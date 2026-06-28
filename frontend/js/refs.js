// ============================================================
// refs.js — Справочники + Комбобокс + Автодополнение
// ============================================================

function loadRefs() {
  if (!TOKEN) {
    setTimeout(loadRefs, 300);
    return;
  }

  http("GET", "/api/tech-ops/refs", null, function (res) {
    if (!res.ok) return;
    REFS = res;

    updateComboDropdown("dd-objectType", res.objectTypes, "tf-objectType");
    updateComboDropdown("dd-materialGrade", res.materials, "tf-materialGrade");
    updateComboDropdown("dd-assortment", res.assortments, "tf-assortment");
    updateComboDropdown("dd-unitOfMeasure", res.units, "tf-unitOfMeasure");
    updateComboDropdown("dd-coating", res.coatings, "tf-coating");

    // Если есть другие комбобоксы — добавляйте сюда
  });
}

function updateComboDropdown(ddId, items, inputId) {
  var dd = document.getElementById(ddId);
  if (!dd || !items) return;
  dd.innerHTML = "";
  items.forEach(function (val) {
    var div = document.createElement("div");
    div.className = "combo-item";
    div.textContent = val;
    div.addEventListener("click", function () {
      document.getElementById(inputId).value = val;
      dd.classList.remove("show");
    });
    dd.appendChild(div);
  });
}

// function comboShow(id) { var d = document.getElementById(id); if (d) d.classList.add('show'); }

function comboShow(id) {
  if (acLock) return;
  var d = document.getElementById(id);
  if (d) d.classList.add("show");
}
function comboHideAll() {
  document.querySelectorAll(".combo-dd").forEach(function (d) {
    d.classList.remove("show");
  });
}

function comboFilter(inputId, ddId) {
  var q = (document.getElementById(inputId).value || "").toLowerCase();
  var d = document.getElementById(ddId);
  if (!d) return;
  d.querySelectorAll(".combo-item").forEach(function (i) {
    i.style.display =
      i.textContent.toLowerCase().indexOf(q) !== -1 ? "" : "none";
  });
  d.classList.add("show");
}

var acLock = false;

function acSearch(inputEl, ddId, field) {
  if (acLock) return;
  var q = inputEl.value.trim();
  var dd = document.getElementById(ddId);
  if (!dd) return;
  if (q.length < 2) {
    dd.classList.remove("show");
    return;
  }
  clearTimeout(acTimers[ddId]);
  acTimers[ddId] = setTimeout(function () {
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
          item.innerHTML =
            r.name +
            ' <span style="color:var(--text3);font-size:10px;font-family:monospace">(' +
            r.code +
            ")</span>";
          item.addEventListener("click", function () {
            // Блокируем повторное открытие
            acLock = true;

            // Заполняем оба поля
            if (field === "product") {
              document.getElementById("tf-orderId").value = r.name;
              document.getElementById("tf-drawing").value = r.code;
            } else {
              document.getElementById("tf-drawing").value = r.name;
              document.getElementById("tf-orderId").value = r.code;
            }

            // Закрываем ВСЕ выпадающие списки
            document.querySelectorAll(".combo-dd").forEach(function (d) {
              d.classList.remove("show");
            });

            // Снимаем блокировку через 500мс
            setTimeout(function () {
              acLock = false;
            }, 500);

            // Подгружаем все остальные данные из архива
            var productName = document.getElementById("tf-orderId").value;
            var classifierCode = document.getElementById("tf-drawing").value;

            api(
              "GET",
              "/api/tech-ops/search?product_name=" +
              encodeURIComponent(productName) +
              "&classifier=" +
              encodeURIComponent(classifierCode),
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

                // Загружаем операции в таблицу
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
                    "Загружено: " + result.operations.length + " операций",
                  );
                } else {
                  showToast("Данные изделия загружены");
                }
              }
            });
          });
          dd.appendChild(item);
        });
        dd.classList.add("show");
      },
    );
  }, 300);
}

// Закрытие всех выпадающих по клику на любое место
document.addEventListener("click", function (e) {
  if (!e.target.closest(".combo-wrap")) {
    document.querySelectorAll(".combo-dd").forEach(function (d) {
      d.classList.remove("show");
    });
  }
});


// Логика построения раздела стправочников.



function getReferenceTablesList() {
  let res = api("GET", "/api/reference-tables")
  return res
}


function constructReferenceTabMenu(tablesList) {

  let finalHtml = ""

  for (const table of tablesList) {
    finalHtml +=
      `<div class="chrome-tab" id="ref-tab-${table.tableName}" onclick="switchRefTab('${table.tableName}')">
              <svg viewBox="0 0 24 24">
                <line x1="8" y1="6" x2="21" y2="6" />
                <line x1="8" y1="12" x2="21" y2="12" />
                <line x1="8" y1="18" x2="21" y2="18" />
                <line x1="3" y1="6" x2="3.01" y2="6" />
                <line x1="3" y1="12" x2="3.01" y2="12" />
                <line x1="3" y1="18" x2="3.01" y2="18" />
              </svg>
              ${table.interfaceName}
            </div>
  `
  };

  return finalHtml

};



function initReferencesSection() {

  getReferenceTablesList().then((res) => {
    
    let referenceTablesList = res.rows;

    

    let tabsSectionParent = document.querySelector("#panel-references .chrome-tabs");

    tabsSectionParent.innerHTML = constructReferenceTabMenu(referenceTablesList);

    let referenceTabsList = document.querySelectorAll('[id^="ref-tab-"]');

    referenceTabsList[0].click();

  })

}