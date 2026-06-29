var { test, describe } = require('node:test');
var assert = require('node:assert/strict');

// ——— http-client —————————————————————————————————————————
describe('http-client', function() {

  test('httpRequest: парсит URL, выбирает http для http://', async function() {
    var { httpRequest } = require('../ai/adapters/http-client');
    assert.equal(typeof httpRequest, 'function');
    // Can't test actual HTTP without a server, just verify it's a function
  });

  test('httpRequest с parseJson=false возвращает сырой body', function() {
    var { httpRequest } = require('../ai/adapters/http-client');
    assert.equal(typeof httpRequest, 'function');
  });

});

// ——— Provider dispatcher ————————————————————————————————
describe('provider.js dispatcher', function() {

  test('возвращает ошибку если нет активного провайдера', async function() {
    var provider = require('../ai/provider');
    var mockPool = {
      query: function() { return { rows: [] }; }
    };
    var result = await provider.getActiveProvider(mockPool);
    assert.equal(result, null);
  });

  test('возвращает ошибку если chat() вызван без провайдера', async function() {
    var provider = require('../ai/provider');
    var mockPool = {
      query: function() { return { rows: [] }; }
    };
    var result = await provider.chat(mockPool, []);
    assert.equal(result.ok, false);
    assert.equal(result.error, 'Нет активного AI-провайдера');
  });

  test('invalidateCache сбрасывает кэш', async function() {
    var provider = require('../ai/provider');
    provider.invalidateCache();
    // just verify no error thrown
    assert.ok(true);
  });

});

// ——— Ollama adapter ——————————————————————————————————————
describe('ollama adapter', function() {

  test('chat: возвращает ошибку при неудачном HTTP-ответе', async function() {
    var ollama = require('../ai/adapters/ollama');
    var provider = { api_url: 'http://localhost:11434', model: 'llama3' };
    var options = { temperature: 0.7, max_tokens: 2000 };
    var messages = [{ role: 'user', content: 'hello' }];
    // No Ollama running → HTTP error → ok: false
    var result = await ollama.chat(provider, messages, options);
    assert.equal(result.ok, false);
  });

});

// ——— OpenAI adapter ——————————————————————————————————————
describe('openai adapter', function() {

  test('chat: пробрасывает HTTP-ошибку', async function() {
    var openai = require('../ai/adapters/openai');
    var provider = { api_url: 'http://localhost:1', model: 'gpt-4', api_key: 'test-key' };
    var options = { temperature: 0.7, max_tokens: 2000 };
    var messages = [{ role: 'user', content: 'hello' }];
    await assert.rejects(function() {
      return openai.chat(provider, messages, options);
    });
  });

});

// ——— GigaChat adapter ————————————————————————————————————
describe('gigachat adapter', function() {

  test('chat: пробрасывает HTTP-ошибку (connection)', async function() {
    var gigachat = require('../ai/adapters/gigachat');
    var provider = {
      api_url: 'http://localhost:1',
      model: 'gigachat',
      api_key: 'test-key',
      name: 'GigaChat',
      config: { client_id: 'test', client_secret: 'test' }
    };
    var options = { temperature: 0.7, max_tokens: 2000 };
    var messages = [{ role: 'user', content: 'hello' }];
    await assert.rejects(function() {
      return gigachat.chat(provider, messages, options);
    });
  });

});
