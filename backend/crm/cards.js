var fs = require('fs');
var path = require('path');

module.exports = function(app, pool, io, auth, adminOnly, crmAccessOnly, uploadDir) {

async function fetchCardEnriched(pool, cardId) {
  var fieldsR = await pool.query(
    'SELECT fv.*, fd.name, fd.type, fd.is_active FROM crm_card_field_values fv INNER JOIN crm_field_definitions fd ON fd.id = fv.field_id WHERE fv.card_id = $1',
    [cardId]
  );
  var filesR = await pool.query(
    'SELECT * FROM crm_card_files WHERE card_id = $1 ORDER BY created_at',
    [cardId]
  );
  var partsR = await pool.query(
    'SELECT u.id, u.first_name, u.last_name, u.email FROM crm_card_participants cp INNER JOIN users u ON u.id = cp.user_id WHERE cp.card_id = $1',
    [cardId]
  );
  var fileFieldsR = await pool.query(
    'SELECT NULL AS id, NULL AS card_id, fd.id AS field_id, NULL AS value, fd.name, fd.type, fd.is_active FROM crm_field_definitions fd WHERE fd.type = $1 AND fd.is_active = TRUE AND fd.id NOT IN (SELECT field_id FROM crm_card_field_values WHERE card_id = $2)',
    ['file', cardId]
  );
  return { fields: fieldsR.rows.concat(fileFieldsR.rows), files: filesR.rows, participants: partsR.rows };
}

  app.get('/api/crm/cards', auth, crmAccessOnly, async function(req, res) {
    try {
      var cardsR = await pool.query(
        `SELECT c.* FROM crm_cards c
         INNER JOIN crm_card_participants p ON p.card_id = c.id AND p.user_id = $1
         ORDER BY c.sort_order`,
        [req.user.id]
      );
      var cardIds = cardsR.rows.map(function(c) { return c.id; });
      if (!cardIds.length) { res.json({ ok: true, rows: [] }); return; }

      var fieldsR = await pool.query(
        'SELECT fv.card_id, fv.value, fv.field_id, fd.name, fd.type, fd.is_active FROM crm_card_field_values fv INNER JOIN crm_field_definitions fd ON fd.id = fv.field_id WHERE fv.card_id = ANY($1)',
        [cardIds]
      );
      var filesR = await pool.query(
        'SELECT * FROM crm_card_files WHERE card_id = ANY($1) ORDER BY card_id, created_at',
        [cardIds]
      );
      var partsR = await pool.query(
        'SELECT cp.card_id, u.id, u.first_name, u.last_name, u.email FROM crm_card_participants cp INNER JOIN users u ON u.id = cp.user_id WHERE cp.card_id = ANY($1)',
        [cardIds]
      );

      var fieldsByCard = {}; var filesByCard = {}; var partsByCard = {};
      for (var i = 0; i < fieldsR.rows.length; i++) {
        var f = fieldsR.rows[i]; if (!fieldsByCard[f.card_id]) fieldsByCard[f.card_id] = [];
        fieldsByCard[f.card_id].push(f);
      }
      for (var i = 0; i < filesR.rows.length; i++) {
        var f = filesR.rows[i]; if (!filesByCard[f.card_id]) filesByCard[f.card_id] = [];
        filesByCard[f.card_id].push(f);
      }
      for (var i = 0; i < partsR.rows.length; i++) {
        var p = partsR.rows[i]; if (!partsByCard[p.card_id]) partsByCard[p.card_id] = [];
        partsByCard[p.card_id].push({ id: p.id, first_name: p.first_name, last_name: p.last_name, email: p.email });
      }

      var result = [];
      for (var i = 0; i < cardsR.rows.length; i++) {
        var card = cardsR.rows[i];
        result.push({
          id: card.id, title: card.title, description: card.description,
          column_id: card.column_id, sort_order: card.sort_order,
          created_by: card.created_by, created_at: card.created_at, updated_at: card.updated_at,
          fields: fieldsByCard[card.id] || [],
          files: filesByCard[card.id] || [],
          participants: partsByCard[card.id] || []
        });
      }
      res.json({ ok: true, rows: result });
    } catch(e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  app.post('/api/crm/cards', auth, crmAccessOnly, async function(req, res) {
    var client;
    try {
      var { title, description, column_id, sort_order, fields } = req.body;
      if (!title) return res.status(400).json({ ok: false, error: 'Название обязательно' });
      client = await pool.connect();
      await client.query('BEGIN');
      var r = await client.query(
        'INSERT INTO crm_cards (title, description, column_id, sort_order, created_by) VALUES ($1, $2, $3, COALESCE($4, 0), $5) RETURNING *',
        [title, description || null, column_id || null, sort_order, req.user.id]
      );
      var card = r.rows[0];
      await client.query(
        'INSERT INTO crm_card_participants (card_id, user_id, added_by) VALUES ($1, $2, $2)',
        [card.id, req.user.id]
      );
      if (Array.isArray(fields) && fields.length) {
        for (var fi = 0; fi < fields.length; fi++) {
          var f = fields[fi];
          if (f.field_id) {
            await client.query(
              'INSERT INTO crm_card_field_values (card_id, field_id, value) VALUES ($1, $2, $3) ON CONFLICT (card_id, field_id) DO UPDATE SET value = $3',
              [card.id, f.field_id, f.value != null ? String(f.value) : '']
            );
          }
        }
      }
      await client.query('COMMIT');
      var enriched = await fetchCardEnriched(pool, card.id);
      io.emit('crm:card-created', {
        id: card.id, title: card.title, description: card.description,
        column_id: card.column_id, sort_order: card.sort_order,
        created_by: card.created_by, created_at: card.created_at, updated_at: card.updated_at,
        fields: enriched.fields, files: [], participants: enriched.participants
      });
      card.fields = enriched.fields;
      card.participants = enriched.participants;
      res.json({ ok: true, row: card });
    } catch(e) {
      if (client) await client.query('ROLLBACK');
      res.status(500).json({ ok: false, error: e.message });
    } finally {
      if (client) client.release();
    }
  });

  app.get('/api/crm/cards/:id', auth, async function(req, res) {
    try {
      var cardR = await pool.query('SELECT * FROM crm_cards WHERE id = $1', [req.params.id]);
      if (!cardR.rows.length) return res.status(404).json({ ok: false, error: 'Карточка не найдена' });
      var card = cardR.rows[0];
      var partR = await pool.query('SELECT 1 FROM crm_card_participants WHERE card_id = $1 AND user_id = $2', [card.id, req.user.id]);
      if (!partR.rows.length) return res.status(403).json({ ok: false, error: 'Нет доступа к карточке' });
      var enriched = await fetchCardEnriched(pool, card.id);
      card.fields = enriched.fields;
      card.files = enriched.files;
      card.participants = enriched.participants;
      res.json({ ok: true, row: card });
    } catch(e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  app.put('/api/crm/cards/:id', auth, async function(req, res) {
    try {
      var partR = await pool.query('SELECT 1 FROM crm_card_participants WHERE card_id = $1 AND user_id = $2', [req.params.id, req.user.id]);
      if (!partR.rows.length) return res.status(403).json({ ok: false, error: 'Нет доступа к карточке' });
      var { title, description, column_id, sort_order, fields } = req.body;
      var r = await pool.query(
        'UPDATE crm_cards SET title = COALESCE($1, title), description = COALESCE($2, description), column_id = COALESCE($3, column_id), sort_order = COALESCE($4, sort_order), updated_at = NOW() WHERE id = $5 RETURNING *',
        [title, description, column_id, sort_order, req.params.id]
      );
      if (!r.rows.length) return res.status(404).json({ ok: false, error: 'Карточка не найдена' });
      if (Array.isArray(fields)) {
        for (var fi = 0; fi < fields.length; fi++) {
          var f = fields[fi];
          if (f.field_id) {
            await pool.query(
              'INSERT INTO crm_card_field_values (card_id, field_id, value) VALUES ($1, $2, $3) ON CONFLICT (card_id, field_id) DO UPDATE SET value = $3',
              [req.params.id, f.field_id, f.value != null ? String(f.value) : '']
            );
          }
        }
      }
      var enriched = await fetchCardEnriched(pool, r.rows[0].id);
      var updated = r.rows[0];
      updated.fields = enriched.fields;
      updated.files = enriched.files;
      updated.participants = enriched.participants;
      io.emit('crm:card-updated', updated);
      res.json({ ok: true, row: updated });
    } catch(e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  app.delete('/api/crm/cards/:id', auth, async function(req, res) {
    try {
      var partR = await pool.query('SELECT 1 FROM crm_card_participants WHERE card_id = $1 AND user_id = $2', [req.params.id, req.user.id]);
      if (!partR.rows.length) return res.status(403).json({ ok: false, error: 'Нет доступа к карточке' });

      var filesR = await pool.query('SELECT * FROM crm_card_files WHERE card_id = $1', [req.params.id]);
      for (var fi = 0; fi < filesR.rows.length; fi++) {
        try {
          await fs.promises.unlink(path.join(uploadDir, filesR.rows[fi].file_name));
        } catch (unlinkErr) {
          if (unlinkErr.code !== 'ENOENT') {
            console.error('Ошибка удаления файла с диска:', unlinkErr.message);
          }
        }
      }

      await pool.query('DELETE FROM crm_cards WHERE id = $1', [req.params.id]);
      io.emit('crm:card-deleted', { id: parseInt(req.params.id) });
      res.json({ ok: true });
    } catch(e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  app.post('/api/crm/cards/:id/move', auth, async function(req, res) {
    try {
      var partR = await pool.query('SELECT 1 FROM crm_card_participants WHERE card_id = $1 AND user_id = $2', [req.params.id, req.user.id]);
      if (!partR.rows.length) return res.status(403).json({ ok: false, error: 'Нет доступа к карточке' });
      var { column_id, sort_order } = req.body;
      var r = await pool.query(
        'UPDATE crm_cards SET column_id = COALESCE($1, column_id), sort_order = COALESCE($2, sort_order), updated_at = NOW() WHERE id = $3 RETURNING *',
        [column_id, sort_order, req.params.id]
      );
      io.emit('crm:card-moved', { id: r.rows[0].id, column_id: r.rows[0].column_id, sort_order: r.rows[0].sort_order });
      res.json({ ok: true, row: r.rows[0] });
    } catch(e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  app.post('/api/crm/cards/:id/participants', auth, async function(req, res) {
    try {
      var partR = await pool.query('SELECT 1 FROM crm_card_participants WHERE card_id = $1 AND user_id = $2', [req.params.id, req.user.id]);
      if (!partR.rows.length) return res.status(403).json({ ok: false, error: 'Нет доступа к карточке' });
      var { user_ids } = req.body;
      if (Array.isArray(user_ids)) {
        await pool.query('DELETE FROM crm_card_participants WHERE card_id = $1', [req.params.id]);
        for (var i = 0; i < user_ids.length; i++) {
          await pool.query(
            'INSERT INTO crm_card_participants (card_id, user_id, added_by) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
            [req.params.id, user_ids[i], req.user.id]
          );
        }
      }
      var users = await pool.query(
        'SELECT u.id, u.first_name, u.last_name, u.email FROM crm_card_participants cp INNER JOIN users u ON u.id = cp.user_id WHERE cp.card_id = $1',
        [req.params.id]
      );
      io.emit('crm:participants-changed', { id: parseInt(req.params.id), participants: users.rows });
      res.json({ ok: true, participants: users.rows });
    } catch(e) { res.status(500).json({ ok: false, error: e.message }); }
  });

};
