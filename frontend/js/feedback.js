var FB_FILTER = "open";
var FB_PAGE = 1;
var FB_INITED = false;
var FB_ROWS = [];
var FB_IS_RESPONSIBLE = false; // admin or feedback_access
var FB_ASSIGNED_ONLY = false;
var FB_REQ = 0;

var FB_CAT_MAP = {
  problem: "Проблема",
  suggestion: "Предложение",
  improvement: "Улучшение",
};
var FB_PRIORITY_MAP = {
  low: "Низкий",
  medium: "Средний",
  high: "Высокий",
};
var FB_STATUS_MAP = {
  open: "Открыто",
  in_progress: "В работе",
  resolved: "Решено",
  closed: "Закрыто",
};
var FB_STATUS_COLORS = {
  open: "#ef4444",
  in_progress: "#f59e0b",
  resolved: "#10b981",
  closed: "#94a3b8",
};

function initFeedback() {
  if (!USER) return;
  if (FB_INITED) {
    fbRefreshAll();
    return;
  }
  FB_INITED = true;
  http("GET", "/api/feedback/check-access", null, function(res) {
    FB_IS_RESPONSIBLE = res.ok && res.is_responsible;
    fbBuild();
    fbRefreshAll();
  });
}

function fbBuild() {
  var panel = document.getElementById("panel-feedback");
  if (!panel) return;

  var isResp = FB_IS_RESPONSIBLE;
  var filterHtml =
    '<div class="fb-filter-bar">' +
    '<button class="fb-filter-tab active" data-fb-filter="open" onclick="fbSetFilter(\'open\')">Открытые</button>' +
    '<button class="fb-filter-tab" data-fb-filter="all" onclick="fbSetFilter(\'all\')">Все</button>' +
    '<button class="fb-filter-tab" data-fb-filter="closed" onclick="fbSetFilter(\'closed\')">Закрытые</button>' +
    "</div>";

  panel.innerHTML =
    '<div class="fb-wrap">' +
    '<div class="fb-left">' +
    '<div class="fb-card">' +
    '<div class="fb-card-hd">Новое обращение</div>' +
    '<div class="fb-err" id="fb-err"></div>' +
    '<div class="fb-form-row">' +
    '<label class="fb-lbl req">Заголовок</label>' +
    '<input class="form-inp" id="fb-title" placeholder="Коротко о проблеме" maxlength="255">' +
    "</div>" +
    '<div class="fb-form-row">' +
    '<label class="fb-lbl req">Описание</label>' +
    '<textarea class="form-inp fb-textarea" id="fb-desc" placeholder="Подробное описание..." rows="4"></textarea>' +
    "</div>" +
    '<div class="fb-form-row fb-inline">' +
    '<div class="fb-field">' +
    '<label class="fb-lbl">Категория</label>' +
    '<select class="form-inp" id="fb-category">' +
    '<option value="problem">Проблема</option>' +
    '<option value="suggestion">Предложение</option>' +
    '<option value="improvement">Улучшение</option>' +
    "</select>" +
    "</div>" +
    '<div class="fb-field">' +
    '<label class="fb-lbl">Приоритет</label>' +
    '<select class="form-inp" id="fb-priority">' +
    '<option value="low">Низкий</option>' +
    '<option value="medium" selected>Средний</option>' +
    '<option value="high">Высокий</option>' +
    "</select>" +
    "</div>" +
        '<div class="fb-field">' +
        '<label class="fb-lbl">Файл</label>' +
        '<input class="form-inp" type="file" id="fb-file" accept=".jpg,.jpeg,.png,.gif,.pdf,.doc,.docx,.xls,.xlsx" onchange="fbFileSelected(this)">' +
        '<span class="fb-file-name" id="fb-file-name"></span>' +
        "</div>" +
    "</div>" +
    '<button class="topbar-btn btn-accent" onclick="fbCreate()">Отправить</button>' +
    "</div>" +
    "</div>" +
    '<div class="fb-right">' +
      (isResp ? '<div class="fb-board-hd">Доска обращений</div>' : '<div class="fb-board-hd">Мои обращения</div>') +
      (USER.role === "admin" ? '<button class="topbar-btn" onclick="fbManageAccess()" style="float:right">⚙ Доступ</button>' : "") +
    filterHtml +
    (isResp
      ? '<label class="fb-assigned-toggle">' +
        '<input type="checkbox" id="fb-assigned-cb"' + (FB_ASSIGNED_ONLY ? " checked" : "") + ' onchange="fbToggleAssigned(this.checked)">' +
        ' Мне назначено' +
        "</label>"
      : "") +
    '<div class="fb-tbl-wrap">' +
    '<table class="fb-table">' +
    "<thead>" +
    "<tr>" +
    '<th class="fb-th-id">#</th>' +
    '<th class="fb-th-title">Заголовок</th>' +
    '<th class="fb-th-cat">Категория</th>' +
    '<th class="fb-th-pri">Приоритет</th>' +
    '<th class="fb-th-st">Статус</th>' +
    (isResp ? '<th class="fb-th-by">Автор</th>' : "") +
    (isResp ? '<th class="fb-th-as">Назначен</th>' : "") +
    '<th class="fb-th-date">Дата</th>' +
    (isResp ? '<th class="fb-th-actions">Действия</th>' : "") +
    "</tr>" +
    "</thead>" +
    '<tbody id="fb-tbody">' +
    '<tr><td colspan="' + (isResp ? 9 : 6) + '" class="fb-empty">Загрузка…</td></tr>' +
    "</tbody>" +
    "</table>" +
    '<div class="fb-pagination" id="fb-pagination"></div>' +
    "</div>" +
    "</div>" +
    "</div>" +

    // Modal for admin/dispatcher actions
    (isResp
      ? '<div id="fb-modal" class="wh-modal-bg" style="display:none" onclick="if(event.target===this)fbCloseModal()">' +
        '<div class="wh-modal">' +
        '<div class="wh-modal-hd">' +
        '<span class="wh-modal-title" id="fb-modal-title">Обращение</span>' +
        '<button class="wh-modal-close" onclick="fbCloseModal()">✕</button>' +
        "</div>" +
        '<div class="fb-modal-err" id="fb-modal-err"></div>' +
        '<div class="fb-form-grid">' +
        '<div class="fb-form-row">' +
        '<label class="fb-lbl">Статус</label>' +
        '<select class="form-inp" id="fb-modal-status">' +
        '<option value="open">Открыто</option>' +
        '<option value="in_progress">В работе</option>' +
        '<option value="resolved">Решено</option>' +
        '<option value="closed">Закрыто</option>' +
        "</select>" +
        "</div>" +
        '<div class="fb-form-row">' +
        '<label class="fb-lbl">Назначить</label>' +
        '<select class="form-inp" id="fb-modal-assign">' +
        '<option value="">— Не назначен —</option>' +
        "</select>" +
        "</div>" +
        '<div class="fb-form-row">' +
        '<label class="fb-lbl">Резолюция</label>' +
        '<textarea class="form-inp fb-textarea" id="fb-modal-resolution" rows="3" placeholder="Решение проблемы…"></textarea>' +
        "</div>" +
        '<div class="fb-form-row" id="fb-modal-file-row" style="display:none">' +
        '<label class="fb-lbl">Файл</label>' +
        '<a id="fb-modal-file-link" href="#" target="_blank"></a>' +
        "</div>" +
        "</div>" +
        '<div class="wh-modal-foot">' +
        '<button class="topbar-btn" onclick="fbCloseModal()">Отмена</button>' +
        '<button class="topbar-btn btn-accent" id="fb-modal-save" onclick="fbModalSave()">Сохранить</button>' +
        "</div>" +
        "</div>" +
        "</div>"
      : "");
}

function fbRefreshAll() {
  fbLoadCounter();
  fbLoadList();
}

function fbSetFilter(f) {
  FB_FILTER = f;
  FB_PAGE = 1;
  document.querySelectorAll(".fb-filter-tab").forEach(function (b) {
    b.classList.toggle("active", b.dataset.fbFilter === f);
  });
  fbLoadList();
}

function fbToggleAssigned(checked) {
  FB_ASSIGNED_ONLY = checked;
  FB_PAGE = 1;
  fbLoadList();
}

function fbLoadCounter() {
  http("GET", "/api/feedback/count", null, function (res) {
    if (!res.ok) return;
    var badge = document.getElementById("fb-counter");
    if (badge) {
      var n = res.open || 0;
      badge.textContent = n;
      badge.style.display = n > 0 ? "" : "none";
    }
  });
}

function fbLoadList() {
  var myReq = ++FB_REQ;
  var statusParam = FB_FILTER === "all" ? "open,in_progress,resolved,closed" : FB_FILTER === "closed" ? "resolved,closed" : "open,in_progress";
  var url = "/api/feedback?page=" + FB_PAGE + "&limit=25";
  if (statusParam) url += "&status=" + encodeURIComponent(statusParam);
  if (FB_ASSIGNED_ONLY) url += "&assigned_to=" + USER.id;

  var tbody = document.getElementById("fb-tbody");
  if (!tbody) return;

  http("GET", url, null, function (res) {
    if (myReq !== FB_REQ) return;
    if (!res.ok) {
      tbody.innerHTML = '<tr><td colspan="9" class="fb-empty">Ошибка загрузки</td></tr>';
      return;
    }
    FB_ROWS = res.rows;
    if (!res.rows.length) {
      tbody.innerHTML = '<tr><td colspan="9" class="fb-empty">Нет обращений</td></tr>';
      fbRenderPagination(res.hasMore);
      return;
    }
    fbRenderTable(res.rows);
    fbRenderPagination(res.hasMore);
  });
}

function fbRenderTable(rows) {
  var tbody = document.getElementById("fb-tbody");
  if (!tbody) return;
  var isResp = FB_IS_RESPONSIBLE;

  tbody.innerHTML = rows
    .map(function (r) {
      var stClr = FB_STATUS_COLORS[r.status] || "#94a3b8";
      var stLbl = FB_STATUS_MAP[r.status] || r.status;
      var date = new Date(r.created_at);
      var dateStr =
        pad2(date.getDate()) +
        "." +
        pad2(date.getMonth() + 1) +
        "." +
        date.getFullYear();
      var title = r.title || "";
      var fileIcon = r.file_path ? '<a class="fb-file-link" href="/uploads/' + fbE(r.file_path) + '" download="' + fbE(r.original_name || '') + '" onclick="event.stopPropagation()" title="' + fbE(r.original_name || 'Скачать файл') + '"><span class="fb-file-icon">📎</span></a> ' : "";
      var catLbl = FB_CAT_MAP[r.category] || r.category;
      var priLbl = FB_PRIORITY_MAP[r.priority] || r.priority;
      var author = (r.created_by && r.created_by.name) || "—";
      var assignee = (r.assigned_to && r.assigned_to.name) || "—";

      return (
        '<tr class="fb-row' +
        (isResp ? ' fb-row-click" onclick="fbOpenModal(' + r.id + ')"' : '"') +
        ">" +
        '<td class="fb-td fb-td-id">' +
        '<span class="fb-id-badge">' +
        r.id +
        "</span>" +
        "</td>" +
        '<td class="fb-td fb-td-title">' +
        '<div class="fb-title-text" title="' +
        fbE(title) +
        '">' +
        fileIcon +
        fbE(title.length > 60 ? title.slice(0, 60) + "…" : title) +
        "</div>" +
        "</td>" +
        '<td class="fb-td fb-td-cat">' +
        '<span class="fb-cat-badge">' +
        fbE(catLbl) +
        "</span>" +
        "</td>" +
        '<td class="fb-td fb-td-pri">' +
        fbPriBadge(r.priority, priLbl) +
        "</td>" +
        '<td class="fb-td fb-td-st">' +
        '<span class="fb-st-badge" style="color:' +
        stClr +
        ";background:" +
        stClr +
        "18" +
        '">' +
        '<span class="fb-st-dot" style="background:' +
        stClr +
        '"></span>' +
        fbE(stLbl) +
        "</span>" +
        "</td>" +
        (isResp ? '<td class="fb-td fb-td-by">' + fbE(author) + "</td>" : "") +
        (isResp ? '<td class="fb-td fb-td-as">' + fbE(assignee) + "</td>" : "") +
        '<td class="fb-td fb-td-date">' +
        dateStr +
        "</td>" +
        (isResp
          ? '<td class="fb-td fb-td-actions">' +
            '<button class="fb-action-btn" onclick="event.stopPropagation();fbOpenModal(' +
            r.id +
            ')" title="Редактировать">✎</button>' +
            (USER.role === "admin"
              ? '<button class="fb-action-btn fb-del-btn" onclick="event.stopPropagation();fbDelete(' +
                r.id +
                ')" title="Удалить">✕</button>'
              : "") +
            "</td>"
          : "") +
        "</tr>"
      );
    })
    .join("");
}

function fbPriBadge(pri, lbl) {
  var cls = pri === "high" ? "fb-pri-high" : pri === "low" ? "fb-pri-low" : "fb-pri-med";
  return '<span class="fb-pri-badge ' + cls + '">' + fbE(lbl) + "</span>";
}

function fbRenderPagination(hasMore) {
  var el = document.getElementById("fb-pagination");
  if (!el) return;
  var html = "";
  if (FB_PAGE > 1)
    html += '<button class="arc-btn" onclick="FB_PAGE--;fbLoadList()">← Назад</button>';
  html += '<span class="fb-page-info">Стр. ' + FB_PAGE + "</span>";
  if (hasMore)
    html += '<button class="arc-btn" onclick="FB_PAGE++;fbLoadList()">Вперёд →</button>';
  el.innerHTML = html;
}

function fbFileSelected(input) {
  var nameEl = document.getElementById("fb-file-name");
  if (!nameEl) return;
  nameEl.textContent = input.files && input.files[0] ? input.files[0].name : "";
}

function fbCreate() {
  var title = (document.getElementById("fb-title") || {}).value || "";
  var desc = (document.getElementById("fb-desc") || {}).value || "";
  var category = (document.getElementById("fb-category") || {}).value || "problem";
  var priority = (document.getElementById("fb-priority") || {}).value || "medium";
  var fileInput = document.getElementById("fb-file");
  var err = document.getElementById("fb-err");

  if (title.length < 3) {
    err.textContent = "Заголовок должен быть минимум 3 символа";
    return;
  }
  if (desc.length < 10) {
    err.textContent = "Описание должно быть минимум 10 символов";
    return;
  }
  err.textContent = "";

  var btn = document.querySelector('.fb-card .btn-accent');
  if (btn) btn.disabled = true;

  var data = { title: title, description: desc, category: category, priority: priority };

  if (fileInput && fileInput.files && fileInput.files[0]) {
    var fd = new FormData();
    fd.append("file", fileInput.files[0]);
    fd.append("title", title);
    fd.append("description", desc);
    fd.append("category", category);
    fd.append("priority", priority);

      httpUpload("POST", "/api/feedback/upload", fd, function (res) {
      if (btn) btn.disabled = false;
      if (!res.ok) {
        err.textContent = res.error || "Ошибка отправки";
        return;
      }
      fbClearForm();
      showToast("Обращение создано (файл прикреплён)");
      fbRefreshAll();
    });
  } else {
    http("POST", "/api/feedback", data, function (res) {
      if (btn) btn.disabled = false;
      if (!res.ok) {
        err.textContent = res.error || "Ошибка отправки";
        return;
      }
      fbClearForm();
      showToast("Обращение создано");
      fbRefreshAll();
    });
  }
}

function fbClearForm() {
  var ids = ["fb-title", "fb-desc", "fb-file"];
  ids.forEach(function (id) {
    var el = document.getElementById(id);
    if (el) el.value = "";
  });
  var nameEl = document.getElementById("fb-file-name");
  if (nameEl) nameEl.textContent = "";
  var err = document.getElementById("fb-err");
  if (err) err.textContent = "";
}

// Admin/dispatcher actions
var FB_MODAL_ID = null;

function fbOpenModal(id) {
  FB_MODAL_ID = id;
  var row;
  for (var i = 0; i < FB_ROWS.length; i++) {
    if (FB_ROWS[i].id === id) { row = FB_ROWS[i]; break; }
  }
  if (!row) return;

  var modal = document.getElementById("fb-modal");
  if (!modal) return;

  document.getElementById("fb-modal-title").textContent = "#" + id + " " + row.title;
  document.getElementById("fb-modal-err").textContent = "";
  document.getElementById("fb-modal-status").value = row.status;
  document.getElementById("fb-modal-resolution").value = row.resolution || "";

  // File link
  var fileRow = document.getElementById("fb-modal-file-row");
  var fileLink = document.getElementById("fb-modal-file-link");
  if (row.file_path && fileRow && fileLink) {
    fileRow.style.display = "";
    fileLink.href = "/uploads/" + row.file_path;
    fileLink.textContent = row.original_name || "Скачать файл";
    fileLink.download = row.original_name || "";
  } else if (fileRow) {
    fileRow.style.display = "none";
  }

  // Load assignable users
  var assignSel = document.getElementById("fb-modal-assign");
  assignSel.innerHTML = '<option value="">— Не назначен —</option>';

  http("GET", "/api/feedback/users", null, function (res) {
    if (res.ok && res.rows) {
      res.rows.forEach(function (u) {
        var opt = document.createElement("option");
        opt.value = u.id;
        opt.textContent = u.name + " (" + u.email + ")";
        if (row.assigned_to && row.assigned_to.id === u.id) opt.selected = true;
        assignSel.appendChild(opt);
      });
    }
  });

  modal.style.display = "flex";
}

function fbCloseModal() {
  var modal = document.getElementById("fb-modal");
  if (modal) modal.style.display = "none";
  FB_MODAL_ID = null;
}

function fbModalSave() {
  if (!FB_MODAL_ID) return;
  var err = document.getElementById("fb-modal-err");
  var status = document.getElementById("fb-modal-status").value;
  var assignedTo = document.getElementById("fb-modal-assign").value || null;
  var resolution = document.getElementById("fb-modal-resolution").value.trim();

  var data = { status: status };
  if (resolution) data.resolution = resolution;
  data.assigned_to = assignedTo;

  var btn = document.getElementById("fb-modal-save");
  if (btn) btn.disabled = true;

  http("PUT", "/api/feedback/" + FB_MODAL_ID, data, function (res) {
    if (btn) btn.disabled = false;
    if (!res.ok) {
      err.textContent = res.error || "Ошибка сохранения";
      return;
    }
    fbCloseModal();
    showToast("Обращение обновлено");
    fbRefreshAll();
  });
}

function fbDelete(id) {
  if (!confirm("Удалить обращение #" + id + "?")) return;
  http("DELETE", "/api/feedback/" + id, null, function (res) {
    if (!res.ok) {
      showToast(res.error || "Ошибка удаления");
      return;
    }
    showToast("Обращение удалено");
    fbRefreshAll();
  });
}

// ── Modal helpers ─────────────────────────────────────────

function showModal(title, bodyHtml, buttons) {
  var existing = document.getElementById("fb-modal-overlay");
  if (existing) existing.remove();

  var overlay = document.createElement("div");
  overlay.id = "fb-modal-overlay";
  overlay.className = "wh-modal-bg";
  overlay.style.cssText = "position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;z-index:9999";

  var btnsHtml = (buttons || []).map(function(b, i) {
    return '<button class="topbar-btn ' + (b.class || "") + '" data-fb-btn="' + i + '">' + b.label + "</button>";
  }).join("");

  overlay.innerHTML =
    '<div class="wh-modal" style="max-width:600px;width:90%">' +
    '<div class="wh-modal-hd">' +
    '<span class="wh-modal-title">' + fbE(title) + "</span>" +
    '<button class="wh-modal-close" onclick="closeModal()">✕</button>' +
    "</div>" +
    '<div class="wh-modal-body" style="padding:16px;max-height:60vh;overflow-y:auto">' +
    bodyHtml +
    "</div>" +
    (buttons && buttons.length ? '<div class="wh-modal-foot">' + btnsHtml + "</div>" : "") +
    "</div>";

  overlay.addEventListener("click", function(e) {
    if (e.target === overlay) closeModal();
    var btn = e.target.closest("[data-fb-btn]");
    if (btn) {
      var i = parseInt(btn.dataset.fbBtn);
      var action = buttons[i] && buttons[i].action;
      if (action) action(); else closeModal();
    }
  });

  document.body.appendChild(overlay);
}

function closeModal() {
  var el = document.getElementById("fb-modal-overlay");
  if (el) el.remove();
}

function fbE(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ── Access Management (admin) ─────────────────────────────

function fbManageAccess() {
  http("GET", "/api/feedback/users/all", null, function(usersRes) {
    if (!usersRes.ok) { showToast("Ошибка загрузки пользователей"); return; }
    http("GET", "/api/feedback/access", null, function(accessRes) {
      if (!accessRes.ok) { showToast("Ошибка загрузки доступа"); return; }

      var accessIds = {};
      for (var i = 0; i < accessRes.rows.length; i++) {
        accessIds[accessRes.rows[i].id] = true;
      }

      var html = "";
      for (var i = 0; i < usersRes.rows.length; i++) {
        var u = usersRes.rows[i];
        var isAdmin = u.role === "admin";
        var checked = isAdmin || accessIds[u.id] ? "checked" : "";
        var roleLbl = isAdmin ? " (админ)" : "";
        html += '<div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--border)">' +
          "<input type=\"checkbox\" " + checked + " onchange=\"fbToggleAccess(" + u.id + ", this.checked)\"" +
          (isAdmin ? " disabled" : "") + ">" +
          '<span style="flex:1">' + fbE(u.name) + "</span>" +
          '<span style="color:var(--text3);font-size:10px">' + fbE(u.email) + roleLbl + "</span>" +
          "</div>";
      }

      showModal("Настройка доступа к Feedback", html, [
        { label: "Готово", class: "btn-accent", action: function() { closeModal(); } }
      ]);
    });
  });
}

function fbToggleAccess(userId, grant) {
  if (grant) {
    http("POST", "/api/feedback/access", { user_id: userId }, function(res) {
      if (!res.ok) showToast(res.error || "Ошибка");
    });
  } else {
    http("DELETE", "/api/feedback/access/" + userId, null, function(res) {
      if (!res.ok) showToast(res.error || "Ошибка");
    });
  }
}
