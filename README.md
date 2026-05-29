# El More — сайт + админка

Премиальный сайт-визитка отеля с админкой. Без базы данных — весь контент в `content.json`.

## Запуск локально

```bash
# 1. установить зависимости
npm install

# 2. задать пароль админа (запишется bcrypt-хэш в .env)
npm run setpass

# 3. запустить сервер
npm start
```

После старта:
- **Сайт:** http://localhost:3000
- **Админка:** http://localhost:3000/admin

## Структура

```
├── server.js          ← Express + auth + API
├── content.json       ← весь контент сайта
├── scripts/
│   └── set-password.js
├── views/
│   ├── index.ejs              ← публичный сайт
│   ├── admin-login.ejs        ← страница входа
│   └── admin-dashboard.ejs    ← дашборд админки
└── public/
    ├── assets/site.css        ← стили сайта
    ├── admin/admin.css        ← стили админки
    ├── admin/admin.js         ← логика админки
    └── uploads/               ← загруженные изображения
```

## Что можно редактировать

Слева в админке 10 разделов:

1. **Hero** — заголовки, мета-теги, вступительный текст, главное фото
2. **Философия** — цитата, параграфы, статистика (24 номера / 03 категории / 98%)
3. **Номера** — добавить / удалить категорию, изменить специфику, фото, описание
4. **Галерея** — мозаика из 6 фото + цитаты; добавить/удалить/заменить
5. **Удобства** — 8 плиток с описаниями
6. **Бронирование** — заголовки формы, список категорий в выпадающем списке
7. **Контакты** — адрес, телефон, email
8. **Подвал** — все колонки и ссылки
9. **Шапка** — пункты навигации, бренд, CTA
10. **Медиатека** — все загруженные изображения

## Авторизация

- Пароль хранится как **bcrypt-хэш** в `.env`
- Сессия — HTTP-only cookie (7 дней)
- Чтобы сменить пароль: `npm run setpass`

## Деплой на субдомен

Настройте DNS:
```
elmore.com         A    <ваш IP>
admin.elmore.com   A    <ваш IP>
```

Сервер сам определяет зону по `req.hostname`:
- `admin.*` → редирект на админку
- иначе → публичный сайт

В продакшене поставьте за nginx/caddy с HTTPS:

```nginx
server {
  server_name elmore.com admin.elmore.com;
  listen 443 ssl http2;
  # ssl_certificate / ssl_certificate_key ...
  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

И в `.env`:
```
NODE_ENV=production
```

## Бэкапы

Перед каждой записью `content.json` сервер делает копию в `backups/content-<timestamp>.json`.
Хранятся последние 20 версий — можно откатиться вручную.

## Безопасность

- ✅ Пароль — bcrypt, не plain
- ✅ Сессия — HTTP-only, sameSite=lax
- ✅ Все админ-роуты под `requireAuth`
- ✅ Загрузка только изображений, лимит 10 MB
- ⚠ В продакшене обязательно `NODE_ENV=production` (secure cookies)
- ⚠ Поставьте reverse-proxy с HTTPS
