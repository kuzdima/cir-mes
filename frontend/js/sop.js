var SOP_MONTHS = [];

function initSop() {
  var el = document.getElementById('panel-sop');
  if (!el) return;
  var d = new Date();
  var y = d.getFullYear();
  var m = String(d.getMonth() + 1).padStart(2, '0');
  el.innerHTML =
    '<div class="sop-wrap">' +
    '<div class="sop-filter">' +
    '<label class="sop-lbl">С</label>' +
    '<input class="form-inp sop-date" id="sop-from" type="date" value="' + (y - 1) + '-01-01">' +
    '<label class="sop-lbl">По</label>' +
    '<input class="form-inp sop-date" id="sop-to" type="date" value="' + y + '-' + m + '-' + String(d.getDate()).padStart(2, '0') + '">' +
    '<button class="topbar-btn btn-accent" onclick="sopLoad()">Загрузить</button>' +
    '</div>' +
    '<div class="sop-summary-wrap" id="sop-summary"></div>' +
    '<div class="sop-orders-wrap">' +
    '<div class="sop-section-hd">Заказы</div>' +
    '<div class="sop-tbl-scroll">' +
    '<table class="sop-tbl">' +
    '<thead><tr>' +
    '<th>Номер заказа</th>' +
    '<th>Дата отгрузки</th>' +
    '<th>Количество</th>' +
    '<th>Статус</th>' +
    '<th>Клиент</th>' +
    '<th>Примечание</th>' +
    '</tr></thead>' +
    '<tbody id="sop-orders-tbody"><tr><td colspan="6" class="sop-empty">Загрузка…</td></tr></tbody>' +
    '</table>' +
    '</div>' +
    '</div>' +
    '</div>';
  sopLoad();
}

function sopLoad() {
  var from = document.getElementById('sop-from')?.value || '';
  var to = document.getElementById('sop-to')?.value || '';
  sopLoadSummary(from, to);
  sopLoadOrders();
}

function sopLoadSummary(from, to) {
  var url = '/api/sop/summary?from=' + encodeURIComponent(from) + '&to=' + encodeURIComponent(to);
  http('GET', url, null, function(res) {
    if (!res.ok) { document.getElementById('sop-summary').innerHTML = '<div class="sop-err">' + (res.error || 'Ошибка') + '</div>'; return; }
    SOP_MONTHS = res.months || [];
    sopRenderSummary();
  });
}

function sopRenderSummary() {
  var el = document.getElementById('sop-summary');
  if (!el) return;
  if (!SOP_MONTHS.length) { el.innerHTML = '<div class="sop-empty">Нет данных за выбранный период</div>'; return; }

  var rowsHtml = SOP_MONTHS.map(function(m) {
    var monthNames = ['', 'Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'];
    var parts = m.month.split('-');
    var label = monthNames[parseInt(parts[1])] + ' ' + parts[0];
    var gapCls = m.gap_qty > 0 ? 'sop-gap-neg' : m.gap_qty < 0 ? 'sop-gap-pos' : '';
    var progress = m.supply.avg_progress ? Math.round(Number(m.supply.avg_progress)) : 0;
    return '<tr>' +
      '<td class="sop-month">' + sopE(label) + '</td>' +
      '<td>' + m.demand.order_count + '</td>' +
      '<td>' + m.demand.qty + '</td>' +
      '<td>' + m.demand.open_orders + '</td>' +
      '<td>' + m.supply.narad_count + '</td>' +
      '<td>' + m.supply.qty + '</td>' +
      '<td>' + Number(m.supply.total_hours).toFixed(1) + '</td>' +
      '<td>' + progress + '%</td>' +
      '<td class="' + gapCls + '">' + m.gap_qty + '</td>' +
      '</tr>';
  }).join('');

  el.innerHTML =
    '<div class="sop-section-hd">Сводка S&OP</div>' +
    '<table class="sop-summary-tbl">' +
    '<thead><tr>' +
    '<th>Месяц</th>' +
    '<th colspan="3">Спрос (заказы)</th>' +
    '<th colspan="4">Производство</th>' +
    '<th>Разрыв</th>' +
    '</tr><tr>' +
    '<th></th>' +
    '<th>Кол-во</th><th>Штук</th><th>Открыто</th>' +
    '<th>Нарядов</th><th>Штук</th><th>Часов</th><th>Готовность</th>' +
    '<th>Штук</th>' +
    '</tr></thead>' +
    '<tbody>' + rowsHtml + '</tbody>' +
    '</table>';
}

function sopLoadOrders() {
  var tbody = document.getElementById('sop-orders-tbody');
  if (!tbody) return;
  http('GET', '/api/sop/orders', null, function(res) {
    if (!res.ok) { tbody.innerHTML = '<tr><td colspan="6" class="sop-empty">Ошибка загрузки</td></tr>'; return; }
    var rows = res.rows || [];
    if (!rows.length) { tbody.innerHTML = '<tr><td colspan="6" class="sop-empty">Нет заказов</td></tr>'; return; }
    tbody.innerHTML = rows.map(function(r) {
      var date = r.ship_date ? new Date(r.ship_date) : null;
      var dateStr = date ? sopPad(date.getDate()) + '.' + sopPad(date.getMonth() + 1) + '.' + date.getFullYear() : '—';
      return '<tr>' +
        '<td>' + sopE(r.order_number || '—') + '</td>' +
        '<td>' + dateStr + '</td>' +
        '<td>' + (r.quantity || 0) + '</td>' +
        '<td>' + sopE(r.status || '—') + '</td>' +
        '<td>' + sopE(r.customer || '—') + '</td>' +
        '<td>' + sopE(r.notes || '') + '</td>' +
        '</tr>';
    }).join('');
  });
}

function sopE(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function sopPad(n) { return n < 10 ? '0' + n : String(n); }
