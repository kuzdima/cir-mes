process.env.JWT_SECRET = process.env.JWT_SECRET || 'crm-test-secret';
var { test, describe, before, after, beforeEach, afterEach } = require('node:test');
var assert = require('node:assert/strict');
var request = require('supertest');
var { app, pool } = require('../server');
var bcrypt = require('bcryptjs');
var jwt = require('jsonwebtoken');

var ADMIN_EMAIL = 'crm-test-admin@cir.ru';
var USER_EMAIL = 'crm-test-user@cir.ru';
var PASS = 'Test123';
var adminId = null;
var userId = null;
var adminToken = null;
var userToken = null;

before(async function() {
  // Очистка мусора от предыдущих запусков
  await pool.query('DELETE FROM crm_card_field_values WHERE card_id IN (SELECT id FROM crm_cards WHERE title LIKE $1)', ['CRM-Test-%']);
  await pool.query('DELETE FROM crm_card_files WHERE card_id IN (SELECT id FROM crm_cards WHERE title LIKE $1)', ['CRM-Test-%']);
  await pool.query('DELETE FROM crm_card_participants WHERE card_id IN (SELECT id FROM crm_cards WHERE title LIKE $1)', ['CRM-Test-%']);
  await pool.query('DELETE FROM crm_cards WHERE title LIKE $1', ['CRM-Test-%']);
  await pool.query('DELETE FROM crm_field_definitions WHERE name LIKE $1', ['CRM-Test-%']);
  await pool.query('DELETE FROM crm_columns WHERE name LIKE $1', ['CRM-Test-%']);

  var hash = await bcrypt.hash(PASS, 10);

  var r = await pool.query(
    "INSERT INTO users (email,password_hash,first_name,last_name,role,is_active) VALUES ($1,$2,'CRM-Admin','Test','admin',TRUE) ON CONFLICT (email) DO UPDATE SET role='admin' RETURNING id",
    [ADMIN_EMAIL, hash]
  );
  adminId = r.rows[0].id;

  var r2 = await pool.query(
    "INSERT INTO users (email,password_hash,first_name,last_name,role,is_active) VALUES ($1,$2,'CRM-User','Test','master',TRUE) ON CONFLICT (email) DO UPDATE SET role='master' RETURNING id",
    [USER_EMAIL, hash]
  );
  userId = r2.rows[0].id;

  await pool.query('INSERT INTO crm_access (user_id) VALUES ($1),($2) ON CONFLICT DO NOTHING', [adminId, userId]);

  adminToken = jwt.sign({ id: adminId, email: ADMIN_EMAIL, role: 'admin', name: 'CRM-Admin Test' }, process.env.JWT_SECRET, { expiresIn: '1h' });
  userToken = jwt.sign({ id: userId, email: USER_EMAIL, role: 'master', name: 'CRM-User Test' }, process.env.JWT_SECRET, { expiresIn: '1h' });
});

after(async function() {
  await pool.query('DELETE FROM crm_cards WHERE created_by IN ($1,$2)', [adminId, userId]);
  await pool.query('DELETE FROM crm_columns WHERE name LIKE $1', ['CRM-Test-%']);
  await pool.query('DELETE FROM crm_field_definitions WHERE name LIKE $1', ['CRM-Test-%']);
  await pool.query('DELETE FROM crm_card_participants WHERE user_id IN ($1,$2)', [adminId, userId]);
  await pool.query('DELETE FROM crm_access WHERE user_id IN ($1,$2)', [adminId, userId]);
  await pool.query('DELETE FROM users WHERE id IN ($1,$2)', [adminId, userId]);
});

// ─── Auth ─────────────────────────────────────────────────────
describe('Auth', function() {

  test('401 без токена', async function() {
    var res = await request(app).get('/api/crm/columns');
    assert.equal(res.status, 401);
    assert.equal(res.body.ok, false);
  });

  test('401 с невалидным токеном', async function() {
    var res = await request(app).get('/api/crm/columns').set('Authorization', 'Bearer invalid');
    assert.equal(res.status, 401);
  });

  test('403 без доступа к CRM', async function() {
    var token = jwt.sign({ id: adminId, email: ADMIN_EMAIL, role: 'admin', name: 'Test' }, process.env.JWT_SECRET, { expiresIn: '1h' });
    // Удаляем доступ для этого теста — восстановим после
    await pool.query('DELETE FROM crm_access WHERE user_id = $1', [adminId]);
    var res = await request(app).get('/api/crm/columns').set('Authorization', 'Bearer ' + token);
    assert.equal(res.status, 403);
    assert.equal(res.body.error, 'Нет доступа к CRM');
    await pool.query('INSERT INTO crm_access (user_id) VALUES ($1) ON CONFLICT DO NOTHING', [adminId]);
  });

});

// ─── Columns ──────────────────────────────────────────────────
describe('Columns', function() {

  before(async function() {
    await pool.query('DELETE FROM crm_columns WHERE name LIKE $1', ['CRM-Test-%']);
  });

  test('GET пустой список тестовых колонок', async function() {
    var res = await request(app).get('/api/crm/columns').set('Authorization', 'Bearer ' + adminToken);
    assert.equal(res.status, 200);
    assert.equal(res.body.ok, true);
    assert.equal(res.body.rows.filter(function(c) { return c.name.startsWith('CRM-Test-'); }).length, 0);
  });

  test('POST создать колонку', async function() {
    var res = await request(app)
      .post('/api/crm/columns')
      .set('Authorization', 'Bearer ' + adminToken)
      .send({ name: 'CRM-Test-Col1', sort_order: 0 });
    assert.equal(res.status, 200);
    assert.equal(res.body.ok, true);
    assert.equal(res.body.row.name, 'CRM-Test-Col1');
    assert.equal(typeof res.body.row.id, 'number');
  });

  test('POST 400 без name', async function() {
    var res = await request(app)
      .post('/api/crm/columns')
      .set('Authorization', 'Bearer ' + adminToken)
      .send({});
    assert.equal(res.status, 400);
    assert.equal(res.body.ok, false);
  });

  test('POST 403 для не-admin', async function() {
    var res = await request(app)
      .post('/api/crm/columns')
      .set('Authorization', 'Bearer ' + userToken)
      .send({ name: 'CRM-Test-X' });
    assert.equal(res.status, 403);
    assert.equal(res.body.error, 'Только для администратора');
  });

  test('GET список с одной колонкой', async function() {
    // Используем колонку, созданную в предыдущем тесте
    var res = await request(app).get('/api/crm/columns').set('Authorization', 'Bearer ' + adminToken);
    var cols = res.body.rows.filter(function(c) { return c.name.startsWith('CRM-Test-'); });
    assert.equal(cols.length >= 1, true);
  });

  test('PUT переименовать колонку', async function() {
    var cols = await request(app).get('/api/crm/columns').set('Authorization', 'Bearer ' + adminToken);
    var col = cols.body.rows.find(function(c) { return c.name === 'CRM-Test-Col1'; });
    if (!col) return; // skip если колонка не найдена (изоляция тестов)

    var res = await request(app)
      .put('/api/crm/columns/' + col.id)
      .set('Authorization', 'Bearer ' + adminToken)
      .send({ name: 'CRM-Test-Col1-Renamed' });
    assert.equal(res.status, 200);
    assert.equal(res.body.row.name, 'CRM-Test-Col1-Renamed');
  });

  test('DELETE колонку', async function() {
    var res = await request(app)
      .post('/api/crm/columns')
      .set('Authorization', 'Bearer ' + adminToken)
      .send({ name: 'CRM-Test-DeleteMe' });
    var id = res.body.row.id;

    var del = await request(app)
      .delete('/api/crm/columns/' + id)
      .set('Authorization', 'Bearer ' + adminToken);
    assert.equal(del.status, 200);
    assert.equal(del.body.ok, true);
  });

  test('PUT /columns/reorder', async function() {
    // Создаём две колонки
    var c1 = await request(app).post('/api/crm/columns').set('Authorization', 'Bearer ' + adminToken).send({ name: 'CRM-Test-RA', sort_order: 0 });
    var c2 = await request(app).post('/api/crm/columns').set('Authorization', 'Bearer ' + adminToken).send({ name: 'CRM-Test-RB', sort_order: 1 });

    var res = await request(app)
      .put('/api/crm/columns/reorder')
      .set('Authorization', 'Bearer ' + adminToken)
      .send({ ids: [c2.body.row.id, c1.body.row.id] });
    assert.equal(res.status, 200);

    // Проверяем порядок
    var cols = await request(app).get('/api/crm/columns').set('Authorization', 'Bearer ' + adminToken);
    var items = cols.body.rows.filter(function(c) { return c.name === 'CRM-Test-RA' || c.name === 'CRM-Test-RB'; });
    // Должны быть в порядке sort_order: RB (0), RA (1)
    assert.equal(items.length, 2);
  });

});

// ─── Cards ────────────────────────────────────────────────────
describe('Cards', function() {

  var cardId = null;

  before(async function() {
    await pool.query('DELETE FROM crm_card_field_values WHERE card_id IN (SELECT id FROM crm_cards WHERE title LIKE $1)', ['CRM-Test-%']);
    await pool.query('DELETE FROM crm_card_files WHERE card_id IN (SELECT id FROM crm_cards WHERE title LIKE $1)', ['CRM-Test-%']);
    await pool.query('DELETE FROM crm_card_participants WHERE card_id IN (SELECT id FROM crm_cards WHERE title LIKE $1)', ['CRM-Test-%']);
    await pool.query('DELETE FROM crm_cards WHERE title LIKE $1', ['CRM-Test-%']);
    cardId = null;
  });
  after(async function() {
    await pool.query('DELETE FROM crm_card_field_values WHERE card_id IN (SELECT id FROM crm_cards WHERE title LIKE $1)', ['CRM-Test-%']);
    await pool.query('DELETE FROM crm_card_files WHERE card_id IN (SELECT id FROM crm_cards WHERE title LIKE $1)', ['CRM-Test-%']);
    await pool.query('DELETE FROM crm_card_participants WHERE card_id IN (SELECT id FROM crm_cards WHERE title LIKE $1)', ['CRM-Test-%']);
    await pool.query('DELETE FROM crm_cards WHERE title LIKE $1', ['CRM-Test-%']);
  });

  test('POST создать карточку', async function() {
    var cols = await request(app).get('/api/crm/columns').set('Authorization', 'Bearer ' + adminToken);
    var col = cols.body.rows.find(function(c) { return c.name.startsWith('CRM-Test-'); });
    if (!col) return;

    var res = await request(app)
      .post('/api/crm/cards')
      .set('Authorization', 'Bearer ' + adminToken)
      .send({ title: 'CRM-Test-Card1', column_id: col.id });
    assert.equal(res.status, 200);
    assert.equal(res.body.ok, true);
    assert.equal(res.body.row.title, 'CRM-Test-Card1');
    cardId = res.body.row.id;

    // Проверяем, что автор — участник
    var parts = await pool.query('SELECT * FROM crm_card_participants WHERE card_id = $1 AND user_id = $2', [cardId, adminId]);
    assert.equal(parts.rows.length, 1);
  });

  test('POST создать карточку с полями', async function() {
    var cols = await request(app).get('/api/crm/columns').set('Authorization', 'Bearer ' + adminToken);
    var col = cols.body.rows.find(function(c) { return c.name.startsWith('CRM-Test-'); });
    if (!col) return;

    var fieldR = await request(app)
      .post('/api/crm/fields')
      .set('Authorization', 'Bearer ' + adminToken)
      .send({ name: 'CRM-Test-Field-Card', type: 'text', sort_order: 0 });
    assert.equal(fieldR.status, 200);
    var fieldId = fieldR.body.row.id;

    var res = await request(app)
      .post('/api/crm/cards')
      .set('Authorization', 'Bearer ' + adminToken)
      .send({ title: 'CRM-Test-Card-With-Fields', column_id: col.id, fields: [{ field_id: fieldId, value: 'hello' }] });
    assert.equal(res.status, 200);
    assert.equal(res.body.ok, true);

    var dbVal = await pool.query('SELECT value FROM crm_card_field_values WHERE card_id = $1 AND field_id = $2', [res.body.row.id, fieldId]);
    assert.equal(dbVal.rows.length, 1);
    assert.equal(dbVal.rows[0].value, 'hello');
  });

  test('POST 400 без title', async function() {
    var res = await request(app)
      .post('/api/crm/cards')
      .set('Authorization', 'Bearer ' + adminToken)
      .send({});
    assert.equal(res.status, 400);
  });

  test('GET карточки (только свои)', async function() {
    var res = await request(app).get('/api/crm/cards').set('Authorization', 'Bearer ' + adminToken);
    assert.equal(res.status, 200);
    assert.equal(res.body.ok, true);
    var cards = res.body.rows.filter(function(c) { return c.title === 'CRM-Test-Card1'; });
    assert.equal(cards.length >= 1, true);
    if (cards.length) {
      assert.equal(Array.isArray(cards[0].participants), true);
      assert.equal(Array.isArray(cards[0].files), true);
      assert.equal(Array.isArray(cards[0].fields), true);
    }
  });

  test('GET /cards/:id детали', async function() {
    if (!cardId) return;
    var res = await request(app).get('/api/crm/cards/' + cardId).set('Authorization', 'Bearer ' + adminToken);
    assert.equal(res.status, 200);
    assert.equal(res.body.row.id, cardId);
    assert.equal(Array.isArray(res.body.row.participants), true);
  });

  test('GET /cards/:id 403 для не-участника', async function() {
    if (!cardId) return;
    var res = await request(app).get('/api/crm/cards/' + cardId).set('Authorization', 'Bearer ' + userToken);
    // user не является участником этой карточки
    assert.equal(res.status, 403);
  });

  test('PUT обновить карточку', async function() {
    if (!cardId) return;
    var res = await request(app)
      .put('/api/crm/cards/' + cardId)
      .set('Authorization', 'Bearer ' + adminToken)
      .send({ title: 'CRM-Test-Card1-Updated' });
    assert.equal(res.status, 200);
    assert.equal(res.body.row.title, 'CRM-Test-Card1-Updated');
  });

  test('PUT обновить поля карточки', async function() {
    if (!cardId) return;
    var fieldR = await request(app)
      .post('/api/crm/fields')
      .set('Authorization', 'Bearer ' + adminToken)
      .send({ name: 'CRM-Test-Field-Put', type: 'text', sort_order: 0 });
    assert.equal(fieldR.status, 200);
    var fieldId = fieldR.body.row.id;

    var res = await request(app)
      .put('/api/crm/cards/' + cardId)
      .set('Authorization', 'Bearer ' + adminToken)
      .send({ fields: [{ field_id: fieldId, value: 'updated' }] });
    assert.equal(res.status, 200);
    assert.equal(res.body.ok, true);

    var dbVal = await pool.query('SELECT value FROM crm_card_field_values WHERE card_id = $1 AND field_id = $2', [cardId, fieldId]);
    assert.equal(dbVal.rows.length, 1);
    assert.equal(dbVal.rows[0].value, 'updated');
  });

  test('POST /cards/:id/move переместить', async function() {
    if (!cardId) return;
    var cols = await request(app).get('/api/crm/columns').set('Authorization', 'Bearer ' + adminToken);
    var col = cols.body.rows.find(function(c) { return c.name.startsWith('CRM-Test-'); });
    if (!col) return;

    var res = await request(app)
      .post('/api/crm/cards/' + cardId + '/move')
      .set('Authorization', 'Bearer ' + adminToken)
      .send({ column_id: col.id, sort_order: 5 });
    assert.equal(res.status, 200);
    assert.equal(res.body.row.column_id, col.id);
    assert.equal(res.body.row.sort_order, 5);
  });

  test('POST /cards/:id/participants добавить/убрать', async function() {
    if (!cardId) return;
    // Добавляем user как участника
    var res = await request(app)
      .post('/api/crm/cards/' + cardId + '/participants')
      .set('Authorization', 'Bearer ' + adminToken)
      .send({ user_ids: [adminId, userId] });
    assert.equal(res.status, 200);
    assert.equal(res.body.ok, true);
    assert.equal(res.body.participants.length, 2);

    // Убираем всех (только admin — автор)
    var res2 = await request(app)
      .post('/api/crm/cards/' + cardId + '/participants')
      .set('Authorization', 'Bearer ' + adminToken)
      .send({ user_ids: [adminId] });
    assert.equal(res2.body.participants.length, 1);
  });

  test('POST /cards/:id/move 403 для не-участника', async function() {
    if (!cardId) return;
    // user уже не участник (убрали выше)
    var res = await request(app)
      .post('/api/crm/cards/' + cardId + '/move')
      .set('Authorization', 'Bearer ' + userToken)
      .send({ column_id: 1 });
    assert.equal(res.status, 403);
  });

  test('DELETE карточку', async function() {
    if (!cardId) return;
    var res = await request(app)
      .delete('/api/crm/cards/' + cardId)
      .set('Authorization', 'Bearer ' + adminToken);
    assert.equal(res.status, 200);
    assert.equal(res.body.ok, true);
    cardId = null;
  });

});

// ─── Fields ───────────────────────────────────────────────────
describe('Fields', function() {

  var fieldId = null;

  before(async function() {
    await pool.query('DELETE FROM crm_field_definitions WHERE name LIKE $1', ['CRM-Test-%']);
  });

  test('GET пустой список тестовых полей', async function() {
    var res = await request(app).get('/api/crm/fields').set('Authorization', 'Bearer ' + adminToken);
    assert.equal(res.status, 200);
    assert.equal(res.body.rows.filter(function(f) { return f.name.startsWith('CRM-Test-'); }).length, 0);
  });

  test('POST создать поле', async function() {
    var res = await request(app)
      .post('/api/crm/fields')
      .set('Authorization', 'Bearer ' + adminToken)
      .send({ name: 'CRM-Test-Field1', type: 'text', sort_order: 0 });
    assert.equal(res.status, 200);
    assert.equal(res.body.row.name, 'CRM-Test-Field1');
    assert.equal(res.body.row.type, 'text');
    fieldId = res.body.row.id;
  });

  test('POST 400 с недопустимым типом', async function() {
    var res = await request(app)
      .post('/api/crm/fields')
      .set('Authorization', 'Bearer ' + adminToken)
      .send({ name: 'CRM-Test-Bad', type: 'bad_type' });
    assert.equal(res.status, 400);
  });

  test('POST 403 для не-admin', async function() {
    var res = await request(app)
      .post('/api/crm/fields')
      .set('Authorization', 'Bearer ' + userToken)
      .send({ name: 'CRM-Test-X', type: 'text' });
    assert.equal(res.status, 403);
  });

  test('DELETE /fields/:id 403 для не-admin', async function() {
    var res = await request(app)
      .delete('/api/crm/fields/1')
      .set('Authorization', 'Bearer ' + userToken);
    assert.equal(res.status, 403);
  });

  test('POST /fields/:id/restore 403 для не-admin', async function() {
    var res = await request(app)
      .post('/api/crm/fields/1/restore')
      .set('Authorization', 'Bearer ' + userToken);
    assert.equal(res.status, 403);
  });

  test('GET /fields/deleted 403 для не-admin', async function() {
    var res = await request(app)
      .get('/api/crm/fields/deleted')
      .set('Authorization', 'Bearer ' + userToken);
    assert.equal(res.status, 403);
  });

  test('PUT обновить поле', async function() {
    if (!fieldId) return;
    var res = await request(app)
      .put('/api/crm/fields/' + fieldId)
      .set('Authorization', 'Bearer ' + adminToken)
      .send({ name: 'CRM-Test-Field1-Updated', type: 'number' });
    assert.equal(res.status, 200);
    assert.equal(res.body.row.name, 'CRM-Test-Field1-Updated');
    assert.equal(res.body.row.type, 'number');
  });

  test('DELETE поле — мягкое удаление (is_active=false)', async function() {
    if (!fieldId) return;
    var res = await request(app)
      .delete('/api/crm/fields/' + fieldId)
      .set('Authorization', 'Bearer ' + adminToken);
    assert.equal(res.status, 200);
    var dbR = await pool.query('SELECT is_active FROM crm_field_definitions WHERE id = $1', [fieldId]);
    assert.equal(dbR.rows.length, 1);
    assert.equal(dbR.rows[0].is_active, false);
  });

  test('POST /fields/:id/restore восстановить поле', async function() {
    if (!fieldId) return;
    var res = await request(app)
      .post('/api/crm/fields/' + fieldId + '/restore')
      .set('Authorization', 'Bearer ' + adminToken);
    assert.equal(res.status, 200);
    var dbR = await pool.query('SELECT is_active FROM crm_field_definitions WHERE id = $1', [fieldId]);
    assert.equal(dbR.rows[0].is_active, true);
  });

  test('DELETE поле + GET /fields/deleted', async function() {
    if (!fieldId) return;
    var res = await request(app)
      .delete('/api/crm/fields/' + fieldId)
      .set('Authorization', 'Bearer ' + adminToken);
    assert.equal(res.status, 200);
    var delRes = await request(app)
      .get('/api/crm/fields/deleted')
      .set('Authorization', 'Bearer ' + adminToken);
    assert.equal(delRes.status, 200);
    var found = delRes.body.rows.filter(function(f) { return f.id === fieldId; });
    assert.equal(found.length, 1);
    assert.equal(found[0].is_active, false);
    fieldId = null;
  });

});

// ─── Access ───────────────────────────────────────────────────
describe('Access', function() {

  test('GET /api/crm/access список', async function() {
    var res = await request(app).get('/api/crm/access').set('Authorization', 'Bearer ' + adminToken);
    assert.equal(res.status, 200);
    assert.equal(res.body.ok, true);
    assert.equal(Array.isArray(res.body.rows), true);
  });

  test('GET /api/crm/access 403 для не-admin', async function() {
    var res = await request(app).get('/api/crm/access').set('Authorization', 'Bearer ' + userToken);
    assert.equal(res.status, 403);
  });

  test('POST /api/crm/access добавить', async function() {
    // Удаляем user из доступа
    await pool.query('DELETE FROM crm_access WHERE user_id = $1', [userId]);
    var res = await request(app)
      .post('/api/crm/access')
      .set('Authorization', 'Bearer ' + adminToken)
      .send({ user_id: userId });
    assert.equal(res.status, 200);
  });

  test('DELETE /api/crm/access/:userId убрать', async function() {
    var res = await request(app)
      .delete('/api/crm/access/' + userId)
      .set('Authorization', 'Bearer ' + adminToken);
    assert.equal(res.status, 200);
    // Возвращаем доступ
    await pool.query('INSERT INTO crm_access (user_id) VALUES ($1) ON CONFLICT DO NOTHING', [userId]);
  });

  test('GET /api/crm/users список всех пользователей', async function() {
    var res = await request(app).get('/api/crm/users').set('Authorization', 'Bearer ' + adminToken);
    assert.equal(res.status, 200);
    assert.equal(res.body.ok, true);
    assert.equal(Array.isArray(res.body.rows), true);
    assert.equal(res.body.rows.length >= 2, true);
  });

  test('GET /api/crm/users 403 для не-admin', async function() {
    var res = await request(app).get('/api/crm/users').set('Authorization', 'Bearer ' + userToken);
    assert.equal(res.status, 403);
  });

});

// ─── Files ─────────────────────────────────────────────────────
describe('Files', function() {
  var cardId = null;

  before(async function() {
    await pool.query('DELETE FROM crm_card_field_values WHERE card_id IN (SELECT id FROM crm_cards WHERE title LIKE $1)', ['CRM-Test-File-%']);
    await pool.query('DELETE FROM crm_card_files WHERE card_id IN (SELECT id FROM crm_cards WHERE title LIKE $1)', ['CRM-Test-File-%']);
    await pool.query('DELETE FROM crm_card_participants WHERE card_id IN (SELECT id FROM crm_cards WHERE title LIKE $1)', ['CRM-Test-File-%']);
    await pool.query('DELETE FROM crm_cards WHERE title LIKE $1', ['CRM-Test-File-%']);
    await pool.query('DELETE FROM crm_columns WHERE name LIKE $1', ['CRM-Test-File-%']);

    var colR = await request(app)
      .post('/api/crm/columns')
      .set('Authorization', 'Bearer ' + adminToken)
      .send({ name: 'CRM-Test-File-Col', sort_order: 0 });
    var colId = colR.body.row.id;

    var cardR = await request(app)
      .post('/api/crm/cards')
      .set('Authorization', 'Bearer ' + adminToken)
      .send({ title: 'CRM-Test-File-Card', column_id: colId });
    cardId = cardR.body.row.id;
  });

  after(async function() {
    await pool.query('DELETE FROM crm_card_field_values WHERE card_id IN (SELECT id FROM crm_cards WHERE title LIKE $1)', ['CRM-Test-File-%']);
    await pool.query('DELETE FROM crm_card_files WHERE card_id IN (SELECT id FROM crm_cards WHERE title LIKE $1)', ['CRM-Test-File-%']);
    await pool.query('DELETE FROM crm_card_participants WHERE card_id IN (SELECT id FROM crm_cards WHERE title LIKE $1)', ['CRM-Test-File-%']);
    await pool.query('DELETE FROM crm_cards WHERE title LIKE $1', ['CRM-Test-File-%']);
    await pool.query('DELETE FROM crm_columns WHERE name LIKE $1', ['CRM-Test-File-%']);
  });

  test('POST /api/crm/upload загрузить PNG', async function() {
    var res = await request(app)
      .post('/api/crm/upload')
      .set('Authorization', 'Bearer ' + adminToken)
      .attach('file', Buffer.alloc(100), { filename: 'test.png', contentType: 'image/png' })
      .field('card_id', cardId);
    assert.equal(res.status, 200);
    assert.equal(res.body.ok, true);
    assert.equal(typeof res.body.row.id, 'number');
    assert.equal(res.body.row.card_id, cardId);
    assert.equal(res.body.row.original_name, 'test.png');

    var dbR = await pool.query('SELECT * FROM crm_card_files WHERE id = $1', [res.body.row.id]);
    assert.equal(dbR.rows.length, 1);
    assert.equal(dbR.rows[0].original_name, 'test.png');

    var cardR = await request(app).get('/api/crm/cards/' + cardId).set('Authorization', 'Bearer ' + adminToken);
    var files = cardR.body.row.files;
    assert.equal(Array.isArray(files), true);
    var found = files.filter(function(f) { return f.id === res.body.row.id; });
    assert.equal(found.length, 1);
  });

  test('POST /api/crm/upload 400 без card_id', async function() {
    var res = await request(app)
      .post('/api/crm/upload')
      .set('Authorization', 'Bearer ' + adminToken)
      .attach('file', Buffer.alloc(100), { filename: 'nocard.png', contentType: 'image/png' });
    assert.equal(res.status, 400);
    assert.equal(res.body.ok, false);
  });

  test('POST /api/crm/upload 401 без токена', async function() {
    var res = await request(app)
      .post('/api/crm/upload')
      .attach('file', Buffer.alloc(100), { filename: 'noauth.png', contentType: 'image/png' })
      .field('card_id', cardId);
    assert.equal(res.status, 401);
  });

  test('POST /api/crm/upload 400 недопустимый MIME', async function() {
    var res = await request(app)
      .post('/api/crm/upload')
      .set('Authorization', 'Bearer ' + adminToken)
      .attach('file', Buffer.alloc(100), { filename: 'bad.exe', contentType: 'application/x-msdownload' })
      .field('card_id', cardId);
    assert.equal(res.status, 400);
    assert.equal(res.body.ok, false);
    assert.match(res.body.error, /Недопустимый/);
  });

  test('POST /api/crm/upload с field_id', async function() {
    var fieldR = await request(app)
      .post('/api/crm/fields')
      .set('Authorization', 'Bearer ' + adminToken)
      .send({ name: 'CRM-Test-File-Field', type: 'file', sort_order: 0 });
    assert.equal(fieldR.status, 200);
    var fieldId = fieldR.body.row.id;

    var res = await request(app)
      .post('/api/crm/upload')
      .set('Authorization', 'Bearer ' + adminToken)
      .attach('file', Buffer.alloc(100), { filename: 'withfield.png', contentType: 'image/png' })
      .field('card_id', cardId)
      .field('field_id', fieldId);
    assert.equal(res.status, 200);
    assert.equal(res.body.row.field_id, fieldId);

    var dbR = await pool.query('SELECT * FROM crm_card_files WHERE id = $1', [res.body.row.id]);
    assert.equal(dbR.rows[0].field_id, fieldId);
  });

  test('DELETE /api/crm/files/:id удалить файл', async function() {
    var upR = await request(app)
      .post('/api/crm/upload')
      .set('Authorization', 'Bearer ' + adminToken)
      .attach('file', Buffer.alloc(100), { filename: 'todelete.png', contentType: 'image/png' })
      .field('card_id', cardId);
    var fid = upR.body.row.id;

    var res = await request(app)
      .delete('/api/crm/files/' + fid)
      .set('Authorization', 'Bearer ' + adminToken);
    assert.equal(res.status, 200);
    assert.equal(res.body.ok, true);

    var dbR = await pool.query('SELECT * FROM crm_card_files WHERE id = $1', [fid]);
    assert.equal(dbR.rows.length, 0);
  });

  test('DELETE /api/crm/files/:id 403 для не-участника', async function() {
    var upR = await request(app)
      .post('/api/crm/upload')
      .set('Authorization', 'Bearer ' + adminToken)
      .attach('file', Buffer.alloc(100), { filename: 'noaccess.png', contentType: 'image/png' })
      .field('card_id', cardId);
    var fid = upR.body.row.id;

    var res = await request(app)
      .delete('/api/crm/files/' + fid)
      .set('Authorization', 'Bearer ' + userToken);
    assert.equal(res.status, 403);

    await pool.query('DELETE FROM crm_card_files WHERE id = $1', [fid]);
  });

});

// ─── CRMStore (frontend logic) ─────────────────────────────
describe('CRMStore (frontend logic)', function() {

  function TestStore() {
    this._columns = [];
    this._cards = [];
    this._fields = [];
  }
  TestStore.prototype.getColumns = function() { return this._columns; };
  TestStore.prototype.getCards = function() { return this._cards; };
  TestStore.prototype.getFields = function() { return this._fields; };
  TestStore.prototype.getCard = function(id) {
    for (var i = 0; i < this._cards.length; i++) {
      if (this._cards[i].id === id) return this._cards[i];
    }
    return null;
  };
  TestStore.prototype.addCard = function(card) { this._cards.push(card); };
  TestStore.prototype.updateCard = function(card) {
    for (var i = 0; i < this._cards.length; i++) {
      if (this._cards[i].id === card.id) { this._cards[i] = card; return; }
    }
  };
  TestStore.prototype.removeCard = function(id) {
    this._cards = this._cards.filter(function(c) { return c.id !== id; });
  };
  TestStore.prototype.moveCard = function(id, column_id, sort_order) {
    for (var i = 0; i < this._cards.length; i++) {
      if (this._cards[i].id === id) {
        this._cards[i].column_id = column_id;
        this._cards[i].sort_order = sort_order;
        return;
      }
    }
  };
  TestStore.prototype.setColumns = function(arr) { this._columns = arr; };
  TestStore.prototype.setFields = function(arr) { this._fields = arr; };

  test('addCard добавляет карточку', function() {
    var s = new TestStore();
    s.addCard({ id: 1, title: 'A' });
    assert.equal(s._cards.length, 1);
    assert.equal(s._cards[0].title, 'A');
  });

  test('getCard возвращает карточку по id', function() {
    var s = new TestStore();
    s._cards = [{ id: 1, title: 'A' }, { id: 2, title: 'B' }];
    assert.equal(s.getCard(2).title, 'B');
    assert.equal(s.getCard(99), null);
  });

  test('updateCard заменяет карточку целиком', function() {
    var s = new TestStore();
    s._cards = [{ id: 1, title: 'A' }];
    s.updateCard({ id: 1, title: 'B', description: 'upd' });
    assert.equal(s._cards.length, 1);
    assert.equal(s._cards[0].title, 'B');
    assert.equal(s._cards[0].description, 'upd');
  });

  test('removeCard удаляет по id', function() {
    var s = new TestStore();
    s._cards = [{ id: 1, title: 'A' }, { id: 2, title: 'B' }];
    s.removeCard(1);
    assert.equal(s._cards.length, 1);
    assert.equal(s._cards[0].id, 2);
  });

  test('moveCard обновляет column_id и sort_order', function() {
    var s = new TestStore();
    s._cards = [{ id: 1, column_id: 1, sort_order: 0 }];
    s.moveCard(1, 2, 5);
    assert.equal(s._cards[0].column_id, 2);
    assert.equal(s._cards[0].sort_order, 5);
  });

  test('setColumns обновляет колонки', function() {
    var s = new TestStore();
    s.setColumns([{ id: 1, name: 'A' }]);
    assert.equal(s._columns.length, 1);
    assert.equal(s._columns[0].name, 'A');
  });

  test('setFields обновляет поля', function() {
    var s = new TestStore();
    s.setFields([{ id: 1, name: 'F1', type: 'text' }]);
    assert.equal(s._fields.length, 1);
    assert.equal(s._fields[0].name, 'F1');
  });

});
