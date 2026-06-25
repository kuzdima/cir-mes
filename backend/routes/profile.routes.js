var express = require('express');

module.exports = function(pool, auth) {
  var router = express.Router();

  router.get('/me', auth, async function(req, res) {
    try {
      var result = await pool.query('SELECT id, email, first_name, last_name, role FROM users WHERE id=$1', [req.user.id]);
      if (!result.rows.length) return res.status(404).json({ ok: false, error: 'Пользователь не найден' });
      res.json({ ok: true, user: result.rows[0] });
    } catch(e) { res.status(500).json({ ok: false, error: 'Ошибка сервера' }); }
  });

  router.put('/', auth, async function(req, res) {
    try {
      var { firstName, lastName, email } = req.body;
      if (!firstName) return res.status(400).json({ ok: false, error: 'Имя обязательно' });
      var result = await pool.query(
        'UPDATE users SET first_name=$1, last_name=$2, email=$3 WHERE id=$4 RETURNING id, email, first_name, last_name, role',
        [firstName, lastName || '', email, req.user.id]
      );
      if (!result.rows.length) return res.status(404).json({ ok: false, error: 'Пользователь не найден' });
      res.json({ ok: true, message: 'Профиль обновлён', user: result.rows[0] });
    } catch(e) { res.status(500).json({ ok: false, error: 'Ошибка обновления профиля' }); }
  });

  router.get('/my-records', auth, async function(req, res) {
    try {
      var uid = req.user.id;
      var [ops, archive, orders] = await Promise.all([
        pool.query(
          'SELECT id, classifier_code, product_name, operation_number, operation_name, created_at FROM tech_operations_archive WHERE created_by=$1 ORDER BY created_at DESC LIMIT 200',
          [uid]
        ),
        pool.query(
          'SELECT assembly_id, item_name, classifier, object_type, created_at FROM products_archive WHERE created_by=$1 AND level=0 ORDER BY created_at DESC LIMIT 200',
          [uid]
        ),
        pool.query(
          'SELECT * FROM (' +
            'SELECT DISTINCT ON (narad_number) narad_number, product_name, created_at, ' +
            'CASE WHEN started_at IS NULL THEN \'Новый\' ' +
                 'WHEN COALESCE(ready,0) >= COALESCE(quantity,0) AND COALESCE(quantity,0) > 0 THEN \'Готово\' ' +
                 'ELSE \'В работе\' END AS status ' +
            'FROM production_orders WHERE created_by=$1 ORDER BY narad_number, created_at DESC' +
          ') t ORDER BY created_at DESC LIMIT 200',
          [uid]
        )
      ]);
      res.json({ ok: true, techOps: ops.rows, archiveItems: archive.rows, productionOrders: orders.rows });
    } catch(e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  return router;
};
