// ─── Timeframe resolution (from timeframe.js) ─────────────────────
function resolveTimeframe(timeframe) {
  if (timeframe == null) return resolveTimeframe('month');

  if (typeof timeframe === 'object') {
    if (!timeframe.from || !timeframe.to)
      throw new Error('timeframe.from и timeframe.to обязательны');
    if (timeframe.from > timeframe.to)
      throw new Error('timeframe.from не может быть больше timeframe.to');
    return { from: timeframe.from, to: timeframe.to };
  }

  var now = new Date();
  var y = now.getFullYear();
  var m = now.getMonth();
  var d = now.getDate();

  function fmtDate(date) {
    var yy = date.getFullYear();
    var mm = String(date.getMonth() + 1).padStart(2, '0');
    var dd = String(date.getDate()).padStart(2, '0');
    return yy + '-' + mm + '-' + dd;
  }

  var todayStr = fmtDate(now);

  switch (timeframe) {
    case 'today':
      return { from: todayStr, to: todayStr };

    case 'week': {
      var dayOfWeek = now.getDay();
      var diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      var monday = new Date(now);
      monday.setDate(d - diff);
      return { from: fmtDate(monday), to: todayStr };
    }

    case 'month':
      return {
        from: y + '-' + String(m + 1).padStart(2, '0') + '-01',
        to: todayStr
      };

    case 'quarter': {
      var qStart = Math.floor(m / 3) * 3;
      return {
        from: y + '-' + String(qStart + 1).padStart(2, '0') + '-01',
        to: todayStr
      };
    }

    case 'year':
      return { from: y + '-01-01', to: todayStr };

    case 'all':
      return null;

    default:
      return resolveTimeframe('month');
  }
}

// ─── Date filter builder (from date-filter.js) ────────────────────
function buildDateFilter(column, timeframe) {
  if (!timeframe || !timeframe.from || !timeframe.to) {
    return { clause: '', params: [] };
  }
  return {
    clause: ' AND ' + column + ' >= $1::date AND ' + column + ' < $2::date + interval \'1 day\'',
    params: [timeframe.from, timeframe.to]
  };
}

// ─── Safe query ──────────────────────────────────────────────────
async function safeQuery(pool, text, params) {
  try {
    return await pool.query(text, params);
  } catch(e) {
    if (e.code === '42P01') {
      console.warn('[safeQuery] Table not found:', e.message);
      return { rows: [] };
    }
    throw e;
  }
}

// ─── Domain builders ────────────────────────────────────────────
async function productionSummary(pool, filters) {
  var df = buildDateFilter('deadline', filters && filters.timeframe);

  var machineSummary = await safeQuery(pool,
    'SELECT machine_resource, SUM(plan_minutes) AS plan_minutes, SUM(fact_minutes) AS fact_minutes, SUM(load_minutes) AS load_minutes, COUNT(*) AS order_count, ROUND(AVG(progress_pct),1) AS avg_progress FROM production_orders WHERE machine_resource IS NOT NULL' + df.clause + ' GROUP BY machine_resource ORDER BY machine_resource LIMIT 500',
    df.params.length ? df.params : undefined
  );
  var defectSummary = await safeQuery(pool,
    'SELECT operation_name, SUM(defects) AS total_defects, SUM(ready) AS total_ready, ROUND(SUM(defects) * 100.0 / NULLIF(SUM(ready), 0), 1) AS defect_pct FROM production_orders WHERE operation_name IS NOT NULL' + df.clause + ' GROUP BY operation_name ORDER BY total_defects DESC LIMIT 500',
    df.params.length ? df.params : undefined
  );
  var executorSummary = await safeQuery(pool,
    'SELECT executor, COUNT(*) AS order_count, ROUND(AVG(progress_pct),1) AS avg_progress FROM production_orders WHERE executor IS NOT NULL' + df.clause + ' GROUP BY executor ORDER BY order_count DESC LIMIT 500',
    df.params.length ? df.params : undefined
  );
  var totalOrders = await safeQuery(pool,
    'SELECT COUNT(*) FROM production_orders' + (df.clause ? ' WHERE 1=1' + df.clause : ''),
    df.params.length ? df.params : undefined
  );
  var activeOrders = await safeQuery(pool,
    "SELECT COUNT(*) FROM production_orders WHERE status NOT IN ('Готово','Отменён')" + df.clause,
    df.params.length ? df.params : undefined
  );

  return {
    ok: true,
    machine_summary: machineSummary.rows,
    defect_summary: defectSummary.rows,
    executor_summary: executorSummary.rows,
    total_orders: totalOrders.rows[0] ? parseInt(totalOrders.rows[0].count) : 0,
    active_orders: activeOrders.rows[0] ? parseInt(activeOrders.rows[0].count) : 0
  };
}

async function feedbackSummary(pool, filters) {
  var df = buildDateFilter('created_at', filters && filters.timeframe);

  var categorySummary = await safeQuery(pool,
    'SELECT category, COUNT(*) AS count FROM feedback' + (df.clause ? ' WHERE 1=1' + df.clause : '') + ' GROUP BY category ORDER BY count DESC LIMIT 500',
    df.params.length ? df.params : undefined
  );
  var statusSummary = await safeQuery(pool,
    "SELECT status, COUNT(*) AS count, priority FROM feedback" + (df.clause ? ' WHERE 1=1' + df.clause : '') + " GROUP BY status, priority ORDER BY status, priority LIMIT 500",
    df.params.length ? df.params : undefined
  );
  var assignedSummary = await safeQuery(pool,
    'SELECT assigned_to, COUNT(*) AS count FROM feedback WHERE assigned_to IS NOT NULL' + df.clause + ' GROUP BY assigned_to ORDER BY count DESC LIMIT 500',
    df.params.length ? df.params : undefined
  );

  return {
    ok: true,
    category_summary: categorySummary.rows,
    status_summary: statusSummary.rows,
    assigned_summary: assignedSummary.rows
  };
}

async function crmSummary(pool, filters) {
  var df = buildDateFilter('crd.updated_at', filters && filters.timeframe);

  var columnSummary = await safeQuery(pool,
    'SELECT c.id AS column_id, c.name AS column_name, COUNT(crd.id) AS card_count FROM crm_columns c LEFT JOIN crm_cards crd ON crd.column_id = c.id' + (df.clause ? ' WHERE 1=1' + df.clause : '') + ' GROUP BY c.id, c.name ORDER BY c.sort_order',
    df.params.length ? df.params : undefined
  );
  var idleCards = await safeQuery(pool,
    'SELECT id, title, updated_at, EXTRACT(EPOCH FROM (NOW() - updated_at)) / 86400 AS idle_days FROM crm_cards' + (df.clause ? ' WHERE 1=1' + df.clause : '') + ' ORDER BY updated_at ASC NULLS FIRST LIMIT 20',
    df.params.length ? df.params : undefined
  );
  var participantSummary = await safeQuery(pool,
    "SELECT u.first_name || ' ' || u.last_name AS name, COUNT(cp.card_id) AS card_count FROM crm_card_participants cp JOIN crm_cards crd ON crd.id = cp.card_id JOIN users u ON u.id = cp.user_id" + (df.clause ? ' WHERE 1=1' + df.clause : '') + ' GROUP BY u.first_name, u.last_name ORDER BY card_count DESC',
    df.params.length ? df.params : undefined
  );

  return {
    ok: true,
    column_summary: columnSummary.rows,
    idle_cards: idleCards.rows,
    participant_summary: participantSummary.rows
  };
}

async function warehouseSummary(pool, filters) {
  var tf = filters && filters.timeframe;
  var movDf = buildDateFilter('wh_movements.created_at', tf);

  var lowStockItems = await safeQuery(pool,
    "SELECT id, name, qty, min_qty, (qty - min_qty) AS surplus, address FROM wh_items WHERE min_qty > 0 AND qty < min_qty ORDER BY surplus ASC LIMIT 100"
  );
  var items = await safeQuery(pool,
    "SELECT id, name, material_type, address, unit, qty, min_qty FROM wh_items ORDER BY qty ASC LIMIT 300"
  );
  var totalStats = await safeQuery(pool,
    "SELECT COUNT(*) AS total_items, COUNT(*) FILTER (WHERE qty < min_qty) AS low_stock_count, SUM(qty) AS total_qty FROM wh_items"
  );
  var recentMovements = await safeQuery(pool,
    "SELECT COUNT(*) AS mov_count, SUM(qty) AS total_mov_qty FROM wh_movements" + (movDf.clause ? ' WHERE 1=1' + movDf.clause : ''),
    movDf.params.length ? movDf.params : undefined
  );

  return {
    ok: true,
    low_stock_items: lowStockItems.rows,
    items: items.rows,
    total_stats: totalStats.rows[0] || null,
    recent_movements: recentMovements.rows[0] || null
  };
}

async function sopSummary(pool, filters) {
  var df = buildDateFilter('ship_date', filters && filters.timeframe);
  var supplyDf = buildDateFilter('deadline', filters && filters.timeframe);

  var demandSummary = await safeQuery(pool,
    "SELECT DATE_TRUNC('month', ship_date)::DATE AS month, COUNT(*) AS order_count, SUM(quantity) AS total_qty, COUNT(*) FILTER (WHERE status != 'Выполнен') AS open_orders FROM orders WHERE ship_date IS NOT NULL" + df.clause + ' GROUP BY month ORDER BY month',
    df.params.length ? df.params : undefined
  );
  var supplySummary = await safeQuery(pool,
    "SELECT DATE_TRUNC('month', deadline)::DATE AS month, COUNT(DISTINCT narad_number) AS narad_count, SUM(norm_time_hours) AS total_hours, SUM(quantity) AS total_qty, ROUND(AVG(progress_pct),1) AS avg_progress FROM production_orders WHERE deadline IS NOT NULL" + supplyDf.clause + ' GROUP BY month ORDER BY month',
    supplyDf.params.length ? supplyDf.params : undefined
  );

  return {
    ok: true,
    demand_summary: demandSummary.rows,
    supply_summary: supplySummary.rows
  };
}

// ─── Registry ───────────────────────────────────────────────────
var DOMAIN_BUILDERS = {
  production: productionSummary,
  feedback: feedbackSummary,
  crm: crmSummary,
  warehouse: warehouseSummary,
  sop: sopSummary
};

// ─── Public API ─────────────────────────────────────────────────
async function buildAll(pool, tf) {
  var filterArg = tf ? { timeframe: tf } : {};
  var entries = Object.entries(DOMAIN_BUILDERS);
  var results = await Promise.all(entries.map(function(e) {
    return e[1](pool, filterArg).then(function(data) { return { name: e[0], data: data }; });
  }));
  var acc = { ok: true };
  results.forEach(function(r) { acc[r.name] = r.data; });
  return acc;
}

async function build(pool, domain, filters) {
  var tf = resolveTimeframe(filters?.timeframe);
  try {
    if (domain === 'all') {
      var data = await buildAll(pool, tf);
      return { ...data, _timeframe: tf };
    }
    var builder = DOMAIN_BUILDERS[domain];
    if (!builder) return { ok: false, error: 'Неизвестный домен: ' + domain };
    var data = await builder(pool, tf ? { timeframe: tf } : {});
    return { ...data, _timeframe: tf };
  } catch(e) {
    return { ok: false, error: e.message };
  }
}

module.exports = { build };
