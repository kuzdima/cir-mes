-- Warehouse tables migration
-- Run once on the database: psql -U cir_user -d cir_mes -f wh_schema.sql

CREATE TABLE IF NOT EXISTS wh_items (
  id          SERIAL PRIMARY KEY,
  name        TEXT NOT NULL,
  material_type TEXT,
  address     TEXT,
  unit        TEXT DEFAULT 'шт',
  qty         NUMERIC(12,3) DEFAULT 0,
  min_qty     NUMERIC(12,3) DEFAULT 0,
  reserved    NUMERIC(12,3) DEFAULT 0,
  comments    TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS wh_movements (
  id           SERIAL PRIMARY KEY,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  operation    TEXT NOT NULL,
  item_id      INT REFERENCES wh_items(id) ON DELETE SET NULL,
  item_name    TEXT NOT NULL,
  qty          NUMERIC(12,3) NOT NULL,
  unit         TEXT,
  warehouse    TEXT,
  address      TEXT,
  supplier     TEXT,
  doc_number   TEXT,
  doc_date     DATE,
  doc_type     TEXT,
  legal_entity TEXT,
  request_ref  TEXT,
  order_ref    TEXT,
  comments     TEXT,
  created_by   INT REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS wh_items_name_idx ON wh_items USING gin(to_tsvector('russian', name));
CREATE INDEX IF NOT EXISTS wh_movements_created_at_idx ON wh_movements(created_at);
CREATE INDEX IF NOT EXISTS wh_movements_item_id_idx ON wh_movements(item_id);
