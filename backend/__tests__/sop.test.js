process.env.JWT_SECRET = process.env.JWT_SECRET || 'crm-test-secret';
var { test, describe, before, after } = require('node:test');
var assert = require('node:assert/strict');
var request = require('supertest');
var { app, pool } = require('../server');
var bcrypt = require('bcryptjs');
var jwt = require('jsonwebtoken');

var ADMIN_EMAIL = 'sop-test-admin@cir.ru';
var USER_EMAIL = 'sop-test-user@cir.ru';
var PASS = 'Test123';
var adminId, userId, adminToken, userToken;

before(async function () {
  await pool.query("DELETE FROM ai_access WHERE user_id IN (SELECT id FROM users WHERE email LIKE 'sop-test-%')");
  await pool.query("DELETE FROM orders WHERE order_number LIKE 'SOP-TEST-%'");
  await pool.query("DELETE FROM users WHERE email IN ($1,$2)", [ADMIN_EMAIL, USER_EMAIL]);

  var hash = await bcrypt.hash(PASS, 10);

  var r = await pool.query(
    "INSERT INTO users (email,password_hash,first_name,last_name,role,is_active) VALUES ($1,$2,'SOP-Admin','Test','admin',TRUE) RETURNING id",
    [ADMIN_EMAIL, hash]
  );
  adminId = r.rows[0].id;

  var r2 = await pool.query(
    "INSERT INTO users (email,password_hash,first_name,last_name,role,is_active) VALUES ($1,$2,'SOP-User','Test','master',TRUE) RETURNING id",
    [USER_EMAIL, hash]
  );
  userId = r2.rows[0].id;

  adminToken = jwt.sign({ id: adminId, email: ADMIN_EMAIL, role: 'admin', name: 'SOP-Admin Test' }, process.env.JWT_SECRET, { expiresIn: '1h' });
  userToken = jwt.sign({ id: userId, email: USER_EMAIL, role: 'master', name: 'SOP-User Test' }, process.env.JWT_SECRET, { expiresIn: '1h' });

  await pool.query("INSERT INTO ai_access (user_id, feature) VALUES ($1, 'sop') ON CONFLICT DO NOTHING", [adminId]);

  await pool.query(
    "INSERT INTO orders (order_number, product_name, customer, ship_date, quantity, status) VALUES ($1,$2,$3,$4,$5,$6)",
    ['SOP-TEST-001', 'Test Product 1', 'Test Customer', '2026-06-15', 10, 'Новый']
  );
  await pool.query(
    "INSERT INTO orders (order_number, product_name, customer, ship_date, quantity, status) VALUES ($1,$2,$3,$4,$5,$6)",
    ['SOP-TEST-002', 'Test Product 2', 'Test Customer', '2026-07-20', 5, 'Новый']
  );
});

after(async function () {
  await pool.query("DELETE FROM ai_access WHERE user_id IN (SELECT id FROM users WHERE email LIKE 'sop-test-%')");
  await pool.query("DELETE FROM orders WHERE order_number LIKE 'SOP-TEST-%'");
  await pool.query("DELETE FROM users WHERE email IN ($1,$2)", [ADMIN_EMAIL, USER_EMAIL]);
});

describe('S&OP', function () {
  test('401 без токена', async function () {
    var res = await request(app).get('/api/sop/summary');
    assert.equal(res.status, 401);
  });

  test('403 без ai_access sop', async function () {
    var res = await request(app)
      .get('/api/sop/summary')
      .set('Authorization', 'Bearer ' + userToken);
    assert.equal(res.status, 403);
    assert.equal(res.body.ok, false);
  });

  test('admin проходит requireFeature', async function () {
    var res = await request(app)
      .get('/api/sop/summary?from=2026-01-01&to=2026-12-31')
      .set('Authorization', 'Bearer ' + adminToken);
    assert.equal(res.status, 200);
    assert.equal(res.body.ok, true);
  });

  test('GET /api/sop/summary возвращает сводку по месяцам', async function () {
    var res = await request(app)
      .get('/api/sop/summary?from=2026-01-01&to=2026-12-31')
      .set('Authorization', 'Bearer ' + adminToken);
    assert.equal(res.status, 200);
    assert.equal(res.body.ok, true);
    assert.equal(Array.isArray(res.body.months), true);
    assert.equal(res.body.months.length > 0, true);
    var month = res.body.months[0];
    assert.equal(typeof month.month, 'string');
    assert.equal(typeof month.demand, 'object');
    assert.equal(typeof month.supply, 'object');
  });

  test('GET /api/sop/orders возвращает заказы', async function () {
    var res = await request(app)
      .get('/api/sop/orders')
      .set('Authorization', 'Bearer ' + adminToken);
    assert.equal(res.status, 200);
    assert.equal(res.body.ok, true);
    assert.equal(Array.isArray(res.body.rows), true);
    assert.equal(res.body.rows.length >= 2, true);
  });
});
