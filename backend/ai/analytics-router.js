module.exports = function(pool, auth, requireFeature, deps) {
  var express = require('express');
  var router = express.Router();
  var resolveTimeframe = require('./timeframe').resolveTimeframe;

  var provider = deps.provider;
  var prompts = deps.prompts;
  var contextBuilder = deps.contextBuilder;

  // ─── Status ─────────────────────────────────────────────────
  router.get('/status', auth, async function(req, res) {
    try {
      var p = await provider.getActiveProvider(pool);
      res.json({
        ok: true,
        provider: p ? p.name : null,
        model: p ? p.model : null,
        connected: !!p
      });
    } catch(e) {
      res.json({ ok: true, provider: null, model: null, connected: false });
    }
  });

  // ─── Query ──────────────────────────────────────────────────
  router.post('/query', auth, requireFeature('chat'), async function(req, res) {
    try {
      var { domain, question, filters, model, temperature } = req.body;
      if (!domain) return res.status(400).json({ ok: false, error: 'Требуется domain' });
      if (!question) return res.status(400).json({ ok: false, error: 'Требуется question' });

      var resolvedTf = resolveTimeframe(filters?.timeframe);
      var contextFilters = resolvedTf ? { timeframe: resolvedTf } : {};
      var context = await contextBuilder.getDomainSummary(pool, domain, contextFilters);
      if (context && context.ok === false) return res.status(400).json({ ok: false, error: context.error });

      var systemPrompt = await prompts.resolvePrompt(pool, domain);
      var userPrompt = prompts.buildUserPrompt(question, { context: context, filters: filters || {} });

      var messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ];

      var result = await provider.chat(pool, messages, { model, temperature });

      if (!result.ok) return res.status(502).json({ ok: false, error: result.error });

      try {
        await pool.query(
          `INSERT INTO ai_chat_history (user_id, domain, question, answer, model, usage_tokens)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [req.user.id, domain, question, result.content,
           model || null, result.usage?.total_tokens || null]
        );
      } catch(e) {
        console.error('Failed to save chat history:', e.message);
      }

      res.json({
        ok: true,
        answer: result.content,
        domain: domain,
        context: context,
        usage: result.usage || null
      });
    } catch(e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  // ─── Dashboard ──────────────────────────────────────────────
  router.post('/dashboard', auth, requireFeature('dashboard'), async function(req, res) {
    try {
      var filters = req.body.filters || {};
      var resolvedTf = resolveTimeframe(filters.timeframe);
      var contextFilters = resolvedTf ? { timeframe: resolvedTf } : {};

      var context = await contextBuilder.getDomainSummary(pool, 'all', contextFilters);
      if (context && context.ok === false) return res.status(400).json({ ok: false, error: context.error });

      var systemPrompt = await prompts.resolvePrompt(pool, 'dashboard');
      var periodStr = resolvedTf ? (resolvedTf.from + ' — ' + resolvedTf.to) : 'за всё время';
      var question = 'Сформируй сводку по цеху на основе данных по всем модулям. Период: ' + periodStr + '.';
      var userPrompt = prompts.buildUserPrompt(question, { context: context, filters: filters });

      var messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ];

      var result = await provider.chat(pool, messages, {});

      if (!result.ok) return res.status(502).json({ ok: false, error: result.error });

      try {
        await pool.query(
          `INSERT INTO ai_chat_history (user_id, domain, question, answer, model, usage_tokens)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [req.user.id, 'all', question, result.content,
           null, result.usage?.total_tokens || null]
        );
      } catch(e) {
        console.error('Failed to save chat history:', e.message);
      }

      res.json({
        ok: true,
        answer: result.content,
        domain: 'all',
        context: context,
        usage: result.usage || null
      });
    } catch(e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  // ─── History ────────────────────────────────────────────────
  router.get('/history', auth, async function(req, res) {
    try {
      if (req.user.role !== 'admin') {
        var chk = await pool.query('SELECT 1 FROM ai_access WHERE user_id = $1 LIMIT 1', [req.user.id]);
        if (!chk.rows.length) return res.status(403).json({ ok: false, error: 'Нет доступа к AI' });
      }
      var r = await pool.query(
        'SELECT id, domain, question, answer, model, usage_tokens, has_error, created_at FROM ai_chat_history WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50',
        [req.user.id]
      );
      res.json({ ok: true, history: r.rows });
    } catch(e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  router.delete('/history', auth, async function(req, res) {
    try {
      if (req.user.role !== 'admin') {
        var chk = await pool.query('SELECT 1 FROM ai_access WHERE user_id = $1 LIMIT 1', [req.user.id]);
        if (!chk.rows.length) return res.status(403).json({ ok: false, error: 'Нет доступа к AI' });
      }
      await pool.query('DELETE FROM ai_chat_history WHERE user_id = $1', [req.user.id]);
      res.json({ ok: true });
    } catch(e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  // ─── Access /my ─────────────────────────────────────────────
  router.get('/access/my', auth, async function(req, res) {
    try {
      if (req.user.role === 'admin') {
        return res.json({ ok: true, features: ['chat', 'dashboard', 'sop', 'admin'] });
      }
      var r = await pool.query('SELECT feature FROM ai_access WHERE user_id = $1', [req.user.id]);
      var features = r.rows.map(function(row) { return row.feature; });
      // also check crm_access for crm feature
      var crmR = await pool.query('SELECT 1 FROM crm_access WHERE user_id = $1', [req.user.id]);
      if (crmR.rows.length) features.push('crm');
      res.json({ ok: true, features: features });
    } catch(e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  // ─── Access admin CRUD ──────────────────────────────────────
  router.get('/access', auth, requireFeature('admin'), async function(req, res) {
    try {
      var r = await pool.query(
        `SELECT a.user_id, a.feature, a.granted_at, u.email, u.first_name, u.last_name
         FROM ai_access a JOIN users u ON u.id = a.user_id
         ORDER BY a.feature, u.email`
      );
      res.json({ ok: true, access: r.rows });
    } catch(e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  router.post('/access', auth, requireFeature('admin'), async function(req, res) {
    try {
      var { userId, feature } = req.body;
      if (!userId || !feature) return res.status(400).json({ ok: false, error: 'Требуется userId и feature' });
      await pool.query(
        'INSERT INTO ai_access (user_id, feature, granted_by) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
        [userId, feature, req.user.id]
      );
      res.json({ ok: true });
    } catch(e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  router.delete('/access/:userId/:feature', auth, requireFeature('admin'), async function(req, res) {
    try {
      await pool.query(
        'DELETE FROM ai_access WHERE user_id = $1 AND feature = $2',
        [req.params.userId, req.params.feature]
      );
      res.json({ ok: true });
    } catch(e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  return router;
};
