var express = require('express');
var bcrypt  = require('bcryptjs');
var jwt     = require('jsonwebtoken');

module.exports = function(pool) {
  var router = express.Router();
  var SECRET = process.env.JWT_SECRET;

  router.get('/health', async function(req, res) {
    try { await pool.query('SELECT 1'); res.json({ ok: true, db: 'connected' }); }
    catch(e) { res.json({ ok: false, error: e.message }); }
  });

  router.post('/auth/login', async function(req, res) {
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

  router.post('/auth/register', async function(req, res) {
    try {
      var { email, password, firstName, lastName, role } = req.body;
      if (!email || !password || !firstName)
        return res.status(400).json({ ok: false, error: 'Заполните обязательные поля (Имя, Email, Пароль)' });
      var exists = await pool.query('SELECT id FROM users WHERE email=$1', [email]);
      if (exists.rows.length)
        return res.status(409).json({ ok: false, error: 'Пользователь с таким email уже существует' });
      var hash = await bcrypt.hash(password, 10);
      var result = await pool.query(
        'INSERT INTO users (email, password_hash, first_name, last_name, role, is_active, created_at) VALUES ($1,$2,$3,$4,$5,TRUE,NOW()) RETURNING id, email, role, first_name, last_name',
        [email, hash, firstName, lastName || '', role || 'technologist']
      );
      res.json({ ok: true, message: 'Пользователь успешно зарегистрирован', user: result.rows[0] });
    } catch(e) {
      console.error('Register error:', e.message);
      res.status(500).json({ ok: false, error: 'Ошибка при регистрации' });
    }
  });

  return router;
};
