var fs = require('fs');
var path = require('path');
var multer = require('multer');
var crypto = require('crypto');
var Router = require('express').Router;

var allowedMimes = [
  'image/jpeg', 'image/png', 'image/gif',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
];

var CATEGORIES = ['problem', 'suggestion', 'improvement'];
var PRIORITIES = ['low', 'medium', 'high'];
var STATUSES   = ['open', 'in_progress', 'resolved', 'closed'];

var uploadDir = path.join(__dirname, 'uploads', 'feedback');
fs.mkdirSync(uploadDir, { recursive: true });

module.exports = function(pool, auth) {
  initTables(pool);
  var router = Router();

  function checkResponsible(req) {
    return new Promise(function(resolve, reject) {
      if (req.user.role === 'admin') return resolve(true);
      if (req._fbResponsible !== undefined) return resolve(req._fbResponsible);
      pool.query('SELECT 1 FROM feedback_access WHERE user_id = $1', [req.user.id], function(err, r) {
        if (err) return reject(err);
        req._fbResponsible = r.rows.length > 0;
        resolve(req._fbResponsible);
      });
    });
  }

  function responsibleOnly(req, res, next) {
    checkResponsible(req).then(function(r) {
      if (r) return next();
      res.status(403).json({ ok: false, error: 'Только для ответственных' });
    }).catch(function(e) {
      res.status(500).json({ ok: false, error: e.message });
    });
  }

  // ---------- users (assignable) ----------
  router.get('/users', auth, responsibleOnly, async function(req, res) {
    try {
      var r = await pool.query(
        "SELECT id, email, first_name, last_name FROM users WHERE is_active = true AND (role = 'admin' OR id IN (SELECT user_id FROM feedback_access)) ORDER BY last_name, first_name"
      );
      var rows = r.rows.map(function(u) {
        var name = (u.last_name || '') + ' ' + (u.first_name || '');
        return { id: u.id, name: name.trim() || u.email, email: u.email };
      });
      res.json({ ok: true, rows: rows });
    } catch(e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  // ---------- check access ----------
  router.get('/check-access', auth, async function(req, res) {
    try {
      res.json({ ok: true, is_responsible: await checkResponsible(req) });
    } catch(e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  // ---------- access management (admin only) ----------
  router.get('/users/all', auth, async function(req, res) {
    try {
      if (req.user.role !== 'admin') return res.status(403).json({ ok: false, error: 'Только для администратора' });
      var r = await pool.query('SELECT id, first_name, last_name, email, role FROM users ORDER BY first_name');
      var rows = r.rows.map(function(u) {
        var name = (u.last_name || '') + ' ' + (u.first_name || '');
        return { id: u.id, name: name.trim() || u.email, email: u.email, role: u.role };
      });
      res.json({ ok: true, rows: rows });
    } catch(e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  router.get('/access', auth, async function(req, res) {
    try {
      if (req.user.role !== 'admin') return res.status(403).json({ ok: false, error: 'Только для администратора' });
      var r = await pool.query(
        'SELECT u.id, u.first_name, u.last_name, u.email, u.role, fa.created_at AS access_granted'
        + ' FROM feedback_access fa INNER JOIN users u ON u.id = fa.user_id ORDER BY u.first_name'
      );
      res.json({ ok: true, rows: r.rows });
    } catch(e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  router.post('/access', auth, async function(req, res) {
    try {
      if (req.user.role !== 'admin') return res.status(403).json({ ok: false, error: 'Только для администратора' });
      var userId = parseInt(req.body.user_id);
      if (!userId) return res.status(400).json({ ok: false, error: 'user_id обязателен' });
      await pool.query('INSERT INTO feedback_access (user_id) VALUES ($1) ON CONFLICT DO NOTHING', [userId]);
      res.json({ ok: true });
    } catch(e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  router.delete('/access/:userId', auth, async function(req, res) {
    try {
      if (req.user.role !== 'admin') return res.status(403).json({ ok: false, error: 'Только для администратора' });
      await pool.query('DELETE FROM feedback_access WHERE user_id = $1', [req.params.userId]);
      res.json({ ok: true });
    } catch(e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  // ---------- count ----------
  router.get('/count', auth, async function(req, res) {
    try {
      var r;
      if (await checkResponsible(req)) {
        r = await pool.query("SELECT COUNT(*) FROM feedback WHERE status = 'open'");
      } else {
        r = await pool.query("SELECT COUNT(*) FROM feedback WHERE created_by = $1 AND status = 'open'", [req.user.id]);
      }
      res.json({ ok: true, open: parseInt(r.rows[0].count) });
    } catch(e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  // ---------- list ----------
  router.get('/', auth, async function(req, res) {
    try {
      var { category, status, priority, created_by, assigned_to, q, page, limit } = req.query;
      page = parseInt(page) || 1;
      limit = parseInt(limit) || 20;
      var offset = (page - 1) * limit;
      var conds = [], params = [], pi = 1;

      if (category) { conds.push('f.category = $' + pi); params.push(category); pi++; }
      var s = status;
      if (!s) s = 'open,in_progress';
      var st = s.split(',').filter(Boolean);
      if (st.length) {
        conds.push('f.status IN (' + st.map(function() { return '$' + (pi++); }).join(',') + ')');
        st.forEach(function(s) { params.push(s); });
      }
      if (priority) { conds.push('f.priority = $' + pi); params.push(priority); pi++; }
      if (created_by) { conds.push('f.created_by = $' + pi); params.push(parseInt(created_by)); pi++; }
      if (assigned_to) { conds.push('f.assigned_to = $' + pi); params.push(parseInt(assigned_to)); pi++; }
      if (q && q.length >= 2) {
        conds.push('(f.title ILIKE $' + pi + ' OR f.description ILIKE $' + (pi + 1) + ')');
        var qq = '%' + q + '%';
        params.push(qq, qq);
        pi += 2;
      }

      if (!(await checkResponsible(req))) {
        conds.push('f.created_by = $' + pi);
        params.push(req.user.id);
        pi++;
      }

      var where = conds.length ? ' WHERE ' + conds.join(' AND ') : '';
      params.push(limit + 1, offset);

      var rows = await pool.query(
        'SELECT f.*,'
        + " NULLIF(TRIM(COALESCE(cb.last_name,'') || ' ' || COALESCE(cb.first_name,'')), '') AS created_by_name,"
        + " NULLIF(TRIM(COALESCE(ab.last_name,'') || ' ' || COALESCE(ab.first_name,'')), '') AS assigned_to_name"
        + ' FROM feedback f'
        + ' LEFT JOIN users cb ON f.created_by = cb.id'
        + ' LEFT JOIN users ab ON f.assigned_to = ab.id'
        + where + ' ORDER BY f.created_at DESC LIMIT $' + (pi) + ' OFFSET $' + (pi + 1),
        params
      );

      var hasMore = rows.rows.length > limit;
      if (hasMore) rows.rows.pop();

      var result = rows.rows.map(function(r) {
        return {
          id: r.id, title: r.title, description: r.description,
          category: r.category, priority: r.priority, status: r.status,
          created_by: r.created_by ? { id: r.created_by, name: r.created_by_name || '' } : null,
          assigned_to: r.assigned_to ? { id: r.assigned_to, name: r.assigned_to_name || '' } : null,
          resolution: r.resolution, file_path: r.file_path, original_name: r.original_name,
          resolved_at: r.resolved_at, created_at: r.created_at, updated_at: r.updated_at
        };
      });

      res.json({ ok: true, rows: result, hasMore: hasMore });
    } catch(e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  // ---------- detail ----------
  router.get('/:id', auth, async function(req, res) {
    try {
      var id = parseInt(req.params.id);
      var r = await pool.query(
        'SELECT f.*,'
        + " NULLIF(TRIM(COALESCE(cb.last_name,'') || ' ' || COALESCE(cb.first_name,'')), '') AS created_by_name,"
        + " NULLIF(TRIM(COALESCE(ab.last_name,'') || ' ' || COALESCE(ab.first_name,'')), '') AS assigned_to_name"
        + ' FROM feedback f'
        + ' LEFT JOIN users cb ON f.created_by = cb.id'
        + ' LEFT JOIN users ab ON f.assigned_to = ab.id'
        + ' WHERE f.id = $1',
        [id]
      );
      if (!r.rows.length) return res.status(404).json({ ok: false, error: 'Не найдено' });

      var row = r.rows[0];
      if (!(await checkResponsible(req)) && row.created_by !== req.user.id) {
        return res.status(403).json({ ok: false, error: 'Нет доступа' });
      }

      res.json({ ok: true, row: {
        id: row.id, title: row.title, description: row.description,
        category: row.category, priority: row.priority, status: row.status,
        created_by: row.created_by ? { id: row.created_by, name: row.created_by_name || '' } : null,
        assigned_to: row.assigned_to ? { id: row.assigned_to, name: row.assigned_to_name || '' } : null,
        resolution: row.resolution, file_path: row.file_path, original_name: row.original_name,
        resolved_at: row.resolved_at, created_at: row.created_at, updated_at: row.updated_at
      }});
    } catch(e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  // ---------- create ----------
  router.post('/', auth, async function(req, res) {
    try {
      var { title, description, category, priority } = req.body;
      if (!title || title.trim().length < 3) return res.status(400).json({ ok: false, error: 'Заголовок минимум 3 символа' });
      if (!description || description.trim().length < 10) return res.status(400).json({ ok: false, error: 'Описание минимум 10 символов' });
      if (CATEGORIES.indexOf(category) === -1) return res.status(400).json({ ok: false, error: 'Недопустимая категория' });
      var p = priority || 'medium';
      if (PRIORITIES.indexOf(p) === -1) return res.status(400).json({ ok: false, error: 'Недопустимый приоритет' });

      var r = await pool.query(
        'INSERT INTO feedback (title, description, category, priority, created_by) VALUES ($1, $2, $3, $4, $5) RETURNING id',
        [title.trim(), description.trim(), category, p, req.user.id]
      );
      res.json({ ok: true, id: r.rows[0].id });
    } catch(e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  // ---------- update ----------
  router.put('/:id', auth, responsibleOnly, async function(req, res) {
    try {
      var id = parseInt(req.params.id);
      var b = req.body;
      var sets = [], params = [], pi = 1;

      if (b.status !== undefined) {
        if (STATUSES.indexOf(b.status) === -1) return res.status(400).json({ ok: false, error: 'Недопустимый статус' });
        sets.push('status = $' + pi);
        params.push(b.status);
        pi++;
        if (b.status === 'resolved') {
          sets.push('resolved_at = NOW()');
        } else {
          sets.push('resolved_at = NULL');
        }
      }
      if (b.assigned_to !== undefined) {
        sets.push('assigned_to = $' + pi);
        params.push(b.assigned_to ? parseInt(b.assigned_to) : null);
        pi++;
      }
      if (b.resolution !== undefined) {
        sets.push('resolution = $' + pi);
        params.push(b.resolution || null);
        pi++;
      }

      if (!sets.length) return res.status(400).json({ ok: false, error: 'Нет полей для обновления' });
      sets.push('updated_at = NOW()');
      params.push(id);

      var r = await pool.query(
        'UPDATE feedback SET ' + sets.join(', ') + ' WHERE id = $' + pi + ' RETURNING id',
        params
      );
      if (!r.rows.length) return res.status(404).json({ ok: false, error: 'Не найдено' });

      res.json({ ok: true });
    } catch(e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  // ---------- delete (admin only) ----------
  router.delete('/:id', auth, async function(req, res) {
    try {
      if (req.user.role !== 'admin') return res.status(403).json({ ok: false, error: 'Только для администратора' });
      var id = parseInt(req.params.id);
      var r = await pool.query('DELETE FROM feedback WHERE id = $1 RETURNING id', [id]);
      if (!r.rows.length) return res.status(404).json({ ok: false, error: 'Не найдено' });
      res.json({ ok: true });
    } catch(e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  // ---------- file upload ----------
  var storage = multer.diskStorage({
    destination: function(req, file, cb) { cb(null, uploadDir); },
    filename: function(req, file, cb) {
      cb(null, crypto.randomUUID() + path.extname(file.originalname));
    }
  });
  var upload = multer({
    storage: storage,
    limits: { fileSize: 50 * 1024 * 1024 },
    fileFilter: function(req, file, cb) {
      if (allowedMimes.indexOf(file.mimetype) !== -1) {
        cb(null, true);
      } else {
        cb(new Error('Недопустимый тип файла. Разрешены: JPG, PNG, GIF, PDF, DOC, DOCX, XLS, XLSX'));
      }
    }
  });

  router.post('/upload', auth, function(req, res, next) {
    upload.single('file')(req, res, function(err) {
      if (err) {
        if (err.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ ok: false, error: 'Файл слишком большой. Максимум 50 МБ' });
        return res.status(400).json({ ok: false, error: err.message });
      }
      next();
    });
  }, async function(req, res) {
    try {
      if (!req.file) return res.status(400).json({ ok: false, error: 'Файл не загружен' });
      var feedbackId = parseInt(req.body.feedback_id);

      if (!feedbackId) {
        var { title, description, category, priority } = req.body;
        if (!title || title.trim().length < 3) return res.status(400).json({ ok: false, error: 'Заголовок минимум 3 символа' });
        if (!description || description.trim().length < 10) return res.status(400).json({ ok: false, error: 'Описание минимум 10 символов' });
        if (CATEGORIES.indexOf(category) === -1) return res.status(400).json({ ok: false, error: 'Недопустимая категория' });
        var p = priority || 'medium';
        if (PRIORITIES.indexOf(p) === -1) return res.status(400).json({ ok: false, error: 'Недопустимый приоритет' });

        var cr = await pool.query(
          'INSERT INTO feedback (title, description, category, priority, created_by) VALUES ($1, $2, $3, $4, $5) RETURNING id',
          [title.trim(), description.trim(), category, p, req.user.id]
        );
        feedbackId = cr.rows[0].id;
      } else {
        var owner = await pool.query('SELECT created_by FROM feedback WHERE id = $1', [feedbackId]);
        if (!owner.rows.length) return res.status(404).json({ ok: false, error: 'Обращение не найдено' });
        if (owner.rows[0].created_by !== req.user.id && !(await checkResponsible(req))) {
          return res.status(403).json({ ok: false, error: 'Нет доступа' });
        }
      }

      var targetDir = path.join(uploadDir, String(feedbackId));
      fs.mkdirSync(targetDir, { recursive: true });
      await fs.promises.rename(req.file.path, path.join(targetDir, req.file.filename));

      var filePath = 'feedback/' + feedbackId + '/' + req.file.filename;
      var originalName = Buffer.from(req.file.originalname, 'latin1').toString('utf8');
      await pool.query(
        'UPDATE feedback SET file_path = $1, original_name = $2, updated_at = NOW() WHERE id = $3',
        [filePath, originalName, feedbackId]
      );

      res.json({ ok: true, id: feedbackId, file_path: filePath });
    } catch(e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  return router;
};

function initTables(pool) {
  var sql =
    'CREATE TABLE IF NOT EXISTS public.feedback ('
    + 'id SERIAL PRIMARY KEY,'
    + "title VARCHAR(255) NOT NULL,"
    + "description TEXT NOT NULL,"
    + "category VARCHAR(50) NOT NULL,"
    + "priority VARCHAR(10) NOT NULL DEFAULT 'medium',"
    + "status VARCHAR(20) NOT NULL DEFAULT 'open',"
    + 'created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,'
    + 'assigned_to INTEGER REFERENCES users(id) ON DELETE SET NULL,'
    + 'resolution TEXT,'
    + 'file_path VARCHAR(500),'
    + 'resolved_at TIMESTAMPTZ,'
    + 'created_at TIMESTAMPTZ DEFAULT NOW(),'
    + 'updated_at TIMESTAMPTZ DEFAULT NOW()'
    + ')';

  pool.query(sql, function(err) {
    if (err) {
      console.log('Feedback: ошибка создания таблицы:', err.message);
    } else {
      console.log('Feedback: таблица инициализирована');
    }
  });

  pool.query(
    'CREATE TABLE IF NOT EXISTS public.feedback_access ('
    + 'user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,'
    + 'created_at TIMESTAMPTZ DEFAULT NOW()'
    + ')',
    function(err) {
      if (err) console.log('Feedback: ошибка создания feedback_access:', err.message);
    }
  );

  pool.query("ALTER TABLE feedback ADD COLUMN IF NOT EXISTS original_name VARCHAR(500)", function(err) {
    if (err) console.log('Feedback: ошибка добавления original_name:', err.message);
  });
}
