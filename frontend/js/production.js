// ============================================================
// production.js — Производство: План по операциям + План проектов
// ============================================================

var PROD_PAGE = 1;
var PROD_SEARCH_T = null;
var PROD_PROJ_PAGE = 1;

function fmtDate(v) {
  if (!v) return '';
  var d = new Date(v);
  if (isNaN(d)) return '';
  var dd = String(d.getDate()).padStart(2,'0');
  var mm = String(d.getMonth()+1).padStart(2,'0');
  return dd + '.' + mm + '.' + d.getFullYear();
}

// ── ЗАГРУЗКА ПЛАНА ПО ОПЕРАЦИЯМ ───────────────────────────
function loadProdOps() {
  var q   = document.getElementById('prod-ops-q') ? document.getElementById('prod-ops-q').value : '';
  var st  = document.getElementById('prod-ops-status') ? document.getElementById('prod-ops-status').value : '';
  var tb  = document.getElementById('prod-ops-tbody');
  if (!tb) return;
  tb.innerHTML = '<tr><td colspan="20" style="text-align:center;color:var(--text3);padding:20px">Загрузка...</td></tr>';

  var url = '/api/production?view=operations&limit=50&page=' + PROD_PAGE;
  if (q)  url += '&q=' + encodeURIComponent(q);
  if (st) url += '&status=' + encodeURIComponent(st);

  api('GET', url).then(function(res) {
    if (!res.ok || !res.rows || !res.rows.length) {
      tb.innerHTML = '<tr><td colspan="20" style="text-align:center;color:var(--text3);padding:20px">Нет данных. Добавьте наряды через форму.</td></tr>';
      return;
    }
    var total = res.total || res.rows.length;
    var info = document.getElementById('prod-ops-info');
    if (info) info.textContent = 'Всего: ' + total;

    var pageInfo = document.getElementById('prod-page-info');
    if (pageInfo) pageInfo.textContent = 'Стр. ' + PROD_PAGE;

    function c(v) { return (v===null||v===undefined||v===''||v==='null')?'':String(v); }


    function badge(s) {
      var icons  = {'Новый':'',   'В работе':'🔄 ', 'Готово':'✅ ', 'Пауза':'⏸ '};
      var colors = {'Новый':'b-gray','В работе':'b-blue','Готово':'b-green','Пауза':'b-amber'};
      var label = (icons[s] || '') + c(s);
      return '<span class="badge ' + (colors[s]||'b-gray') + '" style="font-size:9px">' + label + '</span>';
    }


    tb.innerHTML = res.rows.map(function(r) {
      var safeNarad = c(r.narad_number).replace(/&/g,'&amp;').replace(/"/g,'&quot;');
      var rowBg = r.status === 'Готово' ? ';background:rgba(16,185,129,0.3)' : '';
      return '<tr data-narad="' + safeNarad + '" onclick="prodSelectRow(this)" style="cursor:pointer' + rowBg + '">'
        + '<td style="font-weight:600;color:var(--accent);white-space:nowrap">' + c(r.narad_number) + '</td>'
        + '<td>' + badge(r.status) + '</td>'
        + '<td style="font-size:10px">' + c(r.order_number) + '</td>'
        + '<td style="font-size:10px">' + c(r.customer) + '</td>'
        + '<td style="text-align:center">' + (r.material_ready ? '<span class="badge b-green" style="font-size:9px">✅</span>' : '<span class="badge b-gray" style="font-size:9px">—</span>') + '</td>'
        + '<td class="mono" style="font-size:10px;color:var(--amber-text);text-align:center">' + c(r.operation_number) + '</td>'
        + '<td style="color:#34d399">' + c(r.operation_name) + '</td>'
        + '<td style="font-weight:500">' + c(r.product_name) + '</td>'
        + '<td class="mono" style="font-size:10px;color:var(--text2)">' + c(r.classifier_code) + '</td>'
        + '<td style="font-size:10px">' + c(r.machine_resource) + '</td>'
        + '<td class="mono" style="text-align:right">' + c(r.quantity) + '</td>'
        + '<td class="mono" style="text-align:right">' + c(r.norm_time_hours) + '</td>'
        + '<td class="mono" style="text-align:right">' + c(r.plan_minutes) + '</td>'
        + '<td class="mono" style="text-align:right">' + c(r.fact_minutes) + '</td>'
        + '<td class="mono" style="text-align:right">' + (r.progress_pct ? (r.progress_pct * 100).toFixed(0) + '%' : '') + '</td>'
        + '<td style="font-size:10px">' + fmtDate(r.deadline) + '</td>'
        + '<td class="mono" style="text-align:center">' + c(r.ready) + '</td>'
        + '<td class="mono" style="text-align:center">' + c(r.not_ready) + '</td>'
        + '<td class="mono" style="text-align:center">' + c(r.defects) + '</td>'
        + '<td style="font-size:10px">' + c(r.executor) + '</td>'
        + '<td style="font-size:10px;color:var(--text3)">' + c(r.assembly_id) + '</td>'
        + '</tr>';
    }).join('');
  });
}

function prodShowDetail() {
  if (!prodSelectedNarad) return;
  showNaradDetail(prodSelectedNarad);
}

// ── ЗАГРУЗКА ПЛАНА ПРОЕКТОВ ───────────────────────────────
function loadProdProjects() {
  var q  = document.getElementById('prod-proj-q') ? document.getElementById('prod-proj-q').value : '';
  var st = document.getElementById('prod-proj-status') ? document.getElementById('prod-proj-status').value : '';
  var tb = document.getElementById('prod-proj-tbody');
  if (!tb) return;
  tb.innerHTML = '<tr><td colspan="15" style="text-align:center;color:var(--text3);padding:20px">Загрузка...</td></tr>';

  var url = '/api/production?view=projects&limit=50&page=' + PROD_PROJ_PAGE;
  if (q)  url += '&q=' + encodeURIComponent(q);
  if (st) url += '&status=' + encodeURIComponent(st);

  api('GET', url).then(function(res) {
    if (!res.ok || !res.rows || !res.rows.length) {
      tb.innerHTML = '<tr><td colspan="15" style="text-align:center;color:var(--text3);padding:20px">Нет данных</td></tr>';
      return;
    }
    // var total = res.total || res.rows.length;
    var pageInfo = document.getElementById('prod-proj-page-info');
    if (pageInfo) pageInfo.textContent = 'Стр. ' + PROD_PROJ_PAGE;

    function c(v) { return (v===null||v===undefined||v===''||v==='null')?'':String(v); }

    tb.innerHTML = res.rows.map(function(r) {
      var pct = r.progress_pct ? (parseFloat(r.progress_pct) * 100).toFixed(0) : '0';
      var pctColor = pct >= 100 ? 'var(--green-text)' : pct > 50 ? 'var(--amber-text)' : 'var(--text2)';
      var safeNarad = c(r.narad_number).replace(/&/g,'&amp;').replace(/"/g,'&quot;');
      var rowBg = r.status === 'Готово' ? ';background:rgba(16,185,129,0.3)' : '';
      return '<tr data-narad="' + safeNarad + '" onclick="showNaradDetail(this.dataset.narad)" style="cursor:pointer' + rowBg + '">'
        + '<td style="font-weight:600;color:var(--accent);white-space:nowrap">' + c(r.narad_number) + '</td>'
        + '<td>' + c(r.status) + '</td>'
        + '<td style="font-size:10px">' + c(r.order_number) + '</td>'
        + '<td style="font-size:10px">' + c(r.customer) + '</td>'
        + '<td style="font-weight:500">' + c(r.product_name) + '</td>'
        + '<td class="mono" style="font-size:10px">' + c(r.classifier_code) + '</td>'
        + '<td><span class="badge b-gray" style="font-size:9px">' + c(r.object_type) + '</span></td>'
        + '<td style="text-align:center">' + (r.material_ready ? '<span class="badge b-green" style="font-size:9px">✅</span>' : '<span class="badge b-gray" style="font-size:9px">—</span>') + '</td>'
        + '<td class="mono" style="text-align:right">' + c(r.quantity) + '</td>'
        + '<td style="font-size:10px">' + fmtDate(r.deadline) + '</td>'
        // + '<td class="mono" style="text-align:center">' + c(r.ready) + '/' + c(r.quantity) + '</td>'
        + '<td class="mono" style="text-align:center">' + c(r.ready_parts) + '/' + c(r.quantity) + '</td>'
        + '<td class="mono" style="text-align:center;color:' + pctColor + ';font-weight:700">' + pct + '%</td>'
        + '<td style="font-size:10px">' + c(r.executor) + '</td>'
        + '<td style="font-size:10px;color:var(--text3)">' + c(r.assembly_id) + '</td>'
        + '<td style="font-size:10px;color:var(--text3);max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + c(r.product_comment) + '</td>'
        + '</tr>';
    }).join('');
  });
}



function prodPrintRoute() {
  if (!prodSelectedNarad) return;

  api('GET', '/api/production?q=' + encodeURIComponent(prodSelectedNarad) + '&view=operations&limit=200').then(function(res) {
    if (!res.ok || !res.rows || !res.rows.length) { showToast('Наряд не найден'); return; }
    var rows = res.rows;
    var r = rows[0];

    // Меняем статус на "В работе"
    api('POST', '/api/production/status', { naradNumber: prodSelectedNarad, status: 'В работе' }).then(function() { loadProdOps(); });

    var normTotal = 0;
    rows.forEach(function(o) { normTotal += parseFloat(o.norm_time_hours || 0) * 60; });


    // QR код — локальная генерация (без внешних запросов)
    var factUrl = window.location.origin + '/fact.html?narad=' + encodeURIComponent(prodSelectedNarad);
    var qr = qrcode(0, 'M');                  // type=0 автоподбор размера, M = ~15% коррекция
    qr.addData(factUrl);
    qr.make();
    var qrDataUrl = qr.createDataURL(4, 2);   // cellSize=4px, margin=2 → ~136×136px GIF data URL

    var opsHtml = rows.map(function(o) {
      var normMin = o.norm_time_hours ? Math.round(parseFloat(o.norm_time_hours) * 60) : '';
      return '<tr>'
        + '<td>' + (o.operation_number || '') + '</td>'
        + '<td>' + (o.operation_name || '') + '</td>'
        + '<td>' + (o.machine_resource || '') + '</td>'
        + '<td></td><td></td><td></td><td></td><td></td>'
        + '<td>' + normMin + '</td></tr>';
    }).join('');

    var deadline = r.deadline ? new Date(r.deadline).toLocaleDateString('ru-RU') : '';
    var startDate = r.production_start_date ? new Date(r.production_start_date).toLocaleDateString('ru-RU') : '';

    var html = '<!DOCTYPE html><html><head><meta charset="utf-8"><title>Маршрутный лист ' + (r.narad_number||'') + '</title>'
      + '<style>'
      + 'body{font-family:"Times New Roman",serif;font-size:12px;margin:10mm;color:#000}'
      + 'table{width:100%;border-collapse:collapse;margin-top:6px}'
      + 'td,th{border:1px solid #000;padding:4px 6px;vertical-align:top}'
      + 'th{background:#f0f0f0;font-weight:bold;text-align:center;font-size:11px}'
      + '.header td{border:none;padding:2px 4px;font-size:12px}'
      + '.header{border:1px solid #000}'
      + '.note{font-size:10px;text-align:center;padding:6px;border:1px solid #000;background:#fff3cd}'
      + '.critical{background:#f8d7da}'
      + '.ops td{text-align:center;height:28px}'
      + '.ops td:nth-child(2),.ops td:nth-child(3){text-align:left}'
      + '.qr{position:absolute;top:10mm;right:10mm;text-align:center}'
      + '.qr img{width:120px;height:120px}'
      + '.qr div{font-size:8px;color:#666;margin-top:2px}'
      + '@media print{body{margin:5mm}.qr{top:5mm;right:5mm}}'
      + '</style></head><body>'

      + '<div class="qr"><img src="' + qrDataUrl + '" alt="QR"><div>Сканируйте для<br>отметки выполнения</div></div>'

      + '<div class="note">*При передаче детали на следующую операцию после проведения контроля первой детали обязательно наличие клейма ОТК в графе "Комментарии"</div>'

      + '<table class="header"><tbody>'
      + '<tr><td style="width:15%"><b>Наряд:</b></td><td style="width:20%"><b>' + (r.narad_number||'') + '</b></td>'
      + '<td style="width:5%"></td>'
      + '<td style="width:25%"><b>' + (r.order_number||'') + '</b></td>'
      + '<td style="width:15%"><b>Номер заказа</b></td>'
      + '<td style="width:10%"><b>Партия, шт:</b></td><td style="width:10%">' + (r.quantity||1) + '</td></tr>'

      + '<tr class="critical"><td><b>ВНИМАНИЕ:</b></td><td colspan="6" style="font-size:10px;color:#c00">Строка, выделенная цветом, указывает о наличии критичной операции, требующей особого внимания</td></tr>'

      + '<tr><td><b>Изделие:</b></td><td colspan="3"><b>' + (r.product_name||'') + '</b></td>'
      + '<td><b>Материал:</b></td><td colspan="2">' + (r.material_grade||'') + '</td></tr>'

      + '<tr><td><b>Чертеж:</b></td><td colspan="3"><b>' + (r.classifier_code||'') + '</b></td>'
      + '<td><b>Сортамент:</b></td><td colspan="2">' + (r.assortment||'') + '</td></tr>'

      + '<tr><td><b>Старт/Срок:</b></td><td>' + startDate + '</td><td></td>'
      + '<td style="background:#f8d7da"><b>' + deadline + '</b></td>'
      + '<td><b>Кол-во, шт:</b></td><td colspan="2">' + (r.quantity||1) + '</td></tr>'

      + '<tr><td></td><td colspan="3"></td>'
      + '<td><b>Размер заг.:</b></td><td colspan="2">' + (r.material_amount||'') + '</td></tr>'

      + '<tr><td></td><td colspan="3"></td>'
      + '<td><b>Ед. изм:</b></td><td colspan="2">' + (r.unit_of_measure||'') + '</td></tr>'
      + '</tbody></table>'

      + '<table class="ops"><thead><tr>'
      + '<th style="width:7%">Номер<br>опер.</th>'
      + '<th style="width:13%">Операция</th>'
      + '<th style="width:20%">Рабочий центр</th>'
      + '<th style="width:14%">Комментарии</th>'
      + '<th style="width:10%">ФИО</th>'
      + '<th style="width:8%">Подпись</th>'
      + '<th style="width:8%">Годных</th>'
      + '<th style="width:10%">Несоответ-<br>ствующих</th>'
      + '<th style="width:10%">Норма<br>времени<br>(минут)</th>'
      + '</tr></thead><tbody>' + opsHtml

      + '<tr><td colspan="4" style="text-align:left;font-size:10px"><i>Перечень для Сборочной единицы</i></td>'
      + '<td colspan="5"></td></tr>'
      + '<tr style="height:40px"><td colspan="9"></td></tr>'
      + '</tbody></table>'

      + '<div style="margin-top:10px;font-size:10px">'
      + '<b>Головное изделие:</b> ' + (r.assembly_id||'—')
      + ' | <b>Заказчик:</b> ' + (r.customer||'—')
      + ' | <b>Общая норма:</b> ' + Math.round(normTotal) + ' мин'
      + '</div>'

      + '</body></html>';

    var win = window.open('', '_blank');
    win.document.write(html);
    win.document.close();
    setTimeout(function() { win.print(); }, 50);

  });
}

// ══════════════════════════════════════════════════════════
// МОДАЛЬНОЕ ОКНО ДЕТАЛЕЙ НАРЯДА
// ══════════════════════════════════════════════════════════
// Показать детали наряда в модальном окне
function showNaradDetail(naradNumber) {
  document.getElementById('nd-title').textContent = 'Наряд: ' + naradNumber;
  document.getElementById('nd-content').innerHTML = '<div style="text-align:center;color:var(--text3);padding:20px">Загрузка...</div>';
  document.getElementById('narad-detail-modal').style.display = 'block';

  api('GET', '/api/production?q=' + encodeURIComponent(naradNumber) + '&view=operations&limit=200').then(function(res) {
    if (!res.ok || !res.rows || !res.rows.length) {
      document.getElementById('nd-content').innerHTML = '<div style="text-align:center;color:var(--text3)">Не найден</div>';
      return;
    }
    var r = res.rows[0];
    function c(v) { return (v===null||v===undefined||v===''||v==='null')?'—':String(v); }
    function row(label, val, color) {
      return '<div style="display:flex;border-bottom:1px solid var(--border);padding:8px 0">'
        + '<div style="width:200px;flex-shrink:0;font-size:11px;color:var(--text3)">' + label + '</div>'
        + '<div style="font-size:12px;' + (color ? 'color:' + color : '') + '">' + val + '</div></div>';
    }
    function bool(v) { return v ? '<span class="badge b-green" style="font-size:10px">✅ Да</span>' : '<span class="badge b-gray" style="font-size:10px">Нет</span>'; }

    var html = '<div style="display:grid;grid-template-columns:1fr 1fr;gap:20px">';
    
    // Левая колонка — основная информация
    html += '<div class="card"><div class="card-hd">Основная информация</div><div style="padding:12px">'
      + row('Наряд №', c(r.narad_number), 'var(--accent)')
      + row('Статус', c(r.status))
      + row('Номер заказа', c(r.order_number))
      + row('Заказчик', c(r.customer))
      + row('Дата начала', fmtDate(r.production_start_date) || '—')
      + row('Изделие', c(r.product_name))
      + row('Обозначение', c(r.classifier_code))
      + row('Тип объекта', c(r.object_type))
      + row('Головное изделие', c(r.assembly_id))
      + '</div></div>';

    // Правая колонка — материалы и производство
    html += '<div class="card"><div class="card-hd">Материалы и производство</div><div style="padding:12px">'
      + row('Материал скомплектован', bool(r.material_ready))
      + row('Срок поставки ПКИ', fmtDate(r.pki_delivery_date) || '—')
      + row('Марка материала', c(r.material_grade))
      + row('Сортамент', c(r.assortment))
      + row('Кол-во материала', c(r.material_amount))
      + row('Ед. измерения', c(r.unit_of_measure))
      + row('Программа готова', fmtDate(r.program_ready_date) || '—')
      + row('ЧПУ', bool(r.is_cnc))
      + row('Исполнитель', c(r.executor))
      + '</div></div>';

    html += '</div>';

    // Нижняя часть — прогресс
    var pct = r.progress_pct ? (parseFloat(r.progress_pct) * 100).toFixed(0) : '0';
    html += '<div class="card" style="margin-top:16px"><div class="card-hd">Прогресс выполнения</div><div style="padding:12px;display:grid;grid-template-columns:repeat(6,1fr);gap:12px;text-align:center">'
      + '<div><div style="font-size:22px;font-weight:700">' + c(r.quantity) + '</div><div style="font-size:10px;color:var(--text3)">Делаем (шт.)</div></div>'
      + '<div><div style="font-size:22px;font-weight:700;color:var(--amber-text)">' + c(r.priority) + '</div><div style="font-size:10px;color:var(--text3)">Приоритет</div></div>'
      + '<div><div style="font-size:22px;font-weight:700;color:var(--red-text)">' + c(r.not_ready) + '</div><div style="font-size:10px;color:var(--text3)">Не готово</div></div>'
      + '<div><div style="font-size:22px;font-weight:700;color:var(--green-text)">' + c(r.ready) + '</div><div style="font-size:10px;color:var(--text3)">Готово</div></div>'
      + '<div><div style="font-size:22px;font-weight:700">' + c(r.ready_to_process) + '</div><div style="font-size:10px;color:var(--text3)">К обработке</div></div>'
      + '<div><div style="font-size:22px;font-weight:700;color:var(--red-text)">' + c(r.defects) + '</div><div style="font-size:10px;color:var(--text3)">Брак</div></div>'
      + '</div></div>';

    // Комментарий и заявки
    if (r.request_numbers || r.product_comment) {
      html += '<div class="card" style="margin-top:16px"><div class="card-hd">Дополнительно</div><div style="padding:12px">'
        + (r.request_numbers ? row('№ Заявок', c(r.request_numbers)) : '')
        + (r.product_comment ? row('Комментарий', c(r.product_comment)) : '')
        + '</div></div>';
    }

    // Таблица операций
    html += '<div class="card" style="margin-top:16px"><div class="card-hd">Операции (' + res.rows.length + ')</div>'
      + '<div style="overflow-x:auto;max-height:300px;overflow-y:auto"><table style="width:100%;border-collapse:collapse;font-size:11px">'
      + '<thead><tr style="background:var(--bg3)">'
      + '<th style="padding:5px 6px;font-size:9px;color:var(--amber-text);border-bottom:1px solid var(--border)">№</th>'
      + '<th style="padding:5px 6px;font-size:9px;color:#34d399;border-bottom:1px solid var(--border)">Операция</th>'
      + '<th style="padding:5px 6px;font-size:9px;color:var(--text3);border-bottom:1px solid var(--border)">Станок</th>'
      + '<th style="padding:5px 6px;font-size:9px;color:var(--text3);border-bottom:1px solid var(--border)">Норма</th>'
      + '<th style="padding:5px 6px;font-size:9px;color:var(--text3);border-bottom:1px solid var(--border)">План</th>'
      + '<th style="padding:5px 6px;font-size:9px;color:var(--text3);border-bottom:1px solid var(--border)">Факт</th>'
      + '</tr></thead><tbody>';

    res.rows.forEach(function(op) {
      html += '<tr>'
        + '<td class="mono" style="padding:4px 6px;text-align:center;color:var(--amber-text);font-weight:700">' + c(op.operation_number) + '</td>'
        + '<td style="padding:4px 6px;color:#34d399">' + c(op.operation_name) + '</td>'
        + '<td style="padding:4px 6px;font-size:10px">' + c(op.machine_resource) + '</td>'
        + '<td class="mono" style="padding:4px 6px;text-align:right">' + c(op.norm_time_hours) + '</td>'
        + '<td class="mono" style="padding:4px 6px;text-align:right">' + c(op.plan_minutes) + '</td>'
        + '<td class="mono" style="padding:4px 6px;text-align:right">' + c(op.fact_minutes) + '</td>'
        + '</tr>';
    });

    html += '</tbody></table></div></div>';
    // Форма "Факт цеха" для каждой операции
    html += '<div class="card" style="margin-top:16px;border-color:#f59e0b">'
      + '<div class="card-hd" style="color:#f59e0b">📋 Факт цеха — отметка выполнения</div>'
      + '<div style="padding:12px">'
      + '<div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:10px;margin-bottom:12px">'
      + '<div><label style="font-size:10px;color:var(--text3);display:block;margin-bottom:4px">Номер операции *</label>'
      + '<select id="nd-fact-op" style="width:100%;padding:8px;background:var(--bg3);border:1px solid var(--border);border-radius:var(--radius);color:var(--text);font-size:12px">'
      + res.rows.map(function(op) { return '<option value="' + (op.operation_number||'') + '">' + (op.operation_number||'') + ' — ' + (op.operation_name||'') + '</option>'; }).join('')
      + '</select></div>'
      + '<div><label style="font-size:10px;color:var(--text3);display:block;margin-bottom:4px">Количество годных *</label>'
      + '<input type="number" id="nd-fact-qty" value="0" min="0" placeholder="Сколько добавить" style="width:100%;padding:8px;background:var(--bg3);border:1px solid var(--border);border-radius:var(--radius);color:var(--text);font-size:12px"></div>'
      + '<div><label style="font-size:10px;color:var(--text3);display:block;margin-bottom:4px">Затраченное время (мин)</label>'
      + '<input type="number" id="nd-fact-time" value="" min="0" style="width:100%;padding:8px;background:var(--bg3);border:1px solid var(--border);border-radius:var(--radius);color:var(--text);font-size:12px"></div>'
      + '<div><label style="font-size:10px;color:var(--text3);display:block;margin-bottom:4px">Несоответствующих</label>'
      + '<input type="number" id="nd-fact-defect" value="0" min="0" style="width:100%;padding:8px;background:var(--bg3);border:1px solid var(--border);border-radius:var(--radius);color:var(--text);font-size:12px"></div>'
      + '</div>'
      + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px">'
      + '<div><label style="font-size:10px;color:var(--text3);display:block;margin-bottom:4px">Участок *</label>'
      + '<select id="nd-fact-area" style="width:100%;padding:8px;background:var(--bg3);border:1px solid var(--border);border-radius:var(--radius);color:var(--text);font-size:12px">'
      + '<option value="">— Выберите —</option>'
      + '<option>Заготовительный участок</option><option>Испытательный центр</option>'
      + '<option>Отдел технического контроля</option><option>Сварочный участок</option>'
      + '<option>Слесарно-сборочный участок</option><option>Участок комплектации</option>'
      + '<option>Участок обработки отверстий</option><option>Участок подготовки поверхности</option>'
      + '<option>Участок термообработки</option><option>Участок токарной обработки</option>'
      + '<option>Участок фрезерной обработки</option><option>Участок фрезерных станков с ЧПУ</option>'
      + '<option>Участок электроэрозионной обработки</option><option>Аутсорсинг/Кооперация</option>'
      + '<option>Участок токарной обработки ЦВМ</option><option>Участок фрезерной обработки ЦВМ</option>'
      + '<option>Участок фрезерных станков с ЧПУ ЦВМ</option><option>Участок шлифовки ЦВМ</option>'
      + '<option>Участок зубообработки ЦВМ</option>'
      + '</select></div>'
      + '<div><label style="font-size:10px;color:var(--text3);display:block;margin-bottom:4px">Комментарий</label>'
      + '<input type="text" id="nd-fact-comment" placeholder="Примечание мастера" style="width:100%;padding:8px;background:var(--bg3);border:1px solid var(--border);border-radius:var(--radius);color:var(--text);font-size:12px"></div>'
      + '</div>'
      + '<div style="display:flex;gap:8px">'
      + '<button onclick="submitFact(\'' + c(r.narad_number).replace(/'/g,"\\'") + '\',\'Готово\')" style="padding:8px 20px;background:#10b981;color:#fff;border:none;border-radius:var(--radius);cursor:pointer;font-size:12px;font-weight:600">✅ Готово</button>'
      + '<button onclick="submitFact(\'' + c(r.narad_number).replace(/'/g,"\\'") + '\',\'Пауза\')" style="padding:8px 20px;background:#f59e0b;color:#fff;border:none;border-radius:var(--radius);cursor:pointer;font-size:12px;font-weight:600">⏸ На паузе</button>'
      + '<button onclick="submitFact(\'' + c(r.narad_number).replace(/'/g,"\\'") + '\',\'В работе\')" style="padding:8px 20px;background:#3b82f6;color:#fff;border:none;border-radius:var(--radius);cursor:pointer;font-size:12px;font-weight:600">🔄 В работе</button>'
      + '</div>'
      + '<div class="msg msg-ok" id="nd-fact-ok" style="margin-top:8px"></div>'
      + '<div class="msg msg-err" id="nd-fact-err" style="margin-top:8px"></div>'
      + '</div></div>';
    document.getElementById('nd-content').innerHTML = html;
  });
}

function submitFact(naradNumber, newStatus) {
  var opNum = document.getElementById('nd-fact-op').value;
  var qty = document.getElementById('nd-fact-qty').value;
  var time = document.getElementById('nd-fact-time').value;
  var defects = document.getElementById('nd-fact-defect').value;
  var area = document.getElementById('nd-fact-area').value;
  var comment = document.getElementById('nd-fact-comment').value;

  var errEl = document.getElementById('nd-fact-err');
  var okEl = document.getElementById('nd-fact-ok');
  errEl.classList.remove('show');
  okEl.classList.remove('show');

  if (!opNum) { errEl.textContent = 'Выберите операцию'; errEl.classList.add('show'); return; }
  if (!qty && qty !== '0') { errEl.textContent = 'Укажите количество'; errEl.classList.add('show'); return; }
  if (!area) { errEl.textContent = 'Выберите участок'; errEl.classList.add('show'); return; }

  api('POST', '/api/production/fact', {
    naradNumber: naradNumber,
    operationNumber: opNum,
    ready: parseInt(qty) || 0,
    factMinutes: parseFloat(time) || 0,
    defects: parseInt(defects) || 0,
    workshopArea: area,
    comment: comment,
    status: newStatus
  }).then(function(res) {
    if (res.ok) {
      okEl.textContent = '✓ Операция ' + opNum + ' обновлена. Статус наряда: ' + res.naradStatus;
      okEl.classList.add('show');
      showToast('Факт записан: ' + opNum);
      loadProdOps();
    } else {
      errEl.textContent = 'Ошибка: ' + (res.error || 'неизвестная');
      errEl.classList.add('show');
    }
  });
}

// Показать детали операции в модальном окне
function showOpDetail(opId) {
  if (!opId) return;
  document.getElementById('nd-title').textContent = 'Детали операции';
  document.getElementById('nd-content').innerHTML = '<div style="text-align:center;color:var(--text3);padding:20px">Загрузка...</div>';
  document.getElementById('narad-detail-modal').style.display = 'block';

  api('GET', '/api/production/detail?id=' + opId).then(function(res) {
    if (!res.ok || !res.row) {
      document.getElementById('nd-content').innerHTML = '<div style="text-align:center;color:var(--text3)">Не найдено</div>';
      return;
    }
    var r = res.row;
    function c(v) { return (v===null||v===undefined||v===''||v==='null')?'—':String(v); }
    function row(label, val, color) {
      return '<div style="display:flex;border-bottom:1px solid var(--border);padding:8px 0">'
        + '<div style="width:220px;flex-shrink:0;font-size:11px;color:var(--text3)">' + label + '</div>'
        + '<div style="font-size:12px;' + (color ? 'color:' + color : '') + '">' + val + '</div></div>';
    }
    function bool(v) { return v ? '<span class="badge b-green" style="font-size:10px">✅ Да</span>' : '<span class="badge b-gray" style="font-size:10px">Нет</span>'; }

    var html = '<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">';

    html += '<div class="card"><div class="card-hd">Наряд и заказ</div><div style="padding:12px">'
      + row('Наряд №', c(r.narad_number), 'var(--accent)')
      + row('Статус', c(r.status))
      + row('Номер заказа', c(r.order_number))
      + row('Заказчик', c(r.customer))
      + row('Дата начала', fmtDate(r.production_start_date) || '—')
      + row('Приоритет', c(r.priority))
      + row('Срок', fmtDate(r.deadline) || '—')
      + row('Головное изделие', c(r.assembly_id))
      + row('№ п/п изготовления', c(r.serial_number))
      + '</div></div>';

    html += '<div class="card"><div class="card-hd">Изделие и материал</div><div style="padding:12px">'
      + row('Название изделия', c(r.product_name))
      + row('Обозначение', c(r.classifier_code))
      + row('Тип объекта', c(r.object_type))
      + row('Материал скомплектован', bool(r.material_ready))
      + row('Марка материала', c(r.material_grade))
      + row('Сортамент', c(r.assortment))
      + row('Кол-во материала', c(r.material_amount))
      + row('Ед. измерения', c(r.unit_of_measure))
      + '</div></div>';

    html += '</div>';

    html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:16px">';

    html += '<div class="card"><div class="card-hd">Операция</div><div style="padding:12px">'
      + row('Номер операции', c(r.operation_number), 'var(--amber-text)')
      + row('Наименование', c(r.operation_name), '#34d399')
      + row('Финальная', bool(r.is_final))
      + row('Станок ресурс', c(r.machine_resource))
      + row('Исполнитель', c(r.executor))
      + row('ЧПУ', bool(r.is_cnc))
      + row('Комментарий', c(r.operation_comment))
      + row('Участок', c(r.workshop_area))
      + '</div></div>';

    html += '<div class="card"><div class="card-hd">Время и выполнение</div><div style="padding:12px">'
      + row('Делаем (шт.)', c(r.quantity))
      + row('Норма времени (ч)', c(r.norm_time_hours))
      + row('Загрузка на 1 шт (ч)', c(r.load_per_unit_hours))
      + row('Заготовительная на партию (ч)', c(r.batch_prep_hours))
      + row('Загрузка (мин)', c(r.load_minutes))
      + row('План (мин)', c(r.plan_minutes))
      + row('Факт (мин)', c(r.fact_minutes))
      + row('% Выполнения', c(r.progress_pct))
      + '</div></div>';

    html += '</div>';

    var pct = r.progress_pct ? (parseFloat(r.progress_pct) * 100).toFixed(0) : '0';
    html += '<div class="card" style="margin-top:16px"><div class="card-hd">Прогресс</div>'
      + '<div style="padding:12px;display:grid;grid-template-columns:repeat(5,1fr);gap:12px;text-align:center">'
      + '<div><div style="font-size:22px;font-weight:700;color:var(--red-text)">' + c(r.not_ready) + '</div><div style="font-size:10px;color:var(--text3)">Не готово</div></div>'
      + '<div><div style="font-size:22px;font-weight:700;color:var(--green-text)">' + c(r.ready) + '</div><div style="font-size:10px;color:var(--text3)">Готово</div></div>'
      + '<div><div style="font-size:22px;font-weight:700">' + c(r.ready_to_process) + '</div><div style="font-size:10px;color:var(--text3)">К обработке</div></div>'
      + '<div><div style="font-size:22px;font-weight:700;color:var(--red-text)">' + c(r.defects) + '</div><div style="font-size:10px;color:var(--text3)">Брак</div></div>'
      + '<div><div style="font-size:22px;font-weight:700;color:' + (pct>=100?'var(--green-text)':'var(--amber-text)') + '">' + pct + '%</div><div style="font-size:10px;color:var(--text3)">Выполнение</div></div>'
      + '</div></div>';

    document.getElementById('nd-content').innerHTML = html;
  });
}

// ══════════════════════════════════════════════════════════
// АВТОДОПОЛНЕНИЕ ДЛЯ ФОРМЫ ПРОИЗВОДСТВА
// ══════════════════════════════════════════════════════════

var pfAcLock = false;
var pfAcTimers = {};

// ── Головное изделие: показать все при фокусе ─────────────
function pfAssemblyFocus() {
  if (pfAcLock) return;
  var inp = document.getElementById('pf-assembly');
  var dd = document.getElementById('dd-pf-assembly');
  if (!dd || !inp) return;

  dd.innerHTML = '<div class="combo-item" style="color:var(--text3)">Загрузка...</div>';
  var rect = inp.getBoundingClientRect();
  dd.style.position = 'fixed';
  dd.style.top = (rect.bottom + 2) + 'px';
  dd.style.left = rect.left + 'px';
  dd.style.width = Math.max(rect.width, 400) + 'px';
  dd.style.zIndex = '99999';
  dd.classList.add('show');

  http('GET', '/api/archive/assemblies', null, function(res) {
    if (!res.ok || !res.rows || !res.rows.length) {
      dd.innerHTML = '<div class="combo-item" style="color:var(--text3)">Нет головных изделий в архиве</div>';
      return;
    }
    dd.innerHTML = '';
    var q = inp.value.trim().toLowerCase();
    res.rows.forEach(function(r) {
      var item = document.createElement('div');
      item.className = 'combo-item';
      item.innerHTML = '<b>' + (r.item_name || '') + '</b> <span style="color:var(--text3);font-size:10px;font-family:monospace">' + (r.assembly_id || '') + '</span>';
      if (q && (r.item_name || '').toLowerCase().indexOf(q) === -1 && (r.assembly_id || '').toLowerCase().indexOf(q) === -1) {
        item.style.display = 'none';
      }
      item.addEventListener('click', function() {
        pfAcLock = true;
        inp.value = r.assembly_id;
        document.getElementById('pf-product').value = '';
        document.getElementById('pf-drawing').value = '';
        document.querySelectorAll('.combo-dd').forEach(function(d) { d.classList.remove('show'); });
        setTimeout(function() { pfAcLock = false; }, 300);
        pfAutoLoadOps();
      });
      dd.appendChild(item);
    });
  });
}

function pfAssemblyInput() {
  if (pfAcLock) return;
  var q = document.getElementById('pf-assembly').value.trim().toLowerCase();
  var dd = document.getElementById('dd-pf-assembly');
  if (!dd) return;
  if (!dd.children.length || (dd.children[0] && dd.children[0].textContent === 'Загрузка...')) {
    pfAssemblyFocus();
    return;
  }
  Array.from(dd.children).forEach(function(item) {
    var text = item.textContent.toLowerCase();
    item.style.display = (!q || text.indexOf(q) !== -1) ? '' : 'none';
  });
  dd.classList.add('show');
}

// ── Изделие: показать детали головного изделия ─────────────
function pfProductFocus() {
  if (pfAcLock) return;
  var assembly = document.getElementById('pf-assembly').value.trim();
  if (assembly) {
    pfLoadProductsByAssembly(assembly);
  } else {
    pfProductSearch();
  }
}

function pfProductInput() {
  if (pfAcLock) return;
  var assembly = document.getElementById('pf-assembly').value.trim();
  if (assembly) {
    var q = document.getElementById('pf-product').value.trim().toLowerCase();
    var dd = document.getElementById('dd-pf-product');
    if (dd && dd.children.length > 1) {
      Array.from(dd.children).forEach(function(item) {
        var text = item.textContent.toLowerCase();
        item.style.display = (!q || text.indexOf(q) !== -1) ? '' : 'none';
      });
      dd.classList.add('show');
    } else {
      pfLoadProductsByAssembly(assembly);
    }
  } else {
    pfProductSearch();
  }
}

function pfLoadProductsByAssembly(assemblyId) {
  var dd = document.getElementById('dd-pf-product');
  var inp = document.getElementById('pf-product');
  if (!dd || !inp) return;

  var rect = inp.getBoundingClientRect();
  dd.style.position = 'fixed';
  dd.style.top = (rect.bottom + 2) + 'px';
  dd.style.left = rect.left + 'px';
  dd.style.width = Math.max(rect.width, 400) + 'px';
  dd.style.zIndex = '99999';
  dd.innerHTML = '<div class="combo-item" style="color:var(--text3)">Загрузка...</div>';
  dd.classList.add('show');

  http('GET', '/api/archive?assembly_id=' + encodeURIComponent(assemblyId), null, function(res) {
    if (!res.ok || !res.rows || !res.rows.length) {
      dd.innerHTML = '<div class="combo-item" style="color:var(--text3)">Нет деталей</div>';
      return;
    }
    dd.innerHTML = '';
    var q = inp.value.trim().toLowerCase();
    res.rows.filter(function(r) {
      return r.object_type !== 'Головное изделие' && r.object_type !== 'ПКИ';
    }).forEach(function(r) {
      var item = document.createElement('div');
      item.className = 'combo-item';
      var name = r.item_name || '';
      var code = r.classifier || '';
      var type = r.object_type || '';
      if (q && name.toLowerCase().indexOf(q) === -1 && code.toLowerCase().indexOf(q) === -1) {
        item.style.display = 'none';
      }
      item.innerHTML = name + ' <span style="color:var(--text3);font-size:10px;font-family:monospace">(' + code + ' · ' + type + ')</span>';
      item.addEventListener('click', function() {
        pfAcLock = true;
        inp.value = name;
        document.getElementById('pf-drawing').value = (code && code !== 'nan') ? code : '';
        document.querySelectorAll('.combo-dd').forEach(function(d) { d.classList.remove('show'); });
        setTimeout(function() { pfAcLock = false; }, 300);
        pfAutoLoadOpsByProduct(name, code);
      });
      dd.appendChild(item);
    });
  });
}

function pfProductSearch() {
  var inp = document.getElementById('pf-product');
  var dd = document.getElementById('dd-pf-product');
  if (!inp || !dd) return;
  var q = inp.value.trim();
  if (q.length < 2) { dd.classList.remove('show'); return; }

  clearTimeout(pfAcTimers['pf-product']);
  pfAcTimers['pf-product'] = setTimeout(function() {
    http('GET', '/api/tech-ops/autocomplete?q=' + encodeURIComponent(q) + '&field=product', null, function(res) {
      if (!res.ok || !res.rows || !res.rows.length) { dd.classList.remove('show'); return; }
      dd.innerHTML = '';
      res.rows.forEach(function(r) {
        var item = document.createElement('div');
        item.className = 'combo-item';
        item.innerHTML = r.name + ' <span style="color:var(--text3);font-size:10px;font-family:monospace">(' + r.code + ')</span>';
        item.addEventListener('click', function() {
          pfAcLock = true;
          var cleanName = (r.name && r.name !== 'nan') ? r.name : '';
          var cleanCode = (r.code && r.code !== 'nan') ? r.code : '';
          inp.value = cleanName;
          document.getElementById('pf-drawing').value = cleanCode;
          document.querySelectorAll('.combo-dd').forEach(function(d) { d.classList.remove('show'); });
          setTimeout(function() { pfAcLock = false; }, 300);
          pfAutoLoadOpsByProduct(cleanName, cleanCode);
        });
        dd.appendChild(item);
      });
      var rect = inp.getBoundingClientRect();
      dd.style.position = 'fixed';
      dd.style.top = (rect.bottom + 2) + 'px';
      dd.style.left = rect.left + 'px';
      dd.style.width = Math.max(rect.width, 400) + 'px';
      dd.style.zIndex = '99999';
      dd.classList.add('show');
    });
  }, 300);
}

// ══════════════════════════════════════════════════════════
// АВТОЗАГРУЗКА ОПЕРАЦИЙ
// ══════════════════════════════════════════════════════════
function pfAutoLoadOps() {
  var assembly = document.getElementById('pf-assembly').value.trim();
  if (!assembly) return;
  var tbody = document.getElementById('pf-ops-tbody');
  var info = document.getElementById('pf-ops-info');
  tbody.innerHTML = '<tr><td colspan="11" style="text-align:center;color:var(--text3);padding:15px">Загрузка операций...</td></tr>';
  info.innerHTML = '';

  api('GET', '/api/production/load-from-archive?assembly_id=' + encodeURIComponent(assembly)).then(function(res) {
    pfRenderOpsTable(res.ok ? (res.operations || []) : [], assembly);
  });
}

function pfAutoLoadOpsByProduct(productName, classifierCode) {
  if (!productName && !classifierCode) return;
  var tbody = document.getElementById('pf-ops-tbody');
  var info = document.getElementById('pf-ops-info');
  tbody.innerHTML = '<tr><td colspan="11" style="text-align:center;color:var(--text3);padding:15px">Загрузка...</td></tr>';
  info.innerHTML = '';

  api('GET', '/api/tech-ops/search?product_name=' + encodeURIComponent(productName) + '&classifier=' + encodeURIComponent(classifierCode)).then(function(res) {
    if (!res.ok) {
      tbody.innerHTML = '<tr><td colspan="11" style="text-align:center;color:var(--text3);padding:15px">Операции не найдены</td></tr>';
      return;
    }
    pfRenderOpsTable(res.operations || [], productName);
  });
}

function pfRenderOpsTable(ops, label) {
  var tbody = document.getElementById('pf-ops-tbody');
  var info = document.getElementById('pf-ops-info');

  if (!ops.length) {
    tbody.innerHTML = '<tr><td colspan="11" style="text-align:center;color:var(--text3);padding:15px">Операции не найдены</td></tr>';
    info.innerHTML = '';
    return;
  }

  var totalLabor = 0;
  ops.forEach(function(o) { totalLabor += parseFloat(o.normTimeHours || o.norm_time_hours || 0); });

  info.innerHTML = '<div style="display:flex;gap:20px;padding:10px 14px;background:var(--bg3);border-radius:var(--radius);margin-bottom:10px">'
    + '<div><span style="color:var(--text3);font-size:10px">Изделие:</span> <b>' + (label || '') + '</b></div>'
    + '<div><span style="color:var(--text3);font-size:10px">Операций:</span> <b>' + ops.length + '</b></div>'
    + '<div><span style="color:var(--text3);font-size:10px">Общая трудоёмкость:</span> <b style="color:var(--accent)">' + totalLabor.toFixed(2) + ' ч</b></div>'
    + '</div>';

  function c(v) { return (v===null||v===undefined||v==='')?'':String(v); }

  tbody.innerHTML = ops.map(function(o) {
    return '<tr>'
      + '<td style="font-weight:500">' + c(o.productName || o.product_name) + '</td>'
      + '<td class="mono" style="font-size:10px">' + c(o.classifierCode || o.classifier_code) + '</td>'
      + '<td class="mono" style="text-align:center;color:var(--amber-text);font-weight:700">' + c(o.operationNumber || o.operation_number) + '</td>'
      + '<td style="color:#34d399">' + c(o.operationName || o.operation_name) + '</td>'
      + '<td style="font-size:10px">' + c(o.machineResource || o.machine_resource) + '</td>'
      + '<td class="mono" style="text-align:right">' + c(o.normTimeHours || o.norm_time_hours) + '</td>'
      + '<td class="mono" style="text-align:right">' + c(o.batchPrepHours || o.batch_prep_hours) + '</td>'
      + '<td style="text-align:center">' + (o.isOutsourcing || o.is_outsourcing ? '✓' : '') + '</td>'
      + '<td style="text-align:center">' + (o.isFinal || o.is_final ? '<span class="badge b-green" style="font-size:9px">✓</span>' : '') + '</td>'
      + '<td style="text-align:center">' + (o.isCnc || o.is_cnc ? '<span class="badge b-blue" style="font-size:9px">ЧПУ</span>' : '') + '</td>'
      + '<td class="mono" style="text-align:right">' + c(o.loadPerUnitHours || o.load_per_unit_hours) + '</td>'
      + '</tr>';
  }).join('');
}

// ══════════════════════════════════════════════════════════
// ФОРМА: ОТКРЫТЬ / ЗАКРЫТЬ / ОТПРАВИТЬ
// ══════════════════════════════════════════════════════════
// Открыть форму, очистив все поля и загрузив данные для автодополнения
function openProdForm() {
  ['pf-assembly','pf-product','pf-drawing','pf-order','pf-customer',
   'pf-quantity','pf-priority','pf-deadline','pf-start-date','pf-narad'].forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.value = (el.type === 'number') ? '1' : '';
  });
  var prio = document.getElementById('pf-priority');
  if (prio) prio.value = '3';
  document.getElementById('pf-ops-tbody').innerHTML = '';
  document.getElementById('pf-ops-info').innerHTML = '';
  var err = document.getElementById('pf-err');
  if (err) err.classList.remove('show');
  var ok = document.getElementById('pf-ok');
  if (ok) ok.classList.remove('show');

  document.getElementById('prod-form-modal').style.display = 'block';

  // Загружаем данные формы: следующий номер, списки
  api('GET', '/api/production/form-data').then(function(res) {
    if (!res.ok) return;

    // Подставляем следующий номер наряда
    var naradEl = document.getElementById('pf-narad');
    if (naradEl && !naradEl.value) naradEl.value = res.nextNarad || '';

    // Заполняем список заказов
    var orderDd = document.getElementById('dd-pf-order');
    if (orderDd && res.orders) {
      orderDd.innerHTML = '';
      res.orders.forEach(function(v) {
        var item = document.createElement('div');
        item.className = 'combo-item';
        item.textContent = v;
        item.addEventListener('click', function() {
          document.getElementById('pf-order').value = v;
          orderDd.classList.remove('show');
        });
        orderDd.appendChild(item);
      });
    }

    // Заполняем список заказчиков
    var custDd = document.getElementById('dd-pf-customer');
    if (custDd && res.customers) {
      custDd.innerHTML = '';
      res.customers.forEach(function(v) {
        var item = document.createElement('div');
        item.className = 'combo-item';
        item.textContent = v;
        item.addEventListener('click', function() {
          document.getElementById('pf-customer').value = v;
          custDd.classList.remove('show');
        });
        custDd.appendChild(item);
      });
    }
  });
}

// Показать выпадающий список заказов, отфильтрованный по введённому
function pfOrderFocus() {
  var dd = document.getElementById('dd-pf-order');
  if (!dd || !dd.children.length) return;
  var inp = document.getElementById('pf-order');
  var rect = inp.getBoundingClientRect();
  dd.style.position = 'fixed';
  dd.style.top = (rect.bottom + 2) + 'px';
  dd.style.left = rect.left + 'px';
  dd.style.width = rect.width + 'px';
  dd.style.zIndex = '99999';
  // Фильтруем по введённому
  var q = inp.value.trim().toLowerCase();
  Array.from(dd.children).forEach(function(item) {
    item.style.display = (!q || item.textContent.toLowerCase().indexOf(q) !== -1) ? '' : 'none';
  });
  dd.classList.add('show');
}


// Показать выпадающий список заказчиков, отфильтрованный по введённому
function pfCustomerFocus() {
  var dd = document.getElementById('dd-pf-customer');
  if (!dd || !dd.children.length) return;
  var inp = document.getElementById('pf-customer');
  var rect = inp.getBoundingClientRect();
  dd.style.position = 'fixed';
  dd.style.top = (rect.bottom + 2) + 'px';
  dd.style.left = rect.left + 'px';
  dd.style.width = rect.width + 'px';
  dd.style.zIndex = '99999';
  var q = inp.value.trim().toLowerCase();
  Array.from(dd.children).forEach(function(item) {
    item.style.display = (!q || item.textContent.toLowerCase().indexOf(q) !== -1) ? '' : 'none';
  });
  dd.classList.add('show');
}

function closeProdForm() {
  document.getElementById('prod-form-modal').style.display = 'none';
}

function pfSubmit() {
  var narad     = document.getElementById('pf-narad').value.trim();
  var order     = document.getElementById('pf-order').value.trim();
  var customer  = document.getElementById('pf-customer').value.trim();
  var product   = document.getElementById('pf-product').value.trim();
  var drawing   = document.getElementById('pf-drawing').value.trim();
  var assembly  = document.getElementById('pf-assembly').value.trim();
  var qty       = document.getElementById('pf-quantity').value || 1;
  var priority  = document.getElementById('pf-priority').value || 3;
  var deadline  = document.getElementById('pf-deadline').value || null;
  var startDate = document.getElementById('pf-start-date').value || null;

  var errEl = document.getElementById('pf-err');
  errEl.classList.remove('show');

  if (!narad) { errEl.textContent = 'Укажите номер наряда'; errEl.classList.add('show'); return; }
  if (!product && !assembly) { errEl.textContent = 'Укажите изделие или головное изделие'; errEl.classList.add('show'); return; }

  var rows = document.querySelectorAll('#pf-ops-tbody tr');
  if (!rows.length || rows[0].cells.length < 3) {
    errEl.textContent = 'Сначала выберите изделие — операции загрузятся автоматически';
    errEl.classList.add('show');
    return;
  }

  api('POST', '/api/production', {
    naradNumber: narad,
    orderNumber: order,
    customer: customer,
    productName: product,
    classifierCode: drawing,
    assemblyId: assembly,
    quantity: parseInt(qty),
    priority: parseInt(priority),
    deadline: deadline,
    productionStartDate: startDate
  }).then(function(res) {
    if (res.ok) {
      var okEl = document.getElementById('pf-ok');
      okEl.textContent = '✓ Наряд ' + narad + ' создан: ' + res.added + ' операций добавлено';
      okEl.classList.add('show');
      showToast('Наряд создан: ' + narad);
      var activeTab = document.querySelector('#panel-production .chrome-tab.active');
      if (activeTab && activeTab.id === 'prod-tab-proj') loadProdProjects();
      else loadProdOps();
      setTimeout(closeProdForm, 2000);
    } else {
      errEl.textContent = 'Ошибка: ' + (res.error || 'неизвестная');
      errEl.classList.add('show');
    }
  });
}


// ══════════════════════════════════════════════════════════
// ВЫДЕЛЕНИЕ СТРОК И ДЕЙСТВИЯ
// ══════════════════════════════════════════════════════════

var prodSelectedNarad = null;

function prodSelectRow(rowEl) {
  var narad = rowEl.dataset.narad;
  if (!narad) return;

  // Снимаем выделение со всех
  document.querySelectorAll('#prod-ops-tbody tr').forEach(function(tr) {
    tr.style.outline = '';
  });

  // Выделяем все строки этого наряда
  document.querySelectorAll('#prod-ops-tbody tr[data-narad="' + narad + '"]').forEach(function(tr) {
    tr.style.outline = '2px solid var(--accent)';
    tr.style.outlineOffset = '-1px';
  });

  prodSelectedNarad = narad;

  // Считаем количество операций
  var count = document.querySelectorAll('#prod-ops-tbody tr[data-narad="' + narad + '"]').length;

  // Показываем панель действий
  var bar = document.getElementById('prod-action-bar');
  bar.style.display = 'flex';
  document.getElementById('prod-selected-info').textContent = 'Наряд: ' + narad + ' (' + count + ' операций)';
}

function prodClearSelection() {
  prodSelectedNarad = null;
  document.querySelectorAll('#prod-ops-tbody tr').forEach(function(tr) {
    tr.style.outline = '';
    tr.style.background = '';
  });
  document.getElementById('prod-action-bar').style.display = 'none';
}

function prodDelete() {
  if (!prodSelectedNarad) return;
  if (!confirm('Удалить наряд ' + prodSelectedNarad + ' и ВСЕ его операции?\n\nЭто действие нельзя отменить!')) return;

  api('DELETE', '/api/production', { naradNumber: prodSelectedNarad }).then(function(res) {
    if (res.ok) {
      showToast('Удалён наряд ' + prodSelectedNarad + ': ' + res.deleted + ' операций');
      prodClearSelection();
      loadProdOps();
    } else {
      alert('Ошибка: ' + (res.error || 'неизвестная'));
    }
  });
}

function prodEdit() {
  if (!prodSelectedNarad) return;

  api('GET', '/api/production?q=' + encodeURIComponent(prodSelectedNarad) + '&view=operations&limit=200').then(function(res) {
    if (!res.ok || !res.rows || !res.rows.length) {
      showToast('Наряд не найден');
      return;
    }
    var first = res.rows[0];

    openProdForm();

    document.getElementById('pf-narad').value = first.narad_number || '';
    document.getElementById('pf-order').value = first.order_number || '';
    document.getElementById('pf-customer').value = first.customer || '';
    document.getElementById('pf-assembly').value = first.assembly_id || '';
    document.getElementById('pf-product').value = first.product_name || '';
    document.getElementById('pf-drawing').value = first.classifier_code || '';
    document.getElementById('pf-quantity').value = first.quantity || 1;
    document.getElementById('pf-priority').value = first.priority || 3;
    if (first.deadline) document.getElementById('pf-deadline').value = first.deadline.slice(0, 10);
    if (first.production_start_date) document.getElementById('pf-start-date').value = first.production_start_date.slice(0, 10);

    pfRenderOpsTable(res.rows.map(function(r) {
      return {
        product_name: r.product_name,
        classifier_code: r.classifier_code,
        operation_number: r.operation_number,
        operation_name: r.operation_name,
        machine_resource: r.machine_resource,
        norm_time_hours: r.norm_time_hours,
        batch_prep_hours: r.batch_prep_hours,
        is_outsourcing: r.is_outsourcing,
        is_final: r.is_final,
        is_cnc: r.is_cnc,
        load_per_unit_hours: r.load_per_unit_hours
      };
    }), first.narad_number);

    showToast('Редактирование наряда ' + prodSelectedNarad);
  });
}

// ══════════════════════════════════════════════════════════
function prodPage(dir) {
  PROD_PAGE += dir;
  if (PROD_PAGE < 1) PROD_PAGE = 1;
  loadProdOps();
}
// Пагинация для плана проектов работает отдельно, так как там может быть другая логика загрузки (например, с учётом фильтров)
function prodProjPage(dir) {
  PROD_PROJ_PAGE += dir;
  if (PROD_PROJ_PAGE < 1) PROD_PROJ_PAGE = 1;
  loadProdProjects();
}