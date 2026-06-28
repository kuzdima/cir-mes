var { httpRequest } = require('./http-client');

async function chat(provider, messages, options) {
  if (provider.api_key) {
    // Облачный Ollama (OpenAI-совместимый формат)
    var apiUrl = provider.api_url.replace(/\/+$/, '');
    if (apiUrl.endsWith('/v1')) apiUrl = apiUrl.slice(0, -3);
    apiUrl = apiUrl.replace(/\/+$/, '');
    var chatUrl = apiUrl + '/v1/chat/completions';

    var payload = {
      model: provider.model,
      messages: messages,
      temperature: options.temperature,
      max_tokens: options.max_tokens
    };

    var headers = { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + provider.api_key };

    var res = await httpRequest(chatUrl, 'POST', headers, JSON.stringify(payload), 60000);
    if (res.status !== 200) return { ok: false, error: 'Ошибка Ollama: ' + (res.body && res.body.error && res.body.error.message || res.body && res.body.error || res.status) };

    var choice = res.body.choices && res.body.choices[0];
    if (!choice) return { ok: false, error: 'Пустой ответ от Ollama' };

    return {
      ok: true,
      content: choice.message && choice.message.content || '',
      usage: res.body.usage || { total_tokens: 0 }
    };
  }

  // Локальный Ollama (родной API)
  var systemMsg = messages.find(function(m) { return m.role === 'system'; });
  var userMsg = messages.find(function(m) { return m.role === 'user'; });
  var prompt = (systemMsg ? systemMsg.content + '\n\n' : '') + (userMsg ? userMsg.content : '');

  var res = await httpRequest(
    provider.api_url.replace(/\/+$/, '') + '/api/generate',
    'POST',
    { 'Content-Type': 'application/json' },
    JSON.stringify({ model: provider.model, prompt: prompt, stream: false, options: { temperature: options.temperature } }),
    60000
  );
  if (res.status !== 200) return { ok: false, error: 'Ошибка Ollama: ' + (res.body && res.body.error || res.status) };
  return {
    ok: true,
    content: res.body.response || '',
    usage: { total_tokens: 0 }
  };
}

module.exports = { chat };
