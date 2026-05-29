/**
 * El More — сервер
 * ──────────────────────────────────────────────────────────
 * Сайт + админка. Контент и загрузки — в Timeweb S3 (продакшен),
 * локальная файловая система — fallback для разработки.
 *
 * Режим определяется по наличию env-переменных S3_BUCKET / S3_ACCESS_KEY / S3_SECRET_KEY.
 * Если они есть — используем S3. Если нет — пишем в локальные файлы.
 */

require('dotenv').config();
const fs       = require('fs');
const path     = require('path');
const express  = require('express');
const session  = require('express-session');
const bcrypt   = require('bcryptjs');
const multer   = require('multer');
const multerS3 = require('multer-s3');
const cookieParser = require('cookie-parser');
const {
  S3Client, GetObjectCommand, PutObjectCommand,
  DeleteObjectCommand, ListObjectsV2Command
} = require('@aws-sdk/client-s3');

const app  = express();
const PORT = parseInt(process.env.PORT || '3000', 10);
const HOST = process.env.HOST || '0.0.0.0';

// ─── S3 ────────────────────────────────────────────────
const S3_ENDPOINT   = process.env.S3_ENDPOINT   || 'https://s3.twcstorage.ru';
const S3_REGION     = process.env.S3_REGION     || 'ru-1';
const S3_BUCKET     = process.env.S3_BUCKET     || '';
const S3_ACCESS_KEY = process.env.S3_ACCESS_KEY || '';
const S3_SECRET_KEY = process.env.S3_SECRET_KEY || '';
const USE_S3 = !!(S3_BUCKET && S3_ACCESS_KEY && S3_SECRET_KEY);

const s3 = USE_S3 ? new S3Client({
  endpoint:    S3_ENDPOINT,
  region:      S3_REGION,
  credentials: { accessKeyId: S3_ACCESS_KEY, secretAccessKey: S3_SECRET_KEY },
  forcePathStyle: true,
}) : null;

const SEED_CONTENT = path.join(__dirname, 'content.json');
const LOCAL_UPLOADS = path.join(__dirname, 'uploads');
const LOCAL_BACKUPS = path.join(__dirname, 'backups');
const CONTENT_KEY   = 'content.json';
const UPLOAD_PREFIX = 'uploads/';
const BACKUP_PREFIX = 'backups/';
const MAX_BACKUPS   = 20;

// формируем публичный URL S3-объекта (Timeweb: path-style + бакет публичный)
const publicUrl = (key) => `${S3_ENDPOINT.replace(/\/$/, '')}/${S3_BUCKET}/${key}`;

// ─── абстракция: контент ───────────────────────────────
let contentCache = null;

async function bootstrapContent() {
  if (USE_S3) {
    try {
      const res = await s3.send(new GetObjectCommand({ Bucket: S3_BUCKET, Key: CONTENT_KEY }));
      const text = await res.Body.transformToString();
      contentCache = JSON.parse(text);
      console.log('  ✓ Контент загружен из S3');
    } catch (e) {
      const notFound = e.name === 'NoSuchKey' || e.$metadata?.httpStatusCode === 404;
      if (notFound) {
        const seed = JSON.parse(fs.readFileSync(SEED_CONTENT, 'utf8'));
        await s3.send(new PutObjectCommand({
          Bucket: S3_BUCKET, Key: CONTENT_KEY,
          Body: JSON.stringify(seed, null, 2),
          ContentType: 'application/json; charset=utf-8',
        }));
        contentCache = seed;
        console.log('  ✓ Стартовый контент загружен в S3');
      } else throw e;
    }
  } else {
    contentCache = JSON.parse(fs.readFileSync(SEED_CONTENT, 'utf8'));
    console.log('  ✓ Контент загружен из файла (S3 не настроен — локальный режим)');
  }
}

const readContent = () => contentCache;

async function writeContent(next) {
  if (USE_S3) {
    // бэкап текущей версии
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    if (contentCache) {
      await s3.send(new PutObjectCommand({
        Bucket: S3_BUCKET, Key: `${BACKUP_PREFIX}content-${ts}.json`,
        Body: JSON.stringify(contentCache, null, 2),
        ContentType: 'application/json; charset=utf-8',
      }));
    }
    // прунинг старых бэкапов
    try {
      const list = await s3.send(new ListObjectsV2Command({
        Bucket: S3_BUCKET, Prefix: BACKUP_PREFIX
      }));
      const items = (list.Contents || []).sort((a, b) => a.Key.localeCompare(b.Key));
      while (items.length > MAX_BACKUPS) {
        const old = items.shift();
        await s3.send(new DeleteObjectCommand({ Bucket: S3_BUCKET, Key: old.Key }));
      }
    } catch (e) {
      console.warn('  ⚠ не удалось обновить список бэкапов:', e.message);
    }
    // новый контент
    await s3.send(new PutObjectCommand({
      Bucket: S3_BUCKET, Key: CONTENT_KEY,
      Body: JSON.stringify(next, null, 2),
      ContentType: 'application/json; charset=utf-8',
    }));
    contentCache = next;
  } else {
    if (!fs.existsSync(LOCAL_BACKUPS)) fs.mkdirSync(LOCAL_BACKUPS, { recursive: true });
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    fs.copyFileSync(SEED_CONTENT, path.join(LOCAL_BACKUPS, `content-${ts}.json`));
    const list = fs.readdirSync(LOCAL_BACKUPS).filter(f => f.startsWith('content-')).sort();
    while (list.length > MAX_BACKUPS) fs.unlinkSync(path.join(LOCAL_BACKUPS, list.shift()));
    fs.writeFileSync(SEED_CONTENT, JSON.stringify(next, null, 2));
    contentCache = next;
  }
}

// ─── multer (S3 или файл) ──────────────────────────────
const imageFilter = (_, file, cb) => {
  if (/^image\/(jpe?g|png|webp|gif|avif)$/.test(file.mimetype)) cb(null, true);
  else cb(new Error('Только изображения (jpeg/png/webp/gif/avif)'));
};
const safeName = (orig) => orig.toLowerCase().replace(/[^a-z0-9.]/g, '-');

let upload;
if (USE_S3) {
  upload = multer({
    storage: multerS3({
      s3,
      bucket: S3_BUCKET,
      acl: 'public-read',
      contentType: multerS3.AUTO_CONTENT_TYPE,
      key: (req, file, cb) => cb(null, `${UPLOAD_PREFIX}${Date.now()}-${safeName(file.originalname)}`),
    }),
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: imageFilter,
  });
} else {
  if (!fs.existsSync(LOCAL_UPLOADS)) fs.mkdirSync(LOCAL_UPLOADS, { recursive: true });
  upload = multer({
    storage: multer.diskStorage({
      destination: (_, __, cb) => cb(null, LOCAL_UPLOADS),
      filename: (_, file, cb) => cb(null, Date.now() + '-' + safeName(file.originalname)),
    }),
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: imageFilter,
  });
}

// ─── middleware ────────────────────────────────────────
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.set('trust proxy', 1);
app.use(cookieParser());
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: process.env.SESSION_SECRET || 'change-me-in-env',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 1000 * 60 * 60 * 24 * 7,
    secure: process.env.NODE_ENV === 'production',
  }
}));

// статика
app.use('/assets', express.static(path.join(__dirname, 'public', 'assets'), { maxAge: '7d' }));
app.use('/admin/static', express.static(path.join(__dirname, 'public', 'admin'), { maxAge: '1d' }));
if (!USE_S3) app.use('/uploads', express.static(LOCAL_UPLOADS, { maxAge: '7d' }));

// auth
const requireAuth = (req, res, next) => {
  if (req.session && req.session.authed) return next();
  if (req.path.startsWith('/admin/api/')) return res.status(401).json({ error: 'unauthorized' });
  return res.redirect('/admin/login');
};
const isAdminHost = (req) => (req.hostname || '').toLowerCase().startsWith('admin.');

// ─── роуты ─────────────────────────────────────────────
app.get('/', (req, res) => {
  if (isAdminHost(req)) return res.redirect('/admin');
  res.render('index', { content: readContent() });
});

app.get('/admin/login', (req, res) => {
  if (req.session.authed) return res.redirect('/admin');
  res.render('admin-login', { error: null });
});

app.post('/admin/login', async (req, res) => {
  const hash = process.env.ADMIN_PASSWORD_HASH;
  if (!hash) return res.render('admin-login', { error: 'Пароль не настроен. Задайте ADMIN_PASSWORD_HASH.' });
  const ok = await bcrypt.compare(req.body.password || '', hash);
  if (!ok) return res.render('admin-login', { error: 'Неверный пароль' });
  req.session.authed = true;
  res.redirect('/admin');
});

app.post('/admin/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/admin/login'));
});

app.get('/admin', requireAuth, (req, res) => {
  res.render('admin-dashboard', { content: readContent() });
});

// API: контент
app.get('/admin/api/content', requireAuth, (req, res) => res.json(readContent()));

app.put('/admin/api/content', requireAuth, async (req, res) => {
  try {
    const next = req.body;
    if (typeof next !== 'object' || Array.isArray(next)) return res.status(400).json({ error: 'invalid payload' });
    await writeContent(next);
    res.json({ ok: true, savedAt: new Date().toISOString() });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// API: загрузка
app.post('/admin/api/upload', requireAuth, upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'no file' });
  const url = USE_S3 ? req.file.location : '/uploads/' + req.file.filename;
  res.json({ url, name: req.file.originalname });
});

// API: список загрузок
app.get('/admin/api/uploads', requireAuth, async (req, res) => {
  try {
    if (USE_S3) {
      const list = await s3.send(new ListObjectsV2Command({
        Bucket: S3_BUCKET, Prefix: UPLOAD_PREFIX
      }));
      const items = (list.Contents || [])
        .filter(o => /\.(jpe?g|png|webp|gif|avif)$/i.test(o.Key))
        .map(o => ({
          url:   publicUrl(o.Key),
          name:  o.Key.replace(UPLOAD_PREFIX, ''),
          size:  o.Size,
          mtime: new Date(o.LastModified).getTime(),
        }))
        .sort((a, b) => b.mtime - a.mtime);
      return res.json(items);
    }
    if (!fs.existsSync(LOCAL_UPLOADS)) return res.json([]);
    const files = fs.readdirSync(LOCAL_UPLOADS)
      .filter(f => /\.(jpe?g|png|webp|gif|avif)$/i.test(f))
      .map(f => {
        const stat = fs.statSync(path.join(LOCAL_UPLOADS, f));
        return { url: '/uploads/' + f, name: f, size: stat.size, mtime: stat.mtimeMs };
      })
      .sort((a, b) => b.mtime - a.mtime);
    res.json(files);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// API: удалить загрузку
app.delete('/admin/api/uploads/:name', requireAuth, async (req, res) => {
  try {
    const name = path.basename(req.params.name);
    if (USE_S3) {
      await s3.send(new DeleteObjectCommand({ Bucket: S3_BUCKET, Key: UPLOAD_PREFIX + name }));
    } else {
      const p = path.join(LOCAL_UPLOADS, name);
      if (fs.existsSync(p)) fs.unlinkSync(p);
    }
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// healthcheck
app.get('/healthz', (req, res) => res.json({ ok: true, ts: Date.now(), s3: USE_S3 }));

// ошибки
app.use((err, req, res, next) => {
  console.error(err);
  if (req.path.startsWith('/admin/api/')) return res.status(500).json({ error: err.message });
  res.status(500).send('Internal error');
});

// ─── старт ─────────────────────────────────────────────
(async () => {
  try {
    await bootstrapContent();
  } catch (e) {
    console.error('  ✗ Не удалось загрузить контент:', e.message);
    process.exit(1);
  }
  app.listen(PORT, HOST, () => {
    console.log(`\n  El More — сервер запущен`);
    console.log(`  ───────────────────────────────`);
    console.log(`  HOST:PORT    ${HOST}:${PORT}`);
    console.log(`  Хранилище    ${USE_S3 ? `Timeweb S3 (${S3_BUCKET})` : 'локальные файлы'}`);
    console.log(`  NODE_ENV     ${process.env.NODE_ENV || 'development'}`);
    if (!process.env.ADMIN_PASSWORD_HASH) {
      console.log(`\n  ⚠  ADMIN_PASSWORD_HASH не задан.`);
      console.log(`     локально:  npm run setpass`);
      console.log(`     в облаке:  задайте переменную в панели Timeweb\n`);
    }
  });
})();
