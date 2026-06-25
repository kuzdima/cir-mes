var express = require('express');
var bcrypt  = require('bcryptjs');

module.exports = function(pool, auth) {
  var router = express.Router();

  function adminOnly(req, res, next) {
    if (req.user.role !== 'admin') return res.status(403).json({ ok: false, error: 'Доступ только для администратора' });
    next();
  }

  router.get('/', auth, adminOnly, async function(req, res) {
    try {
      var result = await pool.query(
        'SELECT id, first_name, last_name, email, password_hash, role, is_active, last_login, created_at FROM users ORDER BY created_at DESC'
      );
      res.json({ ok: true, users: result.rows });
    } catch(e) { res.status(500).json({ ok: false, error: 'Ошибка сервера' }); }
  });

  router.post('/', auth, adminOnly, async function(req, res) {
    try {
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

  router.put('/:id', auth, adminOnly, async function(req, res) {
    try {
      var { firstName, lastName, email, role, isActive } = req.body;
      if (!firstName || !email) return res.status(400).json({ ok: false, error: 'Имя и email обязательны' });
      await pool.query(
        'UPDATE users SET first_name=$1, last_name=$2, email=$3, role=$4, is_active=$5 WHERE id=$6',
        [firstName, lastName || '', email, role, isActive !== false, req.params.id]
      );
      res.json({ ok: true });
    } catch(e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  router.put('/:id/password', auth, adminOnly, async function(req, res) {
    try {
      var { password } = req.body;
      if (!password || password.length < 6) return res.status(400).json({ ok: false, error: 'Пароль минимум 6 символов' });
      var hash = await bcrypt.hash(password, 10);
      await pool.query('UPDATE users SET password_hash=$1 WHERE id=$2', [hash, req.params.id]);
      res.json({ ok: true });
    } catch(e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  router.delete('/:id', auth, adminOnly, async function(req, res) {
    try {
      if (parseInt(req.params.id) === req.user.id) return res.status(400).json({ ok: false, error: 'Нельзя удалить свой аккаунт' });
      await pool.query('UPDATE tech_operations_archive SET created_by=NULL WHERE created_by=$1', [req.params.id]);
      await pool.query('UPDATE products_archive SET created_by=NULL WHERE created_by=$1', [req.params.id]);
      await pool.query('UPDATE production_orders SET created_by=NULL WHERE created_by=$1', [req.params.id]);
      await pool.query('DELETE FROM users WHERE id=$1', [req.params.id]);
      res.json({ ok: true });
    } catch(e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  return router;
};
