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


function textToElement(htmlString) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlString, 'text/html');
  return doc.body.firstElementChild;
}


function getReferenceTablesList() {
  let res = api("GET", "/api/reference-tables");
  return res
}

function coustructTab(tableName, tabInterfaceName, tabId, svgIcon = "") {
  let fragmentHtml =
    `<div class="chrome-tab" id="${tabId}" onclick="switchRefTab('${tableName}')">
              ${svgIcon}
              ${tabInterfaceName}
      </div>
    `;

  return textToElement(fragmentHtml)
}

function constructReferenceTabMenu(tablesList) {

  let fragment = document.createDocumentFragment();

  let idPrefix = "ref-tab-";

  let icon = `<svg viewBox="0 0 24 24">
                <line x1="8" y1="6" x2="21" y2="6" />
                <line x1="8" y1="12" x2="21" y2="12" />
                <line x1="8" y1="18" x2="21" y2="18" />
                <line x1="3" y1="6" x2="3.01" y2="6" />
                <line x1="3" y1="12" x2="3.01" y2="12" />
                <line x1="3" y1="18" x2="3.01" y2="18" />
              </svg>`;


  for (const table of tablesList) {
    let id = idPrefix + table.tableName;

    fragment.appendChild(coustructTab(table.tableName, table.interfaceName, id, icon));
  };

  return fragment

}

function constructTable(tableName, headersList = [], tableData = [], delColumn = false) {
  const fragment = document.createDocumentFragment();

  const table = document.createElement("table");
  table.classList.add("table");
  table.dataset.name = tableName;

  const thead = document.createElement("thead");
  thead.appendChild(document.createElement("tr"));

  const tbody = document.createElement("tbody");

  for (const header of headersList) {
    const th = document.createElement("th");
    th.textContent = header;

    thead.firstElementChild.appendChild(th);
  };

  // Доп колонка под кнопки удаления записей если передан параметра delColumn = true
  if (delColumn) {
    const th = document.createElement("th");
    th.classList.add("del-column")
    thead.firstElementChild.appendChild(th)
  };

  for (const dataRow of tableData) {

    const tr = document.createElement("tr")

    for (const name in dataRow) {
      if (name === "id") {
        tr.dataset.id = dataRow.id;
        continue
      }

      const td = document.createElement("td");
      td.textContent = dataRow[name];
      tr.appendChild(td);
    }

    // Кнопки удаления записей если передан параметра delColumn = true
    if (delColumn) {
      const delRecordCol = document.createElement("td");
      const delButton = document.createElement("button");
      delButton.classList.add("del-btn");
      delButton.textContent = "✖";
      delRecordCol.appendChild(delButton);
      tr.appendChild(delRecordCol);
    };


    tbody.appendChild(tr);
  };

  table.appendChild(thead);
  table.appendChild(tbody);

  fragment.appendChild(table);

  return fragment
}

function constructFormFields(fieldList, fieldsTitlesList = [], defaultValuesObj = {}) {
  let fragment = document.createDocumentFragment();
  let form = document.createElement("form");
  for (let i = 0; i < fieldList.length; i++) {
    let field = fieldList[i];
    let fieldName = field.column_comment ? field.column_comment : fieldsTitlesList[i];
    let defaultValue = defaultValuesObj[field.column_name] ? defaultValuesObj[field.column_name] : "";
    let fieldIsRequired = field.is_nullable === "NO" ? "req" : "";
    let fieldTemplate =
      `
      <div class="form-row">
        <div class="form-field">
          <label class="form-lbl ${fieldIsRequired}">${fieldName}</label>
          <div class="combo-wrap">
            <input class="form-inp" name = ${field.column_name} placeholder="Введите значение..." value="${defaultValue}">
          </div>
        </div>
      </div>
      `;

    let fieldElement = textToElement(fieldTemplate);
    form.appendChild(fieldElement);
  }

  fragment.appendChild(form);

  return fragment
}

function submitModal(modal, action) {
  action(modal);
}

function getModlalData(modal) {
  const result = { data: {}, errors: [] };
  modal.querySelectorAll(".form-field").forEach((e) => {
    const inputElement = e.querySelector("input.form-inp");

    result.data[inputElement.name] = typeof inputElement.value === "string" ? inputElement.value.trim() : inputElement.value;
    if (inputElement.name !== "id" && !inputElement.value.trim()) {
      let required = e.querySelector("label.req");
      if (required) { result.errors.push("Заполните поле: " + required.textContent) };
    }

  });

  return result
}

async function addRefRecord(modal) {
  let result;
  const { data, errors } = getModlalData(modal); // Валидация полей внутри обработчика модалки
  const errorElement = modal.querySelector(".msg-err");

  if (errors.length > 0) {
    const fragment = document.createDocumentFragment();
    errors.forEach((e) => {
      errorEl = textToElement(`<div>${e}</div>`);
      fragment.appendChild(errorEl);
    });
    errorElement.replaceChildren(fragment);
    errorElement.classList.toggle("show", true);
    return
  }

  try {
    result = await api("POST", "/api/reference-tables/ref_operations/", data);
  } catch (error) {
    result = error;
  }

  if (result.ok) {
    modal.remove();
    renderRefTable(modal.dataset.id);
    showToast("Запись успешно добавлена");
    return
  }

  errorElement.replaceChildren(result.message ? result.message : result.error);
  errorElement.classList.toggle("show", true);
};

async function changeRefRecord(modal) {
  let result;
  const { data, errors } = getModlalData(modal); // Валидация полей внутри обработчика модалки
  const errorElement = modal.querySelector(".msg-err");

  if (errors.length > 0) {
    const fragment = document.createDocumentFragment();
    errors.forEach((e) => {
      errorEl = textToElement(`<div>${e}</div>`);
      fragment.appendChild(errorEl);
    });
    errorElement.replaceChildren(fragment);
    errorElement.classList.toggle("show", true);
    return
  }

  try {
    result = await api("PATCH", "/api/reference-tables/ref_operations/", data);
  } catch (error) {
    result = error;
  }

  if (result.ok) {
    modal.remove();
    renderRefTable(modal.dataset.id);
    showToast("Запись успешно добавлена");
    return
  }

  errorElement.replaceChildren(result.message ? result.message : result.error);
  errorElement.classList.toggle("show", true);
};



function summonModal(id, modalTitle = "Заголовок модалки", content = [], submitAction) {
  let modalFullId = "modal-" + id;
  let template = `
        <div id="${modalFullId}" data-id ="${id}" class="modal-overlay">
          <div class="modal-content">
            <div class="modal-header">
              <div class="modal-title" id="modal-title-${id}">${modalTitle}</div>
              <button class="modal-close-btn"
                onclick="document.getElementById('${modalFullId}').remove()">✖</button>
            </div>
            <div class="msg msg-err" ></div>
            <div class="msg msg-ok" ></div>
            <div class="card">
            <div id="modal-content-${id}"></div>
            </div>
            <div class="modal-footer">
              <button class="topbar-btn btn-accent submit-btn">✓ Добавить</button>
              <button class="topbar-btn cancel-btn" onclick="document.getElementById('${modalFullId}').remove()">Отмена</button>
            </div>
          </div>
        </div>
  `

  const modal = textToElement(template);
  modal.querySelector(`#modal-content-${id}`).replaceChildren(content);
  modal.style.display = 'block';
  modal.querySelector(".submit-btn").addEventListener("click", async () => {
    submitModal(modal, submitAction);
  });

  document.querySelector(".content").appendChild(modal)
}


function constructSection(sectionId, tableName, content = "") {

  fragment = textToElement(`<div id="${sectionId}"></div>`);

  fragment.replaceChildren(content);

  let toolbar = document.createElement("div");
  let button = document.createElement("button");

  let tabName = document.getElementById("ref-tab-" + tableName).textContent
  button.classList.add("btn-accent");
  button.textContent = "+ Добавить запись";
  button.dataset.id = tableName;

  button.addEventListener("click", async () => {

    const formData = await api("GET", `/api/utils/fieldsInfo/${tableName}`);

    const content = constructFormFields(formData.rows, ["Id", "Значение"]);
    summonModal(tableName, "Добавить запись в справочник: " + tabName, content, addRefRecord);
  }); // Открытие модалки на создание новой записи



  toolbar.appendChild(button);
  toolbar.classList.add("toolbar");
  fragment.appendChild(toolbar);

  const tableContainer = document.createElement("div");
  tableContainer.classList.add("table-container");
  fragment.appendChild(tableContainer)

  return fragment
}

function counstructReferenceSubSections(tablesList) {
  let fragment = document.createDocumentFragment();

  let idPrefix = "ref-content-";


  for (const table of tablesList) {
    const tableName = table.tableName;
    let id = idPrefix + tableName;

    fragment.appendChild(constructSection(id, tableName));
  };

  return fragment
}



function initReferencesSection() {

  getReferenceTablesList().then((res) => {

    let referenceTablesList = res.rows;


    let tabsSectionParent = document.querySelector("#panel-references .chrome-tabs");
    let sectionsParent = document.querySelector("#panel-references .reference_sections")


    tabsSectionParent.replaceChildren(constructReferenceTabMenu(referenceTablesList));
    sectionsParent.replaceChildren(counstructReferenceSubSections(referenceTablesList));


    let referenceTabsList = document.querySelectorAll('[id^="ref-tab-"]');

    referenceTabsList[0].click();

  })

}


function renderRefTable(tableName) {
  api("GET", `/api/reference-tables/${tableName}`).then(
    (res) => {
      const data = res.rows;
      const table = constructTable(tableName, ["Значение"], data, true);
      document.querySelector(`#ref-content-${tableName} .table-container`).replaceChildren(table);
    });
}