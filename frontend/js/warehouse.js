// ============================================================
// warehouse.js — Склад: панель управления
// ============================================================
var WH_TAB = "all";
var WH_PAGE = 1;
var WH_SRCH_T = null;
var WH_SRCH_MODE = "name"; // 'name' | 'sku'
var WH_REFS = null;
var WH_INITED = false;
var WH_ITEM_T = null;
var WH_SUP_T = null;
var WH_CARD_ITEM = null;
var WH_CARD_MOVS = [];
var WH_MOV_DATE  = null;

var WH_TABS = [
  { id: "all", label: "Все" },
  { id: "ГСМ", label: "ГСМ" },
  { id: "Давальческое", label: "Давальческое" },
  { id: "ДСЕ", label: "ДСЕ" },
  { id: "Материал(прокат,сыпучка)", label: "Материалы" },
  { id: "ЦВМ", label: "ЦВМ" },
  { id: "ПКИ", label: "ПКИ" },
  { id: "Производство", label: "Производство" },
  { id: "Роботех", label: "Роботех" },
  { id: "СГП", label: "СГП" },
  { id: "СИЗ", label: "СИЗ" },
  { id: "Склад литейного участка", label: "Литейный" },
  { id: "Сотрудники", label: "Сотрудники" },
  { id: "Спец.инстр (оснастка)", label: "Спец.инстр" },
  { id: "Хозяйственные материалы", label: "Хоз.материалы" },
  { id: "Брак/Утиль", label: "Брак/Утиль" },
];

// init
function initWarehouse() {
  if (WH_INITED) {
    whRefreshAll();
    return;
  }
  WH_INITED = true;
  http("GET", "/api/warehouse/refs", null, function (res) {
    if (res.ok) WH_REFS = res;
    whBuild();
    whRefreshAll();
  });
}

// build panel HTML
function whBuild() {
  var panel = document.getElementById("panel-warehouse");
  if (!panel) return;

  var tabsHtml = WH_TABS.map(function (t) {
    return (
      '<button class="wh-tab' +
      (t.id === WH_TAB ? " active" : "") +
      '" onclick="whSetTab(\'' +
      whE(t.id) +
      '\')" data-wh-tab="' +
      whE(t.id) +
      '">' +
      t.label +
      "</button>"
    );
  }).join("");

  panel.innerHTML =
    '<div class="wh-wrap">' +
    '<div class="wh-kpis" id="wh-kpis">' +
    whKpiCard("#3b82f6", "—", "Позиций на складе") +
    whKpiCard("#10b981", "—", "Принято сегодня") +
    whKpiCard("#f59e0b", "—", "Движений за смену") +
    whKpiCard("#ef4444", "—", "Требует внимания") +
    "</div>" +
    '<div class="wh-toolbar">' +
    '<div class="wh-tabs-wrap">' +
    tabsHtml +
    "</div>" +
    '<div class="wh-toolbar-right">' +
    '<div class="wh-srch-wrap">' +
    '<div class="wh-srch-toggle" id="wh-srch-toggle">' +
    '<button class="wh-srch-opt active" data-mode="name" onclick="whSetSrchMode(\'name\')">Наим.</button>' +
    '<button class="wh-srch-opt" data-mode="sku" onclick="whSetSrchMode(\'sku\')">Арт.</button>' +
    '<button class="wh-srch-opt" data-mode="mov" onclick="whSetSrchMode(\'mov\')">№ дв.</button>' +
    "</div>" +
    '<input class="form-inp wh-search" id="wh-q" placeholder="Поиск..." ' +
    'oninput="clearTimeout(WH_SRCH_T);WH_SRCH_T=setTimeout(function(){WH_PAGE=1;whLoadItems()},350)">' +
    "</div>" +
    '<button class="wh-btn-receipt" onclick="whOpenReceipt()">' +
    '<span class="wh-btn-arrow">↧</span> Оприходовать' +
    "</button>" +
    "</div>" +
    "</div>" +
    '<div class="wh-grid">' +
    '<div class="wh-tbl-card">' +
    '<table class="wh-table">' +
    '<thead><tr class="wh-thead-row">' +
    '<th class="wh-th wh-th-sku">Арт.</th>' +
    '<th class="wh-th">Позиция</th>' +
    '<th class="wh-th">Склад · ячейка</th>' +
    '<th class="wh-th wh-th-bal">Остаток / мин</th>' +
    '<th class="wh-th wh-th-r">Резерв</th>' +
    '<th class="wh-th wh-th-r">Приход</th>' +
    '<th class="wh-th">Статус</th>' +
    "</tr></thead>" +
    '<tbody id="wh-tbody">' +
    '<tr><td colspan="7" class="wh-empty">Загрузка…</td></tr>' +
    "</tbody>" +
    "</table>" +
    "</div>" +
    '<div class="wh-right">' +
    '<div class="wh-panel">' +
    '<div class="wh-panel-hd">' +
    '<span class="wh-panel-title">Движения за смену</span>' +
    '<span class="wh-panel-date" id="wh-mov-date">' +
    new Date().toLocaleDateString("ru", { day: "2-digit", month: "2-digit" }) +
    "</span>" +
    "</div>" +
    '<div id="wh-movements"><div class="wh-empty">Загрузка…</div></div>' +
    "</div>" +
    '<div class="wh-panel">' +
    '<div class="wh-panel-hd">' +
    '<span class="wh-panel-title">Требует внимания</span>' +
    "</div>" +
    '<div id="wh-low"><div class="wh-empty">Загрузка…</div></div>' +
    "</div>" +
    "</div>" +
    "</div>" +
    "</div>" +
    // Item card modal
    '<div id="wh-card-modal" class="wh-modal-bg" style="display:none" onclick="if(event.target===this)whCloseCard()">' +
    '<div class="wh-modal wh-card-modal">' +
    '<div class="wh-modal-hd">' +
    '<span class="wh-modal-title" id="wh-card-title">Карточка позиции</span>' +
    '<button class="wh-modal-close" onclick="whCloseCard()">✕</button>' +
    "</div>" +
    '<div id="wh-card-info"></div>' +
    '<div class="wh-card-hist-hd">История движений</div>' +
    '<div class="wh-card-hist" id="wh-card-hist"><div class="wh-empty">Загрузка…</div></div>' +
    '<div class="wh-modal-foot">' +
    '<button class="topbar-btn" onclick="whCloseCard()">Закрыть</button>' +
    '<button class="topbar-btn btn-accent" onclick="whOpenReceiptForCard()">+ Движение</button>' +
    "</div>" +
    "</div>" +
    "</div>" +
    // Movement detail drawer
    '<div id="wh-mov-drawer-overlay" class="wh-drawer-overlay" onclick="whCloseMovDrawer()"></div>' +
    '<div id="wh-mov-drawer" class="wh-drawer">' +
    '<div class="wh-drawer-hd">' +
    '<span class="wh-drawer-title">Детали движения</span>' +
    '<button class="wh-drawer-close" onclick="whCloseMovDrawer()">✕</button>' +
    "</div>" +
    '<div class="wh-drawer-body" id="wh-drawer-body"></div>' +
    "</div>" +
    // Receipt modal
    '<div id="wh-receipt-modal" class="wh-modal-bg" style="display:none" onclick="if(event.target===this)whCloseReceipt()">' +
    '<div class="wh-modal">' +
    '<div class="wh-modal-hd">' +
    '<span class="wh-modal-title">Движение по складу</span>' +
    '<button class="wh-modal-close" onclick="whCloseReceipt()">✕</button>' +
    "</div>" +
    '<div class="wh-modal-err" id="wh-receipt-err"></div>' +
    '<div class="wh-form-grid">' +
    '<div class="wh-form-field wh-f-full">' +
    '<label class="wh-lbl req">Наименование</label>' +
    '<div class="wh-name-row">' +
    '<span class="wh-sku-badge" id="wh-item-sku-badge" style="display:none"></span>' +
    '<div class="combo-wrap" style="flex:1;min-width:0">' +
    '<input class="form-inp" id="wh-item-name" placeholder="Начните вводить наименование…" autocomplete="off" ' +
    'oninput="whItemSearch(this.value)">' +
    '<div class="combo-dd" id="wh-item-dd"></div>' +
    "</div>" +
    "</div>" +
    '<input type="hidden" id="wh-item-id">' +
    "</div>" +
    '<div class="wh-form-field">' +
    '<label class="wh-lbl req">Операция</label>' +
    '<select class="form-inp" id="wh-op" onchange="whOnOpChange()">' +
    "<option>Приход</option><option>Расход</option>" +
    "<option>Перемещение</option><option>Списание</option>" +
    "</select>" +
    "</div>" +
    '<div class="wh-form-field">' +
    '<label class="wh-lbl req">Количество</label>' +
    '<div style="display:flex;gap:6px">' +
    '<input class="form-inp" id="wh-qty" type="number" min="0.001" step="any" placeholder="0" style="flex:1">' +
    '<select class="form-inp" id="wh-unit" style="width:90px">' +
    "<option>шт</option><option>кг</option><option>л</option>" +
    "<option>м</option><option>уп</option>" +
    "</select>" +
    "</div>" +
    '<div id="wh-qty-avail" style="display:none;margin-top:4px;font-size:12px"></div>' +
    '<input type="hidden" id="wh-item-qty">' +
    "</div>" +
    '<div class="wh-form-field" id="wh-field-warehouse">' +
    '<label class="wh-lbl">Склад</label>' +
    '<select class="form-inp" id="wh-warehouse"><option value="">— Выбрать —</option></select>' +
    "</div>" +
    '<div class="wh-form-field" id="wh-field-address">' +
    '<label class="wh-lbl">Адрес хранения</label>' +
    '<input class="form-inp" id="wh-address" placeholder="1-4-3">' +
    "</div>" +
    '<div class="wh-form-field" id="wh-field-supplier">' +
    '<label class="wh-lbl">Поставщик</label>' +
    '<div class="combo-wrap">' +
    '<input class="form-inp" id="wh-supplier" placeholder="Название поставщика" autocomplete="off" oninput="whSupplierSearch(this.value)">' +
    '<div class="combo-dd" id="wh-supplier-dd"></div>' +
    "</div>" +
    "</div>" +
    '<div class="wh-form-field" id="wh-field-doc-num">' +
    '<label class="wh-lbl">№ документа</label>' +
    '<input class="form-inp" id="wh-doc-num" placeholder="УПД-2026-001">' +
    "</div>" +
    '<div class="wh-form-field">' +
    '<label class="wh-lbl">Дата документа</label>' +
    '<input class="form-inp" id="wh-doc-date" type="date">' +
    "</div>" +
    '<div class="wh-form-field">' +
    '<label class="wh-lbl">Тип документа</label>' +
    '<select class="form-inp" id="wh-doc-type"><option value="">— Тип документа —</option></select>' +
    "</div>" +
    '<div class="wh-form-field">' +
    '<label class="wh-lbl">Заказ</label>' +
    '<div class="combo-wrap">' +
    '<input class="form-inp" id="wh-order-ref" placeholder="208ПП-2026-01" autocomplete="off" oninput="whOrderSearch(this.value)">' +
    '<div class="combo-dd" id="wh-order-dd"></div>' +
    "</div>" +
    "</div>" +
    '<div class="wh-form-field wh-f-full">' +
    '<label class="wh-lbl">Комментарий</label>' +
    '<input class="form-inp" id="wh-comments" placeholder="Примечание">' +
    "</div>" +
    "</div>" +
    '<div class="wh-modal-foot">' +
    '<button class="topbar-btn" onclick="whCloseReceipt()">Отмена</button>' +
    '<button class="topbar-btn btn-accent" id="wh-receipt-submit-btn" onclick="whSubmitReceipt()">Записать движение</button>' +
    "</div>" +
    "</div>" +
    "</div>";
}

function whKpiCard(color, value, label) {
  return (
    '<div class="wh-kpi-card">' +
    '<span class="wh-kpi-bar" style="background:' +
    color +
    '"></span>' +
    '<div><div class="wh-kpi-val">' +
    value +
    "</div>" +
    '<div class="wh-kpi-lbl">' +
    label +
    "</div></div>" +
    "</div>"
  );
}

// refresh all
function whRefreshAll() {
  whLoadKpis();
  whLoadItems();
  whLoadMovements();
  whLoadLow();
}

// KPIs
function whLoadKpis() {
  http("GET", "/api/warehouse/kpis", null, function (res) {
    if (!res.ok) return;
    var cards = document.querySelectorAll("#wh-kpis .wh-kpi-card");
    res.kpis.forEach(function (k, i) {
      var el = cards[i] && cards[i].querySelector(".wh-kpi-val");
      if (el) el.textContent = k.value;
    });
  });
}

// Items table
function whLoadItems() {
  var q = (document.getElementById("wh-q") || {}).value || "";
  var url = "/api/warehouse/items?page=" + WH_PAGE;
  if (WH_TAB !== "all") url += "&warehouse=" + encodeURIComponent(WH_TAB);
  if (q && WH_SRCH_MODE === "sku") url += "&sku=" + encodeURIComponent(q);
  else if (q && WH_SRCH_MODE === "mov")
    url += "&mov_num=" + encodeURIComponent(q);
  else if (q) url += "&q=" + encodeURIComponent(q);

  var tbody = document.getElementById("wh-tbody");
  if (!tbody) return;

  http("GET", url, null, function (res) {
    if (!res.ok) {
      tbody.innerHTML =
        '<tr><td colspan="6" class="wh-empty">Ошибка загрузки</td></tr>';
      return;
    }
    if (!res.rows.length) {
      tbody.innerHTML =
        '<tr><td colspan="6" class="wh-empty">Нет позиций</td></tr>';
      return;
    }
    if (WH_SRCH_MODE === "mov" && res.rows.length === 1) {
      setTimeout(function () {
        whOpenCard(res.rows[0].id);
      }, 50);
    }
    tbody.innerHTML = res.rows
      .map(function (i) {
        var qty = parseFloat(i.qty) || 0;
        var minQty = parseFloat(i.min_qty) || 0;
        var pct = minQty > 0 ? Math.min(qty / minQty, 1) : qty > 0 ? 1 : 0;
        var barClr = pct >= 1 ? "#10b981" : pct >= 0.5 ? "#f59e0b" : "#ef4444";
        var st =
          minQty > 0 && qty < minQty
            ? qty <= 0
              ? {
                  label: "Критично",
                  color: "#ef4444",
                  bg: "rgba(239,68,68,.12)",
                }
              : { label: "Мало", color: "#f59e0b", bg: "rgba(245,158,11,.12)" }
            : { label: "Норма", color: "#10b981", bg: "rgba(16,185,129,.12)" };
        var name = i.name || "";
        var grade = i.material_type || "";
        return (
          '<tr class="wh-row wh-row-click" onclick="whOpenCard(' +
          i.id +
          ')">' +
          '<td class="wh-td wh-td-sku"><span class="wh-sku-badge">' +
          whE(i.sku || "—") +
          "</span></td>" +
          '<td class="wh-td">' +
          '<div class="wh-name" title="' +
          whE(name) +
          '">' +
          whE(name.length > 50 ? name.slice(0, 50) + "…" : name) +
          "</div>" +
          (grade ? '<div class="wh-grade">' + whE(grade) + "</div>" : "") +
          "</td>" +
          '<td class="wh-td wh-loc">' +
          whE(i.address || "—") +
          "</td>" +
          '<td class="wh-td wh-td-bal">' +
          '<div class="wh-bal-row">' +
          '<span class="wh-bal-val">' +
          whFmt(qty) +
          "</span>" +
          '<span class="wh-bal-unit">' +
          whE(i.unit || "шт") +
          "</span>" +
          (minQty > 0
            ? '<span class="wh-bal-sep">/</span>' +
              '<span class="wh-bal-min' +
              (qty < minQty ? " wh-bal-min-low" : "") +
              '">' +
              whFmt(minQty) +
              " мин" +
              "</span>"
            : "") +
          "</div>" +
          "</td>" +
          '<td class="wh-td wh-td-r">' +
          whFmt(parseFloat(i.reserved) || 0) +
          "</td>" +
          '<td class="wh-td wh-td-r wh-income">+0</td>' +
          '<td class="wh-td">' +
          '<span class="wh-badge" style="color:' +
          st.color +
          ";background:" +
          st.bg +
          '">' +
          '<span class="wh-badge-dot"></span>' +
          st.label +
          "</span>" +
          "</td>" +
          "</tr>"
        );
      })
      .join("");
  });
}

// Movements panel
var WH_OP_MAP = {
  Приход: { glyph: "↑", color: "#10b981" },
  Расход: { glyph: "↓", color: "#ef4444" },
  Перемещение: { glyph: "↔", color: "#3b82f6" },
  Списание: { glyph: "×", color: "#94a3b8" },
};

function whLoadMovements() {
  var el = document.getElementById("wh-movements");
  if (!el) return;
  http("GET", "/api/warehouse/movements", null, function (res) {
    if (!res.ok || !res.rows.length) {
      el.innerHTML = '<div class="wh-empty">Нет движений сегодня</div>';
      return;
    }
    WH_TODAY_MOVS = res.rows;
    el.innerHTML = res.rows
      .map(function (m, idx) {
        var op = WH_OP_MAP[m.operation] || { glyph: "·", color: "#94a3b8" };
        var dClr = m.operation === "Приход" ? "#10b981" : "#ef4444";
        var sign = m.operation === "Приход" ? "+" : "-";
        var dStr = sign + whFmt(parseFloat(m.qty)) + " " + (m.unit || "");
        var name = m.item_name || m.item_full_name || "—";
        var d = new Date(m.created_at);
        var tStr = pad2(d.getHours()) + ":" + pad2(d.getMinutes());
        return (
          '<div class="wh-mov-row wh-mov-row-click" onclick="whOpenMovDrawerDash(' +
          idx +
          ')">' +
          '<span class="wh-mov-time">' +
          tStr +
          "</span>" +
          '<span class="wh-mov-glyph" style="color:' +
          op.color +
          '">' +
          op.glyph +
          "</span>" +
          '<div class="wh-mov-info">' +
          '<div class="wh-mov-name">' +
          whE(name.length > 35 ? name.slice(0, 35) + "…" : name) +
          "</div>" +
          '<div class="wh-mov-sub">' +
          whE(m.operation) +
          (m.doc_number
            ? ' · <span class="wh-sku-badge" style="font-size:10px">' +
              whE(m.doc_number) +
              "</span>"
            : "") +
          "</div>" +
          "</div>" +
          '<span class="wh-mov-delta" style="color:' +
          dClr +
          '">' +
          dStr +
          "</span>" +
          "</div>"
        );
      })
      .join("");
  });
}


// Low-stock panel
function whLoadLow() {
  var el = document.getElementById("wh-low");
  if (!el) return;
  http("GET", "/api/warehouse/low", null, function (res) {
    if (!res.ok || !res.rows.length) {
      el.innerHTML = '<div class="wh-empty">Всё в норме</div>';
      return;
    }
    el.innerHTML = res.rows
      .map(function (l) {
        var qty = parseFloat(l.qty) || 0;
        var minQty = parseFloat(l.min_qty) || 0;
        var crit = qty <= 0;
        var dotClr = crit ? "#ef4444" : "#f59e0b";
        var stLbl = crit ? "Критично" : "Мало";
        var stClr = crit ? "#ef4444" : "#f59e0b";
        var detail =
          whFmt(qty) + " из " + whFmt(minQty) + " " + (l.unit || "шт");
        var name = l.name || "";
        return (
          '<div class="wh-low-row wh-low-row-click" onclick="whOpenCard(' +
          l.id +
          ')">' +
          '<span class="wh-low-dot" style="background:' +
          dotClr +
          '"></span>' +
          '<div class="wh-low-info">' +
          '<div class="wh-low-name">' +
          whE(name.length > 30 ? name.slice(0, 30) + "…" : name) +
          "</div>" +
          '<div class="wh-low-sub">' +
          whE(detail) +
          "</div>" +
          "</div>" +
          '<span class="wh-low-st" style="color:' +
          stClr +
          '">' +
          stLbl +
          "</span>" +
          "</div>"
        );
      })
      .join("");
  });
}

// Search mode toggle
function whSetSrchMode(mode) {
  WH_SRCH_MODE = mode;
  document.querySelectorAll(".wh-srch-opt").forEach(function (b) {
    b.classList.toggle("active", b.dataset.mode === mode);
  });
  var inp = document.getElementById("wh-q");
  if (inp)
    inp.placeholder =
      mode === "sku"
        ? "Поиск по арт..."
        : mode === "mov"
          ? "Номер движения..."
          : "Поиск...";
  WH_PAGE = 1;
  whLoadItems();
}

// Tab switch
function whSetTab(id) {
  WH_TAB = id;
  WH_PAGE = 1;
  document.querySelectorAll("[data-wh-tab]").forEach(function (btn) {
    btn.classList.toggle("active", btn.dataset.whTab === id);
  });
  whLoadItems();
}

// Receipt modal
function whOpenReceipt() {
  var modal = document.getElementById("wh-receipt-modal");
  if (!modal) return;

  document.getElementById("wh-op").value = "Приход";
  document.getElementById("wh-doc-date").value = new Date()
    .toISOString()
    .slice(0, 10);
  [
    "wh-item-name",
    "wh-item-qty",
    "wh-qty",
    "wh-address",
    "wh-supplier",
    "wh-doc-num",
    "wh-order-ref",
    "wh-comments",
  ].forEach(function (id) {
    var el = document.getElementById(id);
    if (el) el.value = "";
  });
  document.getElementById("wh-item-id").value = "";
  document.getElementById("wh-receipt-err").textContent = "";
  var skuBadge = document.getElementById("wh-item-sku-badge");
  if (skuBadge) {
    skuBadge.textContent = "";
    skuBadge.style.display = "none";
  }

  if (WH_REFS) {
    var whSel = document.getElementById("wh-warehouse");
    var unitSel = document.getElementById("wh-unit");
    var dtSel = document.getElementById("wh-doc-type");
    whSel.innerHTML =
      '<option value="">— Выбрать —</option>' +
      WH_REFS.warehouses
        .map(function (w) {
          return "<option>" + whE(w) + "</option>";
        })
        .join("");
    unitSel.innerHTML = WH_REFS.units
      .map(function (u) {
        return (
          "<option" +
          (u === "шт" ? " selected" : "") +
          ">" +
          whE(u) +
          "</option>"
        );
      })
      .join("");
    dtSel.innerHTML =
      '<option value="">— Тип документа —</option>' +
      WH_REFS.docTypes
        .map(function (d) {
          return "<option>" + whE(d) + "</option>";
        })
        .join("");
  }

  whOnOpChange();
  modal.style.display = "flex";
}

function whCloseReceipt() {
  var m = document.getElementById("wh-receipt-modal");
  if (m) m.style.display = "none";
}

function whOnOpChange() {
  var op = (document.getElementById("wh-op") || {}).value || "Приход";
  var isRaskhod = op === "Расход";

  var fSupplier = document.getElementById("wh-field-supplier");
  var fDocNum = document.getElementById("wh-field-doc-num");
  if (fSupplier) fSupplier.style.display = isRaskhod ? "none" : "";
  if (fDocNum) fDocNum.style.display = isRaskhod ? "none" : "";

  var whSel = document.getElementById("wh-warehouse");
  var addrInp = document.getElementById("wh-address");
  if (whSel) whSel.disabled = isRaskhod;
  if (addrInp) addrInp.readOnly = isRaskhod;

  if (isRaskhod) {
    var dtSel = document.getElementById("wh-doc-type");
    if (
      dtSel &&
      dtSel.querySelector('option[value="Накладная"], option:not([value])')
    ) {
      dtSel.value = "Накладная";
    }
  }
  whUpdateQtyLimit();
}

var WH_ORDER_T = null;
function whOrderSearch(q) {
  var dd = document.getElementById("wh-order-dd");
  if (!dd) return;
  clearTimeout(WH_ORDER_T);
  if (!q || q.length < 1) {
    dd.classList.remove("show");
    return;
  }
  WH_ORDER_T = setTimeout(function () {
    http(
      "GET",
      "/api/warehouse/orders?q=" + encodeURIComponent(q),
      null,
      function (res) {
        if (!res.ok || !res.rows.length) {
          dd.classList.remove("show");
          return;
        }
        dd.innerHTML = res.rows
          .map(function (r) {
            return (
              '<div class="combo-dd-item" onclick="whPickOrder(\'' +
              esc2(r) +
              "')\">" +
              whE(r) +
              "</div>"
            );
          })
          .join("");
        dd.classList.add("show");
      },
    );
  }, 200);
}
function whPickOrder(val) {
  var inp = document.getElementById("wh-order-ref");
  if (inp) inp.value = val;
  var dd = document.getElementById("wh-order-dd");
  if (dd) dd.classList.remove("show");
}

function whItemSearch(q) {
  var dd = document.getElementById("wh-item-dd");
  if (!dd) return;
  clearTimeout(WH_ITEM_T);
  document.getElementById("wh-item-id").value = "";
  var skuBadge = document.getElementById("wh-item-sku-badge");
  if (skuBadge) {
    skuBadge.textContent = "";
    skuBadge.style.display = "none";
  }
  if (!q || q.length < 2) {
    dd.classList.remove("show");
    return;
  }
  WH_ITEM_T = setTimeout(function () {
    http(
      "GET",
      "/api/warehouse/item-search?q=" + encodeURIComponent(q),
      null,
      function (res) {
        if (!res.ok || !res.rows.length) {
          dd.classList.remove("show");
          return;
        }
        dd.innerHTML = res.rows
          .map(function (r) {
            var n = r.name || "";
            return (
              '<div class="combo-dd-item wh-dd-item-row" onclick="whPickItem(' +
              r.id +
              ",'" +
              esc2(n) +
              "','" +
              esc2(r.unit || "шт") +
              "','" +
              esc2(r.material_type || "") +
              "','" +
              esc2(r.address || "") +
              "','" +
              esc2(r.sku || "") +
              "'," +
              (parseFloat(r.qty) || 0) +
              ')">' +
              '<span class="wh-sku-badge wh-dd-sku">' +
              whE(r.sku || "—") +
              "</span>" +
              '<div class="wh-dd-info">' +
              '<div style="font-weight:600;font-size:12.5px">' +
              whE(n.length > 60 ? n.slice(0, 60) + "…" : n) +
              "</div>" +
              '<div style="font-size:11px;color:var(--text3)">' +
              whE(r.material_type || "") +
              " · " +
              whFmt(parseFloat(r.qty) || 0) +
              " " +
              whE(r.unit || "шт") +
              "</div>" +
              "</div>" +
              "</div>"
            );
          })
          .join("");
        dd.classList.add("show");
      },
    );
  }, 250);
}

function whPickItem(id, name, unit, type, address, sku, qty) {
  document.getElementById("wh-item-id").value = id;
  document.getElementById("wh-item-name").value = name;
  document.getElementById("wh-item-qty").value = qty !== undefined ? qty : "";
  var uSel = document.getElementById("wh-unit");
  if (uSel && unit) uSel.value = unit;
  var wSel = document.getElementById("wh-warehouse");
  if (wSel && type) wSel.value = type;
  var aInp = document.getElementById("wh-address");
  if (aInp && address && !aInp.value) aInp.value = address;
  var badge = document.getElementById("wh-item-sku-badge");
  if (badge) {
    badge.textContent = sku || "";
    badge.style.display = sku ? "" : "none";
  }
  var dd = document.getElementById("wh-item-dd");
  if (dd) dd.classList.remove("show");
  whUpdateQtyLimit();
}

function whUpdateQtyLimit() {
  var op = (document.getElementById("wh-op") || {}).value || "";
  var avail =
    parseFloat((document.getElementById("wh-item-qty") || {}).value) || 0;
  var unitVal = (document.getElementById("wh-unit") || {}).value || "шт";
  var qtyInp = document.getElementById("wh-qty");
  var info = document.getElementById("wh-qty-avail");
  var limited = op === "Расход" || op === "Списание" || op === "Перемещение";

  if (!info || !qtyInp) return;

  if (limited && document.getElementById("wh-item-id").value) {
    qtyInp.max = avail;
    var opLabel =
      op === "Расход"
        ? "расход невозможен"
        : op === "Списание"
          ? "списание невозможно"
          : "перемещение невозможно";
    if (avail <= 0) {
      info.innerHTML =
        '<span style="color:#ef4444;font-weight:600">⚠ На складе: 0 ' +
        whE(unitVal) +
        " — " +
        opLabel +
        "</span>";
    } else {
      info.innerHTML =
        '<span style="color:var(--text3)">На складе: <b style="color:var(--text)">' +
        whFmt(avail) +
        " " +
        whE(unitVal) +
        "</b></span>";
    }
    info.style.display = "";
  } else {
    qtyInp.removeAttribute("max");
    info.style.display = "none";
  }
}

function whSubmitReceipt() {
  var err = document.getElementById("wh-receipt-err");
  err.textContent = "";
  var data = {
    operation: document.getElementById("wh-op").value,
    itemId: document.getElementById("wh-item-id").value || null,
    itemName: document.getElementById("wh-item-name").value.trim(),
    qty: document.getElementById("wh-qty").value,
    unit: document.getElementById("wh-unit").value,
    warehouse: document.getElementById("wh-warehouse").value,
    address: document.getElementById("wh-address").value.trim(),
    supplier: document.getElementById("wh-supplier").value.trim(),
    docNumber: document.getElementById("wh-doc-num").value.trim(),
    docDate: document.getElementById("wh-doc-date").value,
    docType: document.getElementById("wh-doc-type").value,
    orderRef: document.getElementById("wh-order-ref").value.trim(),
    comments: document.getElementById("wh-comments").value.trim(),
  };
  if (!data.itemName) {
    err.textContent = "Укажите наименование";
    return;
  }
  if (!data.qty || parseFloat(data.qty) <= 0) {
    err.textContent = "Укажите количество > 0";
    return;
  }
  var availQty = parseFloat(
    (document.getElementById("wh-item-qty") || {}).value,
  );
  if (
    (data.operation === "Расход" ||
      data.operation === "Списание" ||
      data.operation === "Перемещение") &&
    !isNaN(availQty)
  ) {
    var opErr =
      data.operation === "Расход"
        ? "Нельзя списать в расход — на складе 0"
        : data.operation === "Списание"
          ? "Нельзя списать — на складе 0"
          : "Нельзя переместить — на складе 0";
    if (availQty <= 0) {
      err.textContent = opErr;
      return;
    }
    if (parseFloat(data.qty) > availQty) {
      err.textContent =
        "Количество превышает остаток на складе (" +
        whFmt(availQty) +
        " " +
        data.unit +
        ")";
      return;
    }
  }

  var btn = document.getElementById("wh-receipt-submit-btn");
  btn.disabled = true;
  http("POST", "/api/warehouse/movement", data, function (res) {
    btn.disabled = false;
    if (!res.ok) {
      err.textContent = res.error || "Ошибка";
      return;
    }
    whCloseReceipt();
    showToast("Движение записано");
    whRefreshAll();
    modalReturn(); // ← вернуться к предыдущей модалке
  });
}

// Item card
function whOpenCard(id) {
  var modal = document.getElementById("wh-card-modal");
  if (!modal) return;
  WH_CARD_ITEM = null;
  WH_CARD_MOVS = [];
  document.getElementById("wh-card-title").textContent = "Загрузка…";
  document.getElementById("wh-card-info").innerHTML = "";
  document.getElementById("wh-card-hist").innerHTML =
    '<div class="wh-empty">Загрузка…</div>';
  modal.style.display = "flex";

  http("GET", "/api/warehouse/item/" + id + "/history", null, function (res) {
    if (!res.ok) {
      document.getElementById("wh-card-hist").innerHTML =
        '<div class="wh-empty">Ошибка загрузки</div>';
      return;
    }
    var item = res.item;
    WH_CARD_ITEM = item;
    WH_CARD_MOVS = res.movements;
    var titleEl = document.getElementById("wh-card-title");
    titleEl.textContent =
      item.name.length > 65 ? item.name.slice(0, 65) + "…" : item.name;
    titleEl.title = item.name;

    var qty = parseFloat(item.qty) || 0;
    var minQty = parseFloat(item.min_qty) || 0;
    var stats = [
      { val: whFmt(qty) + " " + whE(item.unit || "шт"), lbl: "Остаток" },
    ];
    if (minQty > 0) stats.push({ val: whFmt(minQty), lbl: "Минимум" });
    if (item.material_type)
      stats.push({ val: whE(item.material_type), lbl: "Склад" });
    if (item.address) stats.push({ val: whE(item.address), lbl: "Адрес" });
    if (item.comments) stats.push({ val: whE(item.comments), lbl: "Примечание" });
    var skuHtml = item.sku
      ? '<div class="wh-card-sku"><span class="wh-sku-badge">' +
        whE(item.sku) +
        "</span></div>"
      : "";

    document.getElementById("wh-card-info").innerHTML =
      skuHtml +
        '<div class="wh-card-stats" id="wh-card-stats">' +
      stats
        .map(function (s) {
          return (
            '<div class="wh-card-stat">' +
            '<span class="wh-card-stat-val">' +
            s.val +
            "</span>" +
            '<span class="wh-card-stat-lbl">' +
            s.lbl +
            "</span>" +
            "</div>"
          );
        })
        .join("") +
      "</div>" +
      '<div class="wh-card-edit">' +
      '<div class="wh-card-edit-row">' +
      '<div class="wh-card-edit-field">' +
      '<label class="wh-lbl">Мин. остаток</label>' +
      '<input class="form-inp wh-card-edit-inp" id="wh-card-minqty" type="number" min="0" step="any" ' +
      'value="' +
      whE(String(minQty)) +
      '" placeholder="0">' +
      "</div>" +
      '<div class="wh-card-edit-field" style="flex:2">' +
      '<label class="wh-lbl">Адрес хранения</label>' +
      '<input class="form-inp wh-card-edit-inp" id="wh-card-address" ' +
      'value="' +
      whE(item.address || "") +
      '" placeholder="1-4-3">' +
      "</div>" +
      '<div class="wh-card-edit-field" style="flex:2">' +
      '<label class="wh-lbl">Комментарий</label>' +
      '<input class="form-inp wh-card-edit-inp" id="wh-card-comments" ' +
      'value="' +
      whE(item.comments || "") +
      '" placeholder="Примечание">' +
      "</div>" +
      '<button class="topbar-btn btn-accent wh-card-save-btn" id="wh-card-save-btn" onclick="whSaveCard(' +
      item.id +
      ')">Сохранить</button>' +
      "</div>" +
      '<div class="wh-card-edit-msg" id="wh-card-edit-msg"></div>' +
      "</div>";

    var histEl = document.getElementById("wh-card-hist");
    if (!res.movements.length) {
      histEl.innerHTML = '<div class="wh-empty">Движений ещё нет</div>';
      return;
    }
    histEl.innerHTML =
      '<table class="wh-table" style="min-width:1200px">' +
      '<thead><tr class="wh-thead-row">' +
      '<th class="wh-th wh-th-sku">№</th>' +
      '<th class="wh-th" style="white-space:nowrap">Дата / время</th>' +
      '<th class="wh-th">Операция</th>' +
      '<th class="wh-th wh-th-r">Кол-во</th>' +
      '<th class="wh-th">Поставщик / Получатель</th>' +
      '<th class="wh-th">Заказ / Заявка</th>' +
      '<th class="wh-th">Документ</th>' +
      '<th class="wh-th">Адрес</th>' +
      '<th class="wh-th">Кто записал</th>' +
      '<th class="wh-th">Комментарий</th>' +
      "</tr></thead>" +
      "<tbody>" +
      res.movements
        .map(function (m, idx) {
          var op = WH_OP_MAP[m.operation] || { glyph: "·", color: "#94a3b8" };
          var dClr =
            m.operation === "Приход"
              ? "#10b981"
              : m.operation === "Расход" || m.operation === "Списание"
                ? "#ef4444"
                : "#3b82f6";
          var sign =
            m.operation === "Приход"
              ? "+"
              : m.operation === "Расход" || m.operation === "Списание"
                ? "−"
                : "";
          var d = new Date(m.created_at);
          var ds =
            pad2(d.getDate()) +
            "." +
            pad2(d.getMonth() + 1) +
            "." +
            d.getFullYear() +
            " " +
            pad2(d.getHours()) +
            ":" +
            pad2(d.getMinutes());
          var ref = m.order_ref || m.request_ref || "";
          var who = (m.created_by_name || "").trim();
          return (
            '<tr class="wh-row wh-hist-row-click" onclick="whOpenMovDrawer(' +
            idx +
            ')">' +
            '<td class="wh-td wh-td-sku">' +
            (m.mov_num
              ? '<span class="wh-sku-badge">' + whE(m.mov_num) + "</span>"
              : "—") +
            "</td>" +
            '<td class="wh-td wh-td-date">' +
            ds +
            "</td>" +
            '<td class="wh-td" style="white-space:nowrap">' +
            '<span style="color:' +
            op.color +
            '">' +
            op.glyph +
            "</span> " +
            whE(m.operation) +
            "</td>" +
            '<td class="wh-td wh-td-r" style="color:' +
            dClr +
            ';font-weight:600">' +
            sign +
            whFmt(parseFloat(m.qty)) +
            " " +
            whE(m.unit || "") +
            "</td>" +
            '<td class="wh-td wh-td-trunc">' +
            whE(whTrunc(m.supplier || "", 22) || "—") +
            "</td>" +
            '<td class="wh-td wh-td-trunc">' +
            whE(whTrunc(ref, 18) || "—") +
            "</td>" +
            '<td class="wh-td">' +
            (m.doc_number
              ? '<div style="font-size:12px">' +
                whE(whTrunc(m.doc_number, 14)) +
                "</div>" +
                (m.doc_type
                  ? '<div style="font-size:10px;color:var(--text3)">' +
                    whE(m.doc_type) +
                    "</div>"
                  : "")
              : "—") +
            "</td>" +
            '<td class="wh-td wh-td-trunc" style="font-family:var(--font-mono);font-size:11.5px">' +
            whE(m.address || "—") +
            "</td>" +
            '<td class="wh-td wh-td-trunc">' +
            whE(whTrunc(who || "—", 16)) +
            "</td>" +
            '<td class="wh-td wh-td-trunc" style="font-size:11.5px;color:var(--text2)">' +
            whE(whTrunc(m.comments || "", 28) || "—") +
            "</td>" +
            "</tr>"
          );
        })
        .join("") +
      "</tbody>" +
      "</table>";
  });
}

function whSaveCard(id) {
  var btn = document.getElementById("wh-card-save-btn");
  var msg = document.getElementById("wh-card-edit-msg");
  if (!btn) return;
  btn.disabled = true;
  msg.textContent = "";
  var data = {
    min_qty: document.getElementById("wh-card-minqty").value,
    address: document.getElementById("wh-card-address").value.trim(),
    comments: document.getElementById("wh-card-comments").value.trim(),
  };
  http("PATCH", "/api/warehouse/items/" + id, data, function (res) {
    btn.disabled = false;
    if (!res.ok) {
      msg.style.color = "var(--red-text)";
      msg.textContent = res.error || "Ошибка";
      return;
    }
    msg.style.color = "#10b981";
    msg.textContent = "Сохранено";
    setTimeout(function () {
      if (msg) msg.textContent = "";
    }, 2000);
    if (WH_CARD_ITEM) {
      WH_CARD_ITEM.min_qty  = data.min_qty;
      WH_CARD_ITEM.address  = data.address;
      WH_CARD_ITEM.comments = data.comments;
      whRefreshCardStats();
    }
    whLoadItems();
    whLoadKpis();
    whLoadLow();
  });
}

function whRefreshCardStats() {
  var el = document.getElementById('wh-card-stats');
  if (!el || !WH_CARD_ITEM) return;
  var item   = WH_CARD_ITEM;
  var qty    = parseFloat(item.qty)    || 0;
  var minQty = parseFloat(item.min_qty)|| 0;
  var stats  = [{ val: whFmt(qty) + ' ' + whE(item.unit || 'шт'), lbl: 'Остаток' }];
  if (minQty > 0) stats.push({ val: whFmt(minQty), lbl: 'Минимум' });
  if (item.material_type) stats.push({ val: whE(item.material_type), lbl: 'Склад' });
  if (item.address) stats.push({ val: whE(item.address), lbl: 'Адрес' });
  if (item.comments) stats.push({ val: whE(item.comments), lbl: 'Примечание' });
  el.innerHTML = stats.map(function(s) {
    return '<div class="wh-card-stat">' +
      '<span class="wh-card-stat-val">' + s.val + '</span>' +
      '<span class="wh-card-stat-lbl">' + s.lbl + '</span>' +
    '</div>';
  }).join('');
}


function whCloseCard() {
  var m = document.getElementById("wh-card-modal");
  if (m) m.style.display = "none";
  WH_CARD_ITEM = null;
  WH_CARD_MOVS = [];
}

function whOpenReceiptForCard() {
  var saved = WH_CARD_ITEM;
  modalPush('wh-card', { id: saved.id }); // запонить место перехода
  whCloseCard();
  whOpenReceipt();
  if (!saved) return;
  setTimeout(function () {
    var nameEl = document.getElementById("wh-item-name");
    var idEl = document.getElementById("wh-item-id");
    if (nameEl) nameEl.value = saved.name;
    if (idEl) idEl.value = saved.id;
    var whSel = document.getElementById("wh-warehouse");
    if (whSel && saved.material_type) whSel.value = saved.material_type;
    var unitSel = document.getElementById("wh-unit");
    if (unitSel && saved.unit) unitSel.value = saved.unit;
    var addrInp = document.getElementById("wh-address");
    if (addrInp && saved.address) addrInp.value = saved.address;
    var badge = document.getElementById("wh-item-sku-badge");
    if (badge && saved.sku) {
      badge.textContent = saved.sku;
      badge.style.display = "";
    }
    var qtyEl = document.getElementById("wh-item-qty");
    if (qtyEl) qtyEl.value = parseFloat(saved.qty) || 0;
    whUpdateQtyLimit();
  }, 30);
}

var WH_TODAY_MOVS = [];

// Movement drawer
function whOpenMovDrawer(idx) {
  whOpenMovDrawerObj(WH_CARD_MOVS[idx]);
}
function whOpenMovDrawerDash(idx) {
  whOpenMovDrawerObj(WH_TODAY_MOVS[idx]);
}
function whOpenMovDrawerObj(m) {
  if (!m) return;
  var op = WH_OP_MAP[m.operation] || { glyph: "·", color: "#94a3b8" };
  var dClr =
    m.operation === "Приход"
      ? "#10b981"
      : m.operation === "Расход" || m.operation === "Списание"
        ? "#ef4444"
        : "#3b82f6";
  var sign =
    m.operation === "Приход"
      ? "+"
      : m.operation === "Расход" || m.operation === "Списание"
        ? "−"
        : "";
  var d = new Date(m.created_at);
  var ds =
    pad2(d.getDate()) +
    "." +
    pad2(d.getMonth() + 1) +
    "." +
    d.getFullYear() +
    " " +
    pad2(d.getHours()) +
    ":" +
    pad2(d.getMinutes());

  var rows = [
    [
      "№ движения",
      m.mov_num
        ? '<span class="wh-sku-badge">' + whE(m.mov_num) + "</span>"
        : "—",
    ],
    [
      "Операция",
      '<span style="display:inline-flex;align-items:center;gap:7px;color:' +
        dClr +
        ';font-weight:700;font-size:15px">' +
        op.glyph +
        " " +
        whE(m.operation) +
        "</span>",
    ],
    ["Дата и время", ds],
    [
      "Количество",
      '<span style="color:' +
        dClr +
        ';font-weight:700;font-size:16px;font-family:var(--font-mono)">' +
        sign +
        whFmt(parseFloat(m.qty)) +
        " " +
        whE(m.unit || "") +
        "</span>",
    ],
  ];
  if (m.supplier) rows.push(["Поставщик / Получатель", whE(m.supplier)]);
  if (m.legal_entity) rows.push(["Юридическое лицо", whE(m.legal_entity)]);
  if (m.warehouse) rows.push(["Склад", whE(m.warehouse)]);
  if (m.address)
    rows.push([
      "Адрес хранения",
      '<span style="font-family:var(--font-mono)">' +
        whE(m.address) +
        "</span>",
    ]);
  if (m.order_ref) rows.push(["Заказ", whE(m.order_ref)]);
  if (m.request_ref) rows.push(["Заявка", whE(m.request_ref)]);
  if (m.doc_number)
    rows.push([
      "Документ",
      whE(m.doc_number) +
        (m.doc_type
          ? ' <span style="color:var(--text3);font-size:11px">(' +
            whE(m.doc_type) +
            ")</span>"
          : ""),
    ]);
  if (m.doc_date)
    rows.push([
      "Дата документа",
      new Date(m.doc_date).toLocaleDateString("ru"),
    ]);
  if (m.comments) rows.push(["Комментарий", whE(m.comments)]);
  var who = (m.created_by_name || "").trim();
  if (who) rows.push(["Кто записал", whE(who)]);

  document.getElementById("wh-drawer-body").innerHTML = rows
    .map(function (r) {
      return (
        '<div class="wh-drawer-row">' +
        '<span class="wh-drawer-lbl">' +
        r[0] +
        "</span>" +
        '<span class="wh-drawer-val">' +
        r[1] +
        "</span>" +
        "</div>"
      );
    })
    .join("");

  var drawer = document.getElementById("wh-mov-drawer");
  var overlay = document.getElementById("wh-mov-drawer-overlay");
  if (drawer) drawer.classList.add("open");
  if (overlay) overlay.classList.add("open");
}

function whCloseMovDrawer() {
  var drawer = document.getElementById("wh-mov-drawer");
  var overlay = document.getElementById("wh-mov-drawer-overlay");
  if (drawer) drawer.classList.remove("open");
  if (overlay) overlay.classList.remove("open");
}

// helpers
function whFmt(v) {
  var n = parseFloat(v) || 0;
  if (n === 0) return "0";
  return n === Math.floor(n) ? n.toFixed(0) : (+n.toFixed(3)).toString();
}
function whE(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
function esc2(s) {
  return String(s).replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}
function pad2(n) {
  return n < 10 ? "0" + n : "" + n;
}
function whTrunc(s, n) {
  return s && s.length > n ? s.slice(0, n) + "…" : s || "";
}

function whSupplierSearch(q) {
  var dd = document.getElementById("wh-supplier-dd");
  if (!dd) return;
  clearTimeout(WH_SUP_T);
  if (!q || q.length < 2) {
    dd.classList.remove("show");
    return;
  }
  WH_SUP_T = setTimeout(function () {
    http(
      "GET",
      "/api/warehouse/suppliers?q=" + encodeURIComponent(q),
      null,
      function (res) {
        if (!res.ok || !res.rows.length) {
          dd.classList.remove("show");
          return;
        }
        dd.innerHTML = res.rows
          .map(function (s) {
            return (
              '<div class="combo-dd-item" onclick="whPickSupplier(\'' +
              esc2(s) +
              "')\">" +
              '<div style="font-size:12.5px">' +
              whE(s) +
              "</div>" +
              "</div>"
            );
          })
          .join("");
        dd.classList.add("show");
      },
    );
  }, 250);
}

function whPickSupplier(name) {
  var inp = document.getElementById("wh-supplier");
  if (inp) inp.value = name;
  var dd = document.getElementById("wh-supplier-dd");
  if (dd) dd.classList.remove("show");
}
