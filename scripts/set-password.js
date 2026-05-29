/**
 * Установка пароля админа.
 * Запуск: npm run setpass
 * Сгенерирует bcrypt-хэш и запишет в .env (ADMIN_PASSWORD_HASH).
 */
const fs       = require('fs');
const path     = require('path');
const readline = require('readline');
const bcrypt   = require('bcryptjs');
const crypto   = require('crypto');

const ENV_FILE = path.join(__dirname, '..', '.env');

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (q) => new Promise((res) => rl.question(q, res));

(async () => {
  console.log('\n  El More — настройка пароля админки\n  ──────────────────────────────────');
  const pwd  = await ask('  Новый пароль: ');
  const pwd2 = await ask('  Повторите:    ');
  rl.close();
  if (!pwd || pwd.length < 6) {
    console.error('\n  Пароль должен быть не короче 6 символов.\n');
    process.exit(1);
  }
  if (pwd !== pwd2) {
    console.error('\n  Пароли не совпадают.\n');
    process.exit(1);
  }
  const hash = await bcrypt.hash(pwd, 12);
  let env = '';
  if (fs.existsSync(ENV_FILE)) env = fs.readFileSync(ENV_FILE, 'utf8');

  const upsert = (key, value) => {
    const line = `${key}=${value}`;
    if (new RegExp(`^${key}=`, 'm').test(env)) env = env.replace(new RegExp(`^${key}=.*$`, 'm'), line);
    else env += (env && !env.endsWith('\n') ? '\n' : '') + line + '\n';
  };
  upsert('ADMIN_PASSWORD_HASH', hash);
  if (!/^SESSION_SECRET=/m.test(env)) {
    upsert('SESSION_SECRET', crypto.randomBytes(32).toString('hex'));
  }
  fs.writeFileSync(ENV_FILE, env, 'utf8');
  console.log('\n  ✓ Пароль сохранён в .env\n  ✓ Перезапустите сервер: npm start\n');
})();
