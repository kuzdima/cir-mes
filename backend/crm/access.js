module.exports = function(app, pool, io, auth, adminOnly) {

  app.get('/api/crm/access', auth, adminOnly, function(req, res) {
    pool.query(
      'SELECT u.id, u.first_name, u.last_name, u.email, u.role, ca.created_at AS access_granted FROM crm_access ca INNER JOIN users u ON u.id = ca.user_id ORDER BY u.first_name',
      function(err, result) {
        if (err) return res.status(500).json({ ok: false, error: err.message });
        res.json({ ok: true, rows: result.rows });
      }
    );
  });

  app.post('/api/crm/access', auth, adminOnly, async function(req, res) {
    try {
      var { user_id } = req.body;
      if (!user_id) return res.status(400).json({ ok: false, error: 'user_id обязателен' });
      await pool.query('INSERT INTO crm_access (user_id) VALUES ($1) ON CONFLICT DO NOTHING', [user_id]);
      io.emit('crm:access-changed', { userId: user_id });
      res.json({ ok: true });
    } catch(e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  app.delete('/api/crm/access/:userId', auth, adminOnly, async function(req, res) {
    try {
      await pool.query('DELETE FROM crm_access WHERE user_id = $1', [req.params.userId]);
      io.emit('crm:access-changed', { userId: parseInt(req.params.userId) });
      res.json({ ok: true });
    } catch(e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  app.get('/api/crm/users', auth, adminOnly, async function(req, res) {
    try {
      var r = await pool.query('SELECT id, first_name, last_name, email, role FROM users ORDER BY first_name');
      res.json({ ok: true, rows: r.rows });
    } catch(e) { res.status(500).json({ ok: false, error: e.message }); }
  });

};
