require('dotenv').config();
const express  = require('express');
const cors     = require('cors');
const path     = require('path');
const { Pool } = require('pg');
const bcrypt   = require('bcryptjs');
const jwt      = require('jsonwebtoken');

const app  = express();
const PORT = process.env.PORT || 8080;
const SECRET = process.env.JWT_SECRET || 'cirmesjwtsecret2026';

const pool = new Pool({
  host:     process.env.DB_HOST     || '185.41.161.31',
  port:     parseInt(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME     || 'cir_mes',
  user:     process.env.DB_USER     || 'cir_user',
  password: process.env.DB_PASSWORD || 'CirMes2026',
  max: 30,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

app.use(cors());
app.use(express.json({ limit: '10mb' }));

app.use(function(req, res, next) {
  console.log(req.method, req.url);
  next();
});

// Auth middleware
function auth(req, res, next) {
  var h = req.headers.authorization;
  if (!h || !h.startsWith('Bearer ')) return res.status(401).json({ ok: false, error: 'Требуется авторизация' });
  try { req.user = jwt.verify(h.slice(7), SECRET); next(); }
  catch(e) { res.status(401).json({ ok: false, error: 'Токен недействителен' }); }
}

// Health
app.get('/api/health', async (req, res) => {
  try { await pool.query('SELECT 1'); res.json({ ok: true, db: 'connected' }); }
  catch(e) { res.json({ ok: false, error: e.message }); }
});

// Login
app.post('/api/auth/login', async (req, res) => {
  try {
    var { email, password } = req.body;
    var r = await pool.query('SELECT * FROM users WHERE email=$1 AND is_active=TRUE', [email]);
    if (!r.rows.length) return res.status(401).json({ ok: false, error: 'Неверный email или пароль' });
    var user = r.rows[0];
    if (!(await bcrypt.compare(password, user.password_hash)))
      return res.status(401).json({ ok: false, error: 'Неверный email или пароль' });
    await pool.query('UPDATE users SET last_login=NOW() WHERE id=$1', [user.id]);
    var token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, name: user.first_name + ' ' + user.last_name },
      SECRET, { expiresIn: '8h' }
    );
    res.json({ ok: true, token, user: {
      id: user.id, email: user.email, role: user.role,
      name: (user.first_name + ' ' + user.last_name).trim()
    }});
  } catch(e) { res.status(500).json({ ok: false, error: e.message }); }
});



// Register — Добавление пользователя в базу
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, firstName, lastName, role } = req.body;

    if (!email || !password || !firstName) {
      return res.status(400).json({ ok: false, error: 'Заполните обязательные поля (Имя, Email, Пароль)' });
    }

    // Проверка существования email
    const exists = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (exists.rows.length > 0) {
      return res.status(409).json({ ok: false, error: 'Пользователь с таким email уже существует' });
    }

    // Хэширование пароля
    const hash = await bcrypt.hash(password, 10);

    // Добавление в базу
    const result = await pool.query(
      `INSERT INTO users 
       (email, password_hash, first_name, last_name, role, is_active, created_at) 
       VALUES ($1, $2, $3, $4, $5, TRUE, NOW()) 
       RETURNING id, email, role, first_name, last_name`,
      [email, hash, firstName, lastName || '', role || 'technologist']
    );

    res.json({ 
      ok: true, 
      message: 'Пользователь успешно зарегистрирован',
      user: result.rows[0]
    });

  } catch(e) {
    console.error('Register error:', e.message);
    res.status(500).json({ ok: false, error: 'Ошибка при регистрации' });
  }
});

// Delete tech operations by classifier + product
app.delete('/api/tech-ops', auth, async (req, res) => {
  try {
    // Проверка роли — только admin может удалять
    if (req.user.role !== 'admin') {
      return res.status(403).json({ 
        ok: false, 
        error: 'Удаление доступно только администратору' 
      });
    }
    const { classifierCode, productName } = req.body;

    if (!classifierCode || !productName) {
      return res.status(400).json({ 
        ok: false, 
        error: 'Не указан classifierCode или productName' 
      });
    }

    const result = await pool.query(
      `DELETE FROM tech_operations_archive 
       WHERE LOWER(classifier_code) = LOWER($1) 
         AND LOWER(product_name) = LOWER($2)`,
      [classifierCode, productName]
    );

    res.json({ 
      ok: true, 
      deleted: result.rowCount,
      message: `Удалено ${result.rowCount} операций` 
    });

  } catch(e) {
    console.error('Delete tech-ops error:', e.message);
    res.status(500).json({ ok: false, error: e.message });
  }
});

// Delete production order by narad number
app.delete('/api/production', auth, async (req, res) => {
  try {
    var { naradNumber } = req.body;
    if (!naradNumber) return res.status(400).json({ ok: false, error: 'naradNumber required' });
    var result = await pool.query('DELETE FROM production_orders WHERE narad_number = $1', [naradNumber]);
    console.log('Удалён наряд:', naradNumber, '| строк:', result.rowCount);
    res.json({ ok: true, deleted: result.rowCount });
  } catch(e) { res.status(500).json({ ok: false, error: e.message }); }
});

// Tech ops list
app.get('/api/tech-ops', auth, async (req, res) => {
  try {
    var { classifier, product_name, object_type, page, limit } = req.query;
    page = parseInt(page) || 1;
    limit = parseInt(limit) || 100;
    var offset = (page - 1) * limit;
    var conds = [], params = [];
    var pi = 1;
    if (classifier) {
      conds.push('(classifier_code ILIKE $' + pi + ' OR product_name ILIKE $' + pi + ')');
      params.push('%' + classifier + '%');
      pi++;
    }
    if (object_type) {
      conds.push('object_type = $' + pi);
      params.push(object_type);
      pi++;
    }
    var where = conds.length ? 'WHERE ' + conds.join(' AND ') : '';
    params.push(limit + 1, offset);
    var sql = 'SELECT t.*, NULLIF(TRIM(COALESCE(u.last_name,\'\') || \' \' || COALESCE(u.first_name,\'\')), \'\') AS creator_name FROM tech_operations_archive t LEFT JOIN users u ON t.created_by = u.id ' + where + ' ORDER BY t.classifier_code, t.operation_number LIMIT $' + pi + ' OFFSET $' + (pi + 1);
    console.log('SQL:', sql, params);
    var rows = await pool.query(sql, params);
    var hasMore = rows.rows.length > limit;
    if (hasMore) rows.rows.pop();
    res.json({ ok: true, rows: rows.rows, total: hasMore ? offset + limit + 1 : offset + rows.rows.length, page: page });
  } catch(e) {
    console.log('tech-ops error:', e.message);
    res.status(500).json({ ok: false, error: e.message });
  }
});

// Tech ops refs
app.get('/api/tech-ops/refs', auth, async (req, res) => {
  try {
    var [ops, machines, coatings, units, objectTypes, materials, assortments] = await Promise.all([
      pool.query('SELECT name FROM ref_operations ORDER BY name'),
      pool.query('SELECT name FROM ref_machines ORDER BY name'),
      pool.query('SELECT name FROM ref_coatings ORDER BY name'),
      pool.query('SELECT name FROM ref_units ORDER BY name'),
      pool.query('SELECT name FROM ref_object_types ORDER BY name'),
      pool.query('SELECT DISTINCT material_grade AS name FROM tech_operations_archive WHERE material_grade IS NOT NULL ORDER BY name'),
      pool.query('SELECT DISTINCT assortment AS name FROM tech_operations_archive WHERE assortment IS NOT NULL AND LENGTH(assortment)<50 ORDER BY name LIMIT 100'),

    ]);
    res.json({ ok: true,
      operations: ops.rows.map(r=>r.name), machines: machines.rows.map(r=>r.name),
      coatings: coatings.rows.map(r=>r.name), units: units.rows.map(r=>r.name),
      objectTypes: objectTypes.rows.map(r=>r.name), materials: materials.rows.map(r=>r.name),
      assortments: assortments.rows.map(r=>r.name),
    });
  } catch(e) { res.status(500).json({ ok: false, error: e.message }); }
});

// Autocomplete
app.get('/api/tech-ops/autocomplete', auth, async (req, res) => {
  try {
    var { q, field } = req.query;
    if (!q || q.length < 2) return res.json({ ok: true, rows: [] });
    var rows;
    if (field === 'product') {
      rows = await pool.query(
        `SELECT name, code, object_type FROM (
          SELECT DISTINCT product_name AS name, classifier_code AS code, object_type FROM tech_operations_archive WHERE product_name ILIKE $1
          UNION
          SELECT DISTINCT item_name AS name, classifier AS code, object_type FROM products_archive WHERE item_name ILIKE $1
        ) t ORDER BY name LIMIT 30`, ['%'+q+'%']);
    } else if (field === 'classifier') {
      rows = await pool.query(
        `SELECT name, code, object_type FROM (
          SELECT DISTINCT classifier_code AS name, product_name AS code, object_type FROM tech_operations_archive WHERE classifier_code ILIKE $1
          UNION
          SELECT DISTINCT classifier AS name, item_name AS code, object_type FROM products_archive WHERE classifier ILIKE $1
        ) t ORDER BY name LIMIT 30`, ['%'+q+'%']);
    } else {
      return res.json({ ok: true, rows: [] });
    }
    res.json({ ok: true, rows: rows.rows });
  } catch(e) { res.status(500).json({ ok: false, error: e.message }); }
});

// Search existing
app.get('/api/tech-ops/search', auth, async (req, res) => {
  try {
    var { product_name, classifier } = req.query;
    var rows = await pool.query(
      'SELECT * FROM tech_operations_archive WHERE LOWER(product_name)=LOWER($1) AND LOWER(classifier_code)=LOWER($2) ORDER BY operation_number',
      [product_name, classifier]
    );
    if (!rows.rows.length) return res.json({ ok: false, message: 'Не найдено' });
    var f = rows.rows[0];
    res.json({ ok: true, commonData: {
      classifierCode: f.classifier_code, productName: f.product_name, noticeNumber: f.notice_number,
      objectType: f.object_type, materialGrade: f.material_grade, assortment: f.assortment,
      materialAmount: f.material_amount, unitOfMeasure: f.unit_of_measure, coating: f.coating,
      hardness: f.hardness, fullName: f.full_name, makeQty: f.make_qty, massKg: f.mass_kg,
      dimensions: f.dimensions, mainOrderId: f.main_order_id, productComment: f.product_comment,
    }, operations: rows.rows.map(r => ({
      operationNumber: r.operation_number, operationName: r.operation_name, executor: r.executor,
      machineResource: r.machine_resource, operationComment: r.operation_comment, tool: r.tool,
      normTimeHours: r.norm_time_hours, batchPrepHours: r.batch_prep_hours,
      isOutsourcing: r.is_outsourcing, isFinal: r.is_final, isCnc: r.is_cnc,
    }))});
  } catch(e) { res.status(500).json({ ok: false, error: e.message }); }
});

// Add tech ops
app.post('/api/tech-ops', auth, async (req, res) => {
  try {
    var b = req.body;
    if (!b.classifierCode || !b.productName) return res.status(400).json({ ok: false, error: 'Заполните обязательные поля' });
    if (!b.operations || !b.operations.length) return res.status(400).json({ ok: false, error: 'Нет операций' });
    if (!b.operations.some(function(o){ return o.isFinal; })) return res.status(400).json({ ok: false, error: 'Нужна финальная операция' });
    if (b.action === 'replace') {
      await pool.query('DELETE FROM tech_operations_archive WHERE LOWER(product_name)=LOWER($1) AND LOWER(classifier_code)=LOWER($2)', [b.productName, b.classifierCode]);
    }
    var drawings = [b.classifierCode].concat(b.analogDrawings || []).filter(Boolean);
    for (var di = 0; di < drawings.length; di++) {
      for (var oi = 0; oi < b.operations.length; oi++) {
        var op = b.operations[oi];
        await pool.query(
          'INSERT INTO tech_operations_archive (classifier_code,product_name,notice_number,object_type,material_grade,assortment,material_amount,unit_of_measure,coating,hardness,full_name,make_qty,mass_kg,dimensions,main_order_id,product_comment,operation_number,operation_name,executor,machine_resource,operation_comment,tool,norm_time_hours,batch_prep_hours,is_outsourcing,is_final,is_cnc,created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28)',
          [drawings[di], b.productName, b.noticeNumber||null, b.objectType||null, b.materialGrade||null, b.assortment||null,
           b.materialAmount?parseFloat(b.materialAmount):null, b.unitOfMeasure||null, b.coating||null, b.hardness||null,
           b.fullName||null, b.makeQty?parseFloat(b.makeQty):null, b.massKg?parseFloat(b.massKg):null, b.dimensions||null,
           b.mainOrderId||null, b.productComment||null, op.operationNumber, op.operationName, op.executor||null,
           op.machineResource||null, op.operationComment||null, op.tool||null,
           op.normTimeHours?parseFloat(op.normTimeHours):null, op.batchPrepHours?parseFloat(op.batchPrepHours):null,
           op.isOutsourcing===true, op.isFinal===true, op.isCnc===true, req.user.id]
        );
      }
    }
    res.json({ ok: true, message: 'Добавлено ' + b.operations.length + ' операций' });
  } catch(e) { res.status(500).json({ ok: false, error: e.message }); }
});

// Archive
app.get('/api/archive', auth, async (req, res) => {
  try {
    var { q, assembly_id } = req.query;
    var conds = [], params = [], pi = 1;
    if (assembly_id) { conds.push('p.assembly_id = $' + pi); params.push(assembly_id); pi++; }
    if (q) {
      conds.push('(p.assembly_id ILIKE $' + pi + ' OR p.item_name ILIKE $' + pi + ' OR p.classifier ILIKE $' + pi + ')');
      params.push('%' + q + '%'); pi++;
    }
    var where = conds.length ? 'WHERE ' + conds.join(' AND ') : '';
    var sql = `
      SELECT p.*, s.serial_number,
        NULLIF(TRIM(COALESCE(u.last_name,'') || ' ' || COALESCE(u.first_name,'')), '') AS creator_name
      FROM products_archive p
      LEFT JOIN (
        SELECT DISTINCT classifier_code, product_name, serial_number
        FROM tech_operations_archive
        WHERE serial_number IS NOT NULL
      ) s ON LOWER(p.classifier) = LOWER(s.classifier_code) AND LOWER(p.item_name) = LOWER(s.product_name)
      LEFT JOIN users u ON p.created_by = u.id
      ${where}
      ORDER BY p.assembly_id, length(p.struct_id), p.struct_id
    `;
    var rows = await pool.query(sql, params);
    res.json({ ok: true, rows: rows.rows });
  } catch(e) { res.status(500).json({ ok: false, error: e.message }); }
});



app.post('/api/archive', auth, async (req, res) => {
  try {
    var items = req.body.items;
    if (!items || !items.length) return res.status(400).json({ ok: false, error: 'Нет данных' });
    var root = items.find(function(i) { return i.id === '0'; });
    if (!root) return res.status(400).json({ ok: false, error: 'Нет корневого элемента' });
    var aid = root.classifier;
    
    // 1. Отвязываем старые строки от этого головного изделия
    var unlinked = await pool.query(
      'UPDATE products_archive SET assembly_id = NULL, serial_order = NULL WHERE assembly_id = $1',
      [aid]
    );
    if (unlinked.rowCount > 0) {
      console.log('Отвязано', unlinked.rowCount, 'строк от', aid);
      await pool.query(
        'UPDATE tech_operations_archive SET serial_number = NULL WHERE serial_number IS NOT NULL AND LOWER(classifier_code) IN (SELECT LOWER(classifier) FROM products_archive WHERE assembly_id IS NULL AND classifier IS NOT NULL)'
      );
    }
    
    // 2. Привязываем строки из новой структуры
    var inserted = 0, updated = 0, serialUpdated = 0;
    
    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      var lvl = it.level != null ? it.level : (it.id === '0' ? 0 : (it.id.match(/\./g) || []).length + 1);
      var pid = it.parentId || (it.id.indexOf('.') !== -1 ? it.id.split('.').slice(0, -1).join('.') : '0');
      
      // Ищем существующую строку по classifier + name
      var existing = null;
      if (it.classifier) {
        existing = await pool.query(
          'SELECT id FROM products_archive WHERE LOWER(classifier) = LOWER($1) AND LOWER(item_name) = LOWER($2) AND assembly_id IS NULL LIMIT 1',
          [it.classifier, it.name]
        );
      }
      if (!existing || !existing.rows.length) {
        existing = await pool.query(
          'SELECT id FROM products_archive WHERE LOWER(item_name) = LOWER($1) AND (classifier IS NULL OR classifier = $2) AND assembly_id IS NULL LIMIT 1',
          [it.name, it.classifier || '']
        );
      }
      
      // Рассчитываем трудоёмкость из архива операций
      var laborHours = null;
      if (it.classifier) {
        var laborResult = await pool.query(
          'SELECT COALESCE(SUM(COALESCE(norm_time_hours,0) + COALESCE(batch_prep_hours,0)), 0) as total FROM tech_operations_archive WHERE LOWER(classifier_code) = LOWER($1)',
          [it.classifier]
        );
        if (laborResult.rows[0].total > 0) {
          laborHours = parseFloat(laborResult.rows[0].total);
        }
      }
      
      if (existing && existing.rows.length > 0) {
        await pool.query(
          'UPDATE products_archive SET assembly_id=$1, struct_id=$2, quantity=$3, object_type=$4, parent_id=$5, level=$6, serial_order=$7, labor_hours=$8 WHERE id=$9',
          [aid, it.id, it.quantity || 1, it.objectType || null, pid, lvl, it.serialOrder || null, laborHours, existing.rows[0].id]
        );
        updated++;
      } else {
        await pool.query(
          'INSERT INTO products_archive (assembly_id,struct_id,item_name,classifier,quantity,object_type,parent_id,level,serial_order,labor_hours,created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)',
          [aid, it.id, it.name, it.classifier || null, it.quantity || 1, it.objectType || null, pid, lvl, it.serialOrder || null, laborHours, req.user.id]
        );
        inserted++;
      }
      
      // 3. Обновляем serial_number в tech_operations_archive
      if (it.serialOrder && it.classifier && it.name) {
        var upd = await pool.query(
          'UPDATE tech_operations_archive SET serial_number = $1 WHERE LOWER(classifier_code) = LOWER($2) AND LOWER(product_name) = LOWER($3) AND is_final = TRUE',
          [it.serialOrder, it.classifier, it.name]
        );
        serialUpdated += upd.rowCount;
      }
    }
    
    console.log('Архив:', aid, '| привязано:', updated, '| новых:', inserted, '| serial:', serialUpdated);
    res.json({ ok: true, added: inserted, updated: updated, serialUpdated: serialUpdated });
  } catch(e) { 
    console.log('archive error:', e.message);
    res.status(500).json({ ok: false, error: e.message }); 
  }
});


// Получить всех пользователей (только для ADMIN)
app.get('/api/users', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ ok: false, error: 'Доступ только для администратора' });
    }

    const result = await pool.query(`
      SELECT 
        id, 
        first_name, 
        last_name, 
        email, 
        password_hash,        -- Добавляем хэш пароля
        role, 
        is_active, 
        last_login, 
        created_at
      FROM users 
      ORDER BY created_at DESC
    `);

    res.json({
      ok: true,
      users: result.rows
    });
  } catch(e) {
    console.error(e);
    res.status(500).json({ ok: false, error: 'Ошибка сервера' });
  }
});

// Создать пользователя (только ADMIN)
app.post('/api/users', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ ok: false, error: 'Доступ запрещён' });
    var { firstName, lastName, email, role, password } = req.body;
    if (!firstName || !email || !password) return res.status(400).json({ ok: false, error: 'Имя, email и пароль обязательны' });
    if (password.length < 6) return res.status(400).json({ ok: false, error: 'Пароль минимум 6 символов' });
    var exists = await pool.query('SELECT id FROM users WHERE email=$1', [email]);
    if (exists.rows.length) return res.status(400).json({ ok: false, error: 'Email уже занят' });
    var hash = await bcrypt.hash(password, 10);
    await pool.query(
      'INSERT INTO users (first_name, last_name, email, password_hash, role, is_active) VALUES ($1,$2,$3,$4,$5,TRUE)',
      [firstName, lastName || '', email, hash, role || 'master']
    );
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ ok: false, error: e.message }); }
});

// Редактировать пользователя (только ADMIN)
app.put('/api/users/:id', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ ok: false, error: 'Доступ запрещён' });
    var { firstName, lastName, email, role, isActive } = req.body;
    if (!firstName || !email) return res.status(400).json({ ok: false, error: 'Имя и email обязательны' });
    await pool.query(
      'UPDATE users SET first_name=$1, last_name=$2, email=$3, role=$4, is_active=$5 WHERE id=$6',
      [firstName, lastName || '', email, role, isActive !== false, req.params.id]
    );
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ ok: false, error: e.message }); }
});

// Сменить пароль пользователю (только ADMIN)
app.put('/api/users/:id/password', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ ok: false, error: 'Доступ запрещён' });
    var { password } = req.body;
    if (!password || password.length < 6) return res.status(400).json({ ok: false, error: 'Пароль минимум 6 символов' });
    var hash = await bcrypt.hash(password, 10);
    await pool.query('UPDATE users SET password_hash=$1 WHERE id=$2', [hash, req.params.id]);
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ ok: false, error: e.message }); }
});

// Удалить пользователя (только ADMIN)
app.delete('/api/users/:id', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ ok: false, error: 'Доступ запрещён' });
    if (parseInt(req.params.id) === req.user.id) return res.status(400).json({ ok: false, error: 'Нельзя удалить свой аккаунт' });
    // Обнуляем created_by во всех связанных таблицах перед удалением
    await pool.query('UPDATE tech_operations_archive SET created_by=NULL WHERE created_by=$1', [req.params.id]);
    await pool.query('UPDATE products_archive SET created_by=NULL WHERE created_by=$1', [req.params.id]);
    await pool.query('UPDATE production_orders SET created_by=NULL WHERE created_by=$1', [req.params.id]);
    await pool.query('DELETE FROM users WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ ok: false, error: e.message }); }
});

// Обновление своего профиля
app.put('/api/profile', auth, async (req, res) => {
  try {
    const { firstName, lastName, email } = req.body;
    const userId = req.user.id;

    if (!firstName) {
      return res.status(400).json({ ok: false, error: 'Имя обязательно' });
    }

    const result = await pool.query(`
      UPDATE users 
      SET first_name = $1, last_name = $2, email = $3
      WHERE id = $4 
      RETURNING id, email, first_name, last_name, role
    `, [firstName, lastName || '', email, userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ ok: false, error: 'Пользователь не найден' });
    }

    res.json({ 
      ok: true, 
      message: 'Профиль обновлён',
      user: result.rows[0]
    });
  } catch(e) {
    console.error(e);
    res.status(500).json({ ok: false, error: 'Ошибка обновления профиля' });
  }
});

// Получить данные текущего пользователя
app.get('/api/profile/me', auth, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT id, email, first_name, last_name, role 
      FROM users 
      WHERE id = $1
    `, [req.user.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ ok: false, error: 'Пользователь не найден' });
    }

    res.json({ ok: true, user: result.rows[0] });
  } catch(e) {
    console.error(e);
    res.status(500).json({ ok: false, error: 'Ошибка сервера' });
  }
});

// Мои записи — всё что создал текущий пользователь
app.get('/api/profile/my-records', auth, async (req, res) => {
  try {
    var uid = req.user.id;
    var [ops, archive, orders] = await Promise.all([
      pool.query(
        'SELECT id, classifier_code, product_name, operation_number, operation_name, created_at FROM tech_operations_archive WHERE created_by = $1 ORDER BY created_at DESC LIMIT 200',
        [uid]
      ),
      pool.query(
        'SELECT assembly_id, item_name, classifier, object_type, created_at FROM products_archive WHERE created_by = $1 AND level = 0 ORDER BY created_at DESC LIMIT 200',
        [uid]
      ),
      pool.query(
        'SELECT * FROM (' +
          'SELECT DISTINCT ON (narad_number) narad_number, product_name, created_at, ' +
          'CASE WHEN started_at IS NULL THEN \'Новый\' ' +
               'WHEN COALESCE(ready,0) >= COALESCE(quantity,0) AND COALESCE(quantity,0) > 0 THEN \'Готово\' ' +
               'ELSE \'В работе\' END AS status ' +
          'FROM production_orders WHERE created_by = $1 ORDER BY narad_number, created_at DESC' +
        ') t ORDER BY created_at DESC LIMIT 200',
        [uid]
      )
    ]);
    res.json({
      ok: true,
      techOps: ops.rows,
      archiveItems: archive.rows,
      productionOrders: orders.rows
    });
  } catch(e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// Production orders - read
app.get('/api/production', auth, async (req, res) => {
  try {
    var { view, q, status, limit, page } = req.query;
    limit = parseInt(limit) || 50;
    page = parseInt(page) || 1;
    var offset = (page - 1) * limit;

    var params = [], pi = 1;

    // Общие условия (поиск по тексту)
    var conds = [];
    if (q) {
      conds.push('(narad_number ILIKE $'+pi+' OR product_name ILIKE $'+pi+' OR classifier_code ILIKE $'+pi+')');
      params.push('%'+q+'%');
      pi++;
    }

    // Условие статуса — РАЗНОЕ для двух view:
    //  • operations: смотрим на ОДНУ строку (это конкретная операция)
    //  • projects:   смотрим на агрегат всех операций наряда (agg.done_parts = MIN(ready))
    var s = status ? String(status).replace(/^[^\wА-Яа-я]+/, '').trim() : '';
    var statusOps = '', statusProj = '';
    if (s === 'Новый') {
      statusOps  = 'started_at IS NULL';
      statusProj = 'p.started_at IS NULL';
    } else if (s === 'Готово') {
      statusOps  = 'COALESCE(ready,0) >= COALESCE(quantity,0) AND COALESCE(quantity,0) > 0';
      statusProj = 'COALESCE(agg.done_parts,0) >= COALESCE(p.quantity,0) AND COALESCE(p.quantity,0) > 0';
    } else if (s === 'В работе') {
      statusOps  = 'started_at IS NOT NULL AND (COALESCE(ready,0) < COALESCE(quantity,0) OR COALESCE(quantity,0) = 0)';
      statusProj = 'p.started_at IS NOT NULL AND (COALESCE(agg.done_parts,0) < COALESCE(p.quantity,0) OR COALESCE(p.quantity,0) = 0)';
    } else if (s === 'Пауза') {
      statusOps  = 'paused_at IS NOT NULL AND NOT (COALESCE(ready,0) >= COALESCE(quantity,0) AND COALESCE(quantity,0) > 0)';
      // В проектном плане Пауза не выделяется — фильтр там просто игнорируется
    }

    if (view === 'projects') {
      // WHERE для projects: общие conds (с префиксом p.) + статус по агрегату
      var pCond = conds.map(function(c){
        return c.replace(/narad_number/g,'p.narad_number')
                .replace(/product_name/g,'p.product_name')
                .replace(/classifier_code/g,'p.classifier_code');
      });
      if (statusProj) pCond.push(statusProj);
      var where = pCond.length ? 'WHERE ' + pCond.join(' AND ') : '';

      params.push(limit, offset);
      var sql = 'SELECT DISTINCT ON (p.narad_number, p.classifier_code) p.*, ' +
          'agg.total_ops, agg.done_ops, ' +
          'COALESCE(agg.done_parts, 0) AS ready_parts, ' +
          'CASE WHEN agg.total_ops > 0 THEN agg.done_ops::numeric / agg.total_ops ELSE 0 END AS progress_pct, ' +
          'CASE WHEN p.started_at IS NULL THEN \'Новый\' ' +
               'WHEN COALESCE(agg.done_parts,0) >= COALESCE(p.quantity,0) AND COALESCE(p.quantity,0) > 0 THEN \'Готово\' ' +
               'ELSE \'В работе\' END AS status, ' +
          'GREATEST(COALESCE(p.quantity,0) - COALESCE(agg.done_parts,0), 0) AS not_ready, ' +
          'NULLIF(TRIM(COALESCE(u.last_name,\'\') || \' \' || COALESCE(u.first_name,\'\')), \'\') AS creator_name ' +
        'FROM production_orders p ' +
        'LEFT JOIN (' +
          'SELECT narad_number, classifier_code, ' +
            'COUNT(*) AS total_ops, ' +
            'COUNT(*) FILTER (WHERE COALESCE(ready,0) >= COALESCE(quantity,0) AND COALESCE(quantity,0) > 0) AS done_ops, ' +
            'MIN(ready) AS done_parts ' +
          'FROM production_orders GROUP BY narad_number, classifier_code' +
        ') agg ON p.narad_number = agg.narad_number AND p.classifier_code = agg.classifier_code ' +
        'LEFT JOIN users u ON p.created_by = u.id ' +
        where +
        ' ORDER BY p.narad_number, p.classifier_code, p.id LIMIT $'+pi+' OFFSET $'+(pi+1);
      var rows = await pool.query(sql, params);
      res.json({ ok: true, rows: rows.rows });
    } else {
      // WHERE для operations: общие conds + статус по конкретной строке
      if (statusOps) conds.push(statusOps);
      var where = conds.length ? 'WHERE ' + conds.join(' AND ') : '';

      params.push(limit + 1, offset);
      var sql = 'SELECT po.*, ' +
        'NULLIF(TRIM(COALESCE(u.last_name,\'\') || \' \' || COALESCE(u.first_name,\'\')), \'\') AS creator_name, ' +
        'CASE WHEN po.started_at IS NULL THEN \'Новый\' ' +
             'WHEN COALESCE(po.ready,0) >= COALESCE(po.quantity,0) AND COALESCE(po.quantity,0) > 0 THEN \'Готово\' ' +
             'WHEN po.paused_at IS NOT NULL THEN \'Пауза\' ' +
             'ELSE \'В работе\' END AS status, ' +
        'GREATEST(COALESCE(po.quantity,0) - COALESCE(po.ready,0), 0) AS not_ready ' +
        'FROM production_orders po ' +
        'LEFT JOIN users u ON po.created_by = u.id ' + where +
        ' ORDER BY narad_number, classifier_code, operation_number LIMIT $'+pi+' OFFSET $'+(pi+1);
      var rows = await pool.query(sql, params);
      var hasMore = rows.rows.length > limit;
      if (hasMore) rows.rows.pop();
      res.json({ ok: true, rows: rows.rows, total: hasMore ? offset+limit+1 : offset+rows.rows.length });
    }
  } catch(e) { res.status(500).json({ ok: false, error: e.message }); }
});

// Production - load ops from archive for assembly
app.get('/api/production/load-from-archive', auth, async (req, res) => {
  try {
    var { assembly_id } = req.query;
    if (!assembly_id) return res.status(400).json({ ok: false, error: 'assembly_id required' });
    var parts = await pool.query('SELECT * FROM products_archive WHERE assembly_id = $1 ORDER BY level, struct_id', [assembly_id]);
    var allOps = [];
    for (var i = 0; i < parts.rows.length; i++) {
      var p = parts.rows[i];
      if (!p.classifier || p.object_type === 'ПКИ') continue;
      var ops = await pool.query('SELECT * FROM tech_operations_archive WHERE LOWER(classifier_code) = LOWER($1) ORDER BY operation_number', [p.classifier]);
      ops.rows.forEach(function(o) { allOps.push(o); });
    }
    res.json({ ok: true, operations: allOps });
  } catch(e) { res.status(500).json({ ok: false, error: e.message }); }
});

// Production - create order
app.post('/api/production', auth, async (req, res) => {
  try {
    var b = req.body;
    if (!b.naradNumber) return res.status(400).json({ ok: false, error: 'Номер наряда обязателен' });
    // Если наряд уже существует — удаляем старый (перезапись)
    var existing = await pool.query('SELECT id FROM production_orders WHERE narad_number = $1 LIMIT 1', [b.naradNumber]);
    if (existing.rows.length > 0) {
      await pool.query('DELETE FROM production_orders WHERE narad_number = $1', [b.naradNumber]);
      console.log('Перезаписан наряд:', b.naradNumber);
    }
    var ops;
    if (b.classifierCode && b.productName) {
      // Выбрано конкретное изделие — только его операции
      var r = await pool.query(
        'SELECT * FROM tech_operations_archive WHERE LOWER(classifier_code) = LOWER($1) AND LOWER(product_name) = LOWER($2) ORDER BY operation_number',
        [b.classifierCode, b.productName]
      );
      ops = r.rows;
      // Если assembly_id не указан — ищем в products_archive
      if (!b.assemblyId && b.classifierCode) {
        var arcRow = await pool.query(
          'SELECT assembly_id FROM products_archive WHERE LOWER(classifier) = LOWER($1) AND assembly_id IS NOT NULL LIMIT 1',
          [b.classifierCode]
        );
        if (arcRow.rows.length) b.assemblyId = arcRow.rows[0].assembly_id;
      }
    } else if (b.assemblyId) {
      // Выбрано только головное изделие — все операции всех деталей
      var parts = await pool.query(
        'SELECT * FROM products_archive WHERE assembly_id = $1 ORDER BY level, struct_id',
        [b.assemblyId]
      );
      ops = [];
      for (var i = 0; i < parts.rows.length; i++) {
        var p = parts.rows[i];
        if (!p.classifier || p.object_type === 'ПКИ') continue;
        var pOps = await pool.query(
          'SELECT * FROM tech_operations_archive WHERE LOWER(classifier_code) = LOWER($1) ORDER BY operation_number',
          [p.classifier]
        );
        pOps.rows.forEach(function(o) { ops.push(o); });
      }
    } else {
      return res.status(400).json({ ok: false, error: 'Укажите изделие или головное изделие' });
    }
    var added = 0;
    
    if (b.classifierCode && b.productName) {
      // Одна деталь — один наряд
      for (var j = 0; j < ops.length; j++) {
        var o = ops[j];
        await pool.query(
          'INSERT INTO production_orders (narad_number,status,order_number,customer,production_start_date,operation_number,is_final,product_name,classifier_code,object_type,material_grade,assortment,material_amount,unit_of_measure,operation_name,machine_resource,operation_comment,quantity,priority,deadline,norm_time_hours,load_per_unit_hours,batch_prep_hours,assembly_id,serial_number,executor,is_cnc,plan_minutes,created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29)',
          [b.naradNumber, 'Новый', b.orderNumber||null, b.customer||null, b.productionStartDate||null, o.operation_number, o.is_final, o.product_name, o.classifier_code, o.object_type, o.material_grade, o.assortment, o.material_amount, o.unit_of_measure, o.operation_name, o.machine_resource, o.operation_comment, b.quantity||1, b.priority||3, b.deadline||null, o.norm_time_hours, o.load_per_unit_hours, o.batch_prep_hours, b.assemblyId||null, o.serial_number, o.executor, o.is_cnc, (o.norm_time_hours||0)*60*(b.quantity||1), req.user.id]
        );
        added++;
      }
    } else {
      // Головное изделие — каждой детали свой наряд
      // Парсим базовый номер: "2026-01" → prefix="2026-", num=1
      var baseNarad = b.naradNumber;
      var match = baseNarad.match(/^(.*?)(\d+)$/);
      var prefix = match ? match[1] : baseNarad + '-';
      var startNum = match ? parseInt(match[2]) : 1;
      var padLen = match ? match[2].length : 2;
      
      // Группируем операции по classifier_code
      var groups = {};
      ops.forEach(function(o) {
        var key = o.classifier_code;
        if (!groups[key]) groups[key] = [];
        groups[key].push(o);
      });
      
      var keys = Object.keys(groups);
      var naradIndex = 0;
      
      for (var k = 0; k < keys.length; k++) {
        var grOps = groups[keys[k]];
        var currentNarad = prefix + String(startNum + naradIndex).padStart(padLen, '0');
        
        for (var j = 0; j < grOps.length; j++) {
          var o = grOps[j];
          await pool.query(
            'INSERT INTO production_orders (narad_number,status,order_number,customer,production_start_date,operation_number,is_final,product_name,classifier_code,object_type,material_grade,assortment,material_amount,unit_of_measure,operation_name,machine_resource,operation_comment,quantity,priority,deadline,norm_time_hours,load_per_unit_hours,batch_prep_hours,assembly_id,serial_number,executor,is_cnc,plan_minutes,created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29)',
            [currentNarad, 'Новый', b.orderNumber||null, b.customer||null, b.productionStartDate||null, o.operation_number, o.is_final, o.product_name, o.classifier_code, o.object_type, o.material_grade, o.assortment, o.material_amount, o.unit_of_measure, o.operation_name, o.machine_resource, o.operation_comment, b.quantity||1, b.priority||3, b.deadline||null, o.norm_time_hours, o.load_per_unit_hours, o.batch_prep_hours, b.assemblyId||null, o.serial_number, o.executor, o.is_cnc, (o.norm_time_hours||0)*60*(b.quantity||1), req.user.id]
          );
          added++;
        }
        naradIndex++;
      }
    }
    
    console.log('Наряды созданы:', b.naradNumber, '| операций:', added);
    res.json({ ok: true, added: added });
  } catch(e) { 
    console.log('production error:', e.message);
    res.status(500).json({ ok: false, error: e.message }); 
  }
});

// Get next narad number + lists for form
app.get('/api/production/form-data', auth, async (req, res) => {
  try {
    // Последний номер наряда
    var lastNarad = await pool.query(
      "SELECT narad_number FROM production_orders ORDER BY narad_number DESC LIMIT 1"
    );
    var nextNarad = '';
    if (lastNarad.rows.length) {
      var last = lastNarad.rows[0].narad_number;
      var match = last.match(/^(.*?)(\d+)$/);
      if (match) {
        var num = parseInt(match[2]) + 1;
        nextNarad = match[1] + String(num).padStart(match[2].length, '0');
      }
    }
    if (!nextNarad) {
      var year = new Date().getFullYear();
      nextNarad = year + '-01';
    }

    // Список заказов
    var orders = await pool.query(
      "SELECT DISTINCT order_number FROM production_orders WHERE order_number IS NOT NULL AND order_number != '' ORDER BY order_number"
    );

    // Список заказчиков
    var customers = await pool.query(
      "SELECT DISTINCT customer FROM production_orders WHERE customer IS NOT NULL AND customer != '' ORDER BY customer"
    );

    res.json({
      ok: true,
      nextNarad: nextNarad,
      orders: orders.rows.map(function(r) { return r.order_number; }),
      customers: customers.rows.map(function(r) { return r.customer; })
    });
  } catch(e) { res.status(500).json({ ok: false, error: e.message }); }
});

// Get single production order detail
app.get('/api/production/detail', auth, async (req, res) => {
  try {
    var { id } = req.query;
    if (!id) return res.status(400).json({ ok: false, error: 'id required' });
    var result = await pool.query('SELECT * FROM production_orders WHERE id = $1', [id]);
    if (!result.rows.length) return res.json({ ok: false, error: 'Not found' });
    res.json({ ok: true, row: result.rows[0] });
  } catch(e) { res.status(500).json({ ok: false, error: e.message }); }
});


app.get('/api/archive/assemblies', auth, async (req, res) => {
  try {
    var rows = await pool.query(
      "SELECT DISTINCT assembly_id, item_name FROM products_archive WHERE struct_id = '0' AND assembly_id IS NOT NULL ORDER BY item_name"
    );
    res.json({ ok: true, rows: rows.rows });
  } catch(e) { res.status(500).json({ ok: false, error: e.message }); }
});



// Submit factory fact (master's report) - updated version with better status handling and not_ready calculation
app.post('/api/production/fact', auth, async (req, res) => {
  try {
    var b = req.body;
    if (!b.naradNumber || !b.operationNumber) {
      return res.status(400).json({ ok: false, error: 'naradNumber and operationNumber required' });
    }

    var deltaReady   = parseInt(b.ready)   || 0;
    var deltaDefects = parseInt(b.defects) || 0;

    if (deltaReady < 0 || deltaDefects < 0) {
      return res.status(400).json({ ok: false, error: 'Количества не могут быть отрицательными' });
    }

    // Чистим статус от эмодзи и решаем, что делать
    var clean = String(b.status||'').replace(/^[^\wА-Яа-я]+/, '').trim();
    var markPause    = (clean === 'Пауза');

    // Текущее состояние операции
    var cur = await pool.query(
      'SELECT quantity, ready FROM production_orders WHERE narad_number=$1 AND operation_number=$2 LIMIT 1',
      [b.naradNumber, b.operationNumber]
    );
    if (!cur.rows.length) {
      return res.status(404).json({ ok: false, error: 'Операция не найдена' });
    }
    var quantity = parseInt(cur.rows[0].quantity) || 0;
    var oldReady = parseInt(cur.rows[0].ready)    || 0;

    // Первый ввод факта = выдаём наряд в производство
    await pool.query(
      'UPDATE production_orders SET started_at=NOW() WHERE narad_number=$1 AND started_at IS NULL',
      [b.naradNumber]
    );

    var upd;

    // Накапливаем ready и defects с капом по quantity
    var maxAdd = Math.max(0, quantity - oldReady);
    if (deltaReady > maxAdd) {
      return res.status(400).json({
        ok: false,
        error: 'Можно добавить максимум ' + maxAdd + ' годных. Уже отмечено ' + oldReady + ' из ' + quantity + '.'
      });
    }
    var upd = await pool.query(
      'UPDATE production_orders SET ' +
        'ready    = COALESCE(ready,0)        + $1, ' +
        'defects  = COALESCE(defects,0)      + $2, ' +
        'fact_minutes = COALESCE(fact_minutes,0) + $3, ' +
        'workshop_area     = $4, ' +
        'operation_comment = $5, ' +
        'updated_at = NOW() ' +
      'WHERE narad_number=$6 AND operation_number=$7 ' +
      'RETURNING quantity, ready, defects',
      [deltaReady, deltaDefects, b.factMinutes||0, b.workshopArea||null, b.comment||null, b.naradNumber, b.operationNumber]
    );

    // Обновляем флаг паузы (отдельным UPDATE, чтобы не плодить ветки)
    if (markPause) {
      await pool.query(
        'UPDATE production_orders SET paused_at=NOW() WHERE narad_number=$1 AND operation_number=$2',
        [b.naradNumber, b.operationNumber]
      );
    } else {
      // Любое другое действие = работа возобновлена
      await pool.query(
        'UPDATE production_orders SET paused_at=NULL WHERE narad_number=$1 AND operation_number=$2',
        [b.naradNumber, b.operationNumber]
      );
    }
    // Сводка по наряду для ответа клиенту
    var summary = await pool.query(
      'SELECT COUNT(*) AS total_ops, ' +
      'COUNT(*) FILTER (WHERE COALESCE(ready,0) >= COALESCE(quantity,0) AND COALESCE(quantity,0) > 0) AS done_ops ' +
      'FROM production_orders WHERE narad_number=$1',
      [b.naradNumber]
    );
    var totalOps = parseInt(summary.rows[0].total_ops) || 0;
    var doneOps  = parseInt(summary.rows[0].done_ops)  || 0;
    var pct      = totalOps > 0 ? (doneOps / totalOps) : 0;
    var allDone  = totalOps > 0 && doneOps === totalOps;

    var newReady = upd.rows[0].ready;
    var qty      = upd.rows[0].quantity;
    var naradStatus = allDone ? 'Готово' : (doneOps > 0 || newReady > 0 ? 'В работе' : 'Новый');

    console.log('Факт:', b.naradNumber, 'оп.', b.operationNumber,
                '|', '+годных:'+deltaReady,
                '→', newReady, '/', qty,
                '| +брак:', deltaDefects, '→', upd.rows[0].defects);

    res.json({
      ok: true,
      naradStatus: naradStatus,
      progress: Math.round(pct * 100) + '%',
      ready: newReady,
      quantity: qty,
      defects: upd.rows[0].defects,
      notReady: Math.max(0, qty - newReady)
    });
  } catch(e) {
    console.log('fact error:', e.message);
    res.status(500).json({ ok: false, error: e.message });  
  }
});

// Update narad status
app.post('/api/production/status', auth, async (req, res) => {
  try {
    var { naradNumber, status } = req.body;
    if (!naradNumber) return res.status(400).json({ ok: false, error: 'naradNumber required' });

    // Чистим эмодзи и пробелы — статус теперь чистый
    var s = String(status||'').replace(/^[^\wА-Яа-я]+/, '').trim();

    if (s === 'В работе') {
      // Выдача в производство: ставим started_at, ready не трогаем
      await pool.query(
        'UPDATE production_orders SET started_at=COALESCE(started_at,NOW()), updated_at=NOW() WHERE narad_number=$1',
        [naradNumber]
      );
    } else if (s === 'Готово') {
      // Ручная отметка наряда готовым: ready=quantity по всем операциям
      await pool.query(
        'UPDATE production_orders SET started_at=COALESCE(started_at,NOW()), ready=quantity, updated_at=NOW() WHERE narad_number=$1',
        [naradNumber]
      );
    } else if (s === 'Новый') {
      // Сброс наряда обратно в "Новый"
      await pool.query(
        'UPDATE production_orders SET started_at=NULL, ready=0, defects=0, fact_minutes=0, updated_at=NOW() WHERE narad_number=$1',
        [naradNumber]
      );
    } else {
      return res.status(400).json({ ok: false, error: 'Неизвестный статус: ' + status });
    }

    console.log('Статус наряда', naradNumber, '→', s);
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ ok: false, error: e.message }); }
});

// Static frontend
app.use(express.static(path.join(__dirname, '../frontend')));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, '../frontend/index.html')));

app.listen(PORT, () => console.log('ЦИР MES -> http://localhost:' + PORT));


