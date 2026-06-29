var PRESETS = {
  openai:   { label: 'OpenAI',   api_url: 'https://api.openai.com/v1',           model: 'gpt-4o-mini',  config: {}, adapter: 'openai' },
  gigachat: { label: 'GigaChat', api_url: 'https://gigachat.devices.sberbank.ru/api/v1', model: 'GigaChat', config: { client_id: '', client_secret: '', auth_url: 'https://ngw.devices.sberbank.ru:9443/api/v2/oauth' }, adapter: 'gigachat' },
  ollama:   { label: 'Ollama',   api_url: 'http://localhost:11434',                model: 'qwen2.5:7b',   config: {}, adapter: 'ollama' },
};

function getPresets() {
  return JSON.parse(JSON.stringify(PRESETS));
}

module.exports = { PRESETS, getPresets };
