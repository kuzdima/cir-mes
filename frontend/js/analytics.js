// ─── AI-аналитика ──────────────────────────────────────────
var AI_CHAT_HISTORY = [];
var AI_CURRENT_FILTERS = { timeframe: 'month' };

var AI_QUICK_QUESTIONS = [
  { label: 'Сводка по цеху', domain: 'dashboard', question: 'Сформируй сводку по цеху на основе всех данных. Выдели ключевые проблемы.' },
  { label: 'Загрузка станков', domain: 'production', question: 'Какая загрузка станков? Есть ли простаивающие?' },
  { label: 'Дефициты на складе', domain: 'warehouse', question: 'Какие материалы в дефиците на складе?' },
  { label: 'Просроченные обращения', domain: 'feedback', question: 'Есть ли просроченные обращения? Сколько?' },
  { label: 'S&OP сводка', domain: 'sop', question: 'Дай сводку спроса и предложения по месяцам.' },
];

function aiInit() {
  AI_CHAT_HISTORY = [];
  AI_CURRENT_FILTERS = { timeframe: 'month' };
  document.getElementById('ai-timeframe-preset').value = 'month';
  document.getElementById('ai-date-from').disabled = true;
  document.getElementById('ai-date-to').disabled = true;
  aiRenderChat();
  aiLoadFeatures();
  aiLoadHistory();
}

function aiOnPresetChange() {
  var preset = document.getElementById('ai-timeframe-preset').value;
  var fromInp = document.getElementById('ai-date-from');
  var toInp = document.getElementById('ai-date-to');
  if (preset === 'custom') {
    fromInp.disabled = false;
    toInp.disabled = false;
    aiOnDateChange();
  } else {
    fromInp.disabled = true;
    toInp.disabled = true;
    fromInp.value = '';
    toInp.value = '';
    AI_CURRENT_FILTERS = { timeframe: preset };
  }
}

function aiOnDateChange() {
  var from = document.getElementById('ai-date-from').value;
  var to = document.getElementById('ai-date-to').value;
  if (from && to) {
    AI_CURRENT_FILTERS = { timeframe: { from: from, to: to } };
  }
}

function aiRenderChat() {
  var log = document.getElementById('ai-chat-log');
  if (!log) return;
  if (!AI_CHAT_HISTORY.length) {
    log.innerHTML =
      '<div class="ai-empty-state">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><circle cx="12" cy="8" r=".5" fill="currentColor"/></svg>' +
      '<div>Задайте вопрос по данным цеха<br>или выберите быстрый сценарий</div></div>';
    return;
  }
  log.innerHTML = AI_CHAT_HISTORY.map(function(m) {
    var cls = 'ai-msg ai-msg-' + m.role;
    var usage = m.usage ? '<div class="ai-msg-usage">токенов: ' + m.usage.total_tokens + '</div>' : '';
    return '<div class="' + cls + '">' + m.content + usage + '</div>';
  }).join('');
  log.scrollTop = log.scrollHeight;
}

function aiSend(domain, question) {
  if (!question) return;
  AI_CHAT_HISTORY.push({ role: 'user', content: question });
  AI_CHAT_HISTORY.push({ role: 'loading', content: 'Думаю...' });
  aiRenderChat();

  var endpoint = domain === 'dashboard' ? '/api/ai/dashboard' : '/api/ai/query';
  var filters = AI_CURRENT_FILTERS || {};
  var body = domain === 'dashboard'
    ? { filters: filters }
    : { domain: domain, question: question, filters: filters };

  document.getElementById('ai-question-inp').value = '';

  http('POST', endpoint, body, function(res) {
    // Remove loading message
    AI_CHAT_HISTORY.pop();
    if (res.ok) {
      AI_CHAT_HISTORY.push({ role: 'ai', content: res.answer, usage: res.usage });
    } else {
      AI_CHAT_HISTORY.push({ role: 'error', content: 'Ошибка: ' + (res.error || 'неизвестная') });
    }
    aiRenderChat();
  });
}

function aiHandleKey(e) {
  if (e.key === 'Enter') {
    var inp = document.getElementById('ai-question-inp');
    aiSend('production', inp.value);
  }
}

function aiQuickClick(btn) {
  aiSend(btn.getAttribute('data-domain'), btn.getAttribute('data-question'));
}

function aiLoadFeatures() {
  http('GET', '/api/ai/access/my', null, function(res) {
    if (res.ok) {
      var features = res.features || [];
      // Show/hide quick buttons based on feature access
      document.querySelectorAll('.ai-quick-btns button').forEach(function(btn) {
        var domain = btn.getAttribute('data-domain');
        var needed = domain === 'dashboard' ? 'dashboard' : 'chat';
        btn.style.display = features.indexOf(needed) >= 0 || features.indexOf('admin') >= 0 ? '' : 'none';
      });
    }
  });
}

function aiLoadHistory() {
  http('GET', '/api/ai/history', null, function(res) {
    if (res.ok && res.history && res.history.length) {
      AI_CHAT_HISTORY = res.history.slice().reverse().reduce(function(acc, h) {
        if (h.has_error) {
          acc.push({ role: 'user', content: h.question });
          acc.push({ role: 'error', content: 'Ошибка: ' + (h.answer || 'неизвестная') });
        } else {
          acc.push({ role: 'user', content: h.question });
          acc.push({ role: 'ai', content: h.answer, usage: h.usage_tokens ? { total_tokens: h.usage_tokens } : null });
        }
        return acc;
      }, []);
      aiRenderChat();
    }
  });
}

function aiClearHistory() {
  if (!confirm('Очистить всю историю?')) return;
  http('DELETE', '/api/ai/history', null, function(res) {
    if (res.ok) {
      AI_CHAT_HISTORY = [];
      aiRenderChat();
    }
  });
}
