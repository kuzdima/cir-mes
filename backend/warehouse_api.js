// ============================================================
// warehouse.js — Склад: REST API
// ============================================================
module.exports = function(pool, auth) {
  var Router = require('express').Router;
  var router = Router();

  var WAREHOUSES = [
    'ГСМ','Давальческое','ДСЕ','Материал(прокат,сыпучка)',
    'ЦВМ','ПКИ','Производство','Роботех','СГП','СИЗ',
    'Склад литейного участка','Сотрудники','Спец.инстр (оснастка)',
    'Хозяйственные материалы','Брак/Утиль'
  ];
  var OPERATIONS  = ['Приход','Расход','Перемещение','Списание'];
  var DOC_TYPES   = ['УПД','ТН','ТТН','Накладная','Маршрутная карта',
                     'Требование-накладная','Чек','М-15','Ввод первичных остатков'];
  var LEGAL_ENT   = ['ЮП','Ур'];
  var UNITS       = ['шт','кг','мм','м','м.кв','м.куб','л','г','т',
                     'уп','компл','боб','пар','упак'];

  // ---------- refs ----------
  router.get('/refs', auth, function(req, res) {
    res.json({ ok: true, warehouses: WAREHOUSES, operations: OPERATIONS,
               docTypes: DOC_TYPES, legalEntities: LEGAL_ENT, units: UNITS });
  });

  // ---------- KPIs ----------
  router.get('/kpis', auth, async function(req, res) {
    try {
      var [total, incoming, moves, low] = await Promise.all([
        pool.query('SELECT COUNT(*) FROM wh_items WHERE qty > 0'),
        pool.query("SELECT COUNT(*) AS v FROM wh_movements WHERE operation='Приход' AND created_at >= CURRENT_DATE"),
        pool.query('SELECT COUNT(*) FROM wh_movements WHERE created_at >= CURRENT_DATE'),
        pool.query('SELECT COUNT(*) FROM wh_items WHERE min_qty > 0 AND qty < min_qty')
      ]);
      res.json({ ok: true, kpis: [
        { color: '#3b82f6', value: total.rows[0].count,              label: 'Позиций на складе'    },
        { color: '#10b981', value: parseInt(incoming.rows[0].v, 10), label: 'Принято сегодня' },
        { color: '#f59e0b', value: moves.rows[0].count,              label: 'Движений за смену'    },
        { color: '#ef4444', value: low.rows[0].count,                label: 'Требует внимания'     }
      ]});
    } catch(e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  // ---------- items list ----------
  router.get('/items', auth, async function(req, res) {
    try {
      var { warehouse, q, sku, mov_num, page } = req.query;
      page = parseInt(page) || 1;
      var limit = 50, offset = (page - 1) * limit;
      var conds = [], params = [], pi = 1;
      if (warehouse) { conds.push('material_type = $' + pi); params.push(warehouse); pi++; }
      if (q) {
        conds.push('(name ILIKE $' + pi + ' OR address ILIKE $' + pi + ')');
        params.push('%' + q + '%'); pi++;
      }
      if (sku) {
        conds.push('sku ILIKE $' + pi);
        params.push('%' + sku + '%'); pi++;
      }
      if (mov_num) {
        conds.push('id IN (SELECT item_id FROM wh_movements WHERE mov_num ILIKE $' + pi + ')');
        params.push('%' + mov_num + '%'); pi++;
      }
      var where = conds.length ? 'WHERE ' + conds.join(' AND ') : '';
      params.push(limit + 1, offset);
      var rows = await pool.query(
        'SELECT id,sku,name,material_type,address,unit,qty,min_qty,reserved FROM wh_items ' +
        where + ' ORDER BY name LIMIT $' + pi + ' OFFSET $' + (pi + 1),
        params
      );
      var hasMore = rows.rows.length > limit;
      if (hasMore) rows.rows.pop();
      res.json({ ok: true, rows: rows.rows, hasMore });
    } catch(e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  // ---------- movements today ----------
  router.get('/movements', auth, async function(req, res) {
    try {
      var rows = await pool.query(
        'SELECT m.*, i.name AS item_full_name ' +
        'FROM wh_movements m LEFT JOIN wh_items i ON m.item_id = i.id ' +
        'WHERE m.created_at >= CURRENT_DATE ' +
        'ORDER BY m.created_at DESC LIMIT 20'
      );
      res.json({ ok: true, rows: rows.rows });
    } catch(e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  // ---------- low-stock ----------
  router.get('/low', auth, async function(req, res) {
    try {
      var rows = await pool.query(
        'SELECT id,name,material_type,address,unit,qty,min_qty ' +
        'FROM wh_items WHERE min_qty > 0 AND qty < min_qty ' +
        'ORDER BY (qty / NULLIF(min_qty,0)) LIMIT 10'
      );
      res.json({ ok: true, rows: rows.rows });
    } catch(e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  // ---------- item history card ----------
  router.get('/item/:id/history', auth, async function(req, res) {
    try {
      var id = parseInt(req.params.id);
      var [itemRes, movRes] = await Promise.all([
        pool.query('SELECT * FROM wh_items WHERE id=$1', [id]),
        pool.query(
          'SELECT m.*, u.last_name || \' \' || u.first_name AS created_by_name ' +
          'FROM wh_movements m ' +
          'LEFT JOIN users u ON m.created_by = u.id ' +
          'WHERE m.item_id=$1 ORDER BY m.created_at DESC LIMIT 200',
          [id]
        )
      ]);
      if (!itemRes.rows.length) return res.status(404).json({ ok: false, error: 'Не найдено' });
      res.json({ ok: true, item: itemRes.rows[0], movements: movRes.rows });
    } catch(e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  // ---------- update item ----------
  router.patch('/items/:id', auth, async function(req, res) {
    try {
      var id = parseInt(req.params.id);
      var b  = req.body;
      var sets = [], params = [], pi = 1;
      if (b.min_qty  !== undefined) { sets.push('min_qty=$'  + pi); params.push(parseFloat(b.min_qty)  || 0); pi++; }
      if (b.address  !== undefined) { sets.push('address=$'  + pi); params.push(b.address  || null);          pi++; }
      if (b.comments !== undefined) { sets.push('comments=$' + pi); params.push(b.comments || null);          pi++; }
      if (!sets.length) return res.json({ ok: true });
      sets.push('updated_at=NOW()');
      params.push(id);
      await pool.query(
        'UPDATE wh_items SET ' + sets.join(',') + ' WHERE id=$' + pi,
        params
      );
      res.json({ ok: true });
    } catch(e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  // ---------- suppliers autocomplete ----------
  router.get('/suppliers', auth, async function(req, res) {
    try {
      var q = req.query.q || '';
      var rows = await pool.query(
        'SELECT DISTINCT supplier FROM wh_movements ' +
        'WHERE supplier ILIKE $1 AND supplier IS NOT NULL ' +
        'ORDER BY supplier LIMIT 15',
        ['%' + q + '%']
      );
      res.json({ ok: true, rows: rows.rows.map(function(r) { return r.supplier; }) });
    } catch(e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  // ---------- orders autocomplete ----------
  router.get('/orders', auth, async function(req, res) {
    try {
      var q = req.query.q || '';
      var rows = await pool.query(
        'SELECT DISTINCT order_ref FROM wh_movements ' +
        'WHERE order_ref ILIKE $1 AND order_ref IS NOT NULL ' +
        'ORDER BY order_ref LIMIT 15',
        ['%' + q + '%']
      );
      res.json({ ok: true, rows: rows.rows.map(function(r) { return r.order_ref; }) });
    } catch(e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  // ---------- item autocomplete ----------
  router.get('/item-search', auth, async function(req, res) {
    try {
      var { q } = req.query;
      if (!q || q.length < 2) return res.json({ ok: true, rows: [] });
      var rows = await pool.query(
        'SELECT id,sku,name,material_type,address,unit,qty ' +
        'FROM wh_items WHERE name ILIKE $1 ORDER BY name LIMIT 20',
        ['%' + q + '%']
      );
      res.json({ ok: true, rows: rows.rows });
    } catch(e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  // ---------- record movement ----------
  router.post('/movement', auth, async function(req, res) {
    try {
      var b = req.body;
      if (!b.operation || !OPERATIONS.includes(b.operation))
        return res.status(400).json({ ok: false, error: 'Укажите операцию' });
      if (!b.itemName || !b.itemName.trim())
        return res.status(400).json({ ok: false, error: 'Укажите наименование' });
      var qty = parseFloat(b.qty);
      if (!qty || qty <= 0)
        return res.status(400).json({ ok: false, error: 'Некорректное количество' });

      // Find or create item
      var item = null;
      if (b.itemId) {
        var r = await pool.query('SELECT * FROM wh_items WHERE id=$1', [parseInt(b.itemId)]);
        if (r.rows.length) item = r.rows[0];
      }
      if (!item) {
        var r = await pool.query(
          'SELECT * FROM wh_items WHERE LOWER(name)=LOWER($1) ' +
          'AND (material_type=$2 OR ($2::text IS NULL AND material_type IS NULL)) LIMIT 1',
          [b.itemName.trim(), b.warehouse || null]
        );
        if (r.rows.length) item = r.rows[0];
      }
      if (!item) {
        var r = await pool.query(
          'INSERT INTO wh_items (sku,name,material_type,address,unit,qty,min_qty,reserved) ' +
          "VALUES ('S'||LPAD(nextval('wh_sku_seq')::text,8,'0'),$1,$2,$3,$4,0,$5,0) RETURNING *",
          [b.itemName.trim(), b.warehouse||null, b.address||null,
           b.unit||'шт', parseFloat(b.minQty)||0]
        );
        item = r.rows[0];
      }

      // Update balance
      var delta = (b.operation === 'Приход') ? qty
                : (b.operation === 'Расход' || b.operation === 'Списание') ? -qty : 0;
      if (delta !== 0) {
        await pool.query(
          'UPDATE wh_items SET qty=GREATEST(0,qty+$1), updated_at=NOW() WHERE id=$2',
          [delta, item.id]
        );
      }
      if (b.address && b.address.trim() && b.address.trim() !== item.address) {
        await pool.query('UPDATE wh_items SET address=$1 WHERE id=$2', [b.address.trim(), item.id]);
      }

      var movNumRes = await pool.query("SELECT 'M'||LPAD(nextval('wh_mov_seq')::text,8,'0') AS v");
      var movNum    = movNumRes.rows[0].v;
      var docNumber = b.operation === 'Приход' ? (b.docNumber || null) : movNum;

      await pool.query(
        'INSERT INTO wh_movements ' +
        '(mov_num,operation,item_id,item_name,qty,unit,warehouse,address,supplier,' +
        ' doc_number,doc_date,doc_type,legal_entity,request_ref,order_ref,comments,created_by) ' +
        'VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::date,$12,$13,$14,$15,$16,$17)',
        [movNum, b.operation, item.id, b.itemName.trim(), qty,
         b.unit||item.unit, b.warehouse||item.material_type,
         b.address||item.address, b.supplier||null,
         docNumber, b.docDate||null, b.docType||null,
         b.legalEntity||null, b.requestRef||null, b.orderRef||null,
         b.comments||null, req.user.id]
      );

      res.json({ ok: true, itemId: item.id });
    } catch(e) {
      console.error('wh movement error:', e.message);
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  // ---------- create item ----------
  router.post('/items', auth, async function(req, res) {
    try {
      var b = req.body;
      if (!b.name || !b.name.trim())
        return res.status(400).json({ ok: false, error: 'Название обязательно' });
      var r = await pool.query(
        'INSERT INTO wh_items (sku,name,material_type,address,unit,qty,min_qty,reserved,comments) ' +
        "VALUES ('S'||LPAD(nextval('wh_sku_seq')::text,8,'0'),$1,$2,$3,$4,$5,$6,$7,$8) RETURNING id,sku",
        [b.name.trim(), b.materialType||null, b.address||null, b.unit||'шт',
         parseFloat(b.qty)||0, parseFloat(b.minQty)||0, parseFloat(b.reserved)||0, b.comments||null]
      );
      res.json({ ok: true, id: r.rows[0].id });
    } catch(e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  return router;
};
