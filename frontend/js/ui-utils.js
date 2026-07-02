
function textToElement(htmlString) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlString, 'text/html');
    return doc.body.firstElementChild;
}


function constructTable(tableName, headersList = [], tableData = [], delColumn = false, updateColum = false) {
    const fragment = document.createDocumentFragment();

    const table = document.createElement("table");
    table.classList.add("table");
    table.dataset.name = tableName;

    const thead = document.createElement("thead");
    const theadTr = thead.appendChild(document.createElement("tr"));
    const tbody = document.createElement("tbody");

    //Собераем заголовки таблицы 

    // Доп колонка под кнопки удаления записей если передан параметра updateColum = true идет самой первой
    if (updateColum) {
        const th = document.createElement("th");
        th.classList.add("update-column");

        theadTr.appendChild(th);
    };

    for (const header of headersList) {
        const th = document.createElement("th");
        th.textContent = header;

        theadTr.appendChild(th);
    };

    // Доп колонка под кнопки удаления записей если передан параметра delColumn = true
    if (delColumn) {
        const th = document.createElement("th");
        th.classList.add("del-column");
        theadTr.appendChild(th);
    };

    //Собераем тело таблицы 

    for (const dataRow of tableData) {
        const tr = document.createElement("tr");

        if (updateColum) {
            const td = document.createElement("td");
            const updateButton = document.createElement("button");
            updateButton.classList.add("update-btn");
            updateButton.textContent = "✎";
            td.appendChild(updateButton);
            tr.appendChild(td);
        };



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
            const td = document.createElement("td");
            const delButton = document.createElement("button");
            delButton.classList.add("del-btn");
            delButton.textContent = "✖";
            td.appendChild(delButton);
            tr.appendChild(td);
        };


        tbody.appendChild(tr);
    };

    table.appendChild(thead);
    table.appendChild(tbody);

    table.addEventListener("click", async (event) => {
        // console.log(event);
        const target = event.target;
        target.blur();
        const id = target.parentElement.parentElement.dataset.id;
        let tabName = document.getElementById("ref-tab-" + tableName).textContent

        if (target.classList.contains("update-btn")) {

            const formData = await api("GET", `/api/utils/fieldsInfo/${tableName}`);
            const selectedRecord = await api("GET", `/api/reference-tables/${tableName}/${id}`);
            const content = constructFormFields(formData.rows, ["Id", "Значение"], selectedRecord.row);
            summonModal(tableName, "Изменить запись в справочнике: " + tabName, content, changeRefRecord, id)
        }

        if (target.classList.contains("del-btn")) {

            const formData = await api("GET", `/api/utils/fieldsInfo/${tableName}`);
            const idFieldRow = formData.rows.filter((row) => row["column_name"] === "id")
            const selectedRecord = await api("GET", `/api/reference-tables/${tableName}/${id}`);
            const content = constructFormFields(formData.rows, ["Id", "Значение"], selectedRecord.row, true);
            summonModal(tableName, "Удалить запись в справочнике: " + tabName, content, deleteRefRecord, id)
        }

    });

    fragment.appendChild(table);

    return fragment
}


function constructFormFields(fieldList, fieldsTitlesList = [], defaultValuesObj = {}, disabled = false) {
    let fragment = document.createDocumentFragment();
    let form = document.createElement("form");
    for (let i = 0; i < fieldList.length; i++) {
        let field = fieldList[i];
        let fieldName = field.column_comment ? field.column_comment : fieldsTitlesList[i];
        let defaultValue = defaultValuesObj[field.column_name] ? defaultValuesObj[field.column_name] : "";
        let fieldIsRequired = field.is_nullable === "NO" ? "req" : "";
        const inputSpecialAttibute = disabled ? "disabled" : "";
        let fieldTemplate =
            `
      <div class="form-row">
        <div class="form-field">
          <label class="form-lbl ${fieldIsRequired}">${fieldName}</label>
          <div class="combo-wrap">
            <input class="form-inp" name = ${field.column_name} ${inputSpecialAttibute}
            placeholder="Введите значение..." value="${defaultValue}">
          </div>
        </div>
      </div>
      `;

        let fieldElement = textToElement(fieldTemplate);
        form.appendChild(fieldElement);
    }

    if (defaultValuesObj.id) { form.dataset.id = defaultValuesObj.id };

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



function summonModal(id, modalTitle = "Заголовок модалки", content = {}, submitAction, recordId) {
    let modalFullId = "modal-" + id;
    let template = `
        <div id="${modalFullId}" data-id ="${id}" class="modal">
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
              <button class="topbar-btn btn-accent submit-btn">✓ Подтвердить</button>
              <button class="topbar-btn cancel-btn" onclick="document.getElementById('${modalFullId}').remove()">Отмена</button>
            </div>
          </div>
        </div>
  `;

    const modal = textToElement(template);
    if (recordId) { modal.dataset.recordId = recordId; };
    modal.querySelector(`#modal-content-${id}`).replaceChildren(content);
    modal.querySelector(".submit-btn").addEventListener("click", async () => {
        submitModal(modal, submitAction);
    });

    document.querySelector(".content").appendChild(modal);

    modal.setAttribute("tabindex", "0");
    modal.focus();
    modal.querySelectorAll("input:not([name='id'])")[0].focus();



    modal.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            modal.remove()
        }
    });

    return modal
}

function constructSection(sectionId, content = "") {

    const fragment = textToElement(`<div id="${sectionId}"></div>`);
    fragment.replaceChildren(content);

    return fragment
}