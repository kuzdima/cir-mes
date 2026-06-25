var express = require('express');

module.exports = function(pool, auth) {
  var router = express.Router();

  router.get('/', auth, async function(req, res) {
    try {
      var { classifier, product_name, object_type, page, limit } = req.query;
      page = parseInt(page) || 1;
      limit = parseInt(limit) || 100;
      var offset = (page - 1) * limit;
      var conds = [], params = [], pi = 1;
      if (classifier) {
        conds.push('(classifier_code ILIKE $' + pi + ' OR product_name ILIKE $' + pi + ')');
        params.push('%' + classifier + '%'); pi++;
      }
      if (object_type) {
        conds.push('object_type = $' + pi);
        params.push(object_type); pi++;
      }
      var where = conds.length ? 'WHERE ' + conds.join(' AND ') : '';
      params.push(limit + 1, offset);
      var sql = 'SELECT t.*, NULLIF(TRIM(COALESCE(u.last_name,\'\') || \' \' || COALESCE(u.first_name,\'\')), \'\') AS creator_name FROM tech_operations_archive t LEFT JOIN users u ON t.created_by = u.id ' + where + ' ORDER BY t.classifier_code, t.operation_number LIMIT $' + pi + ' OFFSET $' + (pi + 1);
      var rows = await pool.query(sql, params);
      var hasMore = rows.rows.length > limit;
      if (hasMore) rows.rows.pop();
      res.json({ ok: true, rows: rows.rows, total: hasMore ? offset + limit + 1 : offset + rows.rows.length, page });
    } catch(e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  router.get('/refs', auth, async function(req, res) {
    try {
      var [ops, machines, coatings, units, objectTypes, materials, assortments] = await Promise.all([
        pool.query('SELECT name FROM ref_operations ORDER BY name'),
        pool.query('SELECT name FROM ref_machines ORDER BY name'),
        pool.query('SELECT name FROM ref_coatings ORDER BY name'),
        pool.query('SELECT name FROM ref_units ORDER BY name'),
        pool.query('SELECT name FROM ref_object_types ORDER BY name'),
        pool.query('SELECT DISTINCT material_grade AS name FROM tech_operations_archive WHERE material_grade IS NOT NULL ORDER BY name'),
        pool.query('SELECT DISTINCT assortment AS name FROM tech_operations_archive WHERE assortment IS NOT NULL AND LENGTH(assortment)<50 ORDER BY name LIMIT 100'),
      ]);
      res.json({ ok: true,
        operations: ops.rows.map(function(r){ return r.name; }),
        machines:   machines.rows.map(function(r){ return r.name; }),
        coatings:   coatings.rows.map(function(r){ return r.name; }),
        units:      units.rows.map(function(r){ return r.name; }),
        objectTypes: objectTypes.rows.map(function(r){ return r.name; }),
        materials:  materials.rows.map(function(r){ return r.name; }),
        assortments: assortments.rows.map(function(r){ return r.name; }),
      });
    } catch(e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  router.get('/autocomplete', auth, async function(req, res) {
    try {
      var { q, field } = req.query;
      if (!q || q.length < 2) return res.json({ ok: true, rows: [] });
      var rows;
      if (field === 'product') {
        rows = await pool.query(
          'SELECT name, code, object_type FROM (SELECT DISTINCT product_name AS name, classifier_code AS code, object_type FROM tech_operations_archive WHERE product_name ILIKE $1 UNION SELECT DISTINCT item_name AS name, classifier AS code, object_type FROM products_archive WHERE item_name ILIKE $1) t ORDER BY name LIMIT 30',
          ['%' + q + '%']
        );
      } else if (field === 'classifier') {
        rows = await pool.query(
          'SELECT name, code, object_type FROM (SELECT DISTINCT classifier_code AS name, product_name AS code, object_type FROM tech_operations_archive WHERE classifier_code ILIKE $1 UNION SELECT DISTINCT classifier AS name, item_name AS code, object_type FROM products_archive WHERE classifier ILIKE $1) t ORDER BY name LIMIT 30',
          ['%' + q + '%']
        );
      } else {
        return res.json({ ok: true, rows: [] });
      }
      res.json({ ok: true, rows: rows.rows });
    } catch(e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  router.get('/search', auth, async function(req, res) {
    try {
      var { product_name, classifier } = req.query;
      var rows = await pool.query(
        'SELECT * FROM tech_operations_archive WHERE LOWER(product_name)=LOWER($1) AND LOWER(classifier_code)=LOWER($2) ORDER BY operation_number',
        [product_name, classifier]
      );
      if (!rows.rows.length) return res.json({ ok: false, message: 'Не найдено' });
      var f = rows.rows[0];
      res.json({ ok: true, commonData: {
        classifierCode: f.classifier_code, productName: f.product_name, noticeNumber: f.notice_number,
        objectType: f.object_type, materialGrade: f.material_grade, assortment: f.assortment,
        materialAmount: f.material_amount, unitOfMeasure: f.unit_of_measure, coating: f.coating,
        hardness: f.hardness, fullName: f.full_name, makeQty: f.make_qty, massKg: f.mass_kg,
        dimensions: f.dimensions, mainOrderId: f.main_order_id, productComment: f.product_comment,
      }, operations: rows.rows.map(function(r) { return {
        operationNumber: r.operation_number, operationName: r.operation_name, executor: r.executor,
        machineResource: r.machine_resource, operationComment: r.operation_comment, tool: r.tool,
        normTimeHours: r.norm_time_hours, batchPrepHours: r.batch_prep_hours,
        isOutsourcing: r.is_outsourcing, isFinal: r.is_final, isCnc: r.is_cnc,
      }; })});
    } catch(e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  router.post('/', auth, async function(req, res) {
    try {
      var b = req.body;
      if (!b.classifierCode || !b.productName) return res.status(400).json({ ok: false, error: 'Заполните обязательные поля' });
      if (!b.operations || !b.operations.length) return res.status(400).json({ ok: false, error: 'Нет операций' });
      if (!b.operations.some(function(o){ return o.isFinal; })) return res.status(400).json({ ok: false, error: 'Нужна финальная операция' });
      if (b.action === 'replace') {
        await pool.query('DELETE FROM tech_operations_archive WHERE LOWER(product_name)=LOWER($1) AND LOWER(classifier_code)=LOWER($2)', [b.productName, b.classifierCode]);
      }
      var drawings = [b.classifierCode].concat(b.analogDrawings || []).filter(Boolean);
      for (var di = 0; di < drawings.length; di++) {
        for (var oi = 0; oi < b.operations.length; oi++) {
          var op = b.operations[oi];
          await pool.query(
            'INSERT INTO tech_operations_archive (classifier_code,product_name,notice_number,object_type,material_grade,assortment,material_amount,unit_of_measure,coating,hardness,full_name,make_qty,mass_kg,dimensions,main_order_id,product_comment,operation_number,operation_name,executor,machine_resource,operation_comment,tool,norm_time_hours,batch_prep_hours,is_outsourcing,is_final,is_cnc,created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28)',
            [drawings[di], b.productName, b.noticeNumber||null, b.objectType||null, b.materialGrade||null, b.assortment||null,
             b.materialAmount?parseFloat(b.materialAmount):null, b.unitOfMeasure||null, b.coating||null, b.hardness||null,
             b.fullName||null, b.makeQty?parseFloat(b.makeQty):null, b.massKg?parseFloat(b.massKg):null, b.dimensions||null,
             b.mainOrderId||null, b.productComment||null, op.operationNumber, op.operationName, op.executor||null,
             op.machineResource||null, op.operationComment||null, op.tool||null,
             op.normTimeHours?parseFloat(op.normTimeHours):null, op.batchPrepHours?parseFloat(op.batchPrepHours):null,
             op.isOutsourcing===true, op.isFinal===true, op.isCnc===true, req.user.id]
          );
        }
      }
      res.json({ ok: true, message: 'Добавлено ' + b.operations.length + ' операций' });
    } catch(e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  router.delete('/', auth, async function(req, res) {
    try {
      if (req.user.role !== 'admin') return res.status(403).json({ ok: false, error: 'Удаление доступно только администратору' });
      var { classifierCode, productName } = req.body;
      if (!classifierCode || !productName) return res.status(400).json({ ok: false, error: 'Не указан classifierCode или productName' });
      var result = await pool.query(
        'DELETE FROM tech_operations_archive WHERE LOWER(classifier_code)=LOWER($1) AND LOWER(product_name)=LOWER($2)',
        [classifierCode, productName]
      );
      res.json({ ok: true, deleted: result.rowCount, message: 'Удалено ' + result.rowCount + ' операций' });
    } catch(e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  return router;
};
