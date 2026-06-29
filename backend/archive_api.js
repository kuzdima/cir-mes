module.exports = function(pool, auth) {
  var express = require('express');
  var router = express.Router();

  // Archive list
  router.get('/', auth, async function(req, res) {
    try {
      var { q, assembly_id } = req.query;
      var conds = [], params = [], pi = 1;
      if (assembly_id) { conds.push('p.assembly_id = $' + pi); params.push(assembly_id); pi++; }
      if (q) {
        conds.push('(p.assembly_id ILIKE $' + pi + ' OR p.item_name ILIKE $' + pi + ' OR p.classifier ILIKE $' + pi + ')');
        params.push('%' + q + '%'); pi++;
      }
      var where = conds.length ? 'WHERE ' + conds.join(' AND ') : '';
      var sql = "SELECT p.*, s.serial_number, NULLIF(TRIM(COALESCE(u.last_name,'') || ' ' || COALESCE(u.first_name,'')), '') AS creator_name FROM products_archive p LEFT JOIN (SELECT DISTINCT classifier_code, product_name, serial_number FROM tech_operations_archive WHERE serial_number IS NOT NULL) s ON LOWER(p.classifier) = LOWER(s.classifier_code) AND LOWER(p.item_name) = LOWER(s.product_name) LEFT JOIN users u ON p.created_by = u.id " + where + " ORDER BY p.assembly_id, length(p.struct_id), p.struct_id";
      var rows = await pool.query(sql, params);
      res.json({ ok: true, rows: rows.rows });
    } catch(e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  // Archive save
  router.post('/', auth, async function(req, res) {
    try {
      var items = req.body.items;
      if (!items || !items.length) return res.status(400).json({ ok: false, error: 'Нет данных' });
      var root = items.find(function(i) { return i.id === '0'; });
      if (!root) return res.status(400).json({ ok: false, error: 'Нет корневого элемента' });
      var aid = root.classifier;

      var unlinked = await pool.query(
        'UPDATE products_archive SET assembly_id = NULL, serial_order = NULL WHERE assembly_id = $1',
        [aid]
      );
      if (unlinked.rowCount > 0) {
        console.log('Отвязано', unlinked.rowCount, 'строк от', aid);
        await pool.query(
          "UPDATE tech_operations_archive SET serial_number = NULL WHERE serial_number IS NOT NULL AND LOWER(classifier_code) IN (SELECT LOWER(classifier) FROM products_archive WHERE assembly_id IS NULL AND classifier IS NOT NULL)"
        );
      }

      var inserted = 0, updated = 0, serialUpdated = 0;

      for (var i = 0; i < items.length; i++) {
        var it = items[i];
        var lvl = it.level != null ? it.level : (it.id === '0' ? 0 : (it.id.match(/\./g) || []).length + 1);
        var pid = it.parentId || (it.id.indexOf('.') !== -1 ? it.id.split('.').slice(0, -1).join('.') : '0');

        var existing = null;
        if (it.classifier) {
          existing = await pool.query(
            "SELECT id FROM products_archive WHERE LOWER(classifier) = LOWER($1) AND LOWER(item_name) = LOWER($2) AND assembly_id IS NULL LIMIT 1",
            [it.classifier, it.name]
          );
        }
        if (!existing || !existing.rows.length) {
          existing = await pool.query(
            "SELECT id FROM products_archive WHERE LOWER(item_name) = LOWER($1) AND (classifier IS NULL OR classifier = $2) AND assembly_id IS NULL LIMIT 1",
            [it.name, it.classifier || '']
          );
        }

        var laborHours = null;
        if (it.classifier) {
          var laborResult = await pool.query(
            'SELECT COALESCE(SUM(COALESCE(norm_time_hours,0) + COALESCE(batch_prep_hours,0)), 0) as total FROM tech_operations_archive WHERE LOWER(classifier_code) = LOWER($1)',
            [it.classifier]
          );
          if (laborResult.rows[0].total > 0) {
            laborHours = parseFloat(laborResult.rows[0].total);
          }
        }

        if (existing && existing.rows.length > 0) {
          await pool.query(
            'UPDATE products_archive SET assembly_id=$1, struct_id=$2, quantity=$3, object_type=$4, parent_id=$5, level=$6, serial_order=$7, labor_hours=$8 WHERE id=$9',
            [aid, it.id, it.quantity || 1, it.objectType || null, pid, lvl, it.serialOrder || null, laborHours, existing.rows[0].id]
          );
          updated++;
        } else {
          await pool.query(
            'INSERT INTO products_archive (assembly_id,struct_id,item_name,classifier,quantity,object_type,parent_id,level,serial_order,labor_hours,created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)',
            [aid, it.id, it.name, it.classifier || null, it.quantity || 1, it.objectType || null, pid, lvl, it.serialOrder || null, laborHours, req.user.id]
          );
          inserted++;
        }

        if (it.serialOrder && it.classifier && it.name) {
          var upd = await pool.query(
            'UPDATE tech_operations_archive SET serial_number = $1 WHERE LOWER(classifier_code) = LOWER($2) AND LOWER(product_name) = LOWER($3) AND is_final = TRUE',
            [it.serialOrder, it.classifier, it.name]
          );
          serialUpdated += upd.rowCount;
        }
      }

      console.log('Архив:', aid, '| привязано:', updated, '| новых:', inserted, '| serial:', serialUpdated);
      res.json({ ok: true, added: inserted, updated: updated, serialUpdated: serialUpdated });
    } catch(e) {
      console.log('archive error:', e.message);
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  // Assemblies list
  router.get('/assemblies', auth, async function(req, res) {
    try {
      var rows = await pool.query("SELECT DISTINCT assembly_id, item_name FROM products_archive WHERE struct_id = '0' AND assembly_id IS NOT NULL ORDER BY item_name");
      res.json({ ok: true, rows: rows.rows });
    } catch(e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  return router;
};
