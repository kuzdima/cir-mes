# ЦИР MES — Производственная система управления

## Структура проекта

```
cir-local/
├── backend/
│   ├── server.js          — API сервер (Node.js + Express)
│   ├── .env               — Конфигурация (не в Git!)
│   └── package.json
└── frontend/
    ├── index.html          — Главная страница
    ├── css/main.css        — Стили
    └── js/
        ├── api.js          — HTTP запросы, глобальные переменные
        ├── auth.js         — Авторизация
        ├── refs.js         — Справочники, автодополнение
        ├── techops.js      — Архив операций
        ├── archive.js      — База архив изделий
        ├── production.js   — Производство (план по операциям / проектам)
        ├── profile.js      — Личный кабинет
        └── app.js          — Навигация, инициализация
```

## Требования

- Node.js 20+
- PostgreSQL 14+
- PM2 (для продакшена)

## Локальная разработка

```bash
cd backend
cp .env.example .env    # Настройте подключение к БД
npm install
node server.js          # http://localhost:8080
```

## Файл .env

```env
PORT=8080
DB_HOST=localhost
DB_PORT=5432
DB_NAME=cir_mes
DB_USER=cir_user
DB_PASSWORD=ВАШ_ПАРОЛЬ
JWT_SECRET=ВАШ_СЕКРЕТ
```

## Развёртывание на сервер

```bash
cd backend
pm2 start server.js --name cir-mes
pm2 save
```

## Пользователи по умолчанию

| Email | Пароль | Роль |
|-------|--------|------|
| admin@cir.ru | Admin123 | Администратор |
| dispatcher@cir.ru | Dispatch123 | Диспетчер |
| master@cir.ru | Master123 | Мастер |
| technolog@cir.ru | Tech123 | Технолог |
