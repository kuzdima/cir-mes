var { httpRequest } = require('./http-client');

async function chat(provider, messages, options) {
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

  var headers = { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + provider.api_key };

  var res = await httpRequest(chatUrl, 'POST', headers, JSON.stringify(payload), 60000);
  if (res.status !== 200) return { ok: false, error: 'Ошибка провайдера: ' + (res.body && res.body.error && res.body.error.message || res.body && res.body.error || res.status) };

  var choice = res.body.choices && res.body.choices[0];
  if (!choice) return { ok: false, error: 'Пустой ответ от провайдера' };

  return {
    ok: true,
    content: choice.message && choice.message.content || '',
    usage: res.body.usage || { total_tokens: 0 }
  };
}

async function test(provider) {
  var apiUrl = provider.api_url.replace(/\/+$/, '');
  try {
    var res = await httpRequest(apiUrl, 'GET', { 'Content-Type': 'application/json' }, null, 15000, false);
    return { ok: res.status < 500, connected: res.status < 500, error: res.status >= 500 ? ('HTTP ' + res.status) : null };
  } catch(e) {
    return { ok: false, connected: false, error: e.message };
  }
}

var registry = require('../provider-registry');
registry.register('openai', { chat, test });

module.exports = { chat };
