var adapters = {};

function register(name, adapter) {
  adapters[name] = adapter;
}

function getAdapter(provider) {
  var presets = require('./provider-presets');
  var preset = presets.PRESETS[provider.name];
  var name = (preset && preset.adapter) || 'openai';
  return adapters[name] || adapters['openai'];
}

function getNames() {
  return Object.keys(adapters);
}

module.exports = { register, getAdapter, getNames };

require('./adapters/openai');
require('./adapters/ollama');
require('./adapters/gigachat');
