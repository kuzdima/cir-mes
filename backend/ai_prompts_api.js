module.exports = function(pool, auth) {
  var express = require('express');
  var router = express.Router();
  var { DEFAULTS } = require('./ai/prompts');
  var adminOnly = require('./middleware/admin');

  router.get('/', auth, adminOnly, async function(req, res) {
    try {
      var r = await pool.query('SELECT * FROM ai_prompts ORDER BY domain, version DESC');
      res.json({ ok: true, prompts: r.rows });
    } catch(e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  router.get('/:id', auth, adminOnly, async function(req, res) {
    try {
      var r = await pool.query('SELECT * FROM ai_prompts WHERE id = $1', [req.params.id]);
      if (!r.rows.length) return res.status(404).json({ ok: false, error: 'Не найден' });
      res.json({ ok: true, prompt: r.rows[0] });
    } catch(e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  router.get('/active/:domain', auth, async function(req, res) {
    try {
      var r = await pool.query('SELECT * FROM ai_prompts WHERE domain = $1 AND is_active = TRUE ORDER BY version DESC LIMIT 1', [req.params.domain]);
      if (!r.rows.length) return res.status(404).json({ ok: false, error: 'Не найден активный промпт' });
      res.json({ ok: true, prompt: r.rows[0] });
    } catch(e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  router.post('/', auth, adminOnly, async function(req, res) {
    try {
      var { domain, name, prompt_text } = req.body;
      if (!domain || !prompt_text) return res.status(400).json({ ok: false, error: 'domain и prompt_text обязательны' });
      var r = await pool.query(
        'INSERT INTO ai_prompts (domain, name, prompt_text, version) VALUES ($1,$2,$3,1) RETURNING *',
        [domain, name || 'default', prompt_text]
      );
      res.json({ ok: true, prompt: r.rows[0] });
    } catch(e) {
      if (e.code === '23505') return res.status(409).json({ ok: false, error: 'Промпт с таким domain/name уже существует' });
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  router.put('/:id', auth, adminOnly, async function(req, res) {
    try {
      var existing = await pool.query('SELECT * FROM ai_prompts WHERE id = $1', [req.params.id]);
      if (!existing.rows.length) return res.status(404).json({ ok: false, error: 'Не найден' });
      var cur = existing.rows[0];
      var { domain, name, prompt_text, is_active } = req.body;
      var r = await pool.query(
        'UPDATE ai_prompts SET domain = $1, name = $2, prompt_text = $3, is_active = $4, updated_at = NOW() WHERE id = $5 RETURNING *',
        [
          domain || cur.domain,
          name || cur.name,
          prompt_text || cur.prompt_text,
          is_active !== undefined ? is_active : cur.is_active,
          req.params.id
        ]
      );
      res.json({ ok: true, prompt: r.rows[0] });
    } catch(e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  router.delete('/:id', auth, adminOnly, async function(req, res) {
    try {
      var r = await pool.query('DELETE FROM ai_prompts WHERE id = $1 RETURNING id', [req.params.id]);
      if (!r.rows.length) return res.status(404).json({ ok: false, error: 'Не найден' });
      res.json({ ok: true });
    } catch(e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  router.post('/:id/reset', auth, adminOnly, async function(req, res) {
    try {
      var existing = await pool.query('SELECT * FROM ai_prompts WHERE id = $1', [req.params.id]);
      if (!existing.rows.length) return res.status(404).json({ ok: false, error: 'Не найден' });
      var domain = existing.rows[0].domain;
      var defaultText = DEFAULTS[domain];
      if (defaultText) {
        await pool.query(
          'UPDATE ai_prompts SET prompt_text = $1, is_active = TRUE, version = version + 1, updated_at = NOW() WHERE id = $2',
          [defaultText, req.params.id]
        );
        res.json({ ok: true, message: 'Промпт восстановлен из заводского шаблона' });
      } else {
        await pool.query('UPDATE ai_prompts SET is_active = FALSE, updated_at = NOW() WHERE id = $1', [req.params.id]);
        res.json({ ok: true, message: 'Промпт сброшен — будет использоваться встроенный дефолтный' });
      }
    } catch(e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  router.post('/:id/version', auth, adminOnly, async function(req, res) {
    try {
      var existing = await pool.query('SELECT * FROM ai_prompts WHERE id = $1', [req.params.id]);
      if (!existing.rows.length) return res.status(404).json({ ok: false, error: 'Не найден' });
      var cur = existing.rows[0];
      var { prompt_text } = req.body;
      if (!prompt_text) return res.status(400).json({ ok: false, error: 'prompt_text обязателен' });

      var r = await pool.query(
        'UPDATE ai_prompts SET prompt_text = $1, version = version + 1, is_active = TRUE, updated_at = NOW() WHERE id = $2 RETURNING *',
        [prompt_text, req.params.id]
      );
      res.json({ ok: true, prompt: r.rows[0] });
    } catch(e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  return router;
};
