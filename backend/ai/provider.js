var { getAdapter } = require('./provider-presets');

var PROVIDER_CACHE = null;
var CACHE_TTL = 5 * 60 * 1000;
var CACHE_TIME = 0;

async function getActiveProvider(pool) {
  var now = Date.now();
  if (PROVIDER_CACHE && now - CACHE_TIME < CACHE_TTL) return PROVIDER_CACHE;
  var r = await pool.query("SELECT * FROM ai_providers WHERE is_active = TRUE LIMIT 1");
  PROVIDER_CACHE = r.rows[0] || null;
  CACHE_TIME = now;
  return PROVIDER_CACHE;
}

function invalidateCache() {
  PROVIDER_CACHE = null;
  CACHE_TIME = 0;
}

async function chat(pool, messages, options) {
  var provider = await getActiveProvider(pool);
  if (!provider) return { ok: false, error: 'Нет активного AI-провайдера' };

  options = options || {};
  options.temperature = options.temperature !== undefined ? options.temperature : 0.7;
  options.max_tokens = options.max_tokens || 2000;

  try {
    var adapter = getAdapter(provider);
    return await adapter.chat(provider, messages, options);
  } catch(e) {
    return { ok: false, error: 'Ошибка вызова AI: ' + e.message };
  }
}

module.exports = { chat, getActiveProvider, invalidateCache };
