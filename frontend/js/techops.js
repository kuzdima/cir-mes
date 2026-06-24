// ============================================================
// techops.js — Archive list + add operations form
// ============================================================

function loadTechOps() {
  var q = document.getElementById("ops-q")
    ? document.getElementById("ops-q").value
    : "";
  var tp = document.getElementById("ops-type")
    ? document.getElementById("ops-type").value
    : "";
  var tb = document.getElementById("ops-tbody");
  if (!tb) return;
  tb.innerHTML =
    '<tr><td colspan="30" style="text-align:center;color:var(--text3);padding:20px">Загрузка...</td></tr>';

  var url = "/api/tech-ops?limit=50&page=" + OPS_PAGE;
  if (q) url += "&classifier=" + encodeURIComponent(q);
  if (tp) url += "&object_type=" + encodeURIComponent(tp);

  api("GET", url).then(function (res) {
    if (!res.ok || !res.rows || !res.rows.length) {
      tb.innerHTML =
        '<tr><td colspan="30" style="text-align:center;color:var(--text3);padding:20px">Нет данных</td></tr>';
      return;
    }

    var total = res.total || res.rows.length;
    var pages = Math.ceil(total / 50);
    var info = document.getElementById("ops-page-info");
    var tot = document.getElementById("ops-total");
    if (info) info.textContent = "Стр. " + OPS_PAGE + " / " + pages;
    if (tot) tot.textContent = "Всего: " + total;
    var prev = document.getElementById("ops-prev");
    var next = document.getElementById("ops-next");
    if (prev) prev.disabled = OPS_PAGE <= 1;
    if (next) next.disabled = OPS_PAGE >= pages;

    function c(v) {
      return v === null || v === undefined || v === "" || v === "null"
        ? ""
        : String(v);
    }
    function badge(v, cls, label) {
      return v
        ? '<span class="badge ' +
            cls +
            '" style="font-size:9px">' +
            label +
            "</span>"
        : "";
    }

    var prevKey = "";
    tb.innerHTML = res.rows
      .map(function (r) {
        var key = (r.classifier_code || "") + "|" + (r.product_name || "");
        var isNew = key !== prevKey;
        prevKey = key;
        var tb2 = isNew ? "border-top:2px solid rgba(59,130,246,0.25);" : "";
        var bold = isNew ? "font-weight:600;" : "";

        var safeCode = c(r.classifier_code)
          .replace(/&/g, "&amp;")
          .replace(/"/g, "&quot;")
          .replace(/'/g, "&#39;");
        var safeName = c(r.product_name)
          .replace(/&/g, "&amp;")
          .replace(/"/g, "&quot;")
          .replace(/'/g, "&#39;");
        return (
          '<tr data-code="' +
          safeCode +
          '" data-name="' +
          safeName +
          '" onclick="selectOpsRow(this.dataset.code, this.dataset.name, this)" style="cursor:pointer">' +
          // ── ДАННЫЕ ИЗДЕЛИЯ (15 колонок) ──
          '<td style="' +
          tb2 +
          'font-family:monospace;font-size:10px;color:#60a5fa;white-space:nowrap">' +
          c(r.classifier_code) +
          "</td>" +
          '<td style="' +
          tb2 +
          bold +
          '">' +
          c(r.product_name) +
          "</td>" +
          '<td style="' +
          tb2 +
          'font-size:10px;color:var(--text3)">' +
          c(r.notice_number) +
          "</td>" +
          '<td style="' +
          tb2 +
          '">' +
          (c(r.object_type)
            ? '<span class="badge b-gray" style="font-size:9px">' +
              c(r.object_type) +
              "</span>"
            : "") +
          "</td>" +
          '<td style="' +
          tb2 +
          'font-size:10px">' +
          c(r.material_grade) +
          "</td>" +
          '<td style="' +
          tb2 +
          'font-size:10px">' +
          c(r.assortment) +
          "</td>" +
          '<td style="' +
          tb2 +
          'font-family:monospace;text-align:right">' +
          c(r.material_amount) +
          "</td>" +
          '<td style="' +
          tb2 +
          'color:var(--text3)">' +
          c(r.unit_of_measure) +
          "</td>" +
          '<td style="' +
          tb2 +
          'font-size:10px">' +
          c(r.coating) +
          "</td>" +
          '<td style="' +
          tb2 +
          'font-size:10px">' +
          c(r.hardness) +
          "</td>" +
          '<td style="' +
          tb2 +
          'font-size:10px">' +
          c(r.full_name) +
          "</td>" +
          '<td style="' +
          tb2 +
          'font-family:monospace;text-align:right">' +
          c(r.make_qty) +
          "</td>" +
          '<td style="' +
          tb2 +
          'font-family:monospace;text-align:right">' +
          c(r.mass_kg) +
          "</td>" +
          '<td style="' +
          tb2 +
          'font-size:10px">' +
          c(r.dimensions) +
          "</td>" +
          '<td style="' +
          tb2 +
          'font-family:monospace;font-size:10px;border-right:2px solid rgba(59,130,246,0.3)">' +
          c(r.main_order_id) +
          "</td>" +
          // ── ТЕХНОЛОГИЧЕСКИЕ ОПЕРАЦИИ (14 колонок) ──
          '<td style="font-family:monospace;font-weight:700;text-align:center;color:var(--amber-text)">' +
          c(r.operation_number) +
          "</td>" +
          '<td style="font-weight:500;white-space:nowrap;color:#34d399">' +
          c(r.operation_name) +
          "</td>" +
          '<td style="font-size:10px;color:var(--text2)">' +
          c(r.executor) +
          "</td>" +
          '<td style="font-size:10px;color:var(--text3);max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' +
          c(r.machine_resource) +
          "</td>" +
          '<td style="font-size:10px;color:var(--text3)">' +
          c(r.operation_comment) +
          "</td>" +
          '<td style="font-size:10px;color:var(--text3)">' +
          c(r.tool) +
          "</td>" +
          '<td style="font-family:monospace;text-align:right">' +
          c(r.norm_time_hours) +
          "</td>" +
          '<td style="font-family:monospace;text-align:right">' +
          c(r.batch_prep_hours) +
          "</td>" +
          '<td style="text-align:center">' +
          badge(r.is_outsourcing, "b-amber", "Да") +
          "</td>" +
          '<td style="text-align:center">' +
          badge(r.is_final, "b-green", "✓") +
          "</td>" +
          '<td style="text-align:center">' +
          badge(r.is_cnc, "b-blue", "ЧПУ") +
          "</td>" +
          '<td style="font-family:monospace;text-align:right">' +
          c(r.load_per_unit_hours) +
          "</td>" +
          '<td style="font-size:10px;color:var(--text3)">' +
          c(r.product_comment) +
          "</td>" +
          '<td style="font-family:monospace;text-align:right">' +
          c(r.serial_number) +
          "</td>" +
          '<td style="font-size:10px;color:var(--text3)">' +
          c(r.creator_name) +
          "</td>" +
          "</tr>"
        );
      })
      .join("");
  });
}

// ═══════════════════════════════════════════════════════
// TECH OPS FORM
// ═══════════════════════════════════════════════════════
function handleTFAction() {
  var v = document.getElementById("tf-action").value;
  document.getElementById("tf-action-hint").style.display =
    v === "Найти Старое" ? "block" : "none";
}

function trySearchExisting() {
  if (document.getElementById("tf-action").value !== "Найти Старое") return;
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(function () {
    var orderId = document.getElementById("tf-orderId").value.trim();
    var drawing = document.getElementById("tf-drawing").value.trim();
    if (!orderId || !drawing) return;
    api(
      "GET",
      "/api/tech-ops/search?product_name=" +
        encodeURIComponent(orderId) +
        "&classifier=" +
        encodeURIComponent(drawing),
    ).then(function (res) {
      if (res.ok) {
        fillTFForm(res.commonData, res.operations);
        showToast(
          "Загружено из архива: " + res.operations.length + " операций",
        );
      }
    });
  }, 800);
}

function fillTFForm(c, ops) {
  function set(id, v) {
    var el = document.getElementById(id);
    if (el && v != null) el.value = v;
  }
  set("tf-orderId", c.productName);
  set("tf-drawing", c.classifierCode);
  set("tf-objectType", c.objectType);
  set("tf-mainOrderId", c.mainOrderId);
  set("tf-makeQty", c.makeQty);
  set("tf-comments", c.productComment);
  set("tf-noticeNumber", c.noticeNumber);
  set("tf-fullName", c.fullName);
  set("tf-materialGrade", c.materialGrade);
  set("tf-assortment", c.assortment);
  set("tf-materialAmount", c.materialAmount);
  set("tf-unitOfMeasure", c.unitOfMeasure);
  set("tf-coating", c.coating);
  set("tf-hardness", c.hardness);
  set("tf-mass", c.massKg);
  set("tf-dimensions", c.dimensions);
  document.getElementById("tf-ops-body").innerHTML = "";
  ops.forEach(function (op) {
    tfAddOp();
    var rows = document.querySelectorAll("#tf-ops-body tr");
    var row = rows[rows.length - 1];
    function sv(name, v) {
      var el = row.querySelector('[name="' + name + '"]');
      if (!el || v == null) return;
      if (el.type === "checkbox") el.checked = v;
      else el.value = v;
    }
    sv("opNum", op.operationNumber);
    sv("opName", op.operationName);
    sv("opExec", op.executor);
    sv("opMachine", op.machineResource);
    sv("opComment", op.operationComment);
    sv("opTool", op.tool);
    sv("opNorm", op.normTimeHours);
    sv("opBatch", op.batchPrepHours);
    sv("opOutsource", op.isOutsourcing);
    sv("opFinal", op.isFinal);
    sv("opCnc", op.isCnc);
    recalcLoad(row);
    if (op.isFinal) row.classList.add("final-op");
  });
}

function guessExecutor(name) {
  if (!name) return "";
  var n = name.toLowerCase();
  if (/чпу|cnc/.test(n)) return "Оператор ЧПУ";
  var map = [
    [["токарн", "расточ", "обточ", "резьб", "канавк"], "Токарь"],
    [["фрезер", "карман", "паз"], "Фрезеровщик"],
    [["сверл", "зенков", "разверт"], "Сверловщик"],
    [["шлифов", "полиров"], "Шлифовщик"],
    [["слесар"], "Слесарь"],
    [["сборк"], "Слесарь-сборщик"],
    [["контрол", "измерен"], "Контролер ОТК"],
    [["термообр", "закалк", "отпуск"], "Термист"],
    [["свар", "наплав"], "Сварщик"],
    [["литье", "заливк"], "Литейщик"],
  ];
  for (var i = 0; i < map.length; i++) {
    var kws = map[i][0];
    var ex = map[i][1];
    for (var j = 0; j < kws.length; j++) {
      if (n.indexOf(kws[j]) !== -1) return ex;
    }
  }
  return "";
}

function tfAddOp() {
  var tbody = document.getElementById("tf-ops-body");
  var num = String((tbody.children.length + 1) * 5).padStart(3, "0");
  var tr = document.createElement("tr");

  var optsOps =
    '<option value="">— Выберите —</option>' +
    REFS.operations
      .map(function (o) {
        return '<option value="' + o + '">' + o + "</option>";
      })
      .join("");
  var optsMach =
    '<option value="">— Выберите —</option>' +
    REFS.machines
      .map(function (m) {
        return '<option value="' + m + '">' + m + "</option>";
      })
      .join("");

  tr.innerHTML =
    '<td><input type="text" name="opNum" value="' +
    num +
    '" placeholder="005"></td>' +
    '<td><select name="opName" onchange="opNameChanged(this)">' +
    optsOps +
    "</select></td>" +
    '<td><input type="text" name="opExec" placeholder="Автоматически"></td>' +
    '<td><select name="opMachine">' +
    optsMach +
    "</select></td>" +
    '<td><input type="text" name="opComment" placeholder="Особые указания"></td>' +
    '<td><input type="text" name="opTool" placeholder="Резец, фреза"></td>' +
    '<td><input type="number" name="opNorm" value="0" step="0.1" oninput="recalcLoad(this.closest(\'tr\'))"></td>' +
    '<td><input type="number" name="opBatch" value="0.2" step="0.1" oninput="recalcLoad(this.closest(\'tr\'))"></td>' +
    '<td style="text-align:center"><input type="checkbox" name="opOutsource"></td>' +
    '<td style="text-align:center"><input type="checkbox" name="opFinal" onchange="handleFinalChange(this)"></td>' +
    '<td style="text-align:center"><input type="checkbox" name="opCnc"></td>' +
    '<td><input type="number" name="opLoad" value="0.2" readonly step="0.1"></td>' +
    '<td><button class="del-btn" onclick="removeOp(this)">×</button></td>';

  tbody.appendChild(tr);
  markLastFinal();
}

function opNameChanged(sel) {
  var row = sel.closest("tr");
  var name = sel.value;
  row.querySelector('[name="opCnc"]').checked = /чпу|cnc/i.test(name);
  var execInput = row.querySelector('[name="opExec"]');
  if (!execInput.dataset.manual) {
    setTimeout(function () {
      if (!execInput.dataset.manual) execInput.value = guessExecutor(name);
    }, 800);
  }
}

function recalcLoad(row) {
  var norm = parseFloat(row.querySelector('[name="opNorm"]').value) || 0;
  var batch = parseFloat(row.querySelector('[name="opBatch"]').value) || 0;
  row.querySelector('[name="opLoad"]').value = (norm + batch).toFixed(2);
}

function handleFinalChange(cb) {
  cb.closest("tr").classList.toggle("final-op", cb.checked);
}

function markLastFinal() {
  var rows = document.querySelectorAll("#tf-ops-body tr");
  rows.forEach(function (r) {
    r.querySelector('[name="opFinal"]').checked = false;
    r.classList.remove("final-op");
  });
  if (rows.length) {
    rows[rows.length - 1].querySelector('[name="opFinal"]').checked = true;
    rows[rows.length - 1].classList.add("final-op");
  }
}

function removeOp(btn) {
  var tbody = document.getElementById("tf-ops-body");
  if (tbody.children.length <= 1) {
    showToast("Должна быть хотя бы одна операция");
    return;
  }
  btn.closest("tr").remove();
  markLastFinal();
}

function tfAddAnalog() {
  var c = document.getElementById("tf-analogs-container");
  var div = document.createElement("div");
  div.className = "form-field";
  div.style.cssText =
    "display:flex;gap:8px;align-items:center;margin-bottom:8px;";
  div.innerHTML =
    '<input class="form-inp" name="analog" placeholder="АРВЦ.XXXXXX.XXX" style="flex:1;">' +
    '<button onclick="this.closest(\'.form-field\').remove()" style="background:none;border:1px solid var(--border);border-radius:var(--radius);color:var(--text3);padding:5px 10px;cursor:pointer;font-size:11px;">×</button>';
  c.appendChild(div);
}

function tfSubmit() {
  var errEl = document.getElementById("tf-err");
  var okEl = document.getElementById("tf-ok");
  errEl.classList.remove("show");
  okEl.classList.remove("show");

  function g(id) {
    return (
      (document.getElementById(id) && document.getElementById(id).value) ||
      ""
    ).trim();
  }

  var classifierCode = g("tf-drawing");
  var productName = g("tf-orderId");
  var objectType = g("tf-objectType");
  var mainOrderId = g("tf-mainOrderId");

  var errors = [];
  if (!productName) errors.push("Заполните поле «Изделие»");
  if (!classifierCode) errors.push("Заполните поле «Чертёж»");
  if (!objectType) errors.push("Заполните поле «Тип объекта»");
  if (!mainOrderId) errors.push("Заполните поле «Головное изделие»");

  var opRows = document.querySelectorAll("#tf-ops-body tr");
  if (!opRows.length) errors.push("Добавьте хотя бы одну операцию");
  var hasFinal = Array.from(opRows).some(function (r) {
    return r.querySelector('[name="opFinal"]').checked;
  });
  if (!hasFinal) errors.push("Хотя бы одна операция должна быть финальной");

  if (errors.length) {
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
    return;
  }

  var operations = Array.from(opRows).map(function (row) {
    return {
      operationNumber: row.querySelector('[name="opNum"]').value,
      operationName: row.querySelector('[name="opName"]').value,
      executor: row.querySelector('[name="opExec"]').value,
      machineResource: row.querySelector('[name="opMachine"]').value,
      operationComment: row.querySelector('[name="opComment"]').value,
      tool: row.querySelector('[name="opTool"]').value,
      normTimeHours:
        parseFloat(row.querySelector('[name="opNorm"]').value) || 0,
      batchPrepHours:
        parseFloat(row.querySelector('[name="opBatch"]').value) || 0,
      isOutsourcing: row.querySelector('[name="opOutsource"]').checked,
      isFinal: row.querySelector('[name="opFinal"]').checked,
      isCnc: row.querySelector('[name="opCnc"]').checked,
    };
  });

  var analogDrawings = Array.from(
    document.querySelectorAll('#tf-analogs-container [name="analog"]'),
  )
    .map(function (i) {
      return i.value.trim();
    })
    .filter(Boolean);

  var payload = {
    action:
      document.getElementById("tf-action").value === "Найти Старое"
        ? "replace"
        : "new",
    classifierCode: classifierCode,
    productName: productName,
    objectType: objectType,
    mainOrderId: mainOrderId,
    noticeNumber: g("tf-noticeNumber"),
    fullName: g("tf-fullName"),
    materialGrade: g("tf-materialGrade"),
    assortment: g("tf-assortment"),
    materialAmount: g("tf-materialAmount"),
    unitOfMeasure: g("tf-unitOfMeasure"),
    coating: g("tf-coating"),
    hardness: g("tf-hardness"),
    massKg: g("tf-mass"),
    dimensions: g("tf-dimensions"),
    makeQty: g("tf-makeQty"),
    productComment: g("tf-comments"),
    operations: operations,
    analogDrawings: analogDrawings,
  };

  api("POST", "/api/tech-ops", payload).then(function (res) {
    if (res.ok) {
      okEl.textContent = "✓ " + res.message;
      okEl.classList.add("show");
      showToast(res.message);
      setTimeout(function () {
        if (confirm("Данные добавлены. Очистить форму?")) tfClearForm();
      }, 1000);
    } else {
      errEl.textContent = "✗ " + (res.error || "Ошибка при сохранении");
      errEl.classList.add("show");
    }
  });
}

function tfClearForm() {
  [
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
  ].forEach(function (id) {
    var el = document.getElementById(id);
    if (el) el.value = "";
  });
  document.getElementById("tf-ops-body").innerHTML = "";
  document.getElementById("tf-analogs-container").innerHTML = "";
  document.getElementById("tf-err").classList.remove("show");
  document.getElementById("tf-ok").classList.remove("show");
  document.getElementById("tf-action").value = "Новое";
  document.getElementById("tf-action-hint").style.display = "none";
  tfAddOp();
}

// ═══════════════════════════════════════════════════════
var selectedOps = null;

function selectOpsRow(code, name, rowEl) {
  // Снимаем выделение со всех
  document.querySelectorAll("#ops-tbody tr").forEach(function (tr) {
    tr.style.outline = "";
    tr.style.background = "";
  });

  // Выделяем все строки этого изделия
  document.querySelectorAll("#ops-tbody tr").forEach(function (tr) {
    if (tr.dataset.code === code && tr.dataset.name === name) {
      tr.style.outline = "2px solid var(--accent)";
      tr.style.outlineOffset = "-1px";
    }
  });

  selectedOps = { code: code, name: name };

  // Показываем панель действий
  var bar = document.getElementById("ops-action-bar");
  bar.style.display = "flex";
  document.getElementById("ops-selected-info").textContent =
    "Выбрано: " + code + " · " + name;
}

function clearSelection() {
  selectedOps = null;
  document.querySelectorAll("#ops-tbody tr").forEach(function (tr) {
    tr.style.outline = "";
  });
  document.getElementById("ops-action-bar").style.display = "none";
}

function deleteSelected() {
  if (!selectedOps) return;
  if (
    !confirm(
      "Удалить ВСЕ операции для:\n\n" +
        selectedOps.code +
        " · " +
        selectedOps.name +
        "\n\nЭто действие нельзя отменить!",
    )
  )
    return;

  api("DELETE", "/api/tech-ops", {
    classifierCode: selectedOps.code,
    productName: selectedOps.name,
  }).then(function (res) {
    if (res.ok) {
      showToast("Удалено записей: " + res.deleted);
      clearSelection();
      loadTechOps();
    } else {
      alert("Ошибка: " + (res.error || "неизвестная"));
    }
  });
}

function editSelected() {
  if (!selectedOps) return;

  // Открываем форму и загружаем данные
  openAddForm();

  // Ставим режим "Найти старое" (замена)
  var action = document.getElementById("tf-action");
  if (action) action.value = "Найти Старое";
  var hint = document.getElementById("tf-action-hint");
  if (hint) hint.style.display = "block";

  // Загружаем данные
  document.getElementById("tf-orderId").value = selectedOps.name;
  document.getElementById("tf-drawing").value = selectedOps.code;

  api(
    "GET",
    "/api/tech-ops/search?product_name=" +
      encodeURIComponent(selectedOps.name) +
      "&classifier=" +
      encodeURIComponent(selectedOps.code),
  ).then(function (result) {
    if (result.ok && result.commonData) {
      var d = result.commonData;
      var s = function (id, v) {
        var el = document.getElementById(id);
        if (el && v != null && v !== "") el.value = v;
      };
      s("tf-objectType", d.objectType);
      s("tf-mainOrderId", d.mainOrderId);
      s("tf-makeQty", d.makeQty);
      s("tf-fullName", d.fullName);
      s("tf-noticeNumber", d.noticeNumber);
      s("tf-comments", d.productComment);
      s("tf-materialGrade", d.materialGrade);
      s("tf-assortment", d.assortment);
      s("tf-materialAmount", d.materialAmount);
      s("tf-unitOfMeasure", d.unitOfMeasure);
      s("tf-coating", d.coating);
      s("tf-hardness", d.hardness);
      s("tf-mass", d.massKg);
      s("tf-dimensions", d.dimensions);

      if (result.operations && result.operations.length) {
        var tbody = document.getElementById("tf-ops-body");
        tbody.innerHTML = "";
        result.operations.forEach(function (op) {
          tfAddOp();
          var rows = document.querySelectorAll("#tf-ops-body tr");
          var row = rows[rows.length - 1];
          var sv = function (name, v) {
            var el = row.querySelector('[name="' + name + '"]');
            if (!el || v == null) return;
            if (el.type === "checkbox") el.checked = v;
            else el.value = v;
          };
          sv("opNum", op.operationNumber);
          sv("opName", op.operationName);
          sv("opExec", op.executor);
          sv("opMachine", op.machineResource);
          sv("opComment", op.operationComment);
          sv("opTool", op.tool);
          sv("opNorm", op.normTimeHours);
          sv("opBatch", op.batchPrepHours);
          sv("opOutsource", op.isOutsourcing);
          sv("opFinal", op.isFinal);
          sv("opCnc", op.isCnc);
        });
        showToast(
          "Загружено для редактирования: " +
            result.operations.length +
            " операций",
        );
      }
    }
  });
}
