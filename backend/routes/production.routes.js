var express = require('express');

module.exports = function(pool, auth) {
  var router = express.Router();

  router.get('/', auth, async function(req, res) {
    try {
      var { view, q, status, limit, page } = req.query;
      limit = parseInt(limit) || 50;
      page  = parseInt(page)  || 1;
      var offset = (page - 1) * limit;
      var params = [], pi = 1, conds = [];

      if (q) {
        conds.push('(narad_number ILIKE $'+pi+' OR product_name ILIKE $'+pi+' OR classifier_code ILIKE $'+pi+')');
        params.push('%'+q+'%'); pi++;
      }

      var s = status ? String(status).replace(/^[^\wА-Яа-я]+/, '').trim() : '';
      var statusOps = '', statusProj = '';
      if (s === 'Новый') {
        statusOps  = 'started_at IS NULL';
        statusProj = 'p.started_at IS NULL';
      } else if (s === 'Готово') {
        statusOps  = 'COALESCE(ready,0) >= COALESCE(quantity,0) AND COALESCE(quantity,0) > 0';
        statusProj = 'COALESCE(agg.done_parts,0) >= COALESCE(p.quantity,0) AND COALESCE(p.quantity,0) > 0';
      } else if (s === 'В работе') {
        statusOps  = 'started_at IS NOT NULL AND (COALESCE(ready,0) < COALESCE(quantity,0) OR COALESCE(quantity,0) = 0)';
        statusProj = 'p.started_at IS NOT NULL AND (COALESCE(agg.done_parts,0) < COALESCE(p.quantity,0) OR COALESCE(p.quantity,0) = 0)';
      } else if (s === 'Пауза') {
        statusOps = 'paused_at IS NOT NULL AND NOT (COALESCE(ready,0) >= COALESCE(quantity,0) AND COALESCE(quantity,0) > 0)';
      }

      if (view === 'projects') {
        var pCond = conds.map(function(c){
          return c.replace(/narad_number/g,'p.narad_number').replace(/product_name/g,'p.product_name').replace(/classifier_code/g,'p.classifier_code');
        });
        if (statusProj) pCond.push(statusProj);
        var where = pCond.length ? 'WHERE ' + pCond.join(' AND ') : '';
        params.push(limit, offset);
        var sql = 'SELECT DISTINCT ON (p.narad_number, p.classifier_code) p.*, agg.total_ops, agg.done_ops, COALESCE(agg.done_parts,0) AS ready_parts, CASE WHEN agg.total_ops > 0 THEN agg.done_ops::numeric / agg.total_ops ELSE 0 END AS progress_pct, CASE WHEN p.started_at IS NULL THEN \'Новый\' WHEN COALESCE(agg.done_parts,0) >= COALESCE(p.quantity,0) AND COALESCE(p.quantity,0) > 0 THEN \'Готово\' ELSE \'В работе\' END AS status, GREATEST(COALESCE(p.quantity,0) - COALESCE(agg.done_parts,0), 0) AS not_ready, NULLIF(TRIM(COALESCE(u.last_name,\'\') || \' \' || COALESCE(u.first_name,\'\')), \'\') AS creator_name FROM production_orders p LEFT JOIN (SELECT narad_number, classifier_code, COUNT(*) AS total_ops, COUNT(*) FILTER (WHERE COALESCE(ready,0) >= COALESCE(quantity,0) AND COALESCE(quantity,0) > 0) AS done_ops, MIN(ready) AS done_parts FROM production_orders GROUP BY narad_number, classifier_code) agg ON p.narad_number = agg.narad_number AND p.classifier_code = agg.classifier_code LEFT JOIN users u ON p.created_by = u.id ' + where + ' ORDER BY p.narad_number, p.classifier_code, p.id LIMIT $'+pi+' OFFSET $'+(pi+1);
        var rows = await pool.query(sql, params);
        res.json({ ok: true, rows: rows.rows });
      } else {
        if (statusOps) conds.push(statusOps);
        var where = conds.length ? 'WHERE ' + conds.join(' AND ') : '';
        params.push(limit + 1, offset);
        var sql = 'SELECT po.*, NULLIF(TRIM(COALESCE(u.last_name,\'\') || \' \' || COALESCE(u.first_name,\'\')), \'\') AS creator_name, CASE WHEN po.started_at IS NULL THEN \'Новый\' WHEN COALESCE(po.ready,0) >= COALESCE(po.quantity,0) AND COALESCE(po.quantity,0) > 0 THEN \'Готово\' WHEN po.paused_at IS NOT NULL THEN \'Пауза\' ELSE \'В работе\' END AS status, GREATEST(COALESCE(po.quantity,0) - COALESCE(po.ready,0), 0) AS not_ready FROM production_orders po LEFT JOIN users u ON po.created_by = u.id ' + where + ' ORDER BY narad_number, classifier_code, operation_number LIMIT $'+pi+' OFFSET $'+(pi+1);
        var rows = await pool.query(sql, params);
        var hasMore = rows.rows.length > limit;
        if (hasMore) rows.rows.pop();
        res.json({ ok: true, rows: rows.rows, total: hasMore ? offset+limit+1 : offset+rows.rows.length });
      }
    } catch(e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  router.get('/form-data', auth, async function(req, res) {
    try {
      var lastNarad = await pool.query("SELECT narad_number FROM production_orders ORDER BY narad_number DESC LIMIT 1");
      var nextNarad = '';
      if (lastNarad.rows.length) {
        var last = lastNarad.rows[0].narad_number;
        var match = last.match(/^(.*?)(\d+)$/);
        if (match) nextNarad = match[1] + String(parseInt(match[2]) + 1).padStart(match[2].length, '0');
      }
      if (!nextNarad) nextNarad = new Date().getFullYear() + '-01';

      var [orders, customers] = await Promise.all([
        pool.query("SELECT DISTINCT order_number FROM production_orders WHERE order_number IS NOT NULL AND order_number != '' ORDER BY order_number"),
        pool.query("SELECT DISTINCT customer FROM production_orders WHERE customer IS NOT NULL AND customer != '' ORDER BY customer"),
      ]);
      res.json({
        ok: true, nextNarad,
        orders:    orders.rows.map(function(r){ return r.order_number; }),
        customers: customers.rows.map(function(r){ return r.customer; }),
      });
    } catch(e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  router.get('/load-from-archive', auth, async function(req, res) {
    try {
      var { assembly_id } = req.query;
      if (!assembly_id) return res.status(400).json({ ok: false, error: 'assembly_id required' });
      var parts = await pool.query('SELECT * FROM products_archive WHERE assembly_id=$1 ORDER BY level, struct_id', [assembly_id]);
      var allOps = [];
      for (var i = 0; i < parts.rows.length; i++) {
        var p = parts.rows[i];
        if (!p.classifier || p.object_type === 'ПКИ') continue;
        var ops = await pool.query('SELECT * FROM tech_operations_archive WHERE LOWER(classifier_code)=LOWER($1) ORDER BY operation_number', [p.classifier]);
        ops.rows.forEach(function(o){ allOps.push(o); });
      }
      res.json({ ok: true, operations: allOps });
    } catch(e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  router.get('/detail', auth, async function(req, res) {
    try {
      var { id } = req.query;
      if (!id) return res.status(400).json({ ok: false, error: 'id required' });
      var result = await pool.query('SELECT * FROM production_orders WHERE id=$1', [id]);
      if (!result.rows.length) return res.json({ ok: false, error: 'Not found' });
      res.json({ ok: true, row: result.rows[0] });
    } catch(e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  router.post('/', auth, async function(req, res) {
    try {
      var b = req.body;
      if (!b.naradNumber) return res.status(400).json({ ok: false, error: 'Номер наряда обязателен' });
      var existing = await pool.query('SELECT id FROM production_orders WHERE narad_number=$1 LIMIT 1', [b.naradNumber]);
      if (existing.rows.length) {
        await pool.query('DELETE FROM production_orders WHERE narad_number=$1', [b.naradNumber]);
        await pool.query('DELETE FROM production_narads WHERE narad_number=$1', [b.naradNumber]);
      }

      var ops;
      if (b.classifierCode && b.productName) {
        var r = await pool.query(
          'SELECT * FROM tech_operations_archive WHERE LOWER(classifier_code)=LOWER($1) AND LOWER(product_name)=LOWER($2) ORDER BY operation_number',
          [b.classifierCode, b.productName]
        );
        ops = r.rows;
        if (!b.assemblyId && b.classifierCode) {
          var arcRow = await pool.query('SELECT assembly_id FROM products_archive WHERE LOWER(classifier)=LOWER($1) AND assembly_id IS NOT NULL LIMIT 1', [b.classifierCode]);
          if (arcRow.rows.length) b.assemblyId = arcRow.rows[0].assembly_id;
        }
      } else if (b.assemblyId) {
        var parts = await pool.query('SELECT * FROM products_archive WHERE assembly_id=$1 ORDER BY level, struct_id', [b.assemblyId]);
        ops = [];
        for (var i = 0; i < parts.rows.length; i++) {
          var p = parts.rows[i];
          if (!p.classifier || p.object_type === 'ПКИ') continue;
          var pOps = await pool.query('SELECT * FROM tech_operations_archive WHERE LOWER(classifier_code)=LOWER($1) ORDER BY operation_number', [p.classifier]);
          pOps.rows.forEach(function(o){ ops.push(o); });
        }
      } else {
        return res.status(400).json({ ok: false, error: 'Укажите изделие или головное изделие' });
      }

      var added = 0;
      var INSERT_SQL = 'INSERT INTO production_orders (narad_number,status,order_number,customer,production_start_date,operation_number,is_final,product_name,classifier_code,object_type,material_grade,assortment,material_amount,unit_of_measure,operation_name,machine_resource,operation_comment,quantity,priority,deadline,norm_time_hours,load_per_unit_hours,batch_prep_hours,assembly_id,serial_number,executor,is_cnc,plan_minutes,created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29)';

      var NARAD_SQL = 'INSERT INTO production_narads (narad_number,assembly_id,quantity,order_number,customer,deadline,priority,created_by) ' +
        'VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (narad_number) DO UPDATE SET ' +
        'assembly_id=$2,quantity=$3,order_number=$4,customer=$5,deadline=$6,priority=$7,updated_at=NOW() RETURNING id';

      if (b.classifierCode && b.productName) {
        for (var j = 0; j < ops.length; j++) {
          var o = ops[j];
          await pool.query(INSERT_SQL, [b.naradNumber,'Новый',b.orderNumber||null,b.customer||null,b.productionStartDate||null,o.operation_number,o.is_final,o.product_name,o.classifier_code,o.object_type,o.material_grade,o.assortment,o.material_amount,o.unit_of_measure,o.operation_name,o.machine_resource,o.operation_comment,b.quantity||1,b.priority||3,b.deadline||null,o.norm_time_hours,o.load_per_unit_hours,o.batch_prep_hours,b.assemblyId||null,o.serial_number,o.executor,o.is_cnc,(o.norm_time_hours||0)*60*(b.quantity||1),req.user.id]);
          added++;
        }
        var nr = await pool.query(NARAD_SQL, [b.naradNumber,b.assemblyId||null,b.quantity||1,b.orderNumber||null,b.customer||null,b.deadline||null,b.priority||3,req.user.id]);
        await pool.query('UPDATE production_orders SET narad_id=$1 WHERE narad_number=$2', [nr.rows[0].id, b.naradNumber]);
      } else {
        var match = b.naradNumber.match(/^(.*?)(\d+)$/);
        var prefix = match ? match[1] : b.naradNumber + '-';
        var startNum = match ? parseInt(match[2]) : 1;
        var padLen = match ? match[2].length : 2;
        var groups = {};
        ops.forEach(function(o){ var k = o.classifier_code; if (!groups[k]) groups[k] = []; groups[k].push(o); });
        var keys = Object.keys(groups), naradIndex = 0;
        for (var k = 0; k < keys.length; k++) {
          var grOps = groups[keys[k]];
          var currentNarad = prefix + String(startNum + naradIndex).padStart(padLen, '0');
          for (var j = 0; j < grOps.length; j++) {
            var o = grOps[j];
            await pool.query(INSERT_SQL, [currentNarad,'Новый',b.orderNumber||null,b.customer||null,b.productionStartDate||null,o.operation_number,o.is_final,o.product_name,o.classifier_code,o.object_type,o.material_grade,o.assortment,o.material_amount,o.unit_of_measure,o.operation_name,o.machine_resource,o.operation_comment,b.quantity||1,b.priority||3,b.deadline||null,o.norm_time_hours,o.load_per_unit_hours,o.batch_prep_hours,b.assemblyId||null,o.serial_number,o.executor,o.is_cnc,(o.norm_time_hours||0)*60*(b.quantity||1),req.user.id]);
            added++;
          }
          var nr = await pool.query(NARAD_SQL, [currentNarad,b.assemblyId||null,b.quantity||1,b.orderNumber||null,b.customer||null,b.deadline||null,b.priority||3,req.user.id]);
          await pool.query('UPDATE production_orders SET narad_id=$1 WHERE narad_number=$2', [nr.rows[0].id, currentNarad]);
          naradIndex++;
        }
      }
      res.json({ ok: true, added });
    } catch(e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  router.delete('/', auth, async function(req, res) {
    try {
      var { naradNumber } = req.body;
      if (!naradNumber) return res.status(400).json({ ok: false, error: 'naradNumber required' });
      var result = await pool.query('DELETE FROM production_orders WHERE narad_number=$1', [naradNumber]);
      await pool.query('DELETE FROM production_narads WHERE narad_number=$1', [naradNumber]);
      res.json({ ok: true, deleted: result.rowCount });
    } catch(e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  router.post('/fact', auth, async function(req, res) {
    try {
      var b = req.body;
      if (!b.naradNumber || !b.operationNumber) return res.status(400).json({ ok: false, error: 'naradNumber and operationNumber required' });
      var deltaReady   = parseInt(b.ready)   || 0;
      var deltaDefects = parseInt(b.defects) || 0;
      if (deltaReady < 0 || deltaDefects < 0) return res.status(400).json({ ok: false, error: 'Количества не могут быть отрицательными' });

      var clean = String(b.status||'').replace(/^[^\wА-Яа-я]+/, '').trim();
      var markPause = (clean === 'Пауза');

      var cur = await pool.query('SELECT quantity, ready FROM production_orders WHERE narad_number=$1 AND operation_number=$2 LIMIT 1', [b.naradNumber, b.operationNumber]);
      if (!cur.rows.length) return res.status(404).json({ ok: false, error: 'Операция не найдена' });
      var quantity = parseInt(cur.rows[0].quantity) || 0;
      var oldReady = parseInt(cur.rows[0].ready)    || 0;

      await pool.query('UPDATE production_orders SET started_at=NOW() WHERE narad_number=$1 AND started_at IS NULL', [b.naradNumber]);

      var maxAdd = Math.max(0, quantity - oldReady);
      if (deltaReady > maxAdd) return res.status(400).json({ ok: false, error: 'Можно добавить максимум ' + maxAdd + ' годных. Уже отмечено ' + oldReady + ' из ' + quantity + '.' });

      var upd = await pool.query(
        'UPDATE production_orders SET ready=COALESCE(ready,0)+$1, defects=COALESCE(defects,0)+$2, fact_minutes=COALESCE(fact_minutes,0)+$3, workshop_area=$4, operation_comment=$5, updated_at=NOW() WHERE narad_number=$6 AND operation_number=$7 RETURNING quantity, ready, defects',
        [deltaReady, deltaDefects, b.factMinutes||0, b.workshopArea||null, b.comment||null, b.naradNumber, b.operationNumber]
      );

      if (markPause) {
        await pool.query('UPDATE production_orders SET paused_at=NOW() WHERE narad_number=$1 AND operation_number=$2', [b.naradNumber, b.operationNumber]);
      } else {
        await pool.query('UPDATE production_orders SET paused_at=NULL WHERE narad_number=$1 AND operation_number=$2', [b.naradNumber, b.operationNumber]);
      }

      var summary = await pool.query('SELECT COUNT(*) AS total_ops, COUNT(*) FILTER (WHERE COALESCE(ready,0) >= COALESCE(quantity,0) AND COALESCE(quantity,0) > 0) AS done_ops FROM production_orders WHERE narad_number=$1', [b.naradNumber]);
      var totalOps = parseInt(summary.rows[0].total_ops) || 0;
      var doneOps  = parseInt(summary.rows[0].done_ops)  || 0;
      var allDone  = totalOps > 0 && doneOps === totalOps;
      var newReady = upd.rows[0].ready;
      var qty      = upd.rows[0].quantity;

      res.json({
        ok: true,
        naradStatus: allDone ? 'Готово' : (doneOps > 0 || newReady > 0 ? 'В работе' : 'Новый'),
        progress: Math.round((totalOps > 0 ? doneOps / totalOps : 0) * 100) + '%',
        ready: newReady, quantity: qty,
        defects: upd.rows[0].defects,
        notReady: Math.max(0, qty - newReady)
      });
    } catch(e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  router.post('/status', auth, async function(req, res) {
    try {
      var { naradNumber, status } = req.body;
      if (!naradNumber) return res.status(400).json({ ok: false, error: 'naradNumber required' });
      var s = String(status||'').replace(/^[^\wА-Яа-я]+/, '').trim();
      if (s === 'В работе') {
        await pool.query('UPDATE production_orders SET started_at=COALESCE(started_at,NOW()), updated_at=NOW() WHERE narad_number=$1', [naradNumber]);
      } else if (s === 'Готово') {
        await pool.query('UPDATE production_orders SET started_at=COALESCE(started_at,NOW()), ready=quantity, updated_at=NOW() WHERE narad_number=$1', [naradNumber]);
      } else if (s === 'Новый') {
        await pool.query('UPDATE production_orders SET started_at=NULL, ready=0, defects=0, fact_minutes=0, updated_at=NOW() WHERE narad_number=$1', [naradNumber]);
      } else {
        return res.status(400).json({ ok: false, error: 'Неизвестный статус: ' + status });
      }
      res.json({ ok: true });
    } catch(e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  return router;
};
