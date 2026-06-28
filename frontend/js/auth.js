// ============================================================
// auth.js — Авторизация
// ============================================================
function doLogin() {
  var email = document.getElementById("login-email").value.trim();
  var pass = document.getElementById("login-pass").value;
  var err = document.getElementById("login-err");
  err.classList.remove("show");
  if (!email || !pass) {
    err.textContent = "Заполните email и пароль";
    err.classList.add("show");
    return;
  }
  http(
    "POST",
    "/api/auth/login",
    { email: email, password: pass },
    function (res) {
      if (res.ok) {
        TOKEN = res.token;
        USER = res.user;
        USER.ai_features = [];
        localStorage.setItem("cir_token", TOKEN);
        localStorage.setItem("cir_user", JSON.stringify(USER));
        applyUser(USER);
        http("GET", "/api/ai/access/my", null, function(ar) {
          if (ar.ok) {
            USER.ai_features = ar.features || [];
            localStorage.setItem("cir_user", JSON.stringify(USER));
            applyUser(USER);
          }
        });
      } else {
        err.textContent = res.error || "Ошибка";
        err.classList.add("show");
      }
    },
  );
}

function applyUser(u) {
  document.getElementById("auth-screen").style.display = "none";

  var parts = (u.name || "").split(" ");
  document.getElementById("sidebar-av").textContent =
    (((parts[0] || "")[0] || "") + ((parts[1] || "")[0] || "")).toUpperCase() ||
    "??";
  document.getElementById("sidebar-uname").textContent = u.name || u.email;

  var roleMap = {
    admin: "Администратор",
    dispatcher: "Диспетчер",
    master: "Мастер",
    technologist: "Технолог",
    warehouse: "Кладовщик",
  };
  document.getElementById("sidebar-urole").textContent =
    roleMap[u.role] || u.role;

  // Управление видимостью пункта "Управление пользователями"
  var adminMenu = document.getElementById("admin-users-menu");
  if (adminMenu) {
    adminMenu.style.display = u.role === "admin" ? "block" : "none";
  }

  // AI Settings — только admin
  var aiSettingsMenu = document.getElementById("ai-settings-menu");
  if (aiSettingsMenu) {
    aiSettingsMenu.style.display = u.role === "admin" ? "block" : "none";
  }

  // AI-аналитика — если есть chat или dashboard (или admin)
  var aiAnalyticsMenu = document.getElementById("ai-analytics-menu");
  if (aiAnalyticsMenu) {
    var features = u.ai_features || [];
    var showAi = u.role === "admin" || features.indexOf("chat") >= 0 || features.indexOf("dashboard") >= 0;
    aiAnalyticsMenu.style.display = showAi ? "block" : "none";
  }

  // S&OP — если есть sop (или admin)
  var sopMenu = document.getElementById("sop-menu");
  if (sopMenu) {
    var features = u.ai_features || [];
    var showSop = u.role === "admin" || features.indexOf("sop") >= 0;
    sopMenu.style.display = showSop ? "block" : "none";
  }

  // CRM admin buttons
  var crmColsBtn = document.getElementById("crm-columns-btn");
  var crmFieldsBtn = document.getElementById("crm-fields-btn");
  var crmAccessBtn = document.getElementById("crm-access-btn");
  if (crmColsBtn) crmColsBtn.style.display = u.role === "admin" ? "" : "none";
  if (crmFieldsBtn)
    crmFieldsBtn.style.display = u.role === "admin" ? "" : "none";
  if (crmAccessBtn)
    crmAccessBtn.style.display = u.role === "admin" ? "" : "none";

  loadRefs();
  initArc();
  // showPanel("nomenclature");
  var lastPanel = localStorage.getItem('mes_last_panel') || 'nomenclature';
  showPanel(lastPanel);
  if (lastPanel === 'nomenclature') {
    var lastNomTab = localStorage.getItem('mes_last_nom_tab') || 'techops';
    switchNomTab(lastNomTab);
  }
  if (lastPanel === 'production') {
    var lastProdTab = localStorage.getItem('mes_last_prod_tab') || 'ops';
    switchProdTab(lastProdTab);
  }
}

function doLogout() {
  TOKEN = "";
  USER = null;
  localStorage.removeItem("cir_token");
  localStorage.removeItem("cir_user");

  document.getElementById("user-menu").classList.remove("show");

  // Скрываем меню и очищаем данные предыдущего пользователя
  var adminMenu = document.getElementById("admin-users-menu");
  if (adminMenu) adminMenu.style.display = "none";
  var aiSettingsMenu = document.getElementById("ai-settings-menu");
  if (aiSettingsMenu) aiSettingsMenu.style.display = "none";
  var aiAnalyticsMenu = document.getElementById("ai-analytics-menu");
  if (aiAnalyticsMenu) aiAnalyticsMenu.style.display = "none";
  var sopMenu = document.getElementById("sop-menu");
  if (sopMenu) sopMenu.style.display = "none";
  var usersTbody = document.getElementById("users-tbody");
  if (usersTbody) usersTbody.innerHTML = "";
  var mrOps = document.getElementById("mr-ops-tbody");
  if (mrOps) mrOps.innerHTML = "";
  var mrArc = document.getElementById("mr-arc-tbody");
  if (mrArc) mrArc.innerHTML = "";
  var mrProd = document.getElementById("mr-prod-tbody");
  if (mrProd) mrProd.innerHTML = "";

  document.getElementById("auth-screen").style.display = "flex";
}
