// ============================================================
// archive.js — База архив изделий (PostgreSQL)
// На основе Google Apps Script логики
// ============================================================

var arcSelectedIdx = null;
var arcDB = []; // локальный кэш архива

// ── ИНИЦИАЛИЗАЦИЯ ─────────────────────────────────────────
function initArc() {
  arcLoadFromDB();
}

// ── ЗАГРУЗКА АРХИВА ИЗ БД ─────────────────────────────────
function arcLoadFromDB() {
  if (!TOKEN) {
    setTimeout(arcLoadFromDB, 500);
    return;
  }
  api("GET", "/api/archive").then(function (res) {
    if (res.ok && res.rows) {
      arcDB = res.rows;
      arcRenderArchive();
      var countEl = document.getElementById("arc-db-count");
      if (countEl) countEl.textContent = arcDB.length;
    }
  });
}

// ── ДОБАВЛЕНИЕ СТРОКИ В ТАБЛИЦУ СТРУКТУРЫ ─────────────────
function arcAddRow() {
  var tbody = document.getElementById("arc-tbody");
  var rows = Array.from(tbody.children);

  // Считаем только элементы верхнего уровня (без точки в ID)
  var topLevel = rows.filter(function (r) {
    var rid = r.querySelector('[name="arc-id"]').value.trim();
    return rid.indexOf(".") === -1 && rid !== "0";
  });

  var newId = String(topLevel.length + 1);
  tbody.appendChild(arcBuildRow(newId, "", "", 1, "Деталь"));
  arcRecalcStructure();
  arcUpdateTotalRows();
}

function arcAddChildRow() {
  var tbody = document.getElementById("arc-tbody");
  var rows = Array.from(tbody.children);
  if (arcSelectedIdx === null) {
    showToast("Кликните по строке-родителю");
    return;
  }
  var parentRow = rows[arcSelectedIdx];
  if (!parentRow) return;
  var parentId = parentRow.querySelector('[name="arc-id"]').value.trim();

  // Находим прямых дочерних для нумерации
  var children = rows.filter(function (r) {
    var rid = r.querySelector('[name="arc-id"]').value.trim();
    return (
      rid.startsWith(parentId + ".") &&
      rid.split(".").length === parentId.split(".").length + 1
    );
  });
  var newId = parentId + "." + (children.length + 1);
  var tr = arcBuildRow(newId, "", "", 1, "Деталь");

  // Находим последнего потомка (любого уровня) этого родителя
  var lastDescendantIdx = arcSelectedIdx;
  for (var i = arcSelectedIdx + 1; i < rows.length; i++) {
    var rid = rows[i].querySelector('[name="arc-id"]').value.trim();
    if (rid.startsWith(parentId + ".")) {
      lastDescendantIdx = i;
    } else {
      break;
    }
  }

  // Вставляем ПОСЛЕ последнего потомка
  if (lastDescendantIdx < rows.length - 1) {
    tbody.insertBefore(tr, rows[lastDescendantIdx + 1]);
  } else {
    tbody.appendChild(tr);
  }

  arcRecalcStructure();
  arcUpdateTotalRows();
}

// ── ПОСТРОЕНИЕ СТРОКИ ─────────────────────────────────────
var arcRowCounter = 0;

function arcBuildRow(id, name, classifier, qty, type) {
  arcRowCounter++;
  var rid = "arcrow-" + arcRowCounter;
  var tr = document.createElement("tr");
  var opts = [
    "—",
    "Головное изделие",
    "Деталь",
    "ПКИ",
    "Сборочная единица",
    "Комплект",
    "Сборочная единица/ПКИ",
  ]
    .map(function (o) {
      return (
        '<option value="' +
        (o === "—" ? "" : o) +
        '"' +
        (o === type ? " selected" : "") +
        ">" +
        o +
        "</option>"
      );
    })
    .join("");

  tr.innerHTML =
    '<td><input type="text" name="arc-id" value="' +
    id +
    '" onchange="arcRecalcStructure()" placeholder="ID" style="width:60px"></td>' +
    '<td><div class="combo-wrap"><input type="text" name="arc-name" value="' +
    (name || "") +
    '" placeholder="Название изделия" autocomplete="off" onchange="arcUpdateAssemblyId()" oninput="arcAcSearch(this,\'' +
    rid +
    "-dd-name','product')\" onfocus=\"arcAcSearch(this,'" +
    rid +
    '-dd-name\',\'product\')"><div class="combo-dd" id="' +
    rid +
    '-dd-name"></div></div></td>' +
    '<td><div class="combo-wrap"><input type="text" name="arc-classifier" value="' +
    (classifier || "") +
    '" placeholder="АРВЦ..." autocomplete="off" onchange="arcUpdateAssemblyId()" oninput="arcAcSearch(this,\'' +
    rid +
    "-dd-code','classifier')\" onfocus=\"arcAcSearch(this,'" +
    rid +
    '-dd-code\',\'classifier\')"><div class="combo-dd" id="' +
    rid +
    '-dd-code"></div></div></td>' +
    '<td><input type="number" name="arc-qty" value="' +
    qty +
    '" min="1" style="width:55px"></td>' +
    '<td><select name="arc-type">' +
    opts +
    "</select></td>" +
    '<td><div class="lvl-badge lvl-1" style="text-align:center">1</div></td>' +
    '<td><input type="text" name="arc-parent" value="0" readonly style="color:var(--text3);width:60px"></td>' +
    '<td><button class="arc-del" onclick="arcRemoveRow(this)"' +
    (id === "0" ? " disabled" : "") +
    ">×</button></td>";

  tr.addEventListener("click", function (e) {
    if (e.target.tagName === "BUTTON") return;
    Array.from(document.getElementById("arc-tbody").children).forEach(
      function (r) {
        r.style.outline = "";
      },
    );
    tr.style.outline = "2px solid var(--accent)";
    tr.style.outlineOffset = "-1px";
    arcSelectedIdx = Array.from(
      document.getElementById("arc-tbody").children,
    ).indexOf(tr);
  });

  return tr;
}

// ── УДАЛЕНИЕ СТРОКИ ───────────────────────────────────────
function arcRemoveRow(btn) {
  var tbody = document.getElementById("arc-tbody");
  var row = btn.closest("tr");
  if (row === tbody.firstElementChild) {
    showToast("Нельзя удалить корневой элемент");
    return;
  }

  var rowId = row.querySelector('[name="arc-id"]').value.trim();

  // Удаляем дочерние элементы
  var children = Array.from(tbody.children).filter(function (r) {
    var rid = r.querySelector('[name="arc-id"]').value.trim();
    return rid !== rowId && rid.startsWith(rowId + ".");
  });

  if (
    children.length &&
    !confirm(
      "У элемента " +
        rowId +
        " есть " +
        children.length +
        " дочерних. Удалить все?",
    )
  )
    return;

  children.forEach(function (c) {
    c.remove();
  });
  row.remove();
  arcSelectedIdx = null;
  arcRecalcStructure();
  arcUpdateTotalRows();
}

function arcRecalcStructure() {
  Array.from(document.getElementById("arc-tbody").children).forEach(
    function (row) {
      var id = row.querySelector('[name="arc-id"]').value.trim();
      var lvl = id === "0" ? 0 : (id.match(/\./g) || []).length + 1;
      var parentId =
        id.indexOf(".") !== -1 ? id.split(".").slice(0, -1).join(".") : "0";

      var badge = row.querySelector(".lvl-badge");
      if (badge) {
        badge.textContent = lvl;
        badge.className = "lvl-badge lvl-" + Math.min(lvl, 4);
      }

      var parentInput = row.querySelector('[name="arc-parent"]');
      if (parentInput) parentInput.value = parentId;

      row.className = "arc-row-" + Math.min(lvl, 4);
    },
  );

  arcUpdateAssemblyId();
}

function arcUpdateAssemblyId() {
  var first = document.getElementById("arc-tbody").firstElementChild;
  if (!first) return;
  var c = first.querySelector('[name="arc-classifier"]').value.trim();
  var el = document.getElementById("arc-assembly-id");
  if (el) el.textContent = c || "—";
}

function arcUpdateTotalRows() {
  var el = document.getElementById("arc-total-rows");
  if (el) el.textContent = document.getElementById("arc-tbody").children.length;
}

// ── ОЧИСТКА ТАБЛИЦЫ ───────────────────────────────────────
function arcClearTable() {
  if (!confirm("Очистить структуру?")) return;
  var tbody = document.getElementById("arc-tbody");
  var first = tbody.firstElementChild;
  tbody.innerHTML = "";
  tbody.appendChild(first);
  first.querySelector('[name="arc-name"]').value = "";
  first.querySelector('[name="arc-classifier"]').value = "";
  first.querySelector('[name="arc-qty"]').value = 1;
  first.querySelector('[name="arc-type"]').value = "Головное изделие";
  arcSelectedIdx = null;
  arcRecalcStructure();
  arcUpdateTotalRows();
}

function arcClearForm() {
  arcClearTable();
  ["arc-err", "arc-ok", "arc-warn"].forEach(function (id) {
    var el = document.getElementById(id);
    if (el) el.classList.remove("show");
  });
}

// ── ОТПРАВКА В АРХИВ (с проверкой дубликатов) ─────────────
function arcSubmit() {
  // Скрываем сообщения
  ["arc-err", "arc-ok", "arc-warn"].forEach(function (id) {
    var el = document.getElementById(id);
    if (el) el.classList.remove("show");
  });

  // Собираем данные из таблицы
  var data = Array.from(document.getElementById("arc-tbody").children).map(
    function (row) {
      return {
        id: row.querySelector('[name="arc-id"]').value.trim(),
        name: row.querySelector('[name="arc-name"]').value.trim(),
        classifier: row.querySelector('[name="arc-classifier"]').value.trim(),
        quantity: row.querySelector('[name="arc-qty"]').value.trim(),
        objectType: row.querySelector('[name="arc-type"]').value,
      };
    },
  );

  // ── Валидация (как в Google Apps Script) ──
  var errors = [];

  // Проверяем корневой элемент
  var rootElement = data.find(function (d) {
    return d.id === "0";
  });
  if (!rootElement) errors.push('Не найден корневой элемент с ID = "0"');

  // Проверяем обязательные поля (ПКИ может быть без обозначения)
  data.forEach(function (d, i) {
    if (!d.id) errors.push("Строка " + (i + 1) + ": ID пустой");
    if (!d.name)
      errors.push("Строка " + (i + 1) + ": Название изделия обязательно");
    if (!d.classifier && d.objectType !== "ПКИ") {
      errors.push(
        "Строка " + (i + 1) + ": Обозначение обязательно (кроме ПКИ)",
      );
    }
  });

  // Проверяем уникальность ID
  var ids = data.map(function (d) {
    return d.id;
  });
  var dups = ids.filter(function (id, i) {
    return ids.indexOf(id) !== i;
  });
  if (dups.length)
    errors.push(
      "Дубликаты ID: " +
        dups
          .filter(function (v, i, a) {
            return a.indexOf(v) === i;
          })
          .join(", "),
    );

  // Проверяем обозначение корневого элемента
  if (rootElement && !rootElement.classifier) {
    errors.push(
      "У корневого элемента не указано обозначение по классификатору",
    );
  }

  if (errors.length) {
    var errEl = document.getElementById("arc-err");
    if (errEl) {
      errEl.innerHTML =
        "<strong>Ошибки:</strong><ul>" +
        errors
          .map(function (e) {
            return "<li>" + e + "</li>";
          })
          .join("") +
        "</ul>";
      errEl.classList.add("show");
      errEl.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
    return;
  }

  var assemblyId = rootElement.classifier;

  // Проверяем дубликат Assembly_ID в базе
  api("GET", "/api/archive?assembly_id=" + encodeURIComponent(assemblyId)).then(
    function (res) {
      if (res.ok && res.rows && res.rows.length > 0) {
        // Дубликат найден
        var existingName = res.rows[0].item_name || "";
        var warnEl = document.getElementById("arc-warn");
        if (warnEl) {
          warnEl.innerHTML =
            '<strong>Изделие с Assembly_ID "' +
            assemblyId +
            '" уже существует в архиве.</strong>' +
            (existingName ? "<br>Существующее изделие: " + existingName : "") +
            '<br><div style="margin-top:10px;display:flex;gap:8px;">' +
            '<button class="arc-btn primary" onclick="arcDoSubmit(true)" style="font-size:12px;padding:6px 14px;">Всё равно добавить</button>' +
            '<button class="arc-btn" onclick="document.getElementById(\'arc-warn\').classList.remove(\'show\')" style="font-size:12px;padding:6px 14px;">Отмена</button>' +
            "</div>";
          warnEl.classList.add("show");
        }
      } else {
        // Дубликатов нет — добавляем
        arcDoSubmit(false);
      }
    },
  );
}

function arcCalcSerialOrder(data) {
  var items = data.map(function (d) {
    // Уровень по логике Google Script: кол-во точек в ID
    var lvl = d.id === "0" ? 0 : (d.id.match(/\./g) || []).length;
    var isAssembly =
      (d.objectType || "").indexOf("Сборочная") !== -1 ||
      d.objectType === "Головное изделие";
    return {
      id: d.id,
      name: d.name,
      objectType: d.objectType,
      level: lvl,
      isAssembly: isAssembly,
    };
  });

  // ПКИ и Сборочная единица/ПКИ не изготавливаются
  var toNumber = items.filter(function (item) {
    return item.objectType !== "ПКИ" && item.objectType !== "";
  });

  // Сортируем:
  // 1) По уровню (глубокие первыми)
  // 2) Внутри уровня: детали ПЕРЕД сборочными единицами
  // 3) Внутри типа: по ID
  toNumber.sort(function (a, b) {
    if (b.level !== a.level) return b.level - a.level;
    if (a.isAssembly !== b.isAssembly) return a.isAssembly ? 1 : -1;
    var sa = a.id.split(".").map(Number);
    var sb = b.id.split(".").map(Number);
    for (var i = 0; i < Math.max(sa.length, sb.length); i++) {
      var na = sa[i] || 0;
      var nb = sb[i] || 0;
      if (na !== nb) return na - nb;
    }
    return 0;
  });

  var orderMap = {};
  var num = 1;
  toNumber.forEach(function (item) {
    orderMap[item.id] = num++;
  });

  return orderMap;
}

// ── ФАКТИЧЕСКОЕ СОХРАНЕНИЕ В БД ──────────────────────────
function arcDoSubmit(force) {
  var warnEl = document.getElementById("arc-warn");
  if (warnEl) warnEl.classList.remove("show");

  var data = Array.from(document.getElementById("arc-tbody").children).map(
    function (row) {
      return {
        id: row.querySelector('[name="arc-id"]').value.trim(),
        name: row.querySelector('[name="arc-name"]').value.trim(),
        classifier: row.querySelector('[name="arc-classifier"]').value.trim(),
        quantity: row.querySelector('[name="arc-qty"]').value.trim(),
        objectType: row.querySelector('[name="arc-type"]').value,
      };
    },
  );

  // Рассчитываем порядок изготовления
  var serialOrder = arcCalcSerialOrder(data);

  // Добавляем level, parentId, serialOrder
  var items = data.map(function (d) {
    var level = d.id === "0" ? 0 : (d.id.match(/\./g) || []).length + 1;
    var parentId =
      d.id.indexOf(".") !== -1 ? d.id.split(".").slice(0, -1).join(".") : "0";
    return {
      id: d.id,
      name: d.name,
      classifier: d.classifier,
      quantity: d.quantity,
      objectType: d.objectType,
      level: level,
      parentId: parentId,
      serialOrder: serialOrder[d.id] || null,
    };
  });

  var manufactured = items.filter(function (i) {
    return i.serialOrder;
  }).length;
  var assemblyId = data.find(function (d) {
    return d.id === "0";
  }).classifier;

  // Показываем порядок в консоли
  console.log("Порядок изготовления для " + assemblyId + ":");
  items
    .filter(function (i) {
      return i.serialOrder;
    })
    .sort(function (a, b) {
      return a.serialOrder - b.serialOrder;
    })
    .forEach(function (i) {
      console.log(
        "  №" +
          i.serialOrder +
          ": " +
          i.name +
          " (" +
          (i.classifier || "без обозначения") +
          ")",
      );
    });

  api("POST", "/api/archive", { items: items, force: force }).then(
    function (res) {
      if (res.ok) {
        var serialUpdated = res.serialUpdated || 0;
        var okEl = document.getElementById("arc-ok");
        if (okEl) {
          var upd = res.updated || 0;
          var ins = res.added || 0;
          var ser = res.serialUpdated || 0;
          okEl.innerHTML =
            "✓ Головное изделие: " +
            assemblyId +
            "<br>Привязано: " +
            upd +
            " | Новых: " +
            ins +
            " | Порядок: " +
            manufactured +
            " поз." +
            (ser > 0 ? " | Обновлено в архиве операций: " + ser : "");
          okEl.classList.add("show");
        }

        arcLoadFromDB();
        showToast("Структура добавлена в архив");

        setTimeout(function () {
          if (confirm("Данные добавлены в архив. Очистить форму?"))
            arcClearForm();
        }, 800);
      } else {
        var errEl = document.getElementById("arc-err");
        if (errEl) {
          errEl.textContent =
            "✗ Ошибка: " + (res.error || "неизвестная ошибка");
          errEl.classList.add("show");
        }
      }
    },
  );
}

function arcRenderArchive(filter) {
  var tbody = document.getElementById("arc-archive-tbody");
  if (!tbody) return;

  var rows = arcDB;
  if (filter) {
    var q = filter.toLowerCase();
    // Если ищут конкретный Assembly_ID — показываем всю структуру
    var exactMatch = rows.filter(function (r) {
      return (
        (r.assembly_id || "").toLowerCase() === q ||
        (r.classifier || "").toLowerCase() === q
      );
    });
    if (exactMatch.length > 0) {
      var aid = exactMatch[0].assembly_id;
      rows = rows.filter(function (r) {
        return r.assembly_id === aid;
      });
    } else {
      rows = rows.filter(function (r) {
        return (
          (r.assembly_id || "").toLowerCase().indexOf(q) !== -1 ||
          (r.item_name || r.name || "").toLowerCase().indexOf(q) !== -1 ||
          (r.classifier || "").toLowerCase().indexOf(q) !== -1
        );
      });
    }
  }

  // Сортировка по иерархии: 0, 1, 1.1, 1.2, 2, 2.1, 2.1.1, ...
  rows.sort(function (a, b) {
    var aidA = a.assembly_id || "";
    var aidB = b.assembly_id || "";
    if (aidA !== aidB) return aidA.localeCompare(aidB);

    var sa = (a.struct_id || a.id || "0").split(".");
    var sb = (b.struct_id || b.id || "0").split(".");
    for (var i = 0; i < Math.max(sa.length, sb.length); i++) {
      var na = parseInt(sa[i]) || 0;
      var nb = parseInt(sb[i]) || 0;
      if (na !== nb) return na - nb;
    }
    return sa.length - sb.length;
  });

  var countEl = document.getElementById("arc-db-count");
  if (countEl) countEl.textContent = arcDB.length;

  if (!rows.length) {
    tbody.innerHTML =
      '<tr><td colspan="11" style="text-align:center;color:var(--text3);padding:24px;font-size:12px;">' +
      (filter ? "Ничего не найдено" : "Архив пуст.") +
      "</td></tr>";
    return;
  }

  var levelColors = ["#10b981", "#f59e0b", "#3b82f6", "#8b5cf6", "#ec4899"];
  var rowBgs = [
    "rgba(16,185,129,0.10)",
    "rgba(245,158,11,0.08)",
    "rgba(59,130,246,0.06)",
    "rgba(139,92,246,0.05)",
    "rgba(236,72,153,0.04)",
  ];

  var prevAid = "";
  tbody.innerHTML = rows
    .map(function (r) {
      var lvl = parseInt(r.level) || 0;
      var colorIdx = Math.min(lvl, 4);
      var sid = r.struct_id || r.id || "—";
      var aid = r.assembly_id || r.assemblyId || "—";
      var isNewGroup = aid !== prevAid;
      prevAid = aid;
      var groupBorder = isNewGroup
        ? "border-top:2px solid " + levelColors[0] + ";"
        : "";
      var nameWeight = lvl === 0 ? "700" : "400";
      var indent = lvl > 0 ? "padding-left:" + lvl * 16 + "px;" : "";
      var labor = r.labor_hours || "";
      var noOps =
        !labor && r.object_type !== "ПКИ" && lvl > 0
          ? ' style="background:var(--red-bg);color:var(--red-text);font-size:9px;padding:2px 6px;border-radius:3px"'
          : "";
      var laborDisplay = labor
        ? labor
        : r.object_type === "ПКИ" || lvl === 0
          ? ""
          : "<span" + noOps + ">нет операций</span>";
      // var serial = r.serial_order || '';
      var serial = r.serial_number || r.serial_order || "";

      return (
        '<tr style="background:' +
        rowBgs[colorIdx] +
        ";" +
        groupBorder +
        '">' +
        '<td class="mono" style="color:' +
        levelColors[0] +
        ';font-size:10px;white-space:nowrap;">' +
        aid +
        "</td>" +
        '<td style="font-size:10px;color:var(--text3);font-family:var(--font-mono)">' +
        sid +
        "</td>" +
        '<td style="' +
        indent +
        "font-weight:" +
        nameWeight +
        '">' +
        (r.item_name || r.name || "—") +
        "</td>" +
        '<td class="mono" style="font-size:10px;color:var(--text2)">' +
        (r.classifier || "—") +
        "</td>" +
        '<td><span class="badge" style="font-size:9px;background:' +
        rowBgs[colorIdx] +
        ";color:" +
        levelColors[colorIdx] +
        ";border:1px solid " +
        levelColors[colorIdx] +
        '">' +
        (r.object_type || r.objectType || "—") +
        "</span></td>" +
        '<td class="mono" style="text-align:center">' +
        (r.quantity || 1) +
        "</td>" +
        '<td><div class="lvl-badge lvl-' +
        colorIdx +
        '">' +
        lvl +
        "</div></td>" +
        '<td class="mono" style="font-size:10px;color:var(--text3)">' +
        (r.parent_id || r.parentId || "—") +
        "</td>" +
        '<td style="text-align:right;font-family:var(--font-mono)">' +
        laborDisplay +
        "</td>" +
        '<td class="mono" style="text-align:center;color:var(--amber-text);font-weight:700">' +
        serial +
        "</td>" +
        '<td style="font-size:10px;color:var(--text3)">' +
        (r.creator_name || "") +
        "</td>" +
        "</tr>"
      );
    })
    .join("");
}

// ── ФИЛЬТРАЦИЯ АРХИВА ─────────────────────────────────────
function arcFilterArchive(q) {
  arcRenderArchive(q || undefined);
}

// ── ОЧИСТКА АРХИВА ────────────────────────────────────────
function arcClearArchive() {
  if (!confirm("Очистить ВЕСЬ архив изделий? Это действие нельзя отменить!"))
    return;

  api("DELETE", "/api/archive").then(function (res) {
    if (res.ok) {
      arcDB = [];
      arcRenderArchive();
      showToast("Архив очищен");
    } else {
      alert("Ошибка очистки: " + (res.error || "неизвестная"));
    }
  });
}

// ── ЭКСПОРТ В CSV ─────────────────────────────────────────
function arcExportCSV() {
  if (!arcDB.length) {
    showToast("Архив пуст");
    return;
  }

  var headers = [
    "ID",
    "Название изделия",
    "Обозначение по классификатору",
    "Кол-во в изделии (шт.)",
    "Тип объекта",
    "Трудоемкость",
    "Родительский ID",
    "Уровень",
    "Assembly_ID",
  ];
  var csvRows = arcDB.map(function (r) {
    return [
      r.struct_id || r.id,
      r.item_name || r.name,
      r.classifier,
      r.quantity,
      r.object_type || r.objectType,
      r.labor_hours || "",
      r.parent_id || r.parentId,
      r.level,
      r.assembly_id || r.assemblyId,
    ]
      .map(function (v) {
        return '"' + String(v || "").replace(/"/g, '""') + '"';
      })
      .join(",");
  });

  var csv = [headers.join(",")].concat(csvRows).join("\n");
  var a = document.createElement("a");
  a.href = URL.createObjectURL(
    new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" }),
  );
  a.download = "archive_" + new Date().toISOString().slice(0, 10) + ".csv";
  a.click();
  showToast("CSV экспортирован");
}

function arcLoadFromDBPrompt() {
  var modal = document.getElementById("arc-load-modal");
  var input = document.getElementById("arc-load-modal-input");
  var err = document.getElementById("arc-load-modal-err");
  input.value = "";
  err.style.display = "none";
  modal.style.display = "flex";
  setTimeout(function () {
    input.focus();
  }, 100);
}

function arcLoadModalClose() {
  document.getElementById("arc-load-modal").style.display = "none";
}

function arcLoadModalConfirm() {
  var input = document.getElementById("arc-load-modal-input");
  var err = document.getElementById("arc-load-modal-err");
  var btn = document.getElementById("arc-load-modal-btn");
  var assemblyId = input.value.trim();

  if (!assemblyId) {
    err.textContent = "Введите обозначение головного изделия";
    err.style.display = "block";
    return;
  }

  btn.disabled = true;
  btn.textContent = "Загрузка...";
  err.style.display = "none";

  api("GET", "/api/archive?assembly_id=" + encodeURIComponent(assemblyId)).then(
    function (res) {
      btn.disabled = false;
      btn.textContent = "Загрузить";
      if (res.ok && res.rows && res.rows.length > 0) {
        arcLoadModalClose();
        arcLoadStructure(assemblyId);
        showToast("Загружена структура: " + res.rows.length + " элементов");
      } else {
        err.textContent = 'Структура "' + assemblyId + '" не найдена в базе';
        err.style.display = "block";
      }
    },
  );
}

// ── Загрузка существующей структуры для редактирования ─────
function arcLoadStructure(assemblyId) {
  api("GET", "/api/archive?assembly_id=" + encodeURIComponent(assemblyId)).then(
    function (res) {
      if (!res.ok || !res.rows || !res.rows.length) {
        showToast("Структура не найдена");
        return;
      }

      // Очищаем таблицу
      var tbody = document.getElementById("arc-tbody");
      tbody.innerHTML = "";

      // Сортируем по иерархии
      var rows = res.rows.sort(function (a, b) {
        var sa = (a.struct_id || "0").split(".").map(Number);
        var sb = (b.struct_id || "0").split(".").map(Number);
        for (var i = 0; i < Math.max(sa.length, sb.length); i++) {
          var na = sa[i] || 0;
          var nb = sb[i] || 0;
          if (na !== nb) return na - nb;
        }
        return 0;
      });

      // Добавляем строки в редактор
      rows.forEach(function (r) {
        var tr = arcBuildRow(
          r.struct_id || "0",
          r.item_name || "",
          r.classifier || "",
          r.quantity || 1,
          r.object_type || "Деталь",
        );
        tbody.appendChild(tr);
      });

      arcRecalcStructure();
      arcUpdateTotalRows();
      arcSelectedIdx = null;

      showToast(
        "Загружена структура: " +
          assemblyId +
          " (" +
          rows.length +
          " элементов)",
      );
    },
  );
}
// ── Автодополнение в строках структуры ────────────────────
var arcAcLock = false;
var arcAcTimers = {};

function arcAcSearch(inputEl, ddId, field) {
  if (arcAcLock) return;
  var q = inputEl.value.trim();
  var dd = document.getElementById(ddId);
  if (!dd) return;
  if (q.length < 2) {
    dd.classList.remove("show");
    return;
  }

  clearTimeout(arcAcTimers[ddId]);
  arcAcTimers[ddId] = setTimeout(function () {
    http(
      "GET",
      "/api/tech-ops/autocomplete?q=" +
        encodeURIComponent(q) +
        "&field=" +
        field,
      null,
      function (res) {
        if (!res.ok || !res.rows || !res.rows.length) {
          dd.classList.remove("show");
          return;
        }
        dd.innerHTML = "";
        res.rows.forEach(function (r) {
          var item = document.createElement("div");
          item.className = "combo-item";
          var typeLabel = r.object_type ? " · " + r.object_type : "";
          item.innerHTML =
            r.name +
            ' <span style="color:var(--text3);font-size:11.5px;font-family:var(--font-mono)">(' +
            r.code +
            typeLabel +
            ")</span>";
          item.addEventListener("click", function () {
            arcAcLock = true;
            var row = inputEl.closest("tr");
            var nameInput = row.querySelector('[name="arc-name"]');
            var codeInput = row.querySelector('[name="arc-classifier"]');
            var typeSelect = row.querySelector('[name="arc-type"]');

            var cleanName =
              r.name && r.name !== "nan" && r.name !== "null" ? r.name : "";
            var cleanCode =
              r.code && r.code !== "nan" && r.code !== "null" ? r.code : "";

            if (field === "product") {
              nameInput.value = cleanName;
              codeInput.value = cleanCode;
            } else {
              codeInput.value = cleanName;
              nameInput.value = cleanCode;
            }

            // Подтягиваем тип объекта
            if (typeSelect && r.object_type) {
              typeSelect.value = r.object_type;
            }

            document.querySelectorAll(".combo-dd").forEach(function (d) {
              d.classList.remove("show");
            });
            arcUpdateAssemblyId();
            setTimeout(function () {
              arcAcLock = false;
            }, 500);

            // Проверяем — это корневой элемент (ID=0)?
            var row = inputEl.closest("tr");
            var idInput = row.querySelector('[name="arc-id"]');
            if (idInput && idInput.value.trim() === "0") {
              // Проверяем есть ли структура в базе
              var checkAssembly =
                field === "classifier" ? cleanName : cleanCode;
              if (checkAssembly) {
                api(
                  "GET",
                  "/api/archive?assembly_id=" +
                    encodeURIComponent(checkAssembly),
                ).then(function (arcRes) {
                  if (arcRes.ok && arcRes.rows && arcRes.rows.length > 1) {
                    if (
                      confirm(
                        'Найдена существующая структура для "' +
                          checkAssembly +
                          '" (' +
                          arcRes.rows.length +
                          " элементов).\n\nЗагрузить для редактирования?",
                      )
                    ) {
                      arcLoadStructure(checkAssembly);
                    }
                  }
                });
              }
            }
          });
          dd.appendChild(item);
        });
        // Позиционируем dropdown поверх всего
        var rect = inputEl.getBoundingClientRect();
        dd.style.position = "fixed";
        dd.style.top = rect.bottom + 2 + "px";
        dd.style.left = rect.left + "px";
        dd.style.width = rect.width + "px";
        dd.style.zIndex = "99999";
        dd.classList.add("show");
      },
    );
  }, 300);
}
