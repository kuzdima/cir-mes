require('dotenv').config();
const express  = require('express');
const cors     = require('cors');
const path     = require('path');
const { Pool } = require('pg');

const app    = express();
const server = require('http').createServer(app);
const io     = require('socket.io')(server, { cors: { origin: '*' } });
const PORT   = process.env.PORT || 8080;
const SECRET = process.env.JWT_SECRET;

if (!SECRET) {
  console.error('FATAL: JWT_SECRET не задан. Укажите в .env');
  process.exit(1);
}

const pool = new Pool({
  host:     process.env.DB_HOST,
  port:     parseInt(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME,
  user:     process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  max: 30,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

const auth = require('./middleware/auth');

// Feature access middleware
function requireFeature(feature) {
  return async function(req, res, next) {
    if (req.user.role === 'admin') return next();
    var r = await pool.query('SELECT 1 FROM ai_access WHERE user_id = $1 AND feature = $2', [req.user.id, feature]);
    if (r.rows.length) return next();
    res.status(403).json({ ok: false, error: 'Нет доступа к этой функции' });
  };
}

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(function(req, res, next) { console.log(req.method, req.url); next(); });

app.use('/api',            require('./routes/auth.routes')(pool));
app.use('/api/users',      require('./routes/users.routes')(pool, auth));
app.use('/api/profile',    require('./routes/profile.routes')(pool, auth));
app.use('/api/tech-ops',   require('./routes/techops.routes')(pool, auth));
app.use('/api/archive',    require('./routes/archive.routes')(pool, auth));
app.use('/api/production', require('./routes/production.routes')(pool, auth));
require('./crm')(app, pool, SECRET, io, auth);
app.use('/api/warehouse',  require('./routes/warehouse.routes')(pool, auth));

// Feedback
app.use('/api/feedback', require('./feedback_api')(pool, auth));

// S&OP
app.use('/api/sop', require('./sop_api')(pool, auth, requireFeature));

// AI
app.get('/api/ai/provider-presets', auth, function(req, res) {
  res.json({ ok: true, presets: require('./ai/provider-presets').getPresets() });
});
// AI Domains
app.get('/api/ai/domains', function(req, res) {
  res.json({ ok: true, domains: require('./ai/domains').DOMAINS });
});

// AI Providers
app.use('/api/ai/providers', require('./ai_providers_api')(pool, auth));
app.use('/api/ai/prompts', require('./ai_prompts_api')(pool, auth));
app.use('/api/ai', require('./ai/analytics-router')(pool, auth, requireFeature, {
  provider: require('./ai/provider'),
  prompts: require('./ai/prompts'),
  contextBuilder: require('./ai/context-builder')
}));

// Health
app.get('/api/health', async (req, res) => {
  try { await pool.query('SELECT 1'); res.json({ ok: true, db: 'connected' }); }
  catch(e) { res.json({ ok: false, error: e.message }); }
});

io.on('connection', function(socket) {
  console.log('Socket.IO: клиент подключился');
});

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(express.static(path.join(__dirname, '../frontend')));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, '../frontend/index.html')));

if (require.main === module) {
  server.listen(PORT, () => console.log('ЦИР MES -> http://localhost:' + PORT));
}

module.exports = { app, pool, server, io, auth };
