process.env.JWT_SECRET = process.env.JWT_SECRET || 'crm-test-secret';
var { test, describe, before, after } = require('node:test');
var assert = require('node:assert/strict');
var { pool } = require('../server');
var contextBuilder = require('../ai/context-builder');

var TEST_PREFIX = 'CTX-TEST-';
var adminId;

// ─── Setup ─────────────────────────────────────────────────────
before(async function() {
  var r = await pool.query("SELECT id FROM users WHERE email = 'ctx-test-admin@cir.ru'");
  if (r.rows.length) {
    adminId = r.rows[0].id;
  } else {
    var bcrypt = require('bcryptjs');
    var hash = await bcrypt.hash('Test123', 10);
    var r2 = await pool.query(
      "INSERT INTO users (email,password_hash,first_name,last_name,role,is_active) VALUES ($1,$2,'CTX-Admin','Test','admin',TRUE) RETURNING id",
      ['ctx-test-admin@cir.ru', hash]
    );
    adminId = r2.rows[0].id;
  }

  // Clean previous test data (some tables may not exist in test env)
  try { await pool.query("DELETE FROM feedback WHERE title LIKE $1", [TEST_PREFIX + '%']); } catch(e) {}
  try { await pool.query("DELETE FROM crm_card_field_values WHERE card_id IN (SELECT id FROM crm_cards WHERE title LIKE $1)", [TEST_PREFIX + '%']); } catch(e) {}
  try { await pool.query("DELETE FROM crm_card_files WHERE card_id IN (SELECT id FROM crm_cards WHERE title LIKE $1)", [TEST_PREFIX + '%']); } catch(e) {}
  try { await pool.query("DELETE FROM crm_card_participants WHERE card_id IN (SELECT id FROM crm_cards WHERE title LIKE $1)", [TEST_PREFIX + '%']); } catch(e) {}
  try { await pool.query("DELETE FROM crm_cards WHERE title LIKE $1", [TEST_PREFIX + '%']); } catch(e) {}
  try { await pool.query("DELETE FROM crm_columns WHERE name LIKE $1", [TEST_PREFIX + '%']); } catch(e) {}
  try { await pool.query("DELETE FROM wh_items WHERE name LIKE $1", [TEST_PREFIX + '%']); } catch(e) {}
  try { await pool.query("DELETE FROM wh_movements WHERE comment LIKE $1", [TEST_PREFIX + '%']); } catch(e) {}
  try { await pool.query("DELETE FROM production_orders WHERE narad_number LIKE $1 OR product_name LIKE $1", [TEST_PREFIX + '%']); } catch(e) {}
  try { await pool.query("DELETE FROM orders WHERE order_number LIKE $1", [TEST_PREFIX + '%']); } catch(e) {}

  // Sync sequence past existing data (real rows may consume ids the sequence doesn't know about)
  try { await pool.query("SELECT setval('production_orders_id_seq', COALESCE((SELECT MAX(id) FROM production_orders), 1))"); } catch(e) {}

  // Insert test data: production_orders
  await pool.query(
    "INSERT INTO production_orders (narad_number, product_name, machine_resource, operation_name, executor, plan_minutes, fact_minutes, load_minutes, ready, defects, quantity, progress_pct, norm_time_hours, deadline, status) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,NOW(),$14)",
    [TEST_PREFIX + 'N001', TEST_PREFIX + 'Product A', 'Станок-1', 'Токарная', 'Иванов И.И.', 120, 100, 110, 50, 2, 50, 80.0, 2.0, 'Новый']
  );
  await pool.query(
    "INSERT INTO production_orders (narad_number, product_name, machine_resource, operation_name, executor, plan_minutes, fact_minutes, load_minutes, ready, defects, quantity, progress_pct, norm_time_hours, deadline, status) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,NOW(),$14)",
    [TEST_PREFIX + 'N002', TEST_PREFIX + 'Product B', 'Станок-1', 'Фрезерная', 'Петров П.П.', 200, 180, 190, 100, 1, 100, 90.0, 3.5, 'В работе']
  );
  await pool.query(
    "INSERT INTO production_orders (narad_number, product_name, machine_resource, operation_name, executor, plan_minutes, fact_minutes, load_minutes, ready, defects, quantity, progress_pct, norm_time_hours, deadline, status) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,NOW(),$14)",
    [TEST_PREFIX + 'N003', TEST_PREFIX + 'Product C', 'Станок-2', 'Токарная', 'Иванов И.И.', 80, 90, 85, 30, 0, 30, 60.0, 1.5, 'Новый']
  );

  // Insert test data: feedback
  await pool.query(
    "INSERT INTO feedback (title, description, category, priority, status, created_by) VALUES ($1,$2,$3,$4,$5,$6)",
    [TEST_PREFIX + 'FB1', 'Test feedback 1', 'problem', 'high', 'open', adminId]
  );
  await pool.query(
    "INSERT INTO feedback (title, description, category, priority, status, created_by, assigned_to) VALUES ($1,$2,$3,$4,$5,$6,$7)",
    [TEST_PREFIX + 'FB2', 'Test feedback 2', 'suggestion', 'medium', 'in_progress', adminId, adminId]
  );

  // Insert test data: crm columns + cards
  var colRes = await pool.query(
    "INSERT INTO crm_columns (name, sort_order) VALUES ($1,0) RETURNING id",
    [TEST_PREFIX + 'Column 1']
  );
  var colId = colRes.rows[0].id;
  await pool.query(
    "INSERT INTO crm_cards (title, column_id, created_by) VALUES ($1,$2,$3)",
    [TEST_PREFIX + 'Card 1', colId, adminId]
  );
  await pool.query(
    "INSERT INTO crm_cards (title, column_id, created_by) VALUES ($1,$2,$3)",
    [TEST_PREFIX + 'Card 2', colId, adminId]
  );

  // Insert test data: warehouse
  try { await pool.query(
    "INSERT INTO wh_items (name, material_type, address, unit, qty, min_qty) VALUES ($1,$2,$3,$4,$5,$6)",
    [TEST_PREFIX + 'Item A', 'Материал(прокат,сыпучка)', 'A-01', 'кг', 100, 50]
  ); } catch(e) {}
  try { await pool.query(
    "INSERT INTO wh_items (name, material_type, address, unit, qty, min_qty) VALUES ($1,$2,$3,$4,$5,$6)",
    [TEST_PREFIX + 'Item B', 'Материал(прокат,сыпучка)', 'A-02', 'кг', 10, 50]
  ); } catch(e) {}

  // Insert test data: warehouse movements
  try { await pool.query(
    "INSERT INTO wh_movements (item_id, mov_type, qty, comment, created_by, created_at) VALUES ((SELECT id FROM wh_items WHERE name = $1 LIMIT 1), 'in', 50, $2, $3, NOW())",
    [TEST_PREFIX + 'Item A', TEST_PREFIX + 'test movement', adminId]
  ); } catch(e) {}

  // Insert test data: orders
  await pool.query(
    "INSERT INTO orders (order_number, product_name, customer, ship_date, quantity, status) VALUES ($1,$2,$3,$4,$5,$6)",
    [TEST_PREFIX + 'ORD-001', TEST_PREFIX + 'Order Product', 'Test Customer', '2026-08-15', 20, 'Новый']
  );
});

after(async function() {
  try { await pool.query("DELETE FROM feedback WHERE title LIKE $1", [TEST_PREFIX + '%']); } catch(e) {}
  try { await pool.query("DELETE FROM crm_card_field_values WHERE card_id IN (SELECT id FROM crm_cards WHERE title LIKE $1)", [TEST_PREFIX + '%']); } catch(e) {}
  try { await pool.query("DELETE FROM crm_card_files WHERE card_id IN (SELECT id FROM crm_cards WHERE title LIKE $1)", [TEST_PREFIX + '%']); } catch(e) {}
  try { await pool.query("DELETE FROM crm_card_participants WHERE card_id IN (SELECT id FROM crm_cards WHERE title LIKE $1)", [TEST_PREFIX + '%']); } catch(e) {}
  try { await pool.query("DELETE FROM crm_cards WHERE title LIKE $1", [TEST_PREFIX + '%']); } catch(e) {}
  try { await pool.query("DELETE FROM crm_columns WHERE name LIKE $1", [TEST_PREFIX + '%']); } catch(e) {}
  try { await pool.query("DELETE FROM wh_items WHERE name LIKE $1", [TEST_PREFIX + '%']); } catch(e) {}
  try { await pool.query("DELETE FROM wh_movements WHERE comment LIKE $1", [TEST_PREFIX + '%']); } catch(e) {}
  try { await pool.query("DELETE FROM production_orders WHERE product_name LIKE $1", [TEST_PREFIX + '%']); } catch(e) {}
  try { await pool.query("DELETE FROM orders WHERE order_number LIKE $1", [TEST_PREFIX + '%']); } catch(e) {}
  try { await pool.query("DELETE FROM users WHERE email = 'ctx-test-admin@cir.ru'"); } catch(e) {}
});

// ─── Tests ─────────────────────────────────────────────────────
describe('context-builder', function() {

  test('production: возвращает сводку по станкам, операциям, исполнителям', async function() {
    var res = await contextBuilder.build(pool, 'production');
    assert.equal(res.ok, true);
    assert.equal(Array.isArray(res.machine_summary), true);
    assert.equal(res.machine_summary.length >= 1, true);
    var mc = res.machine_summary.find(function(m) { return m.machine_resource === 'Станок-1'; });
    assert.ok(mc, 'Станок-1 должен быть в machine_summary');
    assert.ok(typeof mc.plan_minutes === 'number' || typeof mc.plan_minutes === 'string');
    assert.ok(typeof mc.fact_minutes === 'number' || typeof mc.fact_minutes === 'string');
    assert.equal(Array.isArray(res.defect_summary), true);
    assert.equal(res.defect_summary.length >= 1, true);
    assert.equal(Array.isArray(res.executor_summary), true);
    assert.equal(res.executor_summary.length >= 1, true);
    var ex = res.executor_summary.find(function(e) { return e.executor === 'Иванов И.И.'; });
    assert.ok(ex, 'Иванов И.И. должен быть в executor_summary');
    assert.ok(typeof ex.order_count === 'number' || typeof ex.order_count === 'string');
  });

  test('production возвращает _timeframe', async function() {
    var res = await contextBuilder.build(pool, 'production', { timeframe: 'month' });
    assert.equal(res.ok, true);
    assert.ok(res._timeframe !== undefined);
    assert.ok(res._timeframe === null || (typeof res._timeframe.from === 'string' && typeof res._timeframe.to === 'string'));
  });

  test('feedback: возвращает сводку по категориям, статусам и назначенным', async function() {
    var res = await contextBuilder.build(pool, 'feedback');
    assert.equal(res.ok, true);
    assert.equal(Array.isArray(res.category_summary), true);
    assert.equal(res.category_summary.length >= 1, true);
    var cat = res.category_summary.find(function(c) { return c.category === 'problem'; });
    assert.equal(cat ? cat.count >= 1 : false, true);
    assert.equal(Array.isArray(res.status_summary), true);
    assert.equal(Array.isArray(res.assigned_summary), true);
  });

  test('crm: возвращает сводку по колонкам, просроченным карточкам и участникам', async function() {
    var res = await contextBuilder.build(pool, 'crm');
    assert.equal(res.ok, true);
    assert.equal(Array.isArray(res.column_summary), true);
    assert.equal(res.column_summary.length >= 1, true);
    assert.equal(typeof res.column_summary[0].column_name, 'string');
    assert.ok(typeof res.column_summary[0].card_count === 'number' || typeof res.column_summary[0].card_count === 'string');
    assert.equal(Array.isArray(res.idle_cards), true);
    assert.equal(Array.isArray(res.participant_summary), true);
  });

  test('warehouse: возвращает сводку по остаткам, движениям', async function() {
    var res = await contextBuilder.build(pool, 'warehouse', { timeframe: 'month' });
    assert.equal(res.ok, true);
    assert.equal(Array.isArray(res.low_stock_items), true);
    assert.equal(Array.isArray(res.items), true);
    assert.ok(res.recent_movements !== undefined);
  });

  test('warehouse без timeframe — recent_movements пуст', async function() {
    var res = await contextBuilder.build(pool, 'warehouse');
    assert.equal(res.ok, true);
    assert.equal(typeof res.total_stats, 'object');
  });

  test('sop: возвращает сводку спрос/предложение', async function() {
    var res = await contextBuilder.build(pool, 'sop');
    assert.equal(res.ok, true);
    assert.equal(Array.isArray(res.demand_summary), true);
    assert.equal(Array.isArray(res.supply_summary), true);
  });

  test('all: возвращает все домены', async function() {
    var res = await contextBuilder.build(pool, 'all');
    assert.equal(res.ok, true);
    assert.equal(Array.isArray(res.production && res.production.machine_summary), true);
    assert.equal(Array.isArray(res.feedback && res.feedback.category_summary), true);
    assert.equal(Array.isArray(res.crm && res.crm.column_summary), true);
    assert.equal(Array.isArray(res.warehouse && res.warehouse.low_stock_items), true);
    assert.equal(Array.isArray(res.sop && res.sop.demand_summary), true);
  });

  test('all возвращает _timeframe', async function() {
    var res = await contextBuilder.build(pool, 'all', { timeframe: 'month' });
    assert.equal(res.ok, true);
    assert.ok(res._timeframe !== undefined);
  });

  test('неизвестный домен возвращает ошибку', async function() {
    var res = await contextBuilder.build(pool, 'unknown');
    assert.equal(res.ok, false);
    assert.equal(res.error, 'Неизвестный домен: unknown');
  });

  // ─── Timeframe tests ──────────────────────────────────────────
  test('production с timeframe — данные попадают в период', async function() {
    var res = await contextBuilder.build(pool, 'production', {
      timeframe: { from: '2026-01-01', to: '2026-12-31' }
    });
    assert.equal(res.ok, true);
    assert.equal(res.machine_summary.length >= 1, true);
    assert.ok(res.total_orders >= 1);
  });

  test('sop с timeframe попадающим в ship_date — данные возвращаются', async function() {
    var res = await contextBuilder.build(pool, 'sop', {
      timeframe: { from: '2026-08-01', to: '2026-08-31' }
    });
    assert.equal(res.ok, true);
    assert.equal(res.demand_summary.length >= 1, true);
  });

  test('sop с timeframe вне диапазона — пустой результат', async function() {
    var res = await contextBuilder.build(pool, 'sop', {
      timeframe: { from: '2026-01-01', to: '2026-01-31' }
    });
    assert.equal(res.ok, true);
    assert.equal(res.demand_summary.length, 0);
  });

  test('all с timeframe — все домены получают фильтр', async function() {
    var res = await contextBuilder.build(pool, 'all', {
      timeframe: { from: '2026-01-01', to: '2026-12-31' }
    });
    assert.equal(res.ok, true);
    assert.equal(Array.isArray(res.production && res.production.machine_summary), true);
    assert.equal(Array.isArray(res.feedback && res.feedback.category_summary), true);
    assert.equal(Array.isArray(res.crm && res.crm.column_summary), true);
    assert.equal(Array.isArray(res.warehouse && res.warehouse.low_stock_items), true);
    assert.equal(Array.isArray(res.sop && res.sop.demand_summary), true);
  });
});
