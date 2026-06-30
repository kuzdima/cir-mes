// ─── AI Settings — управление провайдерами, промптами и доступом ─────

var AI_PRESETS = {};

function aiSettingsInit() {
  aiSettingsLoadPresets();
  aiSettingsLoadProviders();
  aiSettingsLoadPrompts();
  aiSettingsLoadAccess();
  aiSettingsLoadUsers();
}

function aiSettingsLoadPresets() {
  http('GET', '/api/ai/provider-presets', null, function(res) {
    if (res.ok && res.presets) AI_PRESETS = res.presets;
  });
}

// ─── Providers ──────────────────────────────────────────────
function aiSettingsLoadProviders() {
  http('GET', '/api/ai/providers', null, function(res) {
    var tbody = document.getElementById('ai-providers-tbody');
    if (!tbody) return;
    if (!res.ok) { tbody.innerHTML = '<tr><td colspan="6">Ошибка загрузки</td></tr>'; return; }
    var providers = res.providers || [];
    if (!providers.length) { tbody.innerHTML = '<tr><td colspan="6">Нет провайдеров</td></tr>'; return; }
    tbody.innerHTML = providers.map(function(p) {
      return '<tr>' +
        '<td>' + p.name + '</td>' +
        '<td>' + p.label + '</td>' +
        '<td style="font-size:11px;max-width:200px;overflow:hidden;text-overflow:ellipsis">' + p.api_url + '</td>' +
        '<td>' + p.model + '</td>' +
        '<td>' + (p.api_key && p.api_key !== '***' ? '•••' : (p.api_key === '***' ? '***' : '—')) + '</td>' +
        '<td>' + (p.is_active ? '<span style="color:#27ae60">✓ Активен</span>' : '<span style="color:#999">Неактивен</span>') + '</td>' +
        '<td style="white-space:nowrap">' +
          (!p.is_active ? '<button onclick="aiSettingsActivateProvider(' + p.id + ')" class="btn-sm" title="Активировать">✓</button> ' : '') +
          '<button onclick="aiSettingsTestProvider(' + p.id + ')" class="btn-sm" title="Тест подключения">⟳</button> ' +
          '<button onclick="aiSettingsEditProvider(' + p.id + ')" class="btn-sm">✎</button> ' +
          '<button onclick="aiSettingsDeleteProvider(' + p.id + ')" class="btn-sm btn-danger">✕</button>' +
        '</td></tr>';
    }).join('');
  });
}

function aiSettingsShowAddProvider() {
  document.getElementById('ai-provider-form').style.display = 'block';
  document.getElementById('ai-provider-id').value = '';
  document.getElementById('ai-pf-name').value = '';
  document.getElementById('ai-pf-label').value = '';
  document.getElementById('ai-pf-url').value = '';
  document.getElementById('ai-pf-key').value = '';
  document.getElementById('ai-pf-model').value = '';
  document.getElementById('ai-pf-config').value = '';
  document.getElementById('ai-pf-config-row').style.display = 'none';
  document.getElementById('ai-pf-active').checked = false;
  document.getElementById('ai-pf-reject-unauthorized').checked = false;
  document.getElementById('ai-pf-err').textContent = '';
  document.getElementById('ai-pf-err').classList.remove('show');
  document.getElementById('ai-pf-key').placeholder = 'sk-...';
}

function aiSettingsOnProviderSelect() {
  var name = document.getElementById('ai-pf-name').value;
  var preset = AI_PRESETS[name];
  var keyHint = document.getElementById('ai-pf-key-hint');
  if (!preset) {
    document.getElementById('ai-pf-label').value = '';
    document.getElementById('ai-pf-url').value = '';
    document.getElementById('ai-pf-model').value = '';
    document.getElementById('ai-pf-config').value = '';
    document.getElementById('ai-pf-config-row').style.display = 'none';
    if (keyHint) keyHint.style.display = 'none';
    return;
  }
  document.getElementById('ai-pf-label').value = preset.label;
  document.getElementById('ai-pf-url').value = preset.api_url;
  document.getElementById('ai-pf-model').value = preset.model;
  var configStr = preset.config && Object.keys(preset.config).length ? JSON.stringify(preset.config, null, 2) : '';
  document.getElementById('ai-pf-config').value = configStr;
  document.getElementById('ai-pf-config-row').style.display = name === 'gigachat' ? 'flex' : 'none';
  if (keyHint) keyHint.style.display = name === 'ollama' ? 'flex' : 'none';
}

function aiSettingsCancelProvider() {
  document.getElementById('ai-provider-form').style.display = 'none';
}

function aiSettingsEditProvider(id) {
  http('GET', '/api/ai/providers/' + id, null, function(res) {
    if (!res.ok) return;
    var p = res.provider;
    document.getElementById('ai-provider-form').style.display = 'block';
    document.getElementById('ai-provider-id').value = p.id;
    var sel = document.getElementById('ai-pf-name');
    if (AI_PRESETS[p.name]) {
      sel.value = p.name;
    } else {
      sel.value = '';
    }
    document.getElementById('ai-pf-label').value = p.label || '';
    document.getElementById('ai-pf-url').value = p.api_url;
    document.getElementById('ai-pf-key').value = '';
    document.getElementById('ai-pf-model').value = p.model;
    document.getElementById('ai-pf-config').value = p.config && typeof p.config === 'object' ? JSON.stringify(p.config, null, 2) : (p.config || '');
    document.getElementById('ai-pf-config-row').style.display = (p.name && p.name.toLowerCase().indexOf('gigachat') >= 0) ? 'flex' : 'none';
    document.getElementById('ai-pf-active').checked = p.is_active;
    var cfg = typeof p.config === 'object' ? p.config : {};
    document.getElementById('ai-pf-reject-unauthorized').checked = !!(cfg.reject_unauthorized);
    document.getElementById('ai-pf-key').placeholder = p.api_key === '***' ? '*** (оставьте пустым чтобы не менять)' : '';
    document.getElementById('ai-pf-err').textContent = '';
    document.getElementById('ai-pf-err').classList.remove('show');
  });
}

function aiSettingsSaveProvider() {
  var id = document.getElementById('ai-provider-id').value;
  var name = document.getElementById('ai-pf-name').value.trim();
  var label = document.getElementById('ai-pf-label').value.trim();
  var url = document.getElementById('ai-pf-url').value.trim();
  var key = document.getElementById('ai-pf-key').value;
  var model = document.getElementById('ai-pf-model').value.trim();
  var configRaw = document.getElementById('ai-pf-config').value.trim();
  var active = document.getElementById('ai-pf-active').checked;
  var errEl = document.getElementById('ai-pf-err');

  if (!name || !url || !model) {
    errEl.textContent = 'name, api_url и model обязательны';
    errEl.classList.add('show');
    return;
  }

  var rejectUnauthorized = document.getElementById('ai-pf-reject-unauthorized').checked;

  var config = null;
  if (configRaw) {
    try { config = JSON.parse(configRaw); } catch(e) {
      errEl.textContent = 'Config должен быть валидным JSON';
      errEl.classList.add('show');
      return;
    }
  }

  if (rejectUnauthorized) {
    config = config || {};
    config.reject_unauthorized = true;
  } else if (config && config.reject_unauthorized !== undefined) {
    delete config.reject_unauthorized;
    if (!Object.keys(config).length) config = null;
  }

  var body = { name: name, label: label || name, api_url: url, api_key: key || undefined, model: model, config: config, is_active: active };
  var method = id ? 'PUT' : 'POST';
  var path = id ? '/api/ai/providers/' + id : '/api/ai/providers';

  http(method, path, body, function(res) {
    if (res.ok) {
      aiSettingsCancelProvider();
      aiSettingsLoadProviders();
    } else {
      errEl.textContent = res.error || 'Ошибка';
      errEl.classList.add('show');
    }
  });
}

function aiSettingsDeleteProvider(id) {
  if (!confirm('Удалить провайдера?')) return;
  http('DELETE', '/api/ai/providers/' + id, null, function(res) {
    if (res.ok) aiSettingsLoadProviders();
  });
}

// ─── Prompts ────────────────────────────────────────────────
function aiSettingsLoadPrompts() {
  http('GET', '/api/ai/prompts', null, function(res) {
    var tbody = document.getElementById('ai-prompts-tbody');
    if (!tbody) return;
    if (!res.ok) { tbody.innerHTML = '<tr><td colspan="6">Ошибка загрузки</td></tr>'; return; }
    var prompts = res.prompts || [];
    if (!prompts.length) { tbody.innerHTML = '<tr><td colspan="6">Нет промптов</td></tr>'; return; }
    tbody.innerHTML = prompts.map(function(p) {
      return '<tr>' +
        '<td>' + p.domain + '</td>' +
        '<td>' + p.name + '</td>' +
        '<td style="max-width:300px;overflow:hidden;text-overflow:ellipsis;font-size:11px">' + (p.prompt_text || '').slice(0, 80) + (p.prompt_text && p.prompt_text.length > 80 ? '…' : '') + '</td>' +
        '<td>' + p.version + '</td>' +
        '<td>' + (p.is_active ? '<span style="color:#27ae60">✓</span>' : '') + '</td>' +
        '<td>' +
          '<button onclick="aiSettingsEditPrompt(' + p.id + ')" class="btn-sm">✎</button> ' +
          '<button onclick="aiSettingsNewVersion(' + p.id + ')" class="btn-sm">+v</button> ' +
          '<button onclick="aiSettingsResetPrompt(' + p.id + ')" class="btn-sm" title="Сбросить на дефолтный">↺</button> ' +
          '<button onclick="aiSettingsDeletePrompt(' + p.id + ')" class="btn-sm btn-danger">✕</button>' +
        '</td></tr>';
    }).join('');
  });
}

function aiSettingsShowAddPrompt() {
  document.getElementById('ai-prompt-form').style.display = 'block';
  document.getElementById('ai-prompt-id').value = '';
  document.getElementById('ai-pf-domain').value = 'production';
  document.getElementById('ai-pf-pname').value = 'default';
  document.getElementById('ai-pf-text').value = '';
  document.getElementById('ai-pf-prompt-err').textContent = '';
  document.getElementById('ai-pf-prompt-err').classList.remove('show');
}

function aiSettingsCancelPrompt() {
  document.getElementById('ai-prompt-form').style.display = 'none';
}

function aiSettingsEditPrompt(id) {
  http('GET', '/api/ai/prompts/' + id, null, function(res) {
    if (!res.ok) return;
    var p = res.prompt;
    document.getElementById('ai-prompt-form').style.display = 'block';
    document.getElementById('ai-prompt-id').value = p.id;
    document.getElementById('ai-pf-domain').value = p.domain;
    document.getElementById('ai-pf-pname').value = p.name;
    document.getElementById('ai-pf-text').value = p.prompt_text;
    document.getElementById('ai-pf-prompt-err').textContent = '';
    document.getElementById('ai-pf-prompt-err').classList.remove('show');
  });
}

function aiSettingsSavePrompt() {
  var id = document.getElementById('ai-prompt-id').value;
  var domain = document.getElementById('ai-pf-domain').value.trim();
  var name = document.getElementById('ai-pf-pname').value.trim() || 'default';
  var text = document.getElementById('ai-pf-text').value.trim();
  var errEl = document.getElementById('ai-pf-prompt-err');

  if (!domain || !text) {
    errEl.textContent = 'domain и prompt_text обязательны';
    errEl.classList.add('show');
    return;
  }

  var body = { domain: domain, name: name, prompt_text: text };
  var method = id ? 'PUT' : 'POST';
  var path = id ? '/api/ai/prompts/' + id : '/api/ai/prompts';

  http(method, path, body, function(res) {
    if (res.ok) {
      aiSettingsCancelPrompt();
      aiSettingsLoadPrompts();
    } else {
      errEl.textContent = res.error || 'Ошибка';
      errEl.classList.add('show');
    }
  });
}

function aiSettingsNewVersion(id) {
  var text = prompt('Новый текст промпта:');
  if (!text) return;
  http('POST', '/api/ai/prompts/' + id + '/version', { prompt_text: text }, function(res) {
    if (res.ok) aiSettingsLoadPrompts();
    else alert(res.error || 'Ошибка');
  });
}

function aiSettingsDeletePrompt(id) {
  if (!confirm('Удалить промпт?')) return;
  http('DELETE', '/api/ai/prompts/' + id, null, function(res) {
    if (res.ok) aiSettingsLoadPrompts();
    else alert(res.error || 'Ошибка');
  });
}

function aiSettingsResetPrompt(id) {
  if (!confirm('Сбросить промпт на встроенный дефолтный?')) return;
  http('POST', '/api/ai/prompts/' + id + '/reset', null, function(res) {
    if (res.ok) aiSettingsLoadPrompts();
    else alert(res.error || 'Ошибка');
  });
}

// ─── Activate / Test ────────────────────────────────────────
function aiSettingsActivateProvider(id) {
  http('POST', '/api/ai/providers/' + id + '/activate', null, function(res) {
    if (res.ok) aiSettingsLoadProviders();
    else alert(res.error || 'Ошибка');
  });
}

function aiSettingsTestProvider(id) {
  var btn = event && event.target || document.querySelector('[onclick="aiSettingsTestProvider(' + id + ')"]');
  if (btn) { btn.textContent = '…'; btn.disabled = true; }
  http('POST', '/api/ai/providers/' + id + '/test', null, function(res) {
    if (btn) { btn.textContent = '⟳'; btn.disabled = false; }
    if (res.connected) alert('✓ Подключение успешно');
    else alert('✗ Ошибка: ' + (res.error || 'Нет подключения'));
  });
}

// ─── Access Control ─────────────────────────────────────────
function aiSettingsLoadAccess() {
  http('GET', '/api/ai/access', null, function(res) {
    var tbody = document.getElementById('ai-access-tbody');
    if (!tbody) return;
    if (!res.ok) { tbody.innerHTML = '<tr><td colspan="4">Ошибка загрузки</td></tr>'; return; }
    var access = res.access || [];
    if (!access.length) { tbody.innerHTML = '<tr><td colspan="4">Нет записей доступа</td></tr>'; return; }
    tbody.innerHTML = access.map(function(a) {
      return '<tr>' +
        '<td>' + a.email + '</td>' +
        '<td>' + (a.first_name || '') + ' ' + (a.last_name || '') + '</td>' +
        '<td>' + a.feature + '</td>' +
        '<td>' +
          '<button onclick="aiSettingsRevokeAccess(' + a.user_id + ',\'' + a.feature + '\')" class="btn-sm btn-danger">✕</button>' +
        '</td></tr>';
    }).join('');
  });
}

function aiSettingsGrantAccess() {
  var userId = document.getElementById('ai-access-user').value;
  var feature = document.getElementById('ai-access-feature').value;
  if (!userId || !feature) return;
  http('POST', '/api/ai/access', { userId: parseInt(userId), feature: feature }, function(res) {
    if (res.ok) {
      document.getElementById('ai-access-user').value = '';
      aiSettingsLoadAccess();
    } else {
      alert(res.error || 'Ошибка');
    }
  });
}

function aiSettingsRevokeAccess(userId, feature) {
  if (!confirm('Отозвать доступ ' + feature + ' у пользователя?')) return;
  http('DELETE', '/api/ai/access/' + userId + '/' + feature, null, function(res) {
    if (res.ok) aiSettingsLoadAccess();
    else alert(res.error || 'Ошибка');
  });
}

function aiSettingsLoadUsers() {
  http('GET', '/api/users', null, function(res) {
    var sel = document.getElementById('ai-access-user');
    if (!sel) return;
    if (!res.ok || !res.users) return;
    sel.innerHTML = '<option value="">— выберите пользователя —</option>' +
      res.users.filter(function(u) { return u.is_active; }).map(function(u) {
        return '<option value="' + u.id + '">' + u.email + ' (' + (u.first_name || '') + ' ' + (u.last_name || '') + ')</option>';
      }).join('');
  });
}
