module.exports = function(pool, auth, requireFeature) {
  var express = require('express');
  var router = express.Router();

  router.get('/summary', auth, requireFeature('sop'), async function(req, res) {
    try {
      var from = req.query.from || '2000-01-01';
      var to = req.query.to || '2100-01-01';

      var demand = await pool.query(
        "SELECT DATE_TRUNC('month', ship_date) AS month, COUNT(*) AS order_count, SUM(quantity) AS total_qty, COUNT(*) FILTER (WHERE status != 'Выполнен') AS open_orders FROM orders WHERE ship_date BETWEEN $1 AND $2 GROUP BY month ORDER BY month",
        [from, to]
      );

      var supply = await pool.query(
        "SELECT DATE_TRUNC('month', deadline) AS month, COUNT(DISTINCT narad_number) AS narad_count, SUM(norm_time_hours) AS total_hours, SUM(quantity) AS total_qty, AVG(progress_pct) AS avg_progress FROM production_orders WHERE deadline BETWEEN $1 AND $2 GROUP BY month ORDER BY month",
        [from, to]
      );

      var demandMap = {};
      demand.rows.forEach(function(r) {
        var key = r.month ? r.month.toISOString().slice(0, 7) : '';
        demandMap[key] = r;
      });

      var supplyMap = {};
      supply.rows.forEach(function(r) {
        var key = r.month ? r.month.toISOString().slice(0, 7) : '';
        supplyMap[key] = r;
      });

      var allKeys = Object.keys(demandMap).concat(Object.keys(supplyMap));
      allKeys = allKeys.filter(function(k, i) { return allKeys.indexOf(k) === i; });
      allKeys.sort();

      var months = allKeys.map(function(key) {
        var d = demandMap[key] || { order_count: 0, total_qty: 0, open_orders: 0 };
        var s = supplyMap[key] || { narad_count: 0, total_hours: 0, total_qty: 0, avg_progress: 0 };
        return {
          month: key,
          demand: { order_count: Number(d.order_count), qty: Number(d.total_qty), open_orders: Number(d.open_orders) },
          supply: { narad_count: Number(s.narad_count), total_hours: Number(s.total_hours), qty: Number(s.total_qty), avg_progress: Number(s.avg_progress) },
          gap_qty: Number(d.total_qty) - Number(s.total_qty),
          gap_hours: Number(s.total_hours)
        };
      });

      res.json({ ok: true, months: months });
    } catch(e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  router.get('/orders', auth, requireFeature('sop'), async function(req, res) {
    try {
      var r = await pool.query('SELECT * FROM orders ORDER BY ship_date DESC NULLS LAST, created_at DESC');
      res.json({ ok: true, rows: r.rows });
    } catch(e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  router.get('/orders/autocomplete', auth, requireFeature('sop'), async function(req, res) {
    try {
      var q = req.query.q || '';
      var r = await pool.query("SELECT DISTINCT order_number FROM orders WHERE order_number ILIKE $1 ORDER BY order_number LIMIT 20", ['%' + q + '%']);
      res.json({ ok: true, rows: r.rows.map(function(r) { return r.order_number; }) });
    } catch(e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  return router;
};
