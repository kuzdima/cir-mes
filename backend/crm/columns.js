module.exports = function(app, pool, io, auth, adminOnly, crmAccessOnly) {

  function emitColumns() {
    pool.query('SELECT * FROM crm_columns ORDER BY sort_order', function(err, result) {
      if (!err) io.emit('crm:columns-changed', { columns: result.rows });
    });
  }

  app.get('/api/crm/columns', auth, crmAccessOnly, function(req, res) {
    pool.query('SELECT * FROM crm_columns ORDER BY sort_order', function(err, result) {
      if (err) return res.status(500).json({ ok: false, error: err.message });
      res.json({ ok: true, rows: result.rows });
    });
  });

  app.post('/api/crm/columns', auth, adminOnly, async function(req, res) {
    try {
      var { name, sort_order } = req.body;
      if (!name) return res.status(400).json({ ok: false, error: 'Название обязательно' });
      var r = await pool.query(
        'INSERT INTO crm_columns (name, sort_order) VALUES ($1, COALESCE($2, 0)) RETURNING *',
        [name, sort_order]
      );
      emitColumns();
      res.json({ ok: true, row: r.rows[0] });
    } catch(e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  app.put('/api/crm/columns/reorder', auth, adminOnly, async function(req, res) {
    try {
      var { ids } = req.body;
      if (!Array.isArray(ids)) return res.status(400).json({ ok: false, error: 'ids должен быть массивом' });
      for (var i = 0; i < ids.length; i++) {
        await pool.query('UPDATE crm_columns SET sort_order = $1 WHERE id = $2', [i, ids[i]]);
      }
      emitColumns();
      res.json({ ok: true });
    } catch(e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  app.put('/api/crm/columns/:id', auth, adminOnly, async function(req, res) {
    try {
      var { name } = req.body;
      if (!name) return res.status(400).json({ ok: false, error: 'Название обязательно' });
      var r = await pool.query(
        'UPDATE crm_columns SET name = $1 WHERE id = $2 RETURNING *',
        [name, req.params.id]
      );
      if (!r.rows.length) return res.status(404).json({ ok: false, error: 'Колонка не найдена' });
      emitColumns();
      res.json({ ok: true, row: r.rows[0] });
    } catch(e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  app.delete('/api/crm/columns/:id', auth, adminOnly, async function(req, res) {
    try {
      await pool.query('DELETE FROM crm_columns WHERE id = $1', [req.params.id]);
      emitColumns();
      res.json({ ok: true });
    } catch(e) { res.status(500).json({ ok: false, error: e.message }); }
  });

};
