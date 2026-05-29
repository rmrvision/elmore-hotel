/**
 * El More — сервер
 * ────────────────────────────────────────────────────────
 * Публичный сайт + админка без базы данных.
 * Контент хранится в content.json. Изображения — в public/uploads.
 * Авторизация — bcrypt + express-session (HTTP-only cookie).
 * Субдомен admin.* → админка; иначе сайт. На localhost — путь /admin.
 */

require('dotenv').config();
const fs       = require('fs');
const path     = require('path');
const express  = require('express');
const session  = require('express-session');
const bcrypt   = require('bcryptjs');
const multer   = require('multer');
const cookieParser = require('cookie-parser');

const app  = express();
const PORT = parseInt(process.env.PORT || '3000', 10);
const HOST = process.env.HOST || '0.0.0.0';

/**
 * DATA_DIR — каталог для пользовательских данных (контент + загрузки).
 * В Timeweb Apps монтируйте сюда persistent volume (например, /data),
 * иначе данные будут теряться при каждом редеплое.
 * Для локальной разработки по умолчанию используем корень проекта.
 */
const DATA_DIR     = process.env.DATA_DIR || __dirname;
const CONTENT_FILE = path.join(DATA_DIR, 'content.json');
const BACKUPS_DIR  = path.join(DATA_DIR, 'backups');
const UPLOADS_DIR  = path.join(DATA_DIR, 'uploads');
const SEED_CONTENT = path.join(__dirname, 'content.json');

// При первом запуске в чистом томе — копируем стартовый контент из репозитория.
if (!fs.existsSync(CONTENT_FILE)) {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.copyFileSync(SEED_CONTENT, CONTENT_FILE);
}
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

// За reverse-proxy (Timeweb / Cloudflare / nginx) — доверяем заголовкам X-Forwarded-*
app.set('trust proxy', 1);

// --- утилиты -------------------------------------------------------------
const readContent  = () => JSON.parse(fs.readFileSync(CONTENT_FILE, 'utf8'));
const writeContent = (data) => {
  // делаем бэкап перед записью
  if (!fs.existsSync(BACKUPS_DIR)) fs.mkdirSync(BACKUPS_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  fs.copyFileSync(CONTENT_FILE, path.join(BACKUPS_DIR, `content-${stamp}.json`));
  // оставляем последние 20 бэкапов
  const backups = fs.readdirSync(BACKUPS_DIR).filter(f => f.startsWith('content-')).sort();
  while (backups.length > 20) fs.unlinkSync(path.join(BACKUPS_DIR, backups.shift()));
  // запись
  fs.writeFileSync(CONTENT_FILE, JSON.stringify(data, null, 2), 'utf8');
};

// --- middleware ----------------------------------------------------------
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
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
    maxAge: 1000 * 60 * 60 * 24 * 7, // 7 дней
    secure: process.env.NODE_ENV === 'production'
  }
}));

// статика
app.use('/assets', express.static(path.join(__dirname, 'public', 'assets')));
app.use('/uploads', express.static(UPLOADS_DIR, { maxAge: '7d' }));
app.use('/admin/static', express.static(path.join(__dirname, 'public', 'admin')));

// --- multer (загрузка) ---------------------------------------------------
const storage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, UPLOADS_DIR),
  filename: (_, file, cb) => {
    const safe = file.originalname.toLowerCase().replace(/[^a-z0-9.]/g, '-');
    cb(null, Date.now() + '-' + safe);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (_, file, cb) => {
    if (/^image\/(jpeg|png|webp|gif|avif)$/.test(file.mimetype)) cb(null, true);
    else cb(new Error('Только изображения (jpeg/png/webp/gif/avif)'));
  }
});

// --- определение зоны (admin / site) -------------------------------------
const isAdminHost = (req) => {
  const host = (req.hostname || '').toLowerCase();
  return host.startsWith('admin.');
};

// auth-гарды
const requireAuth = (req, res, next) => {
  if (req.session && req.session.authed) return next();
  if (req.path.startsWith('/admin/api/')) return res.status(401).json({ error: 'unauthorized' });
  return res.redirect('/admin/login');
};

// --- роуты сайта ---------------------------------------------------------
app.get('/', (req, res, next) => {
  // если зашли на admin.* → редирект в админку
  if (isAdminHost(req)) return res.redirect('/admin');
  res.render('index', { content: readContent() });
});

// --- админка: логин ------------------------------------------------------
app.get('/admin/login', (req, res) => {
  if (req.session.authed) return res.redirect('/admin');
  res.render('admin-login', { error: null });
});

app.post('/admin/login', async (req, res) => {
  const { password } = req.body;
  const hash = process.env.ADMIN_PASSWORD_HASH;
  if (!hash) {
    return res.render('admin-login', { error: 'Пароль не настроен. Выполните: npm run setpass' });
  }
  const ok = await bcrypt.compare(password || '', hash);
  if (!ok) {
    return res.render('admin-login', { error: 'Неверный пароль' });
  }
  req.session.authed = true;
  res.redirect('/admin');
});

app.post('/admin/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/admin/login'));
});

// --- админка: дашборд (защищён) ------------------------------------------
app.get('/admin', requireAuth, (req, res) => {
  res.render('admin-dashboard', { content: readContent() });
});

// --- API: контент --------------------------------------------------------
app.get('/admin/api/content', requireAuth, (req, res) => {
  res.json(readContent());
});

app.put('/admin/api/content', requireAuth, (req, res) => {
  try {
    const next = req.body;
    if (typeof next !== 'object' || Array.isArray(next)) {
      return res.status(400).json({ error: 'invalid payload' });
    }
    writeContent(next);
    res.json({ ok: true, savedAt: new Date().toISOString() });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'write failed', message: e.message });
  }
});

// --- API: загрузка изображения ------------------------------------------
app.post('/admin/api/upload', requireAuth, upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'no file' });
  res.json({ url: '/uploads/' + req.file.filename, name: req.file.originalname });
});

// --- API: список загруженных --------------------------------------------
app.get('/admin/api/uploads', requireAuth, (req, res) => {
  const files = fs.readdirSync(UPLOADS_DIR)
    .filter(f => /\.(jpe?g|png|webp|gif|avif)$/i.test(f))
    .map(f => {
      const stat = fs.statSync(path.join(UPLOADS_DIR, f));
      return { url: '/uploads/' + f, name: f, size: stat.size, mtime: stat.mtimeMs };
    })
    .sort((a, b) => b.mtime - a.mtime);
  res.json(files);
});

app.delete('/admin/api/uploads/:name', requireAuth, (req, res) => {
  const safe = path.basename(req.params.name);
  const p = path.join(UPLOADS_DIR, safe);
  if (fs.existsSync(p)) fs.unlinkSync(p);
  res.json({ ok: true });
});

// --- обработка ошибок ----------------------------------------------------
app.use((err, req, res, next) => {
  console.error(err);
  if (req.path.startsWith('/admin/api/')) {
    return res.status(500).json({ error: err.message });
  }
  res.status(500).send('Internal error');
});

// healthcheck (для Timeweb / любого uptime-монитора)
app.get('/healthz', (req, res) => res.json({ ok: true, ts: Date.now() }));

// --- старт ---------------------------------------------------------------
app.listen(PORT, HOST, () => {
  console.log(`\n  El More — сервер запущен`);
  console.log(`  ───────────────────────────────`);
  console.log(`  HOST:PORT    ${HOST}:${PORT}`);
  console.log(`  DATA_DIR     ${DATA_DIR}`);
  console.log(`  NODE_ENV     ${process.env.NODE_ENV || 'development'}`);
  if (!process.env.ADMIN_PASSWORD_HASH) {
    console.log(`\n  ⚠  ADMIN_PASSWORD_HASH не задан. Установите его:`);
    console.log(`     локально:  npm run setpass`);
    console.log(`     в облаке:  задайте переменную ADMIN_PASSWORD_HASH в панели\n`);
  }
});
