// ============================================================
// production.js — Производство: План по операциям + План проектов
// ============================================================


// ── Автодополнение для формы производства ──────────────────
var pfAcLock = false;
var pfAcTimers = {};

function pfAcSearch(inputEl, ddId, field) {
  if (pfAcLock) return;
  var q = inputEl.value.trim();
  var dd = document.getElementById(ddId);
  if (!dd) return;
  if (q.length < 2) { dd.classList.remove('show'); return; }

  clearTimeout(pfAcTimers[ddId]);
  pfAcTimers[ddId] = setTimeout(function() {
    http('GET', '/api/tech-ops/autocomplete?q=' + encodeURIComponent(q) + '&field=' + field, null, function(res) {
      if (!res.ok || !res.rows || !res.rows.length) { dd.classList.remove('show'); return; }
      dd.innerHTML = '';
      res.rows.forEach(function(r) {
        var item = document.createElement('div');
        item.className = 'combo-item';
        var typeLabel = r.object_type ? ' · ' + r.object_type : '';
        item.innerHTML = r.name + ' <span style="color:var(--text3);font-size:10px;font-family:monospace">(' + r.code + typeLabel + ')</span>';
        item.addEventListener('click', function() {
          pfAcLock = true;

          var cleanName = (r.name && r.name !== 'nan' && r.name !== 'null') ? r.name : '';
          var cleanCode = (r.code && r.code !== 'nan' && r.code !== 'null') ? r.code : '';

          if (field === 'product') {
            inputEl.value = cleanName;
            // Заполняем чертёж
            var drawingEl = document.getElementById('pf-drawing');
            if (drawingEl) drawingEl.value = cleanCode;
          } else {
            inputEl.value = cleanName;
            // Заполняем название
            var productEl = document.getElementById('pf-product');
            if (productEl && cleanCode) productEl.value = cleanCode;
          }

          // Закрываем все выпадающие
          document.querySelectorAll('.combo-dd').forEach(function(d) { d.classList.remove('show'); });

          setTimeout(function() { pfAcLock = false; }, 500);
        });
        dd.appendChild(item);
      });

      // Позиционируем поверх всего
      var rect = inputEl.getBoundingClientRect();
      dd.style.position = 'fixed';
      dd.style.top = (rect.bottom + 2) + 'px';
      dd.style.left = rect.left + 'px';
      dd.style.width = rect.width + 'px';
      dd.style.zIndex = '99999';
      dd.classList.add('show');
    });
  }, 300);
}

// === ПЛАН ПРОИЗВОДСТВА: ЗАГРУЗКА ДАННЫХ И ОТКРЫТИЕ ФОРМЫ ===
var PROD_PAGE = 1;
var PROD_SEARCH_T = null;

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

    function c(v) { return (v===null||v===undefined||v===''||v==='null')?'':String(v); }
    function badge(s) {
      var colors = {'Новый':'b-gray','В работе':'b-blue','✅ Готово':'b-green','🔄 В работе':'b-blue','⏸ Пауза':'b-amber','❌ Отменён':'b-gray'};
      return '<span class="badge ' + (colors[s]||'b-gray') + '" style="font-size:9px">' + c(s) + '</span>';
    }

    tb.innerHTML = res.rows.map(function(r) {
      return '<tr>'
        + '<td style="font-weight:600;color:var(--accent);white-space:nowrap">' + c(r.narad_number) + '</td>'
        + '<td>' + badge(r.status) + '</td>'
        + '<td style="font-size:10px">' + c(r.order_number) + '</td>'
        + '<td style="font-size:10px">' + c(r.customer) + '</td>'
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
        + '<td style="font-size:10px">' + c(r.deadline) + '</td>'
        + '<td class="mono" style="text-align:center">' + c(r.ready) + '</td>'
        + '<td class="mono" style="text-align:center">' + c(r.not_ready) + '</td>'
        + '<td class="mono" style="text-align:center">' + c(r.defects) + '</td>'
        + '<td style="font-size:10px">' + c(r.executor) + '</td>'
        + '<td style="font-size:10px;color:var(--text3)">' + c(r.assembly_id) + '</td>'
        + '</tr>';
    }).join('');
  });
}

// ── ЗАГРУЗКА ПЛАНА ПРОЕКТОВ ───────────────────────────────
function loadProdProjects() {
  var q  = document.getElementById('prod-proj-q') ? document.getElementById('prod-proj-q').value : '';
  var st = document.getElementById('prod-proj-status') ? document.getElementById('prod-proj-status').value : '';
  var tb = document.getElementById('prod-proj-tbody');
  if (!tb) return;
  tb.innerHTML = '<tr><td colspan="15" style="text-align:center;color:var(--text3);padding:20px">Загрузка...</td></tr>';

  var url = '/api/production?view=projects&limit=50&page=1';
  if (q)  url += '&q=' + encodeURIComponent(q);
  if (st) url += '&status=' + encodeURIComponent(st);

  api('GET', url).then(function(res) {
    if (!res.ok || !res.rows || !res.rows.length) {
      tb.innerHTML = '<tr><td colspan="15" style="text-align:center;color:var(--text3);padding:20px">Нет данных</td></tr>';
      return;
    }

    function c(v) { return (v===null||v===undefined||v===''||v==='null')?'':String(v); }

    tb.innerHTML = res.rows.map(function(r) {
      var pct = r.progress_pct ? (parseFloat(r.progress_pct) * 100).toFixed(0) : '0';
      var pctColor = pct >= 100 ? 'var(--green-text)' : pct > 50 ? 'var(--amber-text)' : 'var(--text2)';
      return '<tr>'
        + '<td style="font-weight:600;color:var(--accent);white-space:nowrap">' + c(r.narad_number) + '</td>'
        + '<td>' + c(r.status) + '</td>'
        + '<td style="font-size:10px">' + c(r.order_number) + '</td>'
        + '<td style="font-size:10px">' + c(r.customer) + '</td>'
        + '<td style="font-weight:500">' + c(r.product_name) + '</td>'
        + '<td class="mono" style="font-size:10px">' + c(r.classifier_code) + '</td>'
        + '<td><span class="badge b-gray" style="font-size:9px">' + c(r.object_type) + '</span></td>'
        + '<td style="font-size:10px">' + c(r.material_grade) + '</td>'
        + '<td class="mono" style="text-align:right">' + c(r.quantity) + '</td>'
        + '<td style="font-size:10px">' + c(r.deadline) + '</td>'
        + '<td class="mono" style="text-align:center">' + c(r.ready) + '/' + c(r.quantity) + '</td>'
        + '<td class="mono" style="text-align:center;color:' + pctColor + ';font-weight:700">' + pct + '%</td>'
        + '<td style="font-size:10px">' + c(r.executor) + '</td>'
        + '<td style="font-size:10px">' + c(r.assembly_id) + '</td>'
        + '<td style="font-size:10px;color:var(--text3)">' + c(r.product_comment) + '</td>'
        + '</tr>';
    }).join('');
  });
}

// ── ФОРМА ДОБАВЛЕНИЯ НАРЯДА ───────────────────────────────
function openProdForm() {
  // Очищаем форму
  ['pf-assembly','pf-product','pf-drawing','pf-order','pf-customer',
   'pf-quantity','pf-priority','pf-deadline','pf-start-date','pf-narad'].forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.value = el.type === 'number' ? '1' : '';
  });
  document.getElementById('pf-ops-tbody').innerHTML = '';
  document.getElementById('pf-ops-info').innerHTML = '';
  var err = document.getElementById('pf-err');
  if (err) err.classList.remove('show');
  var ok = document.getElementById('pf-ok');
  if (ok) ok.classList.remove('show');

  document.getElementById('prod-form-modal').style.display = 'block';
}

function closeProdForm() {
  document.getElementById('prod-form-modal').style.display = 'none';
}

// Загрузить операции из архива по изделию
function pfLoadOps() {
  var product = document.getElementById('pf-product').value.trim();
  var drawing = document.getElementById('pf-drawing').value.trim();
  var assembly = document.getElementById('pf-assembly').value.trim();
  var tbody = document.getElementById('pf-ops-tbody');
  var info = document.getElementById('pf-ops-info');

  if (!product && !drawing && !assembly) {
    showToast('Укажите изделие или головное изделие');
    return;
  }

  tbody.innerHTML = '<tr><td colspan="11" style="text-align:center;color:var(--text3);padding:15px">Загрузка из архива...</td></tr>';

  // Ищем по головному изделию (assembly_id) или по конкретному изделию
  var url = '';
  if (assembly) {
    // Загружаем все операции всех деталей головного изделия
    url = '/api/production/load-from-archive?assembly_id=' + encodeURIComponent(assembly);
  } else {
    url = '/api/tech-ops/search?product_name=' + encodeURIComponent(product) + '&classifier=' + encodeURIComponent(drawing);
  }

  api('GET', url).then(function(res) {
    if (!res.ok) {
      tbody.innerHTML = '<tr><td colspan="11" style="text-align:center;color:var(--text3);padding:15px">Не найдено</td></tr>';
      info.innerHTML = '';
      return;
    }

    var ops = res.operations || [];
    if (!ops.length && res.rows) ops = res.rows;
    if (!ops.length) {
      tbody.innerHTML = '<tr><td colspan="11" style="text-align:center;color:var(--text3);padding:15px">Операции не найдены</td></tr>';
      return;
    }

    var totalLabor = 0;
    ops.forEach(function(o) { totalLabor += parseFloat(o.normTimeHours || o.norm_time_hours || 0); });

    info.innerHTML = '<div style="display:flex;gap:20px;padding:10px 14px;background:var(--bg3);border-radius:var(--radius);margin-bottom:10px">'
      + '<div><span style="color:var(--text3);font-size:10px">Изделие:</span> <b>' + (product || assembly) + '</b></div>'
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
  });
}

// Отправить наряд в производство
function pfSubmit() {
  var narad    = document.getElementById('pf-narad').value.trim();
  var order    = document.getElementById('pf-order').value.trim();
  var customer = document.getElementById('pf-customer').value.trim();
  var product  = document.getElementById('pf-product').value.trim();
  var drawing  = document.getElementById('pf-drawing').value.trim();
  var assembly = document.getElementById('pf-assembly').value.trim();
  var qty      = document.getElementById('pf-quantity').value || 1;
  var priority = document.getElementById('pf-priority').value || 3;
  var deadline = document.getElementById('pf-deadline').value || null;
  var startDate = document.getElementById('pf-start-date').value || null;

  var errEl = document.getElementById('pf-err');
  errEl.classList.remove('show');

  if (!narad) { errEl.textContent = 'Укажите номер наряда'; errEl.classList.add('show'); return; }
  if (!product && !assembly) { errEl.textContent = 'Укажите изделие'; errEl.classList.add('show'); return; }

  var rows = document.querySelectorAll('#pf-ops-tbody tr');
  if (!rows.length || rows[0].cells.length < 3) {
    errEl.textContent = 'Сначала загрузите операции из архива';
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
      // Обновляем таблицы
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