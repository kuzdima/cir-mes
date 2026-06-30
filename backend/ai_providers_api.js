module.exports = function(pool, auth) {
  var express = require('express');
  var router = express.Router();
  var { invalidateCache } = require('./ai/provider');
  var adminOnly = require('./middleware/admin');

  router.get('/', auth, adminOnly, async function(req, res) {
    try {
      var r = await pool.query('SELECT * FROM ai_providers ORDER BY name');
      r.rows.forEach(function(p) {
        if (p.api_key) p.api_key = '***';
      });
      res.json({ ok: true, providers: r.rows });
    } catch(e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  router.get('/:id', auth, adminOnly, async function(req, res) {
    try {
      var r = await pool.query('SELECT * FROM ai_providers WHERE id = $1', [req.params.id]);
      if (!r.rows.length) return res.status(404).json({ ok: false, error: 'Не найден' });
      if (r.rows[0].api_key) r.rows[0].api_key = '***';
      res.json({ ok: true, provider: r.rows[0] });
    } catch(e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  router.post('/', auth, adminOnly, async function(req, res) {
    try {
      var { name, label, api_url, api_key, model, config, is_active } = req.body;
      if (!name || !api_url || !model) return res.status(400).json({ ok: false, error: 'name, api_url, model обязательны' });
      var r = await pool.query(
        'INSERT INTO ai_providers (name, label, api_url, api_key, model, config, is_active) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *',
        [name, label || name, api_url, api_key || null, model, JSON.stringify(config || {}), is_active !== undefined ? is_active : false]
      );
      if (r.rows[0].is_active) invalidateCache();
      res.json({ ok: true, provider: r.rows[0] });
    } catch(e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  router.put('/:id', auth, adminOnly, async function(req, res) {
    try {
      var existing = await pool.query('SELECT * FROM ai_providers WHERE id = $1', [req.params.id]);
      if (!existing.rows.length) return res.status(404).json({ ok: false, error: 'Не найден' });
      var cur = existing.rows[0];
      var { name, label, api_url, api_key, model, config, is_active } = req.body;
      var r = await pool.query(
        'UPDATE ai_providers SET name = $1, label = $2, api_url = $3, api_key = $4, model = $5, config = $6, is_active = $7, updated_at = NOW() WHERE id = $8 RETURNING *',
        [
          name || cur.name,
          label || cur.label,
          api_url || cur.api_url,
          api_key !== undefined ? (api_key || null) : cur.api_key,
          model || cur.model,
          config ? JSON.stringify(config) : cur.config,
          is_active !== undefined ? is_active : cur.is_active,
          req.params.id
        ]
      );
      if (r.rows[0].is_active) invalidateCache();
      res.json({ ok: true, provider: r.rows[0] });
    } catch(e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  router.post('/:id/activate', auth, adminOnly, async function(req, res) {
    try {
      var existing = await pool.query('SELECT * FROM ai_providers WHERE id = $1', [req.params.id]);
      if (!existing.rows.length) return res.status(404).json({ ok: false, error: 'Не найден' });
      await pool.query('UPDATE ai_providers SET is_active = FALSE WHERE id != $1', [req.params.id]);
      await pool.query('UPDATE ai_providers SET is_active = TRUE, updated_at = NOW() WHERE id = $1', [req.params.id]);
      invalidateCache();
      res.json({ ok: true });
    } catch(e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  router.post('/:id/test', auth, adminOnly, async function(req, res) {
    try {
      var existing = await pool.query('SELECT * FROM ai_providers WHERE id = $1', [req.params.id]);
      if (!existing.rows.length) return res.status(404).json({ ok: false, error: 'Не найден' });
      var p = existing.rows[0];
      var registry = require('./ai/provider-registry');
      var adapter = registry.getAdapter(p);
      var result = await adapter.test(p);
      res.json(result);
    } catch(e) {
      res.json({ ok: false, connected: false, error: e.message });
    }
  });

  router.delete('/:id', auth, adminOnly, async function(req, res) {
    try {
      var existing = await pool.query('SELECT is_active FROM ai_providers WHERE id = $1', [req.params.id]);
      var r = await pool.query('DELETE FROM ai_providers WHERE id = $1 RETURNING id', [req.params.id]);
      if (!r.rows.length) return res.status(404).json({ ok: false, error: 'Не найден' });
      if (existing.rows.length && existing.rows[0].is_active) invalidateCache();
      res.json({ ok: true });
    } catch(e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  return router;
};
