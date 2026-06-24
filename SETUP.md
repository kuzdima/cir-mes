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
```cmd
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
```cmd
set PGCLIENTENCODING=UTF8
"C:\Program Files\PostgreSQL\16\bin\psql.exe" -U postgres -d cir_mes -f schema.sql
```

**Linux:**
```bash
sudo -u postgres psql -d cir_mes -f schema.sql
```

> `schema.sql` в корне проекта — полная актуальная схема БД.

### 3.3. Проверьте что таблицы созданы

```bash
psql -U postgres -d cir_mes -c "\dt"
```

Должно показать 21 таблицу:

| Таблица | Описание |
|---------|----------|
| `users` | Пользователи |
| `tech_operations_archive` | Архив операций технолога |
| `products_archive` | База архив изделий |
| `production_orders` | Наряды на производство |
| `orders` | Заказы |
| `work_orders` | Наряды (устаревшая) |
| `event_log` | Лог событий |
| `ref_operations` | Справочник операций |
| `ref_machines` | Справочник станков |
| `ref_coatings` | Справочник покрытий |
| `ref_units` | Справочник единиц измерения |
| `ref_object_types` | Справочник типов объектов |
| `crm_access` | Доступ к CRM |
| `crm_columns` | Колонки канбан-доски |
| `crm_field_definitions` | Настраиваемые поля карточек |
| `crm_cards` | Карточки |
| `crm_card_field_values` | Значения полей карточек |
| `crm_card_files` | Прикреплённые файлы |
| `crm_card_participants` | Участники карточки |
| `wh_items` | Позиции склада |
| `wh_movements` | Движения склада (приход / расход / перемещение) |

---

## 4. Настройка бэкенда

### 4.1. Создайте файл конфигурации

```bash
cd backend
cp .env.example .env
```

### 4.2. Отредактируйте `.env`

```env
```

> `.env` содержит пароли — он НЕ попадает в Git!

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
| warehouse@cir.ru | Wh123 | Кладовщик |

### Доступные роли

| Роль | Описание |
|------|----------|
| `admin` | Полный доступ, управление пользователями |
| `dispatcher` | Производство, номенклатура |
| `master` | Отметка факта в цехе |
| `technolog` | Архив операций и изделий |
| `warehouse` | Раздел «Склад» |

> Доступ к CRM выдаётся отдельно через **Управление пользователями → CRM** для любой роли.

### Создание пользователя (через админ-панель)

1. Войдите под учётной записью Администратора
2. В боковом меню откройте **«Управление пользователями»**
3. Нажмите **«+ Добавить пользователя»**
4. Заполните имя, email, роль и пароль
5. Нажмите **«Сохранить»**

> Сессия автоматически завершается через **8 часов** — пользователь перенаправляется на страницу авторизации.

---

## 7. Структура проекта

```
cir-mes/
├── backend/
│   ├── server.js          — API сервер (Express + PostgreSQL)
│   ├── warehouse.js       — Роутер раздела «Склад»
│   ├── wh_schema.sql      — Миграция: таблицы склада (wh_items, wh_movements)
│   ├── .env               — Конфигурация (не в Git!)
│   ├── .env.example       — Пример конфигурации
│   ├── package.json       — Зависимости Node.js
│   ├── crm/               — Модуль CRM (канбан-доска)
│   │   ├── cards.js       — CRUD карточек + Socket.IO
│   │   ├── columns.js     — Управление колонками
│   │   ├── fields.js      — Настраиваемые поля + загрузка файлов
│   │   ├── access.js      — Доступ к CRM
│   │   └── users.js       — Список пользователей для доступа
│   └── __tests__/
│       └── crm.test.js    — Интеграционные тесты CRM
│
├── frontend/
│   ├── index.html          — Главная страница (SPA)
│   ├── fact.html           — Мобильная страница отметки факта (QR с маршрутного листа)
│   ├── css/
│   │   ├── main.css        — Базовые стили, тёмная тема, переменные
│   │   ├── warehouse.css   — Раздел «Склад»
│   │   ├── crm.css         — CRM-доска
│   │   ├── fact.css        — Страница отметки факта
│   │   └── fromtags.css    — Стили тегов
│   └── js/
│       ├── api.js          — fetch-обёртка, авторизация, автовыход (8 ч)
│       ├── auth.js         — Вход / выход, восстановление положения после перезагрузки
│       ├── app.js          — Навигация, инициализация
│       ├── refs.js         — Справочники, автодополнение
│       ├── techops.js      — Архив операций
│       ├── archive.js      — База архив изделий
│       ├── nomcatalogue.js — Номенклатура / каталог
│       ├── production.js   — Производство
│       ├── profile.js      — Личный кабинет + управление пользователями
│       ├── warehouse.js    — Раздел «Склад»
│       ├── crm.js          — CRM: доска, карточки, файлы, настройки
│       └── qrcode.js       — Генерация QR-кодов
│
├── schema.sql              — Полная схема БД (актуальная)
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
| POST | `/api/auth/login` | Вход в систему (возвращает JWT, TTL 8 ч) |

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
| GET | `/api/production` | План производства |
| GET | `/api/production/form-data` | Данные для формы наряда |
| GET | `/api/production/detail` | Детали одной операции |
| GET | `/api/production/load-from-archive` | Загрузка операций из архива |
| POST | `/api/production` | Создание наряда |
| POST | `/api/production/fact` | Факт цеха (отметка мастера) |
| POST | `/api/production/status` | Изменение статуса наряда |
| DELETE | `/api/production` | Удаление наряда |

### Склад

| Метод | URL | Описание |
|-------|-----|----------|
| GET | `/api/warehouse/refs` | Справочники (склады, типы материалов) |
| GET | `/api/warehouse/kpis` | KPI-строка |
| GET | `/api/warehouse/items` | Список позиций склада |
| GET | `/api/warehouse/item/:id/history` | История движений по позиции |
| GET | `/api/warehouse/movements` | Журнал движений (`?date=YYYY-MM-DD`) |
| GET | `/api/warehouse/low` | Позиции ниже минимального остатка |
| GET | `/api/warehouse/item-search` | Поиск позиции для движения |
| GET | `/api/warehouse/suppliers` | Список поставщиков |
| GET | `/api/warehouse/orders` | Список заказов для привязки |
| POST | `/api/warehouse/movement` | Создать движение (приход / расход / перемещение) |
| POST | `/api/warehouse/items` | Создать / обновить позицию склада |

### CRM

| Метод | URL | Описание |
|-------|-----|----------|
| GET | `/api/crm/columns` | Список колонок доски |
| POST | `/api/crm/columns` | Создать колонку (admin) |
| PUT | `/api/crm/columns/:id` | Переименовать колонку (admin) |
| DELETE | `/api/crm/columns/:id` | Удалить колонку (admin) |
| GET | `/api/crm/cards` | Все карточки пользователя |
| POST | `/api/crm/cards` | Создать карточку |
| GET | `/api/crm/cards/:id` | Детали карточки |
| PUT | `/api/crm/cards/:id` | Обновить карточку |
| DELETE | `/api/crm/cards/:id` | Удалить карточку |
| POST | `/api/crm/cards/:id/move` | Переместить карточку |
| POST | `/api/crm/cards/:id/participants` | Изменить участников |
| POST | `/api/crm/upload` | Загрузить файл (JPG, PNG, GIF, PDF, DOC, DOCX, XLS, XLSX) |
| DELETE | `/api/crm/files/:id` | Удалить файл |
| GET | `/api/crm/fields` | Список настраиваемых полей |
| POST | `/api/crm/fields` | Создать поле (admin) |
| PUT | `/api/crm/fields/:id` | Изменить поле (admin) |
| DELETE | `/api/crm/fields/:id` | Удалить поле (admin) |
| POST | `/api/crm/fields/:id/restore` | Восстановить удалённое поле (admin) |
| GET | `/api/crm/fields/deleted` | Список удалённых полей |
| GET | `/api/crm/access` | Список пользователей с доступом (admin) |
| POST | `/api/crm/access` | Добавить доступ (admin) |
| DELETE | `/api/crm/access/:userId` | Убрать доступ (admin) |
| GET | `/api/crm/users` | Все пользователи (admin) |

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
SELECT COUNT(*) FROM wh_items;
SELECT COUNT(*) FROM wh_movements;

# Выход
\q
```

### Обновление схемы (после изменений в БД)

**Windows:**
```cmd
"C:\Program Files\PostgreSQL\16\bin\pg_dump.exe" -U postgres -d cir_mes --schema-only > schema.sql
```

**Linux:**
```bash
pg_dump -U postgres -d cir_mes --schema-only > schema.sql
```

---

## Контакты

