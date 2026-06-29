var crypto = require('crypto');
var { httpRequest } = require('./http-client');

function getExtraOpts(provider) {
  var cfg = typeof provider.config === 'string' ? JSON.parse(provider.config) : (provider.config || {});
  return cfg.reject_unauthorized ? { rejectUnauthorized: false } : undefined;
}

async function chat(provider, messages, options) {
  var cfg = typeof provider.config === 'string' ? JSON.parse(provider.config) : provider.config;
  var headers = { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + provider.api_key };

  if (cfg.client_id && cfg.client_secret) {
    var authUrl = cfg.auth_url || 'https://ngw.devices.sberbank.ru:9443/api/v2/oauth';
    var authRes = await httpRequest(
      authUrl, 'POST',
      { 'Content-Type': 'application/x-www-form-urlencoded', 'Accept': 'application/json', 'RqUID': crypto.randomUUID(), 'Authorization': 'Basic ' + Buffer.from(cfg.client_id + ':' + cfg.client_secret).toString('base64') },
      'scope=GIGACHAT_API_PERS',
      15000, true, getExtraOpts(provider)
    );
    if (authRes.status === 200 && authRes.body && authRes.body.access_token) {
      headers['Authorization'] = 'Bearer ' + authRes.body.access_token;
    } else {
      return { ok: false, error: 'Ошибка авторизации GigaChat' };
    }
  }

  var apiUrl = provider.api_url.replace(/\/+$/, '');
  var chatUrl = apiUrl;
  if (chatUrl.indexOf('/chat/completions') === -1) {
    chatUrl += chatUrl.endsWith('/v1') ? '/chat/completions' : '/v1/chat/completions';
  }

  var payload = {
    model: provider.model,
    messages: messages,
    temperature: options.temperature,
    max_tokens: options.max_tokens
  };

  var res = await httpRequest(chatUrl, 'POST', headers, JSON.stringify(payload), 60000, true, getExtraOpts(provider));
  if (res.status !== 200) return { ok: false, error: 'Ошибка провайдера: ' + (res.body && res.body.error && res.body.error.message || res.body && res.body.error || res.status) };

  var choice = res.body.choices && res.body.choices[0];
  if (!choice) return { ok: false, error: 'Пустой ответ от провайдера' };

  return {
    ok: true,
    content: choice.message && choice.message.content || '',
    usage: res.body.usage || { total_tokens: 0 }
  };
}

async function testConnection(provider) {
  var apiUrl = provider.api_url.replace(/\/+$/, '');
  try {
    var res = await httpRequest(apiUrl, 'GET', { 'Content-Type': 'application/json' }, null, 15000, false, getExtraOpts(provider));
    return { ok: res.status < 500, connected: res.status < 500, error: res.status >= 500 ? ('HTTP ' + res.status) : null };
  } catch(e) {
    return { ok: false, connected: false, error: e.message };
  }
}

var registry = require('../provider-registry');
registry.register('gigachat', { chat, test: testConnection });

module.exports = { chat };
