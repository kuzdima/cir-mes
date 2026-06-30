process.env.JWT_SECRET = process.env.JWT_SECRET || 'crm-test-secret';
var { test, describe, before, after } = require('node:test');
var assert = require('node:assert/strict');
var request = require('supertest');
var { app, pool } = require('../server');
var bcrypt = require('bcryptjs');
var jwt = require('jsonwebtoken');

var ADMIN_EMAIL = 'ai-test-admin@cir.ru';
var USER_EMAIL = 'ai-test-user@cir.ru';
var PASS = 'Test123';
var adminId, userId, adminToken, userToken;
var providerId, providerId2, promptId;

// ─── Setup ─────────────────────────────────────────────────────
before(async function() {
  await pool.query("DELETE FROM ai_access WHERE feature IN ('ai_settings','ai_chat')");
  await pool.query("DELETE FROM ai_prompts WHERE domain LIKE 'ai-test-%'");
  await pool.query("DELETE FROM ai_providers WHERE name LIKE 'ai-test-%'");
  await pool.query("DELETE FROM users WHERE email IN ($1,$2)", [ADMIN_EMAIL, USER_EMAIL]);

  var hash = await bcrypt.hash(PASS, 10);

  var r = await pool.query(
    "INSERT INTO users (email,password_hash,first_name,last_name,role,is_active) VALUES ($1,$2,'AI-Admin','Test','admin',TRUE) RETURNING id",
    [ADMIN_EMAIL, hash]
  );
  adminId = r.rows[0].id;

  var r2 = await pool.query(
    "INSERT INTO users (email,password_hash,first_name,last_name,role,is_active) VALUES ($1,$2,'AI-User','Test','master',TRUE) RETURNING id",
    [USER_EMAIL, hash]
  );
  userId = r2.rows[0].id;

  adminToken = jwt.sign({ id: adminId, email: ADMIN_EMAIL, role: 'admin', name: 'AI-Admin Test' }, process.env.JWT_SECRET, { expiresIn: '1h' });
  userToken = jwt.sign({ id: userId, email: USER_EMAIL, role: 'master', name: 'AI-User Test' }, process.env.JWT_SECRET, { expiresIn: '1h' });
});

after(async function() {
  if (providerId) await pool.query("DELETE FROM ai_providers WHERE id = $1", [providerId]);
  if (providerId2) await pool.query("DELETE FROM ai_providers WHERE id = $1", [providerId2]);
  if (promptId) await pool.query("DELETE FROM ai_prompts WHERE id = $1", [promptId]);
  await pool.query("DELETE FROM ai_providers WHERE name LIKE 'ai-test-%'");
  await pool.query("DELETE FROM ai_prompts WHERE domain LIKE 'ai-test-%'");
  await pool.query("DELETE FROM ai_access WHERE feature IN ('ai_settings','ai_chat')");
  await pool.query("DELETE FROM users WHERE email IN ($1,$2)", [ADMIN_EMAIL, USER_EMAIL]);
});

// ─── Providers ─────────────────────────────────────────────────
describe('AI Providers', function() {

  test('401 без токена', async function() {
    var res = await request(app).get('/api/ai/providers');
    assert.equal(res.status, 401);
  });

  test('403 для не-admin', async function() {
    var res = await request(app)
      .get('/api/ai/providers')
      .set('Authorization', 'Bearer ' + userToken);
    assert.equal(res.status, 403);
  });

  test('POST создать провайдера', async function() {
    var res = await request(app)
      .post('/api/ai/providers')
      .set('Authorization', 'Bearer ' + adminToken)
      .send({ name: 'ai-test-openai', label: 'OpenAI Test', api_url: 'https://api.openai.com/v1', model: 'gpt-4', is_active: true });
    assert.equal(res.status, 200);
    assert.equal(res.body.ok, true);
    assert.equal(res.body.provider.name, 'ai-test-openai');
    providerId = res.body.provider.id;
  });

  test('POST 400 без name', async function() {
    var res = await request(app)
      .post('/api/ai/providers')
      .set('Authorization', 'Bearer ' + adminToken)
      .send({ api_url: 'https://example.com', model: 'test' });
    assert.equal(res.status, 400);
  });

  test('GET список провайдеров', async function() {
    var res = await request(app)
      .get('/api/ai/providers')
      .set('Authorization', 'Bearer ' + adminToken);
    assert.equal(res.status, 200);
    assert.equal(res.body.ok, true);
    assert.equal(Array.isArray(res.body.providers), true);
    assert.equal(res.body.providers.length >= 1, true);
  });

  test('GET /:id провайдера', async function() {
    var res = await request(app)
      .get('/api/ai/providers/' + providerId)
      .set('Authorization', 'Bearer ' + adminToken);
    assert.equal(res.status, 200);
    assert.equal(res.body.ok, true);
    assert.equal(res.body.provider.id, providerId);
  });

  test('PUT обновить провайдера', async function() {
    var res = await request(app)
      .put('/api/ai/providers/' + providerId)
      .set('Authorization', 'Bearer ' + adminToken)
      .send({ label: 'OpenAI Updated', api_url: 'https://api.openai.com/v1/chat' });
    assert.equal(res.status, 200);
    assert.equal(res.body.ok, true);
    assert.equal(res.body.provider.label, 'OpenAI Updated');
  });

  test('DELETE провайдера', async function() {
    var res = await request(app)
      .delete('/api/ai/providers/' + providerId)
      .set('Authorization', 'Bearer ' + adminToken);
    assert.equal(res.status, 200);
    assert.equal(res.body.ok, true);
    // verify deleted
    var res2 = await request(app)
      .get('/api/ai/providers/' + providerId)
      .set('Authorization', 'Bearer ' + adminToken);
    assert.equal(res2.status, 404);
    providerId = null;
  });

  test('POST /:id/activate — 401 без токена', async function() {
    var res = await request(app).post('/api/ai/providers/999/activate');
    assert.equal(res.status, 401);
  });

  test('POST /:id/activate — 403 не-admin', async function() {
    var res = await request(app)
      .post('/api/ai/providers/999/activate')
      .set('Authorization', 'Bearer ' + userToken);
    assert.equal(res.status, 403);
  });

  test('POST /:id/activate — 404 несуществующий', async function() {
    var res = await request(app)
      .post('/api/ai/providers/999999/activate')
      .set('Authorization', 'Bearer ' + adminToken);
    assert.equal(res.status, 404);
  });

  test('POST /:id/activate — активирует и деактивирует других', async function() {
    // create two providers
    var r1 = await request(app)
      .post('/api/ai/providers')
      .set('Authorization', 'Bearer ' + adminToken)
      .send({ name: 'ai-test-prov-a', label: 'A', api_url: 'https://a.example.com', model: 'm1', is_active: false });
    assert.equal(r1.status, 200);
    var p1 = r1.body.provider;
    providerId = p1.id;

    var r2 = await request(app)
      .post('/api/ai/providers')
      .set('Authorization', 'Bearer ' + adminToken)
      .send({ name: 'ai-test-prov-b', label: 'B', api_url: 'https://b.example.com', model: 'm2', is_active: true });
    assert.equal(r2.status, 200);
    var p2 = r2.body.provider;
    providerId2 = p2.id;

    // activate p1 — should deactivate p2
    var act = await request(app)
      .post('/api/ai/providers/' + p1.id + '/activate')
      .set('Authorization', 'Bearer ' + adminToken);
    assert.equal(act.status, 200);
    assert.equal(act.body.ok, true);

    // verify p1 is active
    var g1 = await request(app)
      .get('/api/ai/providers/' + p1.id)
      .set('Authorization', 'Bearer ' + adminToken);
    assert.equal(g1.body.provider.is_active, true);

    // verify p2 is inactive
    var g2 = await request(app)
      .get('/api/ai/providers/' + p2.id)
      .set('Authorization', 'Bearer ' + adminToken);
    assert.equal(g2.body.provider.is_active, false);
  });

  test('POST /:id/test — 401 без токена', async function() {
    var res = await request(app).post('/api/ai/providers/999/test');
    assert.equal(res.status, 401);
  });

  test('POST /:id/test — 403 не-admin', async function() {
    var res = await request(app)
      .post('/api/ai/providers/999/test')
      .set('Authorization', 'Bearer ' + userToken);
    assert.equal(res.status, 403);
  });

  test('POST /:id/test — 404 несуществующий', async function() {
    var res = await request(app)
      .post('/api/ai/providers/999999/test')
      .set('Authorization', 'Bearer ' + adminToken);
    assert.equal(res.status, 404);
  });

  test('GET маскирует api_key звёздочками', async function() {
    // create a provider with key
    var r = await request(app)
      .post('/api/ai/providers')
      .set('Authorization', 'Bearer ' + adminToken)
      .send({ name: 'ai-test-keymask', label: 'KeyMask', api_url: 'https://k.example.com', model: 'm', api_key: 'sk-secret-123', is_active: false });
    assert.equal(r.status, 200);
    var pid = r.body.provider.id;

    var g = await request(app)
      .get('/api/ai/providers/' + pid)
      .set('Authorization', 'Bearer ' + adminToken);
    assert.equal(g.body.provider.api_key, '***');

    var gl = await request(app)
      .get('/api/ai/providers')
      .set('Authorization', 'Bearer ' + adminToken);
    var found = gl.body.providers.find(function(p) { return p.id === pid; });
    assert.equal(found.api_key, '***');

    // cleanup
    await request(app).delete('/api/ai/providers/' + pid).set('Authorization', 'Bearer ' + adminToken);
  });

  test('PUT сохраняет api_key если не передан', async function() {
    // create provider with key
    var r = await request(app)
      .post('/api/ai/providers')
      .set('Authorization', 'Bearer ' + adminToken)
      .send({ name: 'ai-test-keepkey', label: 'KeepKey', api_url: 'https://kk.example.com', model: 'm', api_key: 'sk-keep-456', is_active: false });
    assert.equal(r.status, 200);
    var pid = r.body.provider.id;

    // update without sending api_key
    var u = await request(app)
      .put('/api/ai/providers/' + pid)
      .set('Authorization', 'Bearer ' + adminToken)
      .send({ label: 'Updated' });
    assert.equal(u.status, 200);

    // check key is still stored (via direct DB query)
    var db = await pool.query('SELECT api_key FROM ai_providers WHERE id = $1', [pid]);
    assert.equal(db.rows[0].api_key, 'sk-keep-456');

    // cleanup
    await request(app).delete('/api/ai/providers/' + pid).set('Authorization', 'Bearer ' + adminToken);
  });

  test('POST с config JSONB', async function() {
    var r = await request(app)
      .post('/api/ai/providers')
      .set('Authorization', 'Bearer ' + adminToken)
      .send({ name: 'ai-test-config', label: 'ConfigTest', api_url: 'https://c.example.com', model: 'm', config: { client_id: 'cid', client_secret: 'secret', auth_url: 'https://auth.example.com' } });
    assert.equal(r.status, 200);
    var pid = r.body.provider.id;
    assert.equal(r.body.provider.config.client_id, 'cid');

    // update config
    var u = await request(app)
      .put('/api/ai/providers/' + pid)
      .set('Authorization', 'Bearer ' + adminToken)
      .send({ config: { client_id: 'new-cid' } });
    assert.equal(u.body.provider.config.client_id, 'new-cid');

    // cleanup
    await request(app).delete('/api/ai/providers/' + pid).set('Authorization', 'Bearer ' + adminToken);
  });
});

// ─── Prompts ───────────────────────────────────────────────────
describe('AI Prompts', function() {

  test('401 без токена', async function() {
    var res = await request(app).get('/api/ai/prompts');
    assert.equal(res.status, 401);
  });

  test('403 для не-admin', async function() {
    var res = await request(app)
      .get('/api/ai/prompts')
      .set('Authorization', 'Bearer ' + userToken);
    assert.equal(res.status, 403);
  });

  test('POST создать промпт', async function() {
    var res = await request(app)
      .post('/api/ai/prompts')
      .set('Authorization', 'Bearer ' + adminToken)
      .send({ domain: 'ai-test-sop', name: 'default', prompt_text: 'Analyze orders and production data' });
    assert.equal(res.status, 200);
    assert.equal(res.body.ok, true);
    assert.equal(res.body.prompt.domain, 'ai-test-sop');
    promptId = res.body.prompt.id;
  });

  test('POST 400 без domain', async function() {
    var res = await request(app)
      .post('/api/ai/prompts')
      .set('Authorization', 'Bearer ' + adminToken)
      .send({ prompt_text: 'test' });
    assert.equal(res.status, 400);
  });

  test('GET список промптов', async function() {
    var res = await request(app)
      .get('/api/ai/prompts')
      .set('Authorization', 'Bearer ' + adminToken);
    assert.equal(res.status, 200);
    assert.equal(res.body.ok, true);
    assert.equal(Array.isArray(res.body.prompts), true);
    assert.equal(res.body.prompts.length >= 1, true);
  });

  test('GET /:id промпта', async function() {
    var res = await request(app)
      .get('/api/ai/prompts/' + promptId)
      .set('Authorization', 'Bearer ' + adminToken);
    assert.equal(res.status, 200);
    assert.equal(res.body.ok, true);
    assert.equal(res.body.prompt.id, promptId);
  });

  test('PUT обновить промпт', async function() {
    var res = await request(app)
      .put('/api/ai/prompts/' + promptId)
      .set('Authorization', 'Bearer ' + adminToken)
      .send({ prompt_text: 'Updated analysis prompt' });
    assert.equal(res.status, 200);
    assert.equal(res.body.ok, true);
    assert.equal(res.body.prompt.prompt_text, 'Updated analysis prompt');
  });

  test('GET /active/:domain получает активный промпт (любой авторизованный)', async function() {
    var res = await request(app)
      .get('/api/ai/prompts/active/ai-test-sop')
      .set('Authorization', 'Bearer ' + userToken);
    assert.equal(res.status, 200);
    assert.equal(res.body.ok, true);
    assert.equal(res.body.prompt.domain, 'ai-test-sop');
  });

  test('POST /:id/version создаёт новую версию', async function() {
    var res = await request(app)
      .post('/api/ai/prompts/' + promptId + '/version')
      .set('Authorization', 'Bearer ' + adminToken)
      .send({ prompt_text: 'New version prompt' });
    assert.equal(res.status, 200);
    assert.equal(res.body.ok, true);
    assert.equal(res.body.prompt.version, 2);
    assert.equal(res.body.prompt.prompt_text, 'New version prompt');
    assert.equal(res.body.prompt.is_active, true);
  });

  test('DELETE промпта — 401 без токена', async function() {
    var res = await request(app).delete('/api/ai/prompts/999');
    assert.equal(res.status, 401);
  });

  test('DELETE промпта — 403 не-admin', async function() {
    var res = await request(app)
      .delete('/api/ai/prompts/999')
      .set('Authorization', 'Bearer ' + userToken);
    assert.equal(res.status, 403);
  });

  test('DELETE промпта — 404 несуществующий', async function() {
    var res = await request(app)
      .delete('/api/ai/prompts/999999')
      .set('Authorization', 'Bearer ' + adminToken);
    assert.equal(res.status, 404);
  });

  test('DELETE промпта — успешно', async function() {
    // create a temp prompt
    var r = await request(app)
      .post('/api/ai/prompts')
      .set('Authorization', 'Bearer ' + adminToken)
      .send({ domain: 'ai-test-temp', name: 'temp', prompt_text: 'Temp prompt' });
    assert.equal(r.status, 200);
    var tmpId = r.body.prompt.id;

    var d = await request(app)
      .delete('/api/ai/prompts/' + tmpId)
      .set('Authorization', 'Bearer ' + adminToken);
    assert.equal(d.status, 200);
    assert.equal(d.body.ok, true);

    // verify deleted
    var g = await request(app)
      .get('/api/ai/prompts/' + tmpId)
      .set('Authorization', 'Bearer ' + adminToken);
    assert.equal(g.status, 404);
  });

  test('POST /:id/reset — 401 без токена', async function() {
    var res = await request(app).post('/api/ai/prompts/999/reset');
    assert.equal(res.status, 401);
  });

  test('POST /:id/reset — 403 не-admin', async function() {
    var res = await request(app)
      .post('/api/ai/prompts/999/reset')
      .set('Authorization', 'Bearer ' + userToken);
    assert.equal(res.status, 403);
  });

  test('POST /:id/reset — 404 несуществующий', async function() {
    var res = await request(app)
      .post('/api/ai/prompts/999999/reset')
      .set('Authorization', 'Bearer ' + adminToken);
    assert.equal(res.status, 404);
  });

  test('POST /:id/reset — деактивирует промпт', async function() {
    // create a temp prompt (active by default)
    var r = await request(app)
      .post('/api/ai/prompts')
      .set('Authorization', 'Bearer ' + adminToken)
      .send({ domain: 'ai-test-reset', name: 'reset-test', prompt_text: 'Will be reset' });
    assert.equal(r.status, 200);
    var tmpId = r.body.prompt.id;
    assert.equal(r.body.prompt.is_active, true);

    // reset it
    var reset = await request(app)
      .post('/api/ai/prompts/' + tmpId + '/reset')
      .set('Authorization', 'Bearer ' + adminToken);
    assert.equal(reset.status, 200);
    assert.equal(reset.body.ok, true);

    // verify is_active = false
    var g = await request(app)
      .get('/api/ai/prompts/' + tmpId)
      .set('Authorization', 'Bearer ' + adminToken);
    assert.equal(g.body.prompt.is_active, false);

    // cleanup
    await request(app)
      .delete('/api/ai/prompts/' + tmpId)
      .set('Authorization', 'Bearer ' + adminToken);
  });
});
