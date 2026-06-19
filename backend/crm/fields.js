module.exports = function(app, pool, io, auth, adminOnly, crmAccessOnly) {

  function emitFields() {
    pool.query('SELECT * FROM crm_field_definitions WHERE is_active = TRUE ORDER BY sort_order', function(err, result) {
      if (!err) io.emit('crm:fields-changed', { fields: result.rows });
    });
  }

  app.get('/api/crm/fields', auth, crmAccessOnly, function(req, res) {
    pool.query('SELECT * FROM crm_field_definitions WHERE is_active = TRUE ORDER BY sort_order', function(err, result) {
      if (err) return res.status(500).json({ ok: false, error: err.message });
      res.json({ ok: true, rows: result.rows });
    });
  });

  app.get('/api/crm/fields/deleted', auth, adminOnly, function(req, res) {
    pool.query('SELECT * FROM crm_field_definitions WHERE is_active = FALSE ORDER BY sort_order', function(err, result) {
      if (err) return res.status(500).json({ ok: false, error: err.message });
      res.json({ ok: true, rows: result.rows });
    });
  });

  app.post('/api/crm/fields', auth, adminOnly, async function(req, res) {
    try {
      var { name, type, options, sort_order } = req.body;
      if (!name || !type) return res.status(400).json({ ok: false, error: 'name и type обязательны' });
      if (['text','textarea','number','date','select','file','checkbox','link'].indexOf(type) === -1) {
        return res.status(400).json({ ok: false, error: 'Недопустимый тип поля' });
      }
      var dup = await pool.query('SELECT id FROM crm_field_definitions WHERE name = $1', [name]);
      if (dup.rows.length) return res.status(400).json({ ok: false, error: 'Поле с таким именем уже существует' });
      var r = await pool.query(
        'INSERT INTO crm_field_definitions (name, type, options, sort_order) VALUES ($1, $2, $3, COALESCE($4, 0)) RETURNING *',
        [name, type, options ? JSON.stringify(options) : null, sort_order]
      );
      emitFields();
      res.json({ ok: true, row: r.rows[0] });
    } catch(e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  app.put('/api/crm/fields/:id', auth, adminOnly, async function(req, res) {
    try {
      var { name, type, options } = req.body;
      if (!name || !type) return res.status(400).json({ ok: false, error: 'name и type обязательны' });
      var dup = await pool.query('SELECT id FROM crm_field_definitions WHERE name = $1 AND id != $2', [name, req.params.id]);
      if (dup.rows.length) return res.status(400).json({ ok: false, error: 'Поле с таким именем уже существует' });
      var r = await pool.query(
        'UPDATE crm_field_definitions SET name = $1, type = $2, options = $3 WHERE id = $4 RETURNING *',
        [name, type, options ? JSON.stringify(options) : null, req.params.id]
      );
      if (!r.rows.length) return res.status(404).json({ ok: false, error: 'Поле не найдено' });
      emitFields();
      res.json({ ok: true, row: r.rows[0] });
    } catch(e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  app.delete('/api/crm/fields/:id', auth, adminOnly, async function(req, res) {
    try {
      var r = await pool.query('UPDATE crm_field_definitions SET is_active = FALSE WHERE id = $1 RETURNING *', [req.params.id]);
      if (!r.rows.length) return res.status(404).json({ ok: false, error: 'Поле не найдено' });
      emitFields();
      res.json({ ok: true });
    } catch(e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  app.post('/api/crm/fields/:id/restore', auth, adminOnly, async function(req, res) {
    try {
      var r = await pool.query('UPDATE crm_field_definitions SET is_active = TRUE WHERE id = $1 RETURNING *', [req.params.id]);
      if (!r.rows.length) return res.status(404).json({ ok: false, error: 'Поле не найдено' });
      emitFields();
      res.json({ ok: true, row: r.rows[0] });
    } catch(e) { res.status(500).json({ ok: false, error: e.message }); }
  });

};
