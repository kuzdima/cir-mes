var ollama = require('./adapters/ollama');
var openai = require('./adapters/openai');
var gigachat = require('./adapters/gigachat');

var PRESETS = {
  openai:   { label: 'OpenAI',   api_url: 'https://api.openai.com/v1',           model: 'gpt-4o-mini',  config: {}, adapter: 'openai' },
  gigachat: { label: 'GigaChat', api_url: 'https://gigachat.devices.sberbank.ru/api/v1', model: 'GigaChat', config: { client_id: '', client_secret: '', auth_url: 'https://ngw.devices.sberbank.ru:9443/api/v2/oauth' }, adapter: 'gigachat' },
  ollama:   { label: 'Ollama',   api_url: 'http://localhost:11434',                model: 'qwen2.5:7b',   config: {}, adapter: 'ollama' },
};

var ADAPTERS = { ollama, openai, gigachat };

function getPresets() {
  return JSON.parse(JSON.stringify(PRESETS));
}

function getAdapter(p) {
  var preset = PRESETS[p.name];
  var name = preset ? preset.adapter : 'openai';
  return ADAPTERS[name] || ADAPTERS.openai;
}

function getTestConfig(p) {
  var preset = PRESETS[p.name];
  var adapter = preset ? preset.adapter : '';
  var apiUrl = p.api_url.replace(/\/+$/, '');
  switch (adapter) {
    case 'ollama':
      if (p.api_key) {
        // Облачный — тестируем OpenAI-совместимый endpoint
        var testUrl = apiUrl;
        if (testUrl.indexOf('/chat/completions') === -1) {
          testUrl += testUrl.endsWith('/v1') ? '/models' : '/v1/models';
        }
        return { url: testUrl, headers: { 'Authorization': 'Bearer ' + p.api_key }, body: null };
      }
      return { url: apiUrl + '/api/tags', headers: {}, body: null };
    case 'gigachat':
      return { url: apiUrl, headers: { 'Content-Type': 'application/json' }, body: null };
    default:
      var testUrl = apiUrl;
      if (testUrl.indexOf('/chat/completions') === -1) {
        testUrl += testUrl.endsWith('/v1') ? '/models' : '/v1/models';
      } else {
        testUrl = apiUrl + (apiUrl.endsWith('/v1') ? '/models' : '/v1/models');
      }
      return { url: testUrl, headers: { 'Authorization': 'Bearer ' + p.api_key }, body: null };
  }
}

module.exports = { getPresets, getAdapter, getTestConfig };
