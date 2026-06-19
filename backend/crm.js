module.exports = function(app, pool, SECRET, io, auth) {

  function adminOnly(req, res, next) {
    if (req.user.role !== 'admin') return res.status(403).json({ ok: false, error: 'Только для администратора' });
    next();
  }
  function crmAccessOnly(req, res, next) {
    pool.query('SELECT 1 FROM crm_access WHERE user_id = $1', [req.user.id], function(err, result) {
      if (err || !result.rows.length) return res.status(403).json({ ok: false, error: 'Нет доступа к CRM' });
      next();
    });
  }

  initTables(pool).then(function() {});

  require('./crm/columns')(app, pool, io, auth, adminOnly, crmAccessOnly);
  require('./crm/cards')(app, pool, io, auth, adminOnly, crmAccessOnly);
  require('./crm/files')(app, pool, io, auth, adminOnly, crmAccessOnly);
  require('./crm/fields')(app, pool, io, auth, adminOnly, crmAccessOnly);
  require('./crm/access')(app, pool, io, auth, adminOnly, crmAccessOnly);

};

// ── Init tables ───────────────────────────────────────────────
function initTables(pool) {
  var sql = [
    'CREATE TABLE IF NOT EXISTS crm_access (user_id INTEGER REFERENCES users(id) PRIMARY KEY, created_at TIMESTAMPTZ DEFAULT NOW())',
    'CREATE TABLE IF NOT EXISTS crm_columns (id SERIAL PRIMARY KEY, name VARCHAR(255) NOT NULL, sort_order INTEGER DEFAULT 0, created_at TIMESTAMPTZ DEFAULT NOW())',
    'CREATE TABLE IF NOT EXISTS crm_field_definitions (id SERIAL PRIMARY KEY, name VARCHAR(255) NOT NULL, type VARCHAR(50) NOT NULL, options JSONB, sort_order INTEGER DEFAULT 0, is_active BOOLEAN DEFAULT TRUE, created_at TIMESTAMPTZ DEFAULT NOW())',
    'CREATE TABLE IF NOT EXISTS crm_cards (id SERIAL PRIMARY KEY, title VARCHAR(500) NOT NULL, description TEXT, column_id INTEGER REFERENCES crm_columns(id), sort_order INTEGER DEFAULT 0, created_by INTEGER REFERENCES users(id), created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW())',
    'CREATE TABLE IF NOT EXISTS crm_card_field_values (card_id INTEGER REFERENCES crm_cards(id) ON DELETE CASCADE, field_id INTEGER REFERENCES crm_field_definitions(id) ON DELETE CASCADE, value TEXT, PRIMARY KEY (card_id, field_id))',
    'CREATE TABLE IF NOT EXISTS crm_card_files (id SERIAL PRIMARY KEY, card_id INTEGER REFERENCES crm_cards(id) ON DELETE CASCADE, field_id INTEGER REFERENCES crm_field_definitions(id), file_name TEXT NOT NULL, original_name TEXT NOT NULL, file_size INTEGER, uploaded_by INTEGER REFERENCES users(id), created_at TIMESTAMPTZ DEFAULT NOW())',
    'CREATE TABLE IF NOT EXISTS crm_card_participants (card_id INTEGER REFERENCES crm_cards(id) ON DELETE CASCADE, user_id INTEGER REFERENCES users(id), added_by INTEGER REFERENCES users(id), PRIMARY KEY (card_id, user_id))',
    'ALTER TABLE crm_field_definitions ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE',
  ];

  return new Promise(function(resolve) {
    var i = 0;
    function next() {
      if (i >= sql.length) {
        console.log('CRM: таблицы инициализированы');
        resolve(true);
        return;
      }
      pool.query(sql[i], function(err) {
        if (err) {
          console.log('CRM: ошибка создания таблицы [' + (i + 1) + '/' + sql.length + ']: ' + err.message);
        }
        i++;
        next();
      });
    }
    next();
  });
}
