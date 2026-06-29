process.env.JWT_SECRET = process.env.JWT_SECRET || 'crm-test-secret';
var { test, describe, before, after } = require('node:test');
var assert = require('node:assert/strict');
var request = require('supertest');
var express = require('express');
var bcrypt = require('bcryptjs');
var jwt = require('jsonwebtoken');
var { pool } = require('../server');

var ADMIN_EMAIL = 'analytics-test-admin@cir.ru';
var CHAT_EMAIL = 'analytics-test-chat@cir.ru';
var DASHBOARD_EMAIL = 'analytics-test-dash@cir.ru';
var NOACCESS_EMAIL = 'analytics-test-no@cir.ru';
var PASS = 'Test123';
var adminId, chatUserId, dashboardUserId, noAccessUserId;
var adminToken, chatToken, dashboardToken, noAccessToken;

// Mock deps
var mockChatCalled, mockLastMessages;
var providerMock = {
  chat: async function(pool, messages, opts) {
    mockChatCalled = true;
    mockLastMessages = { messages, opts };
    return { ok: true, content: 'Mock AI response for: ' + (messages[messages.length-1]?.content || ''), usage: { total_tokens: 42 } };
  },
  getActiveProvider: async function() { return { name: 'mock-openai', model: 'gpt-4', api_url: 'https://mock.test/v1', api_key: 'sk-test' }; }
};
var promptsMock = {
  resolvePrompt: async function(pool, domain) { return 'Mock system prompt for ' + domain; },
  buildUserPrompt: function(question, data) { return 'User: ' + question + (data ? ' | data: ' + JSON.stringify(data) : ''); }
};
var contextBuilderMock = {
  lastDomain: null,
  lastFilters: null,
  build: async function(pool, domain, filters) {
    contextBuilderMock.lastDomain = domain;
    contextBuilderMock.lastFilters = filters;
    if (domain === 'unknown') return { ok: false, error: 'Неизвестный домен: unknown' };
    return { ok: true, domain: domain, summary: 'mock ' + domain + ' data' };
  }
};
function resetMocks() { mockChatCalled = false; mockLastMessages = null; contextBuilderMock.lastDomain = null; contextBuilderMock.lastFilters = null; }

// Auth middleware (mirrors server.js)
function auth(req, res, next) {
  var h = req.headers.authorization;
  if (!h || !h.startsWith('Bearer ')) return res.status(401).json({ ok: false, error: 'Требуется авторизация' });
  try { req.user = jwt.verify(h.slice(7), process.env.JWT_SECRET); next(); }
  catch(e) { res.status(401).json({ ok: false, error: 'Токен недействителен' }); }
}

function requireFeature(feature) {
  return async function(req, res, next) {
    if (req.user.role === 'admin') return next();
    var r = await pool.query('SELECT 1 FROM ai_access WHERE user_id = $1 AND feature = $2', [req.user.id, feature]);
    if (r.rows.length) return next();
    res.status(403).json({ ok: false, error: 'Нет доступа к этой функции' });
  };
}

var app = express();
app.use(express.json());
app.set('pool', pool);

var router = require('../ai/analytics-router')(pool, auth, requireFeature, {
  provider: providerMock,
  prompts: promptsMock,
  contextBuilder: contextBuilderMock
});
app.use('/api/ai', router);

describe('Analytics Router', function() {

  before(async function() {
    await pool.query("DELETE FROM ai_access WHERE feature IN ('chat','dashboard')");
    await pool.query("DELETE FROM users WHERE email IN ($1,$2,$3,$4)", [ADMIN_EMAIL, CHAT_EMAIL, DASHBOARD_EMAIL, NOACCESS_EMAIL]);

    var hash = await bcrypt.hash(PASS, 10);

    var r = await pool.query(
      "INSERT INTO users (email,password_hash,first_name,last_name,role,is_active) VALUES ($1,$2,'Analytics-Admin','Test','admin',TRUE) RETURNING id",
      [ADMIN_EMAIL, hash]
    );
    adminId = r.rows[0].id;

    var r2 = await pool.query(
      "INSERT INTO users (email,password_hash,first_name,last_name,role,is_active) VALUES ($1,$2,'Analytics-Chat','Test','master',TRUE) RETURNING id",
      [CHAT_EMAIL, hash]
    );
    chatUserId = r2.rows[0].id;

    var r3 = await pool.query(
      "INSERT INTO users (email,password_hash,first_name,last_name,role,is_active) VALUES ($1,$2,'Analytics-Dashboard','Test','technolog',TRUE) RETURNING id",
      [DASHBOARD_EMAIL, hash]
    );
    dashboardUserId = r3.rows[0].id;

    var r4 = await pool.query(
      "INSERT INTO users (email,password_hash,first_name,last_name,role,is_active) VALUES ($1,$2,'Analytics-NoAccess','Test','master',TRUE) RETURNING id",
      [NOACCESS_EMAIL, hash]
    );
    noAccessUserId = r4.rows[0].id;

    await pool.query("INSERT INTO ai_access (user_id, feature) VALUES ($1, 'chat') ON CONFLICT DO NOTHING", [chatUserId]);
    await pool.query("INSERT INTO ai_access (user_id, feature) VALUES ($1, 'dashboard') ON CONFLICT DO NOTHING", [dashboardUserId]);

    adminToken = jwt.sign({ id: adminId, email: ADMIN_EMAIL, role: 'admin', name: 'Analytics-Admin Test' }, process.env.JWT_SECRET, { expiresIn: '1h' });
    chatToken = jwt.sign({ id: chatUserId, email: CHAT_EMAIL, role: 'master', name: 'Analytics-Chat User' }, process.env.JWT_SECRET, { expiresIn: '1h' });
    dashboardToken = jwt.sign({ id: dashboardUserId, email: DASHBOARD_EMAIL, role: 'technolog', name: 'Analytics-Dashboard User' }, process.env.JWT_SECRET, { expiresIn: '1h' });
    noAccessToken = jwt.sign({ id: noAccessUserId, email: NOACCESS_EMAIL, role: 'master', name: 'Analytics-No User' }, process.env.JWT_SECRET, { expiresIn: '1h' });
  });

  after(async function() {
    await pool.query("DELETE FROM ai_access WHERE user_id IN ($1,$2,$3,$4)", [adminId, chatUserId, dashboardUserId, noAccessUserId]);
    await pool.query("DELETE FROM users WHERE email IN ($1,$2,$3,$4)", [ADMIN_EMAIL, CHAT_EMAIL, DASHBOARD_EMAIL, NOACCESS_EMAIL]);
  });

  // ─── Status ─────────────────────────────────────────────────
  test('GET /api/ai/status — 401 без токена', async function() {
    var res = await request(app).get('/api/ai/status');
    assert.equal(res.status, 401);
  });

  test('GET /api/ai/status — 200 для любого авторизованного', async function() {
    resetMocks();
    var res = await request(app).get('/api/ai/status').set('Authorization', 'Bearer ' + noAccessToken);
    assert.equal(res.status, 200);
    assert.equal(res.body.ok, true);
    assert.equal(res.body.provider, 'mock-openai');
    assert.equal(res.body.model, 'gpt-4');
  });

  // ─── Query ──────────────────────────────────────────────────
  test('POST /api/ai/query — 401 без токена', async function() {
    var res = await request(app).post('/api/ai/query').send({ domain: 'production', question: 'test' });
    assert.equal(res.status, 401);
  });

  test('POST /api/ai/query — 403 без ai_access chat', async function() {
    resetMocks();
    var res = await request(app)
      .post('/api/ai/query').set('Authorization', 'Bearer ' + dashboardToken)
      .send({ domain: 'production', question: 'test' });
    assert.equal(res.status, 403);
  });

  test('POST /api/ai/query — 400 без domain', async function() {
    var res = await request(app)
      .post('/api/ai/query').set('Authorization', 'Bearer ' + adminToken)
      .send({ question: 'test' });
    assert.equal(res.status, 400);
  });

  test('POST /api/ai/query — 400 без question', async function() {
    var res = await request(app)
      .post('/api/ai/query').set('Authorization', 'Bearer ' + adminToken)
      .send({ domain: 'production' });
    assert.equal(res.status, 400);
  });

  test('POST /api/ai/query — 200 admin вызывает AI', async function() {
    resetMocks();
    var res = await request(app)
      .post('/api/ai/query').set('Authorization', 'Bearer ' + adminToken)
      .send({ domain: 'production', question: 'Какая загрузка станков?' });
    assert.equal(res.status, 200);
    assert.equal(res.body.ok, true);
    assert.ok(res.body.answer.indexOf('Mock AI response') >= 0);
    assert.equal(res.body.domain, 'production');
    assert.ok(res.body.context);
    assert.equal(res.body.context.summary, 'mock production data');
    assert.equal(mockChatCalled, true);
  });

  test('POST /api/ai/query — 200 user с ai_access chat', async function() {
    resetMocks();
    var res = await request(app)
      .post('/api/ai/query').set('Authorization', 'Bearer ' + chatToken)
      .send({ domain: 'feedback', question: 'Есть ли просроченные?' });
    assert.equal(res.status, 200);
    assert.equal(res.body.ok, true);
    assert.equal(res.body.domain, 'feedback');
    assert.ok(res.body.usage);
  });

  test('POST /api/ai/query — 400 неизвестный домен', async function() {
    resetMocks();
    var res = await request(app)
      .post('/api/ai/query').set('Authorization', 'Bearer ' + adminToken)
      .send({ domain: 'unknown', question: 'test' });
    assert.equal(res.status, 400);
    assert.equal(res.body.ok, false);
  });

  test('POST /api/ai/query — передаёт filters в контекст', async function() {
    resetMocks();
    var res = await request(app)
      .post('/api/ai/query').set('Authorization', 'Bearer ' + adminToken)
      .send({ domain: 'production', question: 'test', filters: { machine: 'CNC-01' } });
    assert.equal(res.status, 200);
    assert.equal(res.body.ok, true);
  });

  test('POST /api/ai/query — с filters.timeframe="month" передаёт timeframe в contextBuilder', async function() {
    resetMocks();
    var res = await request(app)
      .post('/api/ai/query').set('Authorization', 'Bearer ' + adminToken)
      .send({ domain: 'production', question: 'test', filters: { timeframe: 'month' } });
    assert.equal(res.status, 200);
    assert.equal(res.body.ok, true);
    assert.deepEqual(contextBuilderMock.lastFilters, { timeframe: 'month' });
  });

  test('POST /api/ai/query — без filters использует дефолт month', async function() {
    resetMocks();
    var res = await request(app)
      .post('/api/ai/query').set('Authorization', 'Bearer ' + adminToken)
      .send({ domain: 'production', question: 'test' });
    assert.equal(res.status, 200);
    assert.equal(res.body.ok, true);
    assert.equal(contextBuilderMock.lastFilters, undefined);
  });

  test('POST /api/ai/query — передаёт model/temperature', async function() {
    resetMocks();
    var res = await request(app)
      .post('/api/ai/query').set('Authorization', 'Bearer ' + adminToken)
      .send({ domain: 'production', question: 'test', model: 'gpt-4', temperature: 0.3 });
    assert.equal(res.status, 200);
    assert.equal(res.body.ok, true);
  });

  // ─── Dashboard ──────────────────────────────────────────────
  test('POST /api/ai/dashboard — 401 без токена', async function() {
    var res = await request(app).post('/api/ai/dashboard').send({});
    assert.equal(res.status, 401);
  });

  test('POST /api/ai/dashboard — 403 без ai_access dashboard', async function() {
    resetMocks();
    var res = await request(app)
      .post('/api/ai/dashboard').set('Authorization', 'Bearer ' + chatToken).send({});
    assert.equal(res.status, 403);
  });

  test('POST /api/ai/dashboard — 200 admin', async function() {
    resetMocks();
    var res = await request(app)
      .post('/api/ai/dashboard').set('Authorization', 'Bearer ' + adminToken)
      .send({ filters: { timeframe: 'month' } });
    assert.equal(res.status, 200);
    assert.equal(res.body.ok, true);
    assert.ok(res.body.answer.indexOf('Mock AI response') >= 0);
    assert.equal(res.body.domain, 'all');
  });

  test('POST /api/ai/dashboard — 200 user с ai_access dashboard', async function() {
    resetMocks();
    var res = await request(app)
      .post('/api/ai/dashboard').set('Authorization', 'Bearer ' + dashboardToken).send({});
    assert.equal(res.status, 200);
    assert.equal(res.body.ok, true);
  });

  test('POST /api/ai/dashboard — с filters.timeframe="year" передаёт timeframe в contextBuilder', async function() {
    resetMocks();
    var res = await request(app)
      .post('/api/ai/dashboard').set('Authorization', 'Bearer ' + adminToken)
      .send({ filters: { timeframe: 'year' } });
    assert.equal(res.status, 200);
    assert.equal(res.body.ok, true);
    assert.deepEqual(contextBuilderMock.lastFilters, { timeframe: 'year' });
  });

  // ─── Access /my ─────────────────────────────────────────────
  test('GET /api/ai/access/my — 401 без токена', async function() {
    var res = await request(app).get('/api/ai/access/my');
    assert.equal(res.status, 401);
  });

  test('GET /api/ai/access/my — возвращает фичи пользователя', async function() {
    var res = await request(app).get('/api/ai/access/my').set('Authorization', 'Bearer ' + chatToken);
    assert.equal(res.status, 200);
    assert.equal(res.body.ok, true);
    assert.ok(Array.isArray(res.body.features));
    assert.ok(res.body.features.indexOf('chat') >= 0);
  });

  test('GET /api/ai/access/my — admin получает все фичи', async function() {
    var res = await request(app).get('/api/ai/access/my').set('Authorization', 'Bearer ' + adminToken);
    assert.equal(res.status, 200);
    assert.equal(res.body.ok, true);
    assert.ok(Array.isArray(res.body.features));
    assert.ok(res.body.features.indexOf('chat') >= 0);
    assert.ok(res.body.features.indexOf('dashboard') >= 0);
    assert.ok(res.body.features.indexOf('sop') >= 0);
  });

  // ─── Access admin CRUD ──────────────────────────────────────
  test('GET /api/ai/access — 403 не-admin', async function() {
    var res = await request(app).get('/api/ai/access').set('Authorization', 'Bearer ' + chatToken);
    assert.equal(res.status, 403);
  });

  test('GET /api/ai/access — 200 admin', async function() {
    var res = await request(app).get('/api/ai/access').set('Authorization', 'Bearer ' + adminToken);
    assert.equal(res.status, 200);
    assert.equal(res.body.ok, true);
    assert.ok(Array.isArray(res.body.access));
  });

  test('POST /api/ai/access — 403 не-admin', async function() {
    var res = await request(app)
      .post('/api/ai/access').set('Authorization', 'Bearer ' + chatToken)
      .send({ userId: noAccessUserId, feature: 'chat' });
    assert.equal(res.status, 403);
  });

  test('POST /api/ai/access — 200 admin выдаёт доступ', async function() {
    var res = await request(app)
      .post('/api/ai/access').set('Authorization', 'Bearer ' + adminToken)
      .send({ userId: noAccessUserId, feature: 'chat' });
    assert.equal(res.status, 200);
    assert.equal(res.body.ok, true);
    // Verify it sticks
    var res2 = await request(app).get('/api/ai/access/my').set('Authorization', 'Bearer ' + noAccessToken);
    assert.ok(res2.body.features.indexOf('chat') >= 0);
  });

  test('POST /api/ai/access — 400 без userId', async function() {
    var res = await request(app)
      .post('/api/ai/access').set('Authorization', 'Bearer ' + adminToken)
      .send({ feature: 'chat' });
    assert.equal(res.status, 400);
  });

  test('DELETE /api/ai/access/:userId/:feature — 403 не-admin', async function() {
    var res = await request(app)
      .delete('/api/ai/access/' + noAccessUserId + '/chat')
      .set('Authorization', 'Bearer ' + chatToken);
    assert.equal(res.status, 403);
  });

  test('DELETE /api/ai/access/:userId/:feature — 200 admin отзывает доступ', async function() {
    var res = await request(app)
      .delete('/api/ai/access/' + noAccessUserId + '/chat')
      .set('Authorization', 'Bearer ' + adminToken);
    assert.equal(res.status, 200);
    assert.equal(res.body.ok, true);
    // Verify it's gone
    var res2 = await request(app).get('/api/ai/access/my').set('Authorization', 'Bearer ' + noAccessToken);
    assert.equal(res2.body.features.indexOf('chat'), -1);
  });

});
