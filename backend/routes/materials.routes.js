var express = require('express');

module.exports = function(pool, auth) {
  var router = express.Router();

  // ПКИ для наряда + остатки на складе
  router.get('/narad/:naradId', auth, async function(req, res) {
    try {
      var naradId = parseInt(req.params.naradId);
      var narad = await pool.query('SELECT * FROM production_narads WHERE id=$1', [naradId]);
      if (!narad.rows.length) return res.status(404).json({ ok: false, error: 'Наряд не найден' });
      var n = narad.rows[0];

      var pkiRows = [];
      if (n.assembly_id) {
        var parts = await pool.query(
          "SELECT * FROM products_archive WHERE assembly_id=$1 AND object_type='ПКИ' ORDER BY struct_id",
          [n.assembly_id]
        );
        pkiRows = parts.rows;
      }

      var items = [];
      for (var i = 0; i < pkiRows.length; i++) {
        var p = pkiRows[i];
        var qtyNeeded = (parseFloat(p.quantity) || 1) * (n.quantity || 1);

        // Ищем позицию на складе по имени (артикул wh_items — внутренний номер, не совпадает с classifier)
        var whQuery = await pool.query(
          'SELECT id, name, sku, qty, reserved, unit FROM wh_items WHERE LOWER(name) = LOWER($1) LIMIT 1',
          [p.item_name]
        );
        var whItem = whQuery.rows[0] || null;

        // Текущее резервирование под этот наряд
        var resv = whItem
          ? await pool.query(
              'SELECT * FROM wh_reservations WHERE narad_id=$1 AND item_id=$2 LIMIT 1',
              [naradId, whItem.id]
            )
          : { rows: [] };
        var resvRow = resv.rows[0] || null;

        var available = whItem ? (parseFloat(whItem.qty) - parseFloat(whItem.reserved)) : 0;
        var status = resvRow ? resvRow.status
          : (!whItem ? 'no_stock'
          : available >= qtyNeeded ? 'available'
          : 'shortage');

        items.push({
          pki_name:    p.item_name,
          classifier:  p.classifier,
          qty_needed:  qtyNeeded,
          unit:        p.unit_of_measure || 'шт',
          wh_item:     whItem,
          available:   available,
          reservation: resvRow,
          status:      status
        });
      }

      res.json({ ok: true, narad: n, items });
    } catch(e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  // Зарезервировать материалы под наряд
  router.post('/reserve', auth, async function(req, res) {
    try {
      var { narad_id, items } = req.body;
      if (!narad_id || !items || !items.length)
        return res.status(400).json({ ok: false, error: 'narad_id и items обязательны' });

      var results = [];
      for (var i = 0; i < items.length; i++) {
        var it = items[i];
        if (!it.item_id || !it.qty_needed)
          return res.status(400).json({ ok: false, error: 'item_id и qty_needed обязательны' });

        var wh = await pool.query('SELECT qty, reserved FROM wh_items WHERE id=$1', [it.item_id]);
        if (!wh.rows.length) return res.status(404).json({ ok: false, error: 'Позиция не найдена: ' + it.item_id });

        var available = parseFloat(wh.rows[0].qty) - parseFloat(wh.rows[0].reserved);
        var qtyToReserve = Math.min(parseFloat(it.qty_needed), available);
        var status = qtyToReserve >= parseFloat(it.qty_needed) ? 'reserved' : (qtyToReserve > 0 ? 'partial' : 'pending');

        // Upsert резервирования
        var existing = await pool.query(
          'SELECT id, qty_soft FROM wh_reservations WHERE narad_id=$1 AND item_id=$2 LIMIT 1',
          [narad_id, it.item_id]
        );

        var resvId;
        if (existing.rows.length) {
          var old = parseFloat(existing.rows[0].qty_soft);
          await pool.query(
            'UPDATE wh_reservations SET qty_needed=$1, qty_soft=$2, status=$3, updated_at=NOW() WHERE id=$4',
            [it.qty_needed, qtyToReserve, status, existing.rows[0].id]
          );
          // Корректируем reserved в wh_items
          await pool.query(
            'UPDATE wh_items SET reserved = reserved - $1 + $2 WHERE id=$3',
            [old, qtyToReserve, it.item_id]
          );
          resvId = existing.rows[0].id;
        } else {
          var r = await pool.query(
            'INSERT INTO wh_reservations (narad_id, item_id, item_name, qty_needed, qty_soft, unit, status, created_by) ' +
            'VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id',
            [narad_id, it.item_id, it.item_name || '', it.qty_needed, qtyToReserve, it.unit || 'шт', status, req.user.id]
          );
          await pool.query('UPDATE wh_items SET reserved = reserved + $1 WHERE id=$2', [qtyToReserve, it.item_id]);
          resvId = r.rows[0].id;
        }

        results.push({ id: resvId, item_id: it.item_id, qty_soft: qtyToReserve, status });
      }

      // Обновить materials_status наряда
      var pending = await pool.query(
        "SELECT COUNT(*) FROM wh_reservations WHERE narad_id=$1 AND status NOT IN ('reserved','issued')",
        [narad_id]
      );
      var materialsStatus = parseInt(pending.rows[0].count) === 0 ? 'reserved' : 'shortage';
      await pool.query('UPDATE production_narads SET materials_status=$1, updated_at=NOW() WHERE id=$2', [materialsStatus, narad_id]);

      res.json({ ok: true, results, materials_status: materialsStatus });
    } catch(e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  // Список резервирований (для кладовщика)
  router.get('/reservations', auth, async function(req, res) {
    try {
      var { status } = req.query;
      var conds = [], params = [], pi = 1;
      if (status) { conds.push('r.status=$' + pi); params.push(status); pi++; }
      var where = conds.length ? 'WHERE ' + conds.join(' AND ') : '';
      var rows = await pool.query(
        'SELECT r.*, pn.narad_number, pn.assembly_id, pn.order_number, pn.customer, pn.deadline, ' +
        'i.sku, i.qty AS stock_qty, i.address ' +
        'FROM wh_reservations r ' +
        'JOIN production_narads pn ON r.narad_id = pn.id ' +
        'LEFT JOIN wh_items i ON r.item_id = i.id ' +
        where + ' ORDER BY pn.deadline NULLS LAST, pn.narad_number',
        params
      );
      res.json({ ok: true, rows: rows.rows });
    } catch(e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  // Выдать материал (создаёт движение Расход + Требование-накладная)
  router.post('/issue', auth, async function(req, res) {
    try {
      var { reservation_id, qty } = req.body;
      if (!reservation_id || !qty) return res.status(400).json({ ok: false, error: 'reservation_id и qty обязательны' });
      qty = parseFloat(qty);

      var resv = await pool.query(
        'SELECT r.*, pn.narad_number FROM wh_reservations r JOIN production_narads pn ON r.narad_id=pn.id WHERE r.id=$1',
        [reservation_id]
      );
      if (!resv.rows.length) return res.status(404).json({ ok: false, error: 'Резервирование не найдено' });
      var r = resv.rows[0];

      var remaining = parseFloat(r.qty_soft) - parseFloat(r.qty_issued);
      if (qty > remaining) return res.status(400).json({ ok: false, error: 'Количество превышает резерв: ' + remaining });

      // Номер движения
      var movNumRes = await pool.query("SELECT 'M'||LPAD(nextval('wh_mov_seq')::text,8,'0') AS v");
      var movNum = movNumRes.rows[0].v;

      // Создаём движение Расход
      await pool.query(
        'INSERT INTO wh_movements (mov_num,operation,item_id,item_name,qty,unit,warehouse,doc_type,narad_id,created_by) ' +
        'VALUES ($1,$2,$3,$4,$5,$6,' +
        "(SELECT material_type FROM wh_items WHERE id=$3),'Требование-накладная',$7,$8)",
        [movNum, 'Расход', r.item_id, r.item_name, qty, r.unit, r.narad_id, req.user.id]
      );

      // Уменьшаем qty и reserved
      await pool.query(
        'UPDATE wh_items SET qty=GREATEST(0,qty-$1), reserved=GREATEST(0,reserved-$1), updated_at=NOW() WHERE id=$2',
        [qty, r.item_id]
      );

      // Обновляем резервирование
      var newIssued = parseFloat(r.qty_issued) + qty;
      var newStatus = newIssued >= parseFloat(r.qty_needed) ? 'issued' : 'partial';
      await pool.query(
        'UPDATE wh_reservations SET qty_issued=$1, qty_soft=GREATEST(0,qty_soft-$2), status=$3, updated_at=NOW() WHERE id=$4',
        [newIssued, qty, newStatus, reservation_id]
      );

      res.json({ ok: true, mov_num: movNum, qty_issued: newIssued, status: newStatus });
    } catch(e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  // Отменить резервирование
  router.delete('/reserve/:id', auth, async function(req, res) {
    try {
      var id = parseInt(req.params.id);
      var resv = await pool.query('SELECT * FROM wh_reservations WHERE id=$1', [id]);
      if (!resv.rows.length) return res.status(404).json({ ok: false, error: 'Не найдено' });
      var r = resv.rows[0];

      // Освобождаем резерв
      await pool.query(
        'UPDATE wh_items SET reserved=GREATEST(0,reserved-$1), updated_at=NOW() WHERE id=$2',
        [r.qty_soft, r.item_id]
      );
      await pool.query('UPDATE wh_reservations SET status=$1, qty_soft=0, updated_at=NOW() WHERE id=$2', ['cancelled', id]);

      res.json({ ok: true });
    } catch(e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  return router;
};
