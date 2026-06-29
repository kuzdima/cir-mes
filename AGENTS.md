# ЦИР MES — Памятка для OpenCode

## Быстрый старт

```bash
cd backend
npm install
node server.js
# → http://localhost:8080
```

## Команды

| Действие | Команда |
|---|---|
| Установка зависимостей | `cd backend; npm install` |
| Запуск сервера | `cd backend; node server.js` |
| Запуск (готовый скрипт) | `start.bat` |
| Запуск тестов | `cd backend; npm test` (= `node --test`) |
| Один тест по имени | `cd backend; node --test --test-name-pattern="CRM"` |
| Продакшен | `pm2 start server.js --name cir-mes` |

## Тесты

- **Раннер:** встроенный `node:test` (не jest, не mocha).
- **HTTP-клиент:** supertest.
- **Файл:** `backend/__tests__/crm.test.js` (802 строки, только CRM).
- **Требуется PostgreSQL:** тесты подключаются к БД `cir_mes`, создают/удаляют тестовых пользователей и записи.
- `JWT_SECRET` для тестов: `process.env.JWT_SECRET || 'crm-test-secret'`.

## Архитектура

- **Монолит:** один Express-сервер (`backend/server.js`) раздаёт API + статику фронтенда.
- **Фронтенд:** SPA без фреймворка (чистый JS, HTML, CSS), точка входа — `frontend/index.html`.
- **БД:** PostgreSQL 14+. Полная схема — `schema.sql` (корень проекта).
- **Socket.IO** — real-time обновления CRM-доски.
- **JWT-аутентификация** (TTL 8 ч), автовыход на страницу логина.
- **Роли:** `admin`, `dispatcher`, `master`, `technolog`, `warehouse`. Жёстко зашиты в auth middleware.
- **CRM-доступ** назначается отдельно (`crm_access`), не зависит от роли.

## Важные особенности

- `.env` лежит в **`backend/.env`**, а не в корне. `.env.example` — в **корне** проекта.
- `package-lock.json` в `.gitignore` — не коммитится.
- `backend/uploads/` — загрузки файлов (в `.gitignore`, кроме `.gitkeep`).
- Схема БД дампится через: `pg_dump -U postgres -d cir_mes --schema-only > schema.sql`.
- Фронтенд без сборщика: правь напрямую `.html`, `.css`, `.js` в `frontend/`.

## Ключевые файлы

```
backend/
├── server.js          — точка входа, все роуты, auth middleware
├── crm.js             — подключение CRM-модуля
├── crm/               — CRM (cards.js, columns.js, fields.js, access.js, users.js)
├── warehouse_api.js   — API склада
└── __tests__/crm.test.js
frontend/
├── index.html         — SPA-точка входа
└── js/
    ├── api.js         — fetch-обёртка, авторизация, автовыход
    ├── auth.js        — вход/выход, восстановление положения
    ├── app.js         — навигация, инициализация
    ├── crm.js         — CRM-доска
    └── *.js           — прочие модули
```
