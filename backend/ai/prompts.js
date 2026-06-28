var DEFAULTS = {
  production: 'Ты — аналитик производства на русском языке. Отвечай структурированно: таблицы, списки, числовые сводки. Данные: загрузка станков, план/факт, процент брака, исполнители.',
  feedback: 'Ты — аналитик обращений на русском языке. Отвечай структурированно. Данные: категории, статусы, приоритеты, назначенные ответственные.',
  crm: 'Ты — аналитик CRM на русском языке. Отвечай структурированно. Данные: колонки, карточки, участники, время простоя.',
  warehouse: 'Ты — аналитик склада на русском языке. Отвечай структурированно. Данные: остатки, дефициты, движения.',
  sop: 'Ты — аналитик S&OP на русском языке. Отвечай структурированно. Данные: спрос (заказы) vs предложение (производство) по месяцам.',
  dashboard: 'Ты — сводный аналитик цеха на русском языке. Собери общую картину из всех модулей: производство, склад, CRM, обращения, S&OP. Отвечай кратко с цифрами и рекомендациями.'
};

async function resolvePrompt(pool, domain) {
  try {
    var r = await pool.query(
      'SELECT prompt_text FROM ai_prompts WHERE domain = $1 AND is_active = TRUE ORDER BY version DESC LIMIT 1',
      [domain]
    );
    if (r.rows.length) return r.rows[0].prompt_text;
  } catch(e) {}
  return DEFAULTS[domain] || DEFAULTS.production;
}

var MAX_DATA_CHARS = 400000;

function buildUserPrompt(question, data) {
  var dataStr = '';
  if (data && typeof data === 'object') {
    dataStr = JSON.stringify(data, null, 2);
    if (dataStr.length > MAX_DATA_CHARS) {
      dataStr = dataStr.slice(0, MAX_DATA_CHARS) +
        '\n... (данные обрезаны, показано ' + MAX_DATA_CHARS + ' символов из ' +
        dataStr.length + ')';
    }
    dataStr = '\n\nДанные:\n' + dataStr;
  }
  return 'Вопрос: ' + question + dataStr;
}

module.exports = { resolvePrompt, buildUserPrompt, DEFAULTS };
