-- ============================================================
-- ЦИР MES — Схема базы данных
-- Для локальной разработки:
--   psql -U postgres -f schema.sql
-- ============================================================

-- Создание базы и пользователя
-- CREATE DATABASE cir_mes;
-- CREATE USER cir_user WITH PASSWORD 'CirMes2026';

\c cir_mes

-- ============================================================
-- ПОЛЬЗОВАТЕЛИ
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'technologist',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_login TIMESTAMPTZ
);

-- ============================================================
-- СПРАВОЧНИКИ
-- ============================================================
CREATE TABLE IF NOT EXISTS ref_operations (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) UNIQUE NOT NULL
);

CREATE TABLE IF NOT EXISTS ref_machines (
    id SERIAL PRIMARY KEY,
    name TEXT UNIQUE NOT NULL
);

CREATE TABLE IF NOT EXISTS ref_coatings (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) UNIQUE NOT NULL
);

CREATE TABLE IF NOT EXISTS ref_units (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL
);

CREATE TABLE IF NOT EXISTS ref_object_types (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL
);

-- ============================================================
-- АРХИВ ОПЕРАЦИЙ ТЕХНОЛОГА (29 колонок из Excel)
-- ============================================================
CREATE TABLE IF NOT EXISTS tech_operations_archive (
    id SERIAL PRIMARY KEY,
    classifier_code VARCHAR(255) NOT NULL,
    product_name VARCHAR(500) NOT NULL,
    notice_number VARCHAR(100),
    object_type VARCHAR(100),
    material_grade VARCHAR(255),
    assortment TEXT,
    material_amount NUMERIC(10,4),
    unit_of_measure VARCHAR(50),
    coating VARCHAR(255),
    hardness VARCHAR(100),
    full_name VARCHAR(255),
    make_qty NUMERIC(10,3),
    mass_kg NUMERIC(10,4),
    dimensions VARCHAR(255),
    main_order_id VARCHAR(255),
    product_comment TEXT,
    operation_number VARCHAR(20) NOT NULL,
    operation_name VARCHAR(255) NOT NULL,
    executor VARCHAR(255),
    machine_resource TEXT,
    operation_comment TEXT,
    tool TEXT,
    norm_time_hours NUMERIC(8,3),
    batch_prep_hours NUMERIC(8,3),
    load_per_unit_hours NUMERIC(8,3),
    serial_number INTEGER,
    is_outsourcing BOOLEAN DEFAULT FALSE,
    is_final BOOLEAN DEFAULT FALSE,
    is_cnc BOOLEAN DEFAULT FALSE,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- БАЗА АРХИВ ИЗДЕЛИЙ (иерархическая структура)
-- ============================================================
CREATE TABLE IF NOT EXISTS products_archive (
    id SERIAL PRIMARY KEY,
    assembly_id VARCHAR(255),
    struct_id VARCHAR(50) NOT NULL,
    item_name TEXT NOT NULL,
    classifier VARCHAR(255),
    quantity INTEGER DEFAULT 1,
    object_type VARCHAR(100),
    labor_hours NUMERIC(8,3),
    parent_id VARCHAR(50),
    level INTEGER DEFAULT 0,
    serial_order INTEGER,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ПРОИЗВОДСТВО (наряды на производство)
-- ============================================================
CREATE TABLE IF NOT EXISTS production_orders (
    id SERIAL PRIMARY KEY,
    narad_number VARCHAR(100),
    status VARCHAR(50) DEFAULT 'Новый',
    order_number VARCHAR(100),
    customer VARCHAR(255),
    production_start_date DATE,
    operation_number VARCHAR(20),
    is_final BOOLEAN DEFAULT FALSE,
    product_name VARCHAR(500),
    classifier_code VARCHAR(255),
    object_type VARCHAR(100),
    material_ready BOOLEAN DEFAULT FALSE,
    pki_delivery_date DATE,
    material_grade VARCHAR(255),
    assortment TEXT,
    material_amount NUMERIC(10,4),
    unit_of_measure VARCHAR(50),
    operation_name VARCHAR(255),
    machine_resource TEXT,
    operation_comment TEXT,
    quantity INTEGER DEFAULT 1,
    priority INTEGER DEFAULT 3,
    deadline TIMESTAMPTZ,
    not_ready INTEGER DEFAULT 0,
    ready INTEGER DEFAULT 0,
    ready_to_process INTEGER DEFAULT 0,
    defects INTEGER DEFAULT 0,
    load_minutes NUMERIC(10,2) DEFAULT 0,
    plan_minutes NUMERIC(10,2) DEFAULT 0,
    fact_minutes NUMERIC(10,2) DEFAULT 0,
    progress_pct NUMERIC(5,2) DEFAULT 0,
    norm_time_hours NUMERIC(8,3),
    load_per_unit_hours NUMERIC(8,3),
    batch_prep_hours NUMERIC(8,3),
    assembly_id VARCHAR(255),
    serial_number INTEGER,
    workshop_area VARCHAR(255),
    executor VARCHAR(255),
    program_ready_date DATE,
    is_cnc BOOLEAN DEFAULT FALSE,
    request_numbers TEXT,
    product_comment TEXT,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ЗАКАЗЫ
-- ============================================================
CREATE TABLE IF NOT EXISTS orders (
    id SERIAL PRIMARY KEY,
    order_number VARCHAR(100) UNIQUE NOT NULL,
    product_name TEXT NOT NULL,
    customer VARCHAR(255),
    ship_date DATE,
    quantity INTEGER DEFAULT 1,
    product_type VARCHAR(50) DEFAULT 'Стандарт',
    status VARCHAR(50) DEFAULT 'Новый',
    comment TEXT,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- НАРЯДЫ (устаревшая таблица, сохранена для совместимости)
-- ============================================================
CREATE TABLE IF NOT EXISTS work_orders (
    id SERIAL PRIMARY KEY,
    narad_number VARCHAR(100) UNIQUE NOT NULL,
    order_id INTEGER REFERENCES orders(id),
    dse_name TEXT,
    dse_code VARCHAR(255),
    process_type VARCHAR(100),
    machine TEXT,
    operation_number VARCHAR(20),
    is_final BOOLEAN DEFAULT FALSE,
    norm_time_hours NUMERIC(8,3),
    quantity INTEGER DEFAULT 1,
    status VARCHAR(50) DEFAULT 'Новый',
    priority INTEGER DEFAULT 3,
    start_date DATE,
    deadline DATE,
    not_ready INTEGER DEFAULT 0,
    ready INTEGER DEFAULT 0,
    defect INTEGER DEFAULT 0,
    load_min NUMERIC(8,2) DEFAULT 0,
    plan_min NUMERIC(8,2) DEFAULT 0,
    fact_min NUMERIC(8,2) DEFAULT 0,
    pct_done NUMERIC(5,2) DEFAULT 0,
    comment TEXT,
    responsible VARCHAR(255),
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ЛОГ СОБЫТИЙ
-- ============================================================
CREATE TABLE IF NOT EXISTS event_log (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(100),
    entity_id INTEGER,
    details JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ПРАВА ДОСТУПА
-- ============================================================
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO cir_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO cir_user;

-- ============================================================
-- ТЕСТОВЫЕ ПОЛЬЗОВАТЕЛИ
-- Пароли хешированы через bcrypt
-- admin@cir.ru / Admin123
-- dispatcher@cir.ru / Dispatch123
-- master@cir.ru / Master123
-- technolog@cir.ru / Tech123
-- ============================================================