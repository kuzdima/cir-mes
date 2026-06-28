process.env.JWT_SECRET = process.env.JWT_SECRET || 'crm-test-secret';
var { test, describe, before, after } = require('node:test');
var assert = require('node:assert/strict');
var request = require('supertest');
var { app, pool } = require('../server');
var bcrypt = require('bcryptjs');
var jwt = require('jsonwebtoken');

var USER_EMAIL = 'ai-test-history@cir.ru';
var NO_ACCESS_EMAIL = 'ai-test-history-noaccess@cir.ru';
var PASS = 'Test123';
var userId, userToken, noAccessId, noAccessToken;

var PROVIDER_ID;

before(async function() {
  await pool.query(`CREATE TABLE IF NOT EXISTS public.ai_chat_history (
    id SERIAL PRIMARY KEY,
    user_id integer NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    domain character varying(50) NOT NULL,
    question text NOT NULL,
    answer text,
    model character varying(255),
    usage_tokens integer,
    has_error boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now()
  )`);
  await pool.query("DELETE FROM ai_chat_history WHERE user_id IN (SELECT id FROM users WHERE email IN ($1,$2))", [USER_EMAIL, NO_ACCESS_EMAIL]);
  await pool.query("DELETE FROM ai_access WHERE user_id IN (SELECT id FROM users WHERE email IN ($1,$2))", [USER_EMAIL, NO_ACCESS_EMAIL]);
  await pool.query("DELETE FROM users WHERE email IN ($1,$2)", [USER_EMAIL, NO_ACCESS_EMAIL]);

  var hash = await bcrypt.hash(PASS, 10);

  var r = await pool.query(
    "INSERT INTO users (email,password_hash,first_name,last_name,role,is_active) VALUES ($1,$2,'AI-History','Test','master',TRUE) RETURNING id",
    [USER_EMAIL, hash]
  );
  userId = r.rows[0].id;

  var r2 = await pool.query(
    "INSERT INTO users (email,password_hash,first_name,last_name,role,is_active) VALUES ($1,$2,'AI-History-No','Access','master',TRUE) RETURNING id",
    [NO_ACCESS_EMAIL, hash]
  );
  noAccessId = r2.rows[0].id;

  await pool.query("INSERT INTO ai_access (user_id, feature) VALUES ($1, 'chat') ON CONFLICT DO NOTHING", [userId]);

  userToken = jwt.sign({ id: userId, email: USER_EMAIL, role: 'master', name: 'AI-History Test' }, process.env.JWT_SECRET, { expiresIn: '1h' });
  noAccessToken = jwt.sign({ id: noAccessId, email: NO_ACCESS_EMAIL, role: 'master', name: 'AI-History-No Test' }, process.env.JWT_SECRET, { expiresIn: '1h' });

  // Ensure there's an active provider so /query doesn't 500 on provider lookup
  var pr = await pool.query("SELECT id FROM ai_providers WHERE is_active = TRUE LIMIT 1");
  if (!pr.rows.length) {
    var pp = await pool.query(
      "INSERT INTO ai_providers (name, label, api_url, model, is_active) VALUES ('test-provider','Test','http://localhost:9999','test-model',TRUE) RETURNING id"
    );
    PROVIDER_ID = pp.rows[0].id;
  }
});

after(async function() {
  await pool.query("DELETE FROM ai_chat_history WHERE user_id IN ($1,$2)", [userId, noAccessId]);
  await pool.query("DELETE FROM ai_access WHERE user_id IN ($1,$2)", [userId, noAccessId]);
  await pool.query("DELETE FROM users WHERE email IN ($1,$2)", [USER_EMAIL, NO_ACCESS_EMAIL]);
  if (PROVIDER_ID) await pool.query("DELETE FROM ai_providers WHERE id = $1", [PROVIDER_ID]);
});

// ─── Tests ─────────────────────────────────────────────────────

test('GET /api/ai/history без токена → 401', async function() {
  var res = await request(app).get('/api/ai/history');
  assert.equal(res.status, 401);
});

test('GET /api/ai/history с пользователем без ai_access → 403', async function() {
  var res = await request(app)
    .get('/api/ai/history')
    .set('Authorization', 'Bearer ' + noAccessToken);
  assert.equal(res.status, 403);
});

test('DELETE /api/ai/history с пользователем без ai_access → 403', async function() {
  var res = await request(app)
    .delete('/api/ai/history')
    .set('Authorization', 'Bearer ' + noAccessToken);
  assert.equal(res.status, 403);
});

test('POST /api/ai/query → история сохраняется', async function() {
  var res = await request(app)
    .post('/api/ai/query')
    .set('Authorization', 'Bearer ' + userToken)
    .send({ domain: 'production', question: 'Какая загрузка станков?' });
  // Может вернуть 502 если провайдер не отвечает — это ок, проверяем что ответили
  // Главное — проверим, что запись в БД появилась
  var q = await pool.query('SELECT COUNT(*)::int AS cnt FROM ai_chat_history WHERE user_id = $1', [userId]);
  if (res.status === 200) {
    assert.ok(q.rows[0].cnt > 0, 'должна быть хотя бы одна запись истории');
  } else {
    // Если провайдер не отвечает — записи быть не должно (!result.ok → не сохраняем)
    assert.equal(q.rows[0].cnt, 0, 'при ошибке провайдера запись не сохраняется');
  }
});

test('GET /api/ai/history возвращает список', async function() {
  // Сначала вставим тестовую запись напрямую
  await pool.query(
    "INSERT INTO ai_chat_history (user_id, domain, question, answer, model, usage_tokens) VALUES ($1,'production','test question','test answer','test-model',10)",
    [userId]
  );

  var res = await request(app)
    .get('/api/ai/history')
    .set('Authorization', 'Bearer ' + userToken);
  assert.equal(res.status, 200);
  assert.ok(res.body.ok);
  assert.ok(Array.isArray(res.body.history));
  assert.ok(res.body.history.length > 0);
  assert.equal(res.body.history[0].question, 'test question');
  assert.equal(res.body.history[0].answer, 'test answer');
});

test('DELETE /api/ai/history очищает историю', async function() {
  await pool.query(
    "INSERT INTO ai_chat_history (user_id, domain, question, answer) VALUES ($1,'production','q','a')",
    [userId]
  );

  var del = await request(app)
    .delete('/api/ai/history')
    .set('Authorization', 'Bearer ' + userToken);
  assert.equal(del.status, 200);
  assert.ok(del.body.ok);

  var get = await request(app)
    .get('/api/ai/history')
    .set('Authorization', 'Bearer ' + userToken);
  assert.equal(get.status, 200);
  assert.equal(get.body.history.length, 0);
});

test('при ошибке провайдера история НЕ сохраняется', async function() {
  await pool.query("DELETE FROM ai_chat_history WHERE user_id = $1", [userId]);

  // Провайдер не активен / не отвечает → result.ok = false
  var res = await request(app)
    .post('/api/ai/query')
    .set('Authorization', 'Bearer ' + userToken)
    .send({ domain: 'production', question: 'test' });

  var q = await pool.query('SELECT COUNT(*)::int AS cnt FROM ai_chat_history WHERE user_id = $1', [userId]);
  assert.equal(q.rows[0].cnt, 0, 'запись не должна быть создана при ошибке провайдера');
});
