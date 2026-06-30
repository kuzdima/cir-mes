process.env.JWT_SECRET = process.env.JWT_SECRET || 'crm-test-secret';
var { test, describe, before, after } = require('node:test');
var assert = require('node:assert/strict');
var request = require('supertest');
var { app, pool } = require('../server');
var bcrypt = require('bcryptjs');
var jwt = require('jsonwebtoken');
var fs = require('fs');
var path = require('path');

var ADMIN_EMAIL = 'fb-test-admin@cir.ru';
var DISP_EMAIL  = 'fb-test-disp@cir.ru';
var USER_EMAIL  = 'fb-test-user@cir.ru';
var PASS = 'Test123';
var adminId = null;
var dispId = null;
var userId = null;
var adminToken = null;
var dispToken = null;
var userToken = null;

var fbId = null;

before(async function() {
  await pool.query('DELETE FROM feedback WHERE title LIKE $1', ['FB-Test-%']);
  await pool.query("DELETE FROM users WHERE email IN ($1,$2,$3)", [ADMIN_EMAIL, DISP_EMAIL, USER_EMAIL]);

  var hash = await bcrypt.hash(PASS, 10);

  var r = await pool.query(
    "INSERT INTO users (email,password_hash,first_name,last_name,role,is_active) VALUES ($1,$2,'FB-Admin','Test','admin',TRUE) ON CONFLICT (email) DO UPDATE SET role='admin' RETURNING id",
    [ADMIN_EMAIL, hash]
  );
  adminId = r.rows[0].id;

  var r2 = await pool.query(
    "INSERT INTO users (email,password_hash,first_name,last_name,role,is_active) VALUES ($1,$2,'FB-Disp','Test','dispatcher',TRUE) ON CONFLICT (email) DO UPDATE SET role='dispatcher' RETURNING id",
    [DISP_EMAIL, hash]
  );
  dispId = r2.rows[0].id;

  var r3 = await pool.query(
    "INSERT INTO users (email,password_hash,first_name,last_name,role,is_active) VALUES ($1,$2,'FB-User','Test','master',TRUE) ON CONFLICT (email) DO UPDATE SET role='master' RETURNING id",
    [USER_EMAIL, hash]
  );
  userId = r3.rows[0].id;

  adminToken = jwt.sign({ id: adminId, email: ADMIN_EMAIL, role: 'admin', name: 'FB-Admin Test' }, process.env.JWT_SECRET, { expiresIn: '1h' });
  dispToken   = jwt.sign({ id: dispId, email: DISP_EMAIL, role: 'dispatcher', name: 'FB-Disp Test' }, process.env.JWT_SECRET, { expiresIn: '1h' });
  userToken   = jwt.sign({ id: userId, email: USER_EMAIL, role: 'master', name: 'FB-User Test' }, process.env.JWT_SECRET, { expiresIn: '1h' });

  // Give test dispatcher feedback_access so existing Role Access tests work
  await pool.query('INSERT INTO feedback_access (user_id) VALUES ($1) ON CONFLICT DO NOTHING', [dispId]);
});

after(async function() {
  await pool.query('DELETE FROM feedback_access WHERE user_id IN ($1,$2,$3)', [adminId, dispId, userId]);
  await pool.query('DELETE FROM feedback WHERE title LIKE $1', ['FB-Test-%']);
  await pool.query("DELETE FROM users WHERE id IN ($1,$2,$3)", [adminId, dispId, userId]);
});

// ─── Auth ───────────────────────────────────────────────────────
describe('Auth', function() {
  test('401 без токена', async function() {
    var res = await request(app).get('/api/feedback');
    assert.equal(res.status, 401);
    assert.equal(res.body.ok, false);
  });

  test('401 с невалидным токеном', async function() {
    var res = await request(app).get('/api/feedback').set('Authorization', 'Bearer invalid');
    assert.equal(res.status, 401);
    assert.equal(res.body.ok, false);
  });
});

// ─── Feedback CRUD ──────────────────────────────────────────────
describe('Feedback CRUD', function() {
  test('POST создать обращение', async function() {
    var res = await request(app)
      .post('/api/feedback')
      .set('Authorization', 'Bearer ' + userToken)
      .send({ title: 'FB-Test-Проблема', description: 'FB-Test-Описание проблемы для проверки', category: 'problem', priority: 'high' });
    assert.equal(res.status, 200);
    assert.equal(res.body.ok, true);
    assert.equal(typeof res.body.id, 'number');
    fbId = res.body.id;
  });

  test('POST 400 при пустом заголовке', async function() {
    var res = await request(app)
      .post('/api/feedback')
      .set('Authorization', 'Bearer ' + userToken)
      .send({ title: 'ab', description: 'FB-Test-Описание' });
    assert.equal(res.status, 400);
    assert.equal(res.body.ok, false);
  });

  test('POST 400 при коротком описании', async function() {
    var res = await request(app)
      .post('/api/feedback')
      .set('Authorization', 'Bearer ' + userToken)
      .send({ title: 'FB-Test-Заголовок', description: 'коротко' });
    assert.equal(res.status, 400);
    assert.equal(res.body.ok, false);
  });

  test('GET список содержит созданное обращение', async function() {
    var res = await request(app).get('/api/feedback').set('Authorization', 'Bearer ' + adminToken);
    assert.equal(res.status, 200);
    assert.equal(res.body.ok, true);
    var found = res.body.rows.filter(function(r) { return r.id === fbId; });
    assert.equal(found.length, 1);
    assert.equal(found[0].title, 'FB-Test-Проблема');
    assert.equal(found[0].category, 'problem');
    assert.equal(found[0].priority, 'high');
    assert.equal(found[0].status, 'open');
  });

  test('GET /:id возвращает детали', async function() {
    var res = await request(app).get('/api/feedback/' + fbId).set('Authorization', 'Bearer ' + adminToken);
    assert.equal(res.status, 200);
    assert.equal(res.body.ok, true);
    assert.equal(res.body.row.id, fbId);
    assert.equal(res.body.row.title, 'FB-Test-Проблема');
    assert.ok(res.body.row.created_by);
    assert.equal(typeof res.body.row.created_by.name, 'string');
  });

  test('PUT обновить статус и назначить ответственного', async function() {
    var res = await request(app)
      .put('/api/feedback/' + fbId)
      .set('Authorization', 'Bearer ' + adminToken)
      .send({ status: 'in_progress', assigned_to: dispId });
    assert.equal(res.status, 200);
    assert.equal(res.body.ok, true);

    var check = await request(app).get('/api/feedback/' + fbId).set('Authorization', 'Bearer ' + adminToken);
    assert.equal(check.body.row.status, 'in_progress');
    assert.equal(check.body.row.assigned_to.id, dispId);
  });

  test('PUT resolved устанавливает resolved_at', async function() {
    var res = await request(app)
      .put('/api/feedback/' + fbId)
      .set('Authorization', 'Bearer ' + adminToken)
      .send({ status: 'resolved', resolution: 'FB-Test-Исправлено' });
    assert.equal(res.status, 200);

    var check = await request(app).get('/api/feedback/' + fbId).set('Authorization', 'Bearer ' + adminToken);
    assert.equal(check.body.row.status, 'resolved');
    assert.equal(check.body.row.resolution, 'FB-Test-Исправлено');
    assert.ok(check.body.row.resolved_at);
  });

  test('DELETE удаляет обращение', async function() {
    var res = await request(app).delete('/api/feedback/' + fbId).set('Authorization', 'Bearer ' + adminToken);
    assert.equal(res.status, 200);
    assert.equal(res.body.ok, true);

    var check = await request(app).get('/api/feedback/' + fbId).set('Authorization', 'Bearer ' + adminToken);
    assert.equal(check.status, 404);
  });
});

// ─── Role Access ────────────────────────────────────────────────
describe('Role Access', function() {
  var rid = null;

  before(async function() {
    var r = await request(app)
      .post('/api/feedback')
      .set('Authorization', 'Bearer ' + userToken)
      .send({ title: 'FB-Test-Role', description: 'FB-Test-Описание для проверки ролей', category: 'suggestion' });
    rid = r.body.id;
  });

  test('admin может удалять', async function() {
    var res = await request(app).delete('/api/feedback/' + rid).set('Authorization', 'Bearer ' + adminToken);
    assert.equal(res.status, 200);
  });

  test('dispatcher может обновлять (менять статус)', async function() {
    var r = await request(app)
      .post('/api/feedback')
      .set('Authorization', 'Bearer ' + userToken)
      .send({ title: 'FB-Test-Role2', description: 'FB-Test-Описание для диспетчера', category: 'improvement' });
    var tmpId = r.body.id;

    var res = await request(app)
      .put('/api/feedback/' + tmpId)
      .set('Authorization', 'Bearer ' + dispToken)
      .send({ status: 'resolved', resolution: 'FB-Test-OK' });
    assert.equal(res.status, 200);
  });

  test('dispatcher НЕ может удалять', async function() {
    var r = await request(app)
      .post('/api/feedback')
      .set('Authorization', 'Bearer ' + userToken)
      .send({ title: 'FB-Test-Role3', description: 'FB-Test-Описание удаление диспетчер', category: 'problem' });
    var tmpId = r.body.id;

    var res = await request(app).delete('/api/feedback/' + tmpId).set('Authorization', 'Bearer ' + dispToken);
    assert.equal(res.status, 403);
  });

  test('master НЕ может обновлять', async function() {
    var r = await request(app)
      .post('/api/feedback')
      .set('Authorization', 'Bearer ' + userToken)
      .send({ title: 'FB-Test-Role4', description: 'FB-Test-Описание мастер обновление', category: 'problem' });
    var tmpId = r.body.id;

    var res = await request(app)
      .put('/api/feedback/' + tmpId)
      .set('Authorization', 'Bearer ' + userToken)
      .send({ status: 'resolved' });
    assert.equal(res.status, 403);
  });

  test('master НЕ может удалять', async function() {
    var r = await request(app)
      .post('/api/feedback')
      .set('Authorization', 'Bearer ' + userToken)
      .send({ title: 'FB-Test-Role5', description: 'FB-Test-Описание мастер удаление', category: 'problem' });
    var tmpId = r.body.id;

    var res = await request(app).delete('/api/feedback/' + tmpId).set('Authorization', 'Bearer ' + userToken);
    assert.equal(res.status, 403);
  });
});

// ─── Isolation ──────────────────────────────────────────────────
describe('Isolation', function() {
  test('master видит только свои обращения', async function() {
    var r = await request(app)
      .post('/api/feedback')
      .set('Authorization', 'Bearer ' + userToken)
      .send({ title: 'FB-Test-Isol-User', description: 'FB-Test-Описание юзер', category: 'problem' });

    var r2 = await request(app)
      .post('/api/feedback')
      .set('Authorization', 'Bearer ' + adminToken)
      .send({ title: 'FB-Test-Isol-Admin', description: 'FB-Test-Описание админ', category: 'suggestion' });

    var list = await request(app).get('/api/feedback').set('Authorization', 'Bearer ' + userToken);
    assert.equal(list.status, 200);
    var titles = list.body.rows.map(function(r) { return r.title; });
    assert.ok(titles.indexOf('FB-Test-Isol-User') !== -1);
    assert.equal(titles.indexOf('FB-Test-Isol-Admin'), -1);
  });

  test('admin видит все обращения', async function() {
    var list = await request(app).get('/api/feedback').set('Authorization', 'Bearer ' + adminToken);
    var titles = list.body.rows.map(function(r) { return r.title; });
    assert.ok(titles.indexOf('FB-Test-Isol-User') !== -1);
    assert.ok(titles.indexOf('FB-Test-Isol-Admin') !== -1);
  });
});

// ─── Filters ────────────────────────────────────────────────────
describe('Filters', function() {
  test('фильтр по категории', async function() {
    var res = await request(app).get('/api/feedback?category=suggestion').set('Authorization', 'Bearer ' + adminToken);
    assert.equal(res.status, 200);
    res.body.rows.forEach(function(r) { assert.equal(r.category, 'suggestion'); });
  });

  test('фильтр по статусу', async function() {
    var res = await request(app).get('/api/feedback?status=open,in_progress').set('Authorization', 'Bearer ' + adminToken);
    assert.equal(res.status, 200);
    res.body.rows.forEach(function(r) { assert.ok(r.status === 'open' || r.status === 'in_progress'); });
  });

  test('фильтр по приоритету', async function() {
    var res = await request(app).get('/api/feedback?priority=high').set('Authorization', 'Bearer ' + adminToken);
    assert.equal(res.status, 200);
    res.body.rows.forEach(function(r) { assert.equal(r.priority, 'high'); });
  });

  test('поиск по ?q=', async function() {
    var res = await request(app).get('/api/feedback?q=Isol-User').set('Authorization', 'Bearer ' + adminToken);
    assert.equal(res.status, 200);
    assert.ok(res.body.rows.length > 0);
    res.body.rows.forEach(function(r) {
      assert.ok(r.title.indexOf('Isol-User') !== -1 || r.description.indexOf('Isol-User') !== -1);
    });
  });

  test('дефолтный фильтр — только открытые', async function() {
    var res = await request(app).get('/api/feedback').set('Authorization', 'Bearer ' + adminToken);
    res.body.rows.forEach(function(r) {
      assert.ok(r.status === 'open' || r.status === 'in_progress');
    });
  });
});

// ─── Count ──────────────────────────────────────────────────────
describe('Count', function() {
  test('admin видит все open', async function() {
    var res = await request(app).get('/api/feedback/count').set('Authorization', 'Bearer ' + adminToken);
    assert.equal(res.status, 200);
    assert.equal(typeof res.body.open, 'number');
    assert.ok(res.body.open >= 0);
  });

  test('master видит только свои open', async function() {
    var res = await request(app).get('/api/feedback/count').set('Authorization', 'Bearer ' + userToken);
    assert.equal(res.status, 200);
    assert.equal(typeof res.body.open, 'number');
    assert.ok(res.body.open >= 0);
  });

  test('dispatcher видит все open', async function() {
    var res = await request(app).get('/api/feedback/count').set('Authorization', 'Bearer ' + dispToken);
    assert.equal(res.status, 200);
    assert.equal(typeof res.body.open, 'number');
    assert.ok(res.body.open >= 0);
  });
});

// ─── Access ──────────────────────────────────────────────────────
describe('Access', function() {
  var testUserId = null;
  var testUserToken = null;

  before(async function() {
    var hash = await bcrypt.hash('Test123', 10);
    var r = await pool.query(
      "INSERT INTO users (email,password_hash,first_name,last_name,role,is_active) VALUES ('fb-access-test@cir.ru',$1,'FB-Access','Test','technolog',TRUE) ON CONFLICT (email) DO UPDATE SET role='technolog' RETURNING id",
      [hash]
    );
    testUserId = r.rows[0].id;
    testUserToken = jwt.sign({ id: testUserId, email: 'fb-access-test@cir.ru', role: 'technolog', name: 'FB-Access Test' }, process.env.JWT_SECRET, { expiresIn: '1h' });
  });

  after(async function() {
    await pool.query('DELETE FROM feedback_access WHERE user_id = $1', [testUserId]);
    await pool.query('DELETE FROM feedback WHERE created_by = $1', [testUserId]);
    await pool.query('DELETE FROM users WHERE id = $1', [testUserId]);
  });

  test('GET /access 403 для не-admin', async function() {
    var res = await request(app).get('/api/feedback/access').set('Authorization', 'Bearer ' + userToken);
    assert.equal(res.status, 403);
  });

  test('POST /access добавить пользователя', async function() {
    var res = await request(app)
      .post('/api/feedback/access')
      .set('Authorization', 'Bearer ' + adminToken)
      .send({ user_id: testUserId });
    assert.equal(res.status, 200);
    assert.equal(res.body.ok, true);
  });

  test('GET /access содержит пользователя', async function() {
    var res = await request(app).get('/api/feedback/access').set('Authorization', 'Bearer ' + adminToken);
    assert.equal(res.status, 200);
    var found = res.body.rows.some(function(r) { return r.id === testUserId; });
    assert.ok(found);
  });

  test('DELETE /access/:userId убрать доступ', async function() {
    var res = await request(app).delete('/api/feedback/access/' + testUserId).set('Authorization', 'Bearer ' + adminToken);
    assert.equal(res.status, 200);
    assert.equal(res.body.ok, true);
  });

  test('после удаления доступа — нет в списке', async function() {
    var res = await request(app).get('/api/feedback/access').set('Authorization', 'Bearer ' + adminToken);
    assert.equal(res.status, 200);
    var found = res.body.rows.some(function(r) { return r.id === testUserId; });
    assert.ok(!found);
  });

  test('GET /users/all 403 для не-admin', async function() {
    var res = await request(app).get('/api/feedback/users/all').set('Authorization', 'Bearer ' + userToken);
    assert.equal(res.status, 403);
  });

  test('GET /users/all (admin) возвращает всех пользователей', async function() {
    var res = await request(app).get('/api/feedback/users/all').set('Authorization', 'Bearer ' + adminToken);
    assert.equal(res.status, 200);
    assert.ok(res.body.rows.length > 0);
  });

  test('technolog без feedback_access не может обновлять', async function() {
    // Re-grant access to testUserId first, then revoke to test
    await pool.query('INSERT INTO feedback_access (user_id) VALUES ($1) ON CONFLICT DO NOTHING', [testUserId]);

    var fb = await request(app)
      .post('/api/feedback')
      .set('Authorization', 'Bearer ' + testUserToken)
      .send({ title: 'FB-Test-Access-Upd', description: 'FB-Test-Описание для проверки доступа', category: 'problem' });

    // Revoke access
    await pool.query('DELETE FROM feedback_access WHERE user_id = $1', [testUserId]);

    var res = await request(app)
      .put('/api/feedback/' + fb.body.id)
      .set('Authorization', 'Bearer ' + testUserToken)
      .send({ status: 'in_progress' });
    assert.equal(res.status, 403);
  });
});

// ─── Files ──────────────────────────────────────────────────────
describe('Files', function() {
  var fbFileId = null;

  before(async function() {
    var r = await request(app)
      .post('/api/feedback')
      .set('Authorization', 'Bearer ' + userToken)
      .send({ title: 'FB-Test-File', description: 'FB-Test-Описание для проверки файла', category: 'problem' });
    fbFileId = r.body.id;
  });

  test('загрузка PNG (200)', async function() {
    var png = Buffer.from([137,80,78,71,13,10,26,10,0,0,0,13,73,72,68,82,0,0,0,1,0,0,0,1,8,2,0,0,0,144,119,83,222,0,0,0,12,73,68,65,84,8,215,99,248,207,0,0,0,2,0,1,226,135,177,0,0,0,0,73,69,78,68,174,66,96,130]);
    var res = await request(app)
      .post('/api/feedback/upload')
      .set('Authorization', 'Bearer ' + adminToken)
      .field('feedback_id', String(fbFileId))
      .attach('file', png, 'test.png');
    assert.equal(res.status, 200);
    assert.equal(res.body.ok, true);
    assert.ok(res.body.file_path);

    var check = await request(app).get('/api/feedback/' + fbFileId).set('Authorization', 'Bearer ' + adminToken);
    assert.equal(check.body.row.file_path, res.body.file_path);
    assert.equal(check.body.row.original_name, 'test.png');

    var fullPath = path.join(__dirname, '..', 'uploads', check.body.row.file_path);
    assert.ok(fs.existsSync(fullPath));
  });

  test('русское имя файла: original_name', async function() {
    var cr = await request(app)
      .post('/api/feedback')
      .set('Authorization', 'Bearer ' + adminToken)
      .send({ title: 'FB-Test-Rus', description: 'FB-Test-Описание для русского имени', category: 'problem' });
    var rid = cr.body.id;

    var png = Buffer.from([137,80,78,71,13,10,26,10,0,0,0,13,73,72,68,82,0,0,0,1,0,0,0,1,8,2,0,0,0,144,119,83,222,0,0,0,12,73,68,65,84,8,215,99,248,207,0,0,0,2,0,1,226,135,177,0,0,0,0,73,69,78,68,174,66,96,130]);
    var up = await request(app)
      .post('/api/feedback/upload')
      .set('Authorization', 'Bearer ' + adminToken)
      .field('feedback_id', String(rid))
      .attach('file', png, 'отчет.png');
    assert.equal(up.status, 200);
    assert.equal(up.body.ok, true);

    var check = await request(app).get('/api/feedback/' + rid).set('Authorization', 'Bearer ' + adminToken);
    assert.equal(check.body.row.original_name, 'отчет.png');
  });

  test('загрузка .exe (400)', async function() {
    var exe = Buffer.from([77,90,144,0]);
    var res = await request(app)
      .post('/api/feedback/upload')
      .set('Authorization', 'Bearer ' + adminToken)
      .field('feedback_id', String(fbFileId))
      .attach('file', exe, 'test.exe');
    assert.equal(res.status, 400);
    assert.equal(res.body.ok, false);
  });
});
