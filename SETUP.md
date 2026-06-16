# ЦИР MES — Инструкция по развёртыванию

## 1. Требования

- **Node.js** 20+ → https://nodejs.org/
- **PostgreSQL** 14+ → https://www.postgresql.org/download/
- **Git** → https://git-scm.com/

---

## 2. Клонирование проекта

```bash
git clone https://github.com/kuzdima/cir-mes.git
cd cir-mes
```

---

## 3. Настройка базы данных

### 3.1. Создайте базу и пользователя

**Windows (CMD):**
```bash
"C:\Program Files\PostgreSQL\16\bin\psql.exe" -U postgres -c "CREATE DATABASE cir_mes;"
"C:\Program Files\PostgreSQL\16\bin\psql.exe" -U postgres -c "CREATE USER cir_user WITH PASSWORD 'CirMes2026';"
```

**Linux:**
```bash
sudo -u postgres psql -c "CREATE DATABASE cir_mes;"
sudo -u postgres psql -c "CREATE USER cir_user WITH PASSWORD 'CirMes2026';"
```

### 3.2. Создайте таблицы

**Windows:**
```bash
set PGCLIENTENCODING=UTF8
"C:\Program Files\PostgreSQL\16\bin\psql.exe" -U postgres -d cir_mes -f backend\schema.sql
```

**Linux:**
```bash
sudo -u postgres psql -d cir_mes -f backend/schema.sql
```

### 3.3. Проверьте что таблицы созданы

```bash
psql -U postgres -d cir_mes -c "\dt"
```

Должно показать 12 таблиц:
- `users` — пользователи
- `tech_operations_archive` — архив операций технолога
- `products_archive` — база архив изделий
- `production_orders` — наряды на производство
- `orders` — заказы
- `work_orders` — наряды (устаревшая)
- `event_log` — лог событий
- `ref_operations` — справочник операций
- `ref_machines` — справочник станков
- `ref_coatings` — справочник покрытий
- `ref_units` — справочник единиц измерения
- `ref_object_types` — справочник типов объектов

---

## 4. Настройка бэкенда

### 4.1. Создайте файл конфигурации

```bash
cd backend
cp .env.example .env
```

### 4.2. Отредактируйте `.env`


> ⚠️ Файл `.env` содержит пароли — он НЕ попадает в Git!

### 4.3. Установите зависимости

```bash
npm install
```

---

## 5. Запуск

### Локальная разработка

```bash
cd backend
node server.js
```

Откройте: **http://localhost:8080**

### На сервере (продакшен)

```bash
cd backend
pm2 start server.js --name cir-mes
pm2 save
pm2 startup
```

---

## 6. Первый вход

Самостоятельная регистрация пользователей **отключена**. Новых пользователей создаёт только **Администратор** через раздел «Управление пользователями».

### Тестовые пользователи

| Email | Пароль | Роль |
|-------|--------|------|
| admin@cir.ru | Admin123 | Администратор |
| dispatcher@cir.ru | Dispatch123 | Диспетчер |
| master@cir.ru | Master123 | Мастер |
| technolog@cir.ru | Tech123 | Технолог |

### Создание пользователя (через админ-панель)

1. Войдите под учётной записью Администратора
2. В боковом меню откройте **«Управление пользователями»**
3. Нажмите **«+ Добавить пользователя»**
4. Заполните имя, email, роль и пароль
5. Нажмите **«Сохранить»**

Доступные действия с пользователями: изменить данные, сменить пароль, удалить.

---

## 7. Структура проекта

```
cir-mes/
├── backend/
│   ├── server.js          — API сервер (Express + PostgreSQL)
│   ├── schema.sql         — Схема базы данных
│   ├── .env               — Конфигурация (не в Git!)
│   ├── .env.example       — Пример конфигурации
│   └── package.json       — Зависимости Node.js
│
├── frontend/
│   ├── index.html          — Главная страница (SPA)
│   ├── fact.html           — Мобильная страница отметки факта (открывается по QR с маршрутного листа)
│   ├── css/
│   │   └── main.css        — Стили (тёмная тема)
│   └── js/
│       ├── api.js          — HTTP запросы, глобалы, toast
│       ├── auth.js         — Авторизация (вход / выход)
│       ├── refs.js         — Справочники, автодополнение
│       ├── techops.js      — Архив операций
│       ├── archive.js      — База архив изделий
│       ├── production.js   — Производство
│       ├── profile.js      — Личный кабинет + управление пользователями
│       └── app.js          — Навигация, инициализация
│
├── .gitignore
├── .env.example
├── SETUP.md
└── README.md
```

---

## 8. Работа с Git

### Получить последние изменения
```bash
git pull
```

### Создать коммит и отправить
```bash
git add .
git commit -m "Описание изменений"
git push
```

---

## 9. API Endpoints

### Авторизация

| Метод | URL | Описание |
|-------|-----|----------|
| GET | `/api/health` | Проверка соединения с БД |
| POST | `/api/auth/login` | Вход в систему |

### Пользователи (только Администратор)

| Метод | URL | Описание |
|-------|-----|----------|
| GET | `/api/users` | Список всех пользователей |
| POST | `/api/users` | Создать пользователя |
| PUT | `/api/users/:id` | Редактировать пользователя |
| PUT | `/api/users/:id/password` | Сменить пароль пользователя |
| DELETE | `/api/users/:id` | Удалить пользователя |

### Личный кабинет

| Метод | URL | Описание |
|-------|-----|----------|
| GET | `/api/profile/me` | Данные текущего пользователя |
| PUT | `/api/profile` | Обновить свой профиль |
| GET | `/api/profile/my-records` | Мои записи (операции, изделия, наряды) |

### Номенклатура — Архив операций

| Метод | URL | Описание |
|-------|-----|----------|
| GET | `/api/tech-ops` | Список операций |
| GET | `/api/tech-ops/refs` | Справочники |
| GET | `/api/tech-ops/autocomplete` | Автодополнение |
| GET | `/api/tech-ops/search` | Поиск операций |
| POST | `/api/tech-ops` | Добавление операций |
| DELETE | `/api/tech-ops` | Удаление операций (admin) |

### Номенклатура — База архив изделий

| Метод | URL | Описание |
|-------|-----|----------|
| GET | `/api/archive` | Архив изделий |
| GET | `/api/archive/assemblies` | Список головных изделий |
| POST | `/api/archive` | Добавление / обновление структуры |

### Производство

| Метод | URL | Описание |
|-------|-----|----------|
| GET | `/api/production` | План производства (операции и проекты) |
| GET | `/api/production/form-data` | Данные для формы наряда |
| GET | `/api/production/detail` | Детали одной операции |
| GET | `/api/production/load-from-archive` | Загрузка операций из архива |
| POST | `/api/production` | Создание наряда |
| POST | `/api/production/fact` | Факт цеха (отметка мастера) |
| POST | `/api/production/status` | Изменение статуса наряда |
| DELETE | `/api/production` | Удаление наряда |

---

## 10. Развёртывание на сервер

### Подключение
```bash
ssh root@185.41.161.31
```

### Обновление кода
```bash
cd /var/www/cir-mes
git pull
pm2 restart cir-mes
```

### Логи
```bash
pm2 logs cir-mes --lines 50
```

### Статус
```bash
pm2 status
```

---

## 11. Полезные команды PostgreSQL

```bash
# Подключиться к базе
psql -U postgres -d cir_mes

# Список таблиц
\dt

# Количество записей
SELECT COUNT(*) FROM tech_operations_archive;
SELECT COUNT(*) FROM products_archive;
SELECT COUNT(*) FROM production_orders;
SELECT COUNT(*) FROM users;

# Выход
\q
```

---

## Контакты
