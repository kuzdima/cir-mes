// ============================================================
// app.js — Инициализация + навигация
// Все обработчики кнопок — inline в HTML
// ============================================================

// Modal stack (функция для возврата к прежней модаке после закрытия)
var MODAL_STACK = [];
function modalPush(name, args) {
  MODAL_STACK.push({ name: name, args: args });
}
function modalReturn() {
  var prev = MODAL_STACK.pop();
  if (!prev) return;
  setTimeout(function () {
    modalOpen(prev.name, prev.args);
  }, 150);
}
function modalOpen(name, args) {
  if (name === "wh-card") whOpenCard(args.id);
}

function showPanel(id) {
  localStorage.setItem('mes_last_panel', id);
  var titles = {
    nomenclature: "Номенклатура",
    production: "Производство",
    profile: "Личный кабинет",
    users: "Управление пользователями",
    crm: "CRM",
    feedback: "Обратная связь",
    warehouse: "Склад",
  };
  // Переключаем кнопки в топбаре
  var btnNom = document.getElementById("add-btn-nom");
  var btnProd = document.getElementById("add-btn-prod");
  if (btnNom) btnNom.style.display = id === "nomenclature" ? "" : "none";
  if (btnProd) btnProd.style.display = id === "production" ? "" : "none";
  // Показываем нужную панель
  document.querySelectorAll(".panel").forEach(function (p) {
    p.classList.remove("active");
  });
  document.querySelectorAll(".nav-item[data-panel]").forEach(function (n) {
    n.classList.remove("active");
  });
  // Специальные действия при открытии некоторых панелей
  var p = document.getElementById("panel-" + id);
  if (p) p.classList.add("active");
  document.getElementById("page-title").textContent = titles[id] || id;
  var ni = document.querySelector('.nav-item[data-panel="' + id + '"]');
  if (ni) ni.classList.add("active");
  if (id === "nomenclature") {
    var activeTab = document.querySelector(".chrome-tab.active");
    var tab = activeTab
      ? activeTab.id === "nom-tab-arc"
        ? "archive"
        : "techops"
      : "techops";
    switchNomTab(tab);
  }
  if (id === "production") {
    var activeTab = document.querySelector(
      "#panel-production .chrome-tab.active",
    );
    var tab = activeTab
      ? activeTab.id === "prod-tab-proj"
        ? "proj"
        : "ops"
      : "ops";
    switchProdTab(tab);
  }
  if (id === "profile" && USER) {
    var parts = (USER.name || "").split(" ");
    var initials =
      (
        ((parts[0] || "")[0] || "") + ((parts[1] || "")[0] || "")
      ).toUpperCase() || "??";
    document.getElementById("profile-av").textContent = initials;
    document.getElementById("profile-name").textContent = USER.name || "—";
    document.getElementById("profile-email").textContent = USER.email || "—";
    var rm = {
      admin: "Администратор",
      dispatcher: "Диспетчер",
      master: "Мастер",
      technologist: "Технолог",
      warehouse: "Кладовщик",
    };
    document.getElementById("profile-role").textContent =
      rm[USER.role] || USER.role;
    if (typeof loadProfileData === "function") loadProfileData();
    if (typeof loadMyRecords === "function") loadMyRecords();
  }
  if (id === "users" && typeof loadAllUsers === "function") {
    loadAllUsers();
  }
  if (id === "crm" && typeof crmInit === "function") {
    crmInit();
  }

  if (id === "feedback" && typeof initFeedback === "function") {
    initFeedback();
  }

  if (id === "warehouse" && typeof initWarehouse === "function") {
    initWarehouse();
  }
}

function handleAddBtn() {
  var activePanel = document.querySelector(".panel.active");
  if (activePanel && activePanel.id === "panel-production") {
    openProdForm();
  } else {
    openAddForm();
  }
}

function opsPage(dir) {
  OPS_PAGE += dir;
  if (OPS_PAGE < 1) OPS_PAGE = 1;
  loadTechOps();
}

// Init on DOM ready
document.addEventListener("DOMContentLoaded", function () {
  // Focus splash password
  var sp = document.getElementById("splash-pass");
  if (sp) sp.focus();

  // Restore session
  if (TOKEN && USER) {
    applyUser(USER);
  } else {
    if (typeof initArc === "function") initArc();
  }

  console.log("ЦИР MES загружен");
});

function openAddForm() {
  // Очищаем форму при каждом открытии
  var fields = [
    "tf-orderId",
    "tf-drawing",
    "tf-objectType",
    "tf-mainOrderId",
    "tf-makeQty",
    "tf-comments",
    "tf-noticeNumber",
    "tf-fullName",
    "tf-materialGrade",
    "tf-assortment",
    "tf-materialAmount",
    "tf-unitOfMeasure",
    "tf-coating",
    "tf-hardness",
    "tf-mass",
    "tf-dimensions",
  ];
  fields.forEach(function (id) {
    var el = document.getElementById(id);
    if (el) el.value = "";
  });
  // Очищаем таблицу операций
  var tbody = document.getElementById("tf-ops-body");
  if (tbody) tbody.innerHTML = "";
  // Очищаем аналоги
  var analogs = document.getElementById("tf-analogs-container");
  if (analogs) analogs.innerHTML = "";
  // Сброс действия
  var action = document.getElementById("tf-action");
  if (action) action.value = "Новое";
  var hint = document.getElementById("tf-action-hint");
  if (hint) hint.style.display = "none";
  // Скрываем сообщения
  var err = document.getElementById("tf-err");
  var ok = document.getElementById("tf-ok");
  if (err) err.classList.remove("show");
  if (ok) ok.classList.remove("show");
  // Автозаполняем ФИО из профиля текущего пользователя
  var fnEl = document.getElementById("tf-fullName");
  if (fnEl && typeof USER !== "undefined" && USER) fnEl.value = USER.name || "";
  // Добавляем пустую строку операции
  tfAddOp();
  // Показываем модалку
  document.getElementById("panel-techops-form").style.display = "block";
}

function closeAddForm() {
  document.getElementById("panel-techops-form").style.display = "none";
}

function switchNomTab(tab) {
  localStorage.setItem('mes_last_nom_tab', tab);
  document
    .getElementById("nom-tab-ops")
    .classList.toggle("active", tab === "techops");
  document
    .getElementById("nom-tab-arc")
    .classList.toggle("active", tab === "archive");
  document.getElementById("nom-content-ops").style.display =
    tab === "techops" ? "" : "none";
  document.getElementById("nom-content-arc").style.display =
    tab === "archive" ? "" : "none";
  document
    .getElementById("nom-tab-cat")
    .classList.toggle("active", tab === "catalogue");
  document.getElementById("nom-content-cat").style.display =
    tab === "catalogue" ? "" : "none";
  if (tab === "techops") loadTechOps();
  if (tab === "archive" && typeof arcLoadFromDB === "function") arcLoadFromDB();
  if (tab === "catalogue" && typeof catLoadFromDB === "function")
    catLoadFromDB();
}

function switchProdTab(tab) {
  localStorage.setItem('mes_last_prod_tab', tab);
  document
    .getElementById("prod-tab-ops")
    .classList.toggle("active", tab === "ops");
  document
    .getElementById("prod-tab-proj")
    .classList.toggle("active", tab === "proj");
  document.getElementById("prod-content-ops").style.display =
    tab === "ops" ? "" : "none";
  document.getElementById("prod-content-proj").style.display =
    tab === "proj" ? "" : "none";
  if (tab === "ops") loadProdOps();
  if (tab === "proj") loadProdProjects();
}

// === COLLAPSIBLE SIDEBAR — финальная версия ===
document.addEventListener("DOMContentLoaded", function () {
  const sidebar = document.getElementById("sidebar");
  const btn = document.getElementById("toggleSidebarBtn");

  if (btn && sidebar) {
    console.log("✅ Sidebar button found!");

    function updateButton() {
      if (sidebar.classList.contains("collapsed")) {
        btn.innerHTML = "→"; // свёрнуто → стрелка вправо
        btn.title = "Развернуть меню";
      } else {
        btn.innerHTML = "←"; // развёрнуто → стрелка влево
        btn.title = "Свернуть меню";
      }
    }

    btn.addEventListener("click", function () {
      sidebar.classList.toggle("collapsed");
      updateButton();
      localStorage.setItem(
        "sidebarCollapsed",
        sidebar.classList.contains("collapsed"),
      );
    });

    // Восстановление состояния
    if (localStorage.getItem("sidebarCollapsed") === "true") {
      sidebar.classList.add("collapsed");
    }

    updateButton(); // правильная стрелка сразу
  } else {
    console.log("❌ Button or sidebar not found. Check ID!");
  }
});
