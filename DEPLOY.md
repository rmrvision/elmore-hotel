# Деплой El More на Timeweb Cloud Apps

> **Главное:** файловая система в Apps **эфемерная** — при каждом редеплое
> всё в `/app` пересоздаётся. Если хотите, чтобы правки из админки и
> загруженные картинки сохранялись — **обязательно используйте вариант
> с Dockerfile и постоянным диском (Volume)**.

---

## 0. Подготовка кода

1. Запушьте проект в Git (GitHub / GitLab / Bitbucket):
   ```bash
   git init
   git add .
   git commit -m "El More — initial"
   git remote add origin git@github.com:USERNAME/elmore.git
   git push -u origin main
   ```
2. **Не** коммитьте `.env` (он в `.gitignore`).

---

## Вариант A — Быстрый (Node.js builder, без сохранения данных)

Подходит для **демонстрации**. Любые правки в админке и новые загрузки
**теряются при следующем деплое**, потому что Timeweb пересобирает контейнер.

### Шаги

1. Зайдите в [панель Timeweb Cloud](https://timeweb.cloud/my/apps) → **App Platform → Создать**.
2. **Тип:** Backend → **Фреймворк:** Express (или Node.js).
3. **Репозиторий:** подключите GitHub/GitLab, выберите репозиторий и ветку `main`.
4. **Команда сборки:** `npm install && npm run build`
5. **Команда запуска:** `npm start`
6. **Версия Node.js:** 22.
7. **Переменные окружения** (раздел «Переменные»):
   ```
   NODE_ENV=production
   PORT=3000
   ADMIN_PASSWORD_HASH=<вставьте bcrypt-хэш — см. ниже>
   SESSION_SECRET=<длинная случайная строка>
   ```
8. Создайте приложение. Через 2–4 минуты получите URL вида
   `https://elmore-xxxxx.twc1.net` с автоматическим SSL.

### Где взять `ADMIN_PASSWORD_HASH`

Локально:
```bash
npm install
npm run setpass           # введите пароль — он запишется в .env
cat .env                  # скопируйте значение ADMIN_PASSWORD_HASH=...
```
Или одной командой:
```bash
node -e "console.log(require('bcryptjs').hashSync(process.argv[1], 12))" "ваш-пароль"
```

### Где взять `SESSION_SECRET`

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

---

## Вариант B — Продакшен (Dockerfile + постоянный диск)

Правки из админки и загрузки **сохраняются между деплоями**.

### Шаги

1. В корне репозитория уже лежит `Dockerfile` (приложен в проекте) — он
   монтирует `/data` под пользовательский контент.
2. В панели Timeweb → **App Platform → Создать**.
3. **Тип:** Backend → **Способ деплоя:** Dockerfile.
4. **Репозиторий:** ваш.
5. **Подключите постоянный диск (Volume):**
   - **Размер:** 1–5 ГБ для начала.
   - **Точка монтирования:** `/data`.
6. **Переменные окружения:**
   ```
   NODE_ENV=production
   ADMIN_PASSWORD_HASH=...
   SESSION_SECRET=...
   DATA_DIR=/data
   ```
   `PORT`, `HOST` уже заданы в `Dockerfile`.
7. Создайте приложение.

При первом запуске сервер сам скопирует `content.json` из репозитория
в `/data/content.json` — дальше он будет жить там и переживать редеплои.

---

## Кастомный домен и админка-субдомен

В разделе **«Домены»** вашего приложения в Timeweb:

1. Добавьте основной домен: `elmore.com`.
2. Добавьте субдомен админки: `admin.elmore.com`.
3. У регистратора укажите CNAME-записи на технический домен приложения
   (Timeweb подскажет какой именно).
4. SSL выпустится автоматически через Let's Encrypt.

**Логика субдомена** уже реализована в `server.js`:
- `GET /` на хосте `admin.elmore.com` → редирект на `/admin`.
- На основном хосте → публичный сайт.

Никаких дополнительных настроек на сервере не требуется.

---

## Локальная проверка перед пушем

```bash
npm install
npm run setpass
npm start
```

Сайт: `http://localhost:3000` · Админка: `http://localhost:3000/admin`

Проверка Dockerfile-сборки:
```bash
docker build -t elmore .
docker run -p 3000:3000 \
  -e ADMIN_PASSWORD_HASH='$2a$12$...' \
  -e SESSION_SECRET='...' \
  -v $(pwd)/data:/data \
  elmore
```

---

## Чек-лист перед деплоем

- [ ] Код запушен в Git
- [ ] `.env` **не** в репозитории
- [ ] Заданы `ADMIN_PASSWORD_HASH` и `SESSION_SECRET` в переменных Timeweb
- [ ] `NODE_ENV=production`
- [ ] Для варианта B — подключён `Volume` на `/data` и задан `DATA_DIR=/data`
- [ ] Проверка `https://<домен>/healthz` → должно вернуть `{"ok":true}`
- [ ] Проверка `/admin/login` → форма логина показывается
- [ ] Вход с заданным паролем → попадаете на дашборд

---

## После деплоя

- **Логи:** в панели приложения → «Логи».
- **Откатиться:** в репозитории есть `backups/content-*.json` (последние 20),
  можно вручную восстановить через SSH или через переключение коммитов.
- **Обновить:** просто запушьте в `main` — Timeweb автоматически
  пересоберёт приложение.
