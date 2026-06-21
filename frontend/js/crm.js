// ============================================================
// crm.js — Канбан-доска CRM
// ============================================================

// ── CRMStore ────────────────────────────────────────────────

function CRMStore() {
  this._columns = [];
  this._cards = [];
  this._fields = [];
}

CRMStore.prototype.loadAll = function(cb) {
  var self = this;
  if (!USER) { if (cb) cb(); return; }
  http('GET', '/api/crm/columns', null, function(colRes) {
    if (!colRes.ok) { showToast('CRM: ' + (colRes.error || 'Ошибка загрузки колонок')); if (cb) cb(); return; }
    self._columns = colRes.rows;
    http('GET', '/api/crm/cards', null, function(cardRes) {
      if (!cardRes.ok) { showToast('CRM: ' + (cardRes.error || 'Ошибка загрузки карточек')); if (cb) cb(); return; }
      self._cards = cardRes.rows;
      http('GET', '/api/crm/fields', null, function(fieldRes) {
        if (!fieldRes.ok) { showToast('CRM: ' + (fieldRes.error || 'Ошибка загрузки полей')); if (cb) cb(); return; }
        self._fields = fieldRes.rows;
        if (cb) cb();
      });
    });
  });
};

CRMStore.prototype.getColumns = function() {
  return this._columns;
};

CRMStore.prototype.getCards = function() {
  return this._cards;
};

CRMStore.prototype.getFields = function() {
  return this._fields;
};

CRMStore.prototype.getCard = function(id) {
  for (var i = 0; i < this._cards.length; i++) {
    if (this._cards[i].id === id) return this._cards[i];
  }
  return null;
};

CRMStore.prototype.addCard = function(card) {
  this._cards.push(card);
};

CRMStore.prototype.updateCard = function(card) {
  for (var i = 0; i < this._cards.length; i++) {
    if (this._cards[i].id === card.id) { this._cards[i] = card; return; }
  }
};

CRMStore.prototype.removeCard = function(id) {
  this._cards = this._cards.filter(function(c) { return c.id !== id; });
};

CRMStore.prototype.moveCard = function(id, column_id, sort_order) {
  for (var i = 0; i < this._cards.length; i++) {
    if (this._cards[i].id === id) {
      this._cards[i].column_id = column_id;
      this._cards[i].sort_order = sort_order;
      return;
    }
  }
};

CRMStore.prototype.setColumns = function(arr) {
  this._columns = arr;
};

CRMStore.prototype.setFields = function(arr) {
  this._fields = arr;
};

// ── CRMRenderer ─────────────────────────────────────────────

function CRMRenderer(store, view) {
  this._store = store;
  this._view = view || 'board';
}

CRMRenderer.prototype.render = function() {
  if (this._view === 'board') {
    this._renderBoard();
  } else {
    this._renderList();
  }
};

CRMRenderer.prototype.setView = function(v) {
  this._view = v;
};

CRMRenderer.prototype.applyFilter = function() {
  var filterVal = document.getElementById('crm-filter-column').value;
  var cards = document.querySelectorAll('.crm-card');
  for (var i = 0; i < cards.length; i++) {
    var cardId = parseInt(cards[i].dataset.cardId);
    var card = this._store.getCard(cardId);
    if (!filterVal || (card && String(card.column_id) === filterVal)) {
      cards[i].style.display = '';
    } else {
      cards[i].style.display = 'none';
    }
  }
};

CRMRenderer.prototype._renderBoard = function() {
  var container = document.getElementById('crm-board');
  container.innerHTML = '';

  var columns = this._store.getColumns();
  var cards = this._store.getCards();

  for (var ci = 0; ci < columns.length; ci++) {
    var col = columns[ci];
    var colDiv = document.createElement('div');
    colDiv.className = 'crm-column';
    colDiv.dataset.columnId = col.id;

    var colCards = cards.filter(function(c) { return c.column_id === col.id; });
    colCards.sort(function(a, b) { return (a.sort_order || 0) - (b.sort_order || 0); });

    colDiv.innerHTML =
      '<div class="crm-column-header">' +
        '<span>' + crmEsc(col.name) + '</span>' +
        '<span class="crm-column-counter">' + colCards.length + '</span>' +
      '</div>' +
      '<div class="crm-column-body" data-column-id="' + col.id + '">' +
        this._cardsHtml(colCards) +
      '</div>';

    container.appendChild(colDiv);
  }

  // SortableJS
  if (typeof Sortable !== 'undefined') {
    var bodies = container.querySelectorAll('.crm-column-body');
    for (var si = 0; si < bodies.length; si++) {
      Sortable.create(bodies[si], {
        group: 'crm-cards',
        animation: 150,
        ghostClass: 'crm-card-dragging',
        onEnd: function(evt) {
          var cardId = parseInt(evt.item.dataset.cardId);
          var newColId = parseInt(evt.to.dataset.columnId);
          var order = Array.prototype.indexOf.call(evt.to.children, evt.item);
          http('POST', '/api/crm/cards/' + cardId + '/move', { column_id: newColId, sort_order: order }, function(r) {
            if (!r.ok) { showToast(r.error || 'Ошибка перемещения'); }
          });
        }
      });
    }
  }
};

CRMRenderer.prototype._cardsHtml = function(cards) {
  var html = '';
  for (var i = 0; i < cards.length; i++) {
    var c = cards[i];
    html += '<div class="crm-card" data-card-id="' + c.id + '" onclick="crmOpenCard(' + c.id + ')">' +
      '<div class="crm-card-title">' + crmEsc(c.title) + '</div>';
    if (c.participants && c.participants.length) {
      html += '<div class="crm-card-meta">' +
        '<span>' + c.participants.length + ' уч.</span>' +
      '</div>';
    }
    html += '</div>';
  }
  return html;
};

CRMRenderer.prototype._renderList = function() {
  var container = document.getElementById('crm-list');
  container.innerHTML = '';

  var cards = this._store.getCards();
  var columns = this._store.getColumns();

  if (!cards.length) { container.innerHTML = '<div style="color:var(--text3);padding:20px;text-align:center;">Нет карточек</div>'; return; }

  var html = '<div class="tbl-wrap"><table><thead><tr>' +
    '<th>Название</th><th>Колонка</th><th>Участники</th><th>Создана</th><th></th>' +
    '</tr></thead><tbody>';

  for (var i = 0; i < cards.length; i++) {
    var c = cards[i];
    var colName = '';
    for (var j = 0; j < columns.length; j++) {
      if (columns[j].id === c.column_id) { colName = columns[j].name; break; }
    }
    var parts = c.participants ? c.participants.length : 0;
    html += '<tr class="crm-card" data-card-id="' + c.id + '">' +
      '<td><a href="#" onclick="crmOpenCard(' + c.id + ');return false" style="color:var(--accent);">' + crmEsc(c.title) + '</a></td>' +
      '<td>' + crmEsc(colName) + '</td>' +
      '<td>' + parts + '</td>' +
      '<td class="mono">' + (c.created_at ? c.created_at.slice(0,10) : '') + '</td>' +
      '<td><button onclick="crmDeleteCard(' + c.id + ')" style="background:none;border:none;color:var(--text3);cursor:pointer;">✕</button></td>' +
      '</tr>';
  }
  html += '</tbody></table></div>';
  container.innerHTML = html;
};

// ── Globals ─────────────────────────────────────────────────

var CRM_SOCKET = null;
var CRM_STORE = null;
var CRM_RENDERER = null;

// ── Init ────────────────────────────────────────────────────

function crmInit() {
  if (CRM_SOCKET) {
    CRM_STORE.loadAll(function() {
      crmPopulateFilterColumns();
      CRM_RENDERER.render();
      CRM_RENDERER.applyFilter();
    });
    return;
  }

  CRM_STORE = new CRMStore();
  CRM_RENDERER = new CRMRenderer(CRM_STORE, 'board');
  CRM_SOCKET = io();

  CRM_SOCKET.on('connect', function() { console.log('CRM Socket: подключен'); });

  CRM_SOCKET.on('crm:card-created', function(card) {
    CRM_STORE.addCard(card);
    CRM_RENDERER.render();
    CRM_RENDERER.applyFilter();
  });
  CRM_SOCKET.on('crm:card-updated', function(card) {
    CRM_STORE.updateCard(card);
    CRM_RENDERER.render();
    CRM_RENDERER.applyFilter();
  });
  CRM_SOCKET.on('crm:card-deleted', function(data) {
    CRM_STORE.removeCard(data.id);
    CRM_RENDERER.render();
    CRM_RENDERER.applyFilter();
    var modalTitle = document.querySelector('.crm-modal-title');
    if (modalTitle && modalTitle.textContent === 'Карточка #' + data.id) {
      crmCloseModal();
    }
  });
  CRM_SOCKET.on('crm:card-moved', function(data) {
    CRM_STORE.moveCard(data.id, data.column_id, data.sort_order);
    CRM_RENDERER.render();
    CRM_RENDERER.applyFilter();
  });
  CRM_SOCKET.on('crm:participants-changed', function(data) {
    var card = CRM_STORE.getCard(data.id);
    if (card) { card.participants = data.participants; }
    CRM_RENDERER.render();
  });
  CRM_SOCKET.on('crm:file-added', function(data) {
    var card = CRM_STORE.getCard(data.card_id);
    if (card && card.files) { card.files.push(data.file); }
  });
  CRM_SOCKET.on('crm:file-deleted', function(data) {
    var card = CRM_STORE.getCard(data.card_id);
    if (card && card.files) {
      card.files = card.files.filter(function(f) { return f.id !== data.file_id; });
    }
  });
  CRM_SOCKET.on('crm:columns-changed', function(data) {
    CRM_STORE.setColumns(data.columns);
    crmPopulateFilterColumns();
    CRM_RENDERER.render();
    CRM_RENDERER.applyFilter();
    crmRefreshColumnsModal();
  });
  CRM_SOCKET.on('crm:fields-changed', function(data) {
    CRM_STORE.setFields(data.fields);
    CRM_RENDERER.render();
    CRM_RENDERER.applyFilter();
    crmRefreshFieldsModal();
    crmLoadDeletedFields();
  });
  CRM_SOCKET.on('crm:access-changed', function(data) {
    if (USER && data.userId === USER.id) {
      showToast('Ваш доступ к CRM изменён');
    }
  });

  CRM_STORE.loadAll(function() {
    crmPopulateFilterColumns();
    CRM_RENDERER.render();
    CRM_RENDERER.applyFilter();
  });
}

// ── Field Input Helpers ─────────────────────────────────────

function crmRenderFieldInput(field, value) {
  var id = 'crm-field-' + field.id;
  var isInactive = field.is_active === false;
  var disabledAttr = isInactive ? ' disabled' : '';
  var inactiveNote = isInactive ? ' <span style="color:var(--text3);font-size:11px;">(поле удалено)</span>' : '';
  var html = '<div class="crm-field"><label>' + crmEsc(field.name) + inactiveNote + '</label>';
  switch (field.type) {
    case 'textarea':
      html += '<textarea id="' + id + '"' + disabledAttr + '>' + crmEsc(value || '') + '</textarea>';
      break;
    case 'number':
      html += '<input type="number" step="any" id="' + id + '" value="' + crmEscAttr(value || '') + '"' + disabledAttr + '>';
      break;
    case 'date':
      html += '<input type="date" id="' + id + '" value="' + crmEscAttr(value || '') + '"' + disabledAttr + '>';
      break;
    case 'checkbox':
      html += '<input type="checkbox" id="' + id + '" value="1"' + (value === '1' ? ' checked' : '') + disabledAttr + '>';
      break;
    case 'link':
      html += '<input type="url" id="' + id + '" value="' + crmEscAttr(value || '') + '"' + disabledAttr + '>';
      break;
    case 'file':
      html += '<input type="file" id="' + id + '" style="font-size:12px;width:100%;"' + disabledAttr + ' multiple>';
      break;
    case 'select':
      html += '<select id="' + id + '"' + disabledAttr + '>';
      if (field.options && Array.isArray(field.options)) {
        for (var oi = 0; oi < field.options.length; oi++) {
          var opt = field.options[oi];
          html += '<option value="' + crmEscAttr(opt) + '"' + (String(opt) === String(value) ? ' selected' : '') + '>' + crmEsc(opt) + '</option>';
        }
      }
      html += '</select>';
      break;
    default:
      html += '<input type="text" id="' + id + '" value="' + crmEscAttr(value || '') + '"' + disabledAttr + '>';
  }
  html += '</div>';
  return html;
}

function crmCollectFields(extraFields) {
  var fieldsMeta = CRM_STORE.getFields();
  if (extraFields && extraFields.length) {
    fieldsMeta = fieldsMeta.concat(extraFields);
  }
  var result = [];
  for (var i = 0; i < fieldsMeta.length; i++) {
    var f = fieldsMeta[i];
    if (f.type === 'file') continue;
    var el = document.getElementById('crm-field-' + f.id);
    if (!el) continue;
    var val;
    if (f.type === 'checkbox') {
      val = el.checked ? '1' : '0';
    } else {
      val = el.value;
    }
    result.push({ field_id: f.id, value: val });
  }
  return result;
}

// ── Card CRUD ───────────────────────────────────────────────

function crmCreateCard() {
  var cols = CRM_STORE.getColumns();
  var fieldsMeta = CRM_STORE.getFields();
  var html = '<div class="crm-field">' +
    '<label>Название *</label>' +
    '<input id="crm-card-form-title" placeholder="Введите название">' +
    '</div>' +
    '<div class="crm-field">' +
    '<label>Описание</label>' +
    '<textarea id="crm-card-form-desc" placeholder="Описание карточки"></textarea>' +
    '</div>' +
    '<div class="crm-field">' +
    '<label>Колонка</label>' +
    '<select id="crm-card-form-col">';

  for (var i = 0; i < cols.length; i++) {
    html += '<option value="' + cols[i].id + '">' + crmEsc(cols[i].name) + '</option>';
  }

  html += '</select></div>';

  for (var i = 0; i < fieldsMeta.length; i++) {
    if (fieldsMeta[i].type === 'file') {
      html += '<div class="crm-field"><label>' + crmEsc(fieldsMeta[i].name) + '</label>' +
        '<div style="font-size:11px;color:var(--text3);padding:8px 0;">Файлы можно прикрепить после создания карточки</div></div>';
      continue;
    }
    html += crmRenderFieldInput(fieldsMeta[i], '');
  }

  crmShowModal('Новая карточка', html, [
    { label: 'Отмена', class: '', action: function() { crmCloseModal(); } },
    { label: 'Создать', class: 'btn-accent', action: function() {
      var title = document.getElementById('crm-card-form-title').value.trim();
      if (!title) { showToast('Введите название'); return; }
      var desc = document.getElementById('crm-card-form-desc').value.trim();
      var colId = parseInt(document.getElementById('crm-card-form-col').value);
      var fieldsData = crmCollectFields();
      var payload = { title: title, description: desc, column_id: colId };
      if (fieldsData.length) payload.fields = fieldsData;
      http('POST', '/api/crm/cards', payload, function(res) {
        if (res.ok) { crmCloseModal(); showToast('Карточка создана'); }
        else { showToast(res.error || 'Ошибка'); }
      });
    } }
  ]);
}

function crmEditCard(cardId) {
  var card = CRM_STORE.getCard(cardId);
  if (!card) return;

  var fieldValues = {};
  if (card.fields && card.fields.length) {
    for (var fi = 0; fi < card.fields.length; fi++) {
      fieldValues[card.fields[fi].field_id] = card.fields[fi].value;
    }
  }

  var fieldsMeta = CRM_STORE.getFields();

  var inactiveFields = [];
  if (card.fields && card.fields.length) {
    for (var fi = 0; fi < card.fields.length; fi++) {
      var cf = card.fields[fi];
      if (cf.is_active === false) {
        inactiveFields.push({
          id: cf.field_id,
          field_id: cf.field_id,
          name: cf.name,
          type: cf.type,
          options: cf.options,
          is_active: false
        });
      }
    }
  }

  http('GET', '/api/crm/users', null, function(usersRes) {
    if (!usersRes.ok) { showToast('Ошибка загрузки пользователей'); return; }

    var participantIds = {};
    if (card.participants) {
      for (var pi = 0; pi < card.participants.length; pi++) {
        participantIds[card.participants[pi].id] = true;
      }
    }

    var partHtml = '<div class="crm-field"><label>Участники</label>' +
      '<div style="max-height:160px;overflow-y:auto;border:1px solid var(--border);border-radius:6px;padding:4px 8px;">';
    for (var ui = 0; ui < usersRes.rows.length; ui++) {
      var u = usersRes.rows[ui];
      var checked = participantIds[u.id] ? 'checked' : '';
      var name = u.first_name;
      if (u.last_name) name += ' ' + u.last_name;
      partHtml += '<label style="display:flex;align-items:center;gap:6px;padding:3px 0;font-size:12px;cursor:pointer;">' +
        '<input type="checkbox" class="crm-part-checkbox" value="' + u.id + '" ' + checked + '>' +
        '<span>' + crmEsc(name) + '</span>' +
        '<span style="color:var(--text3);margin-left:auto;font-size:10px;">' + crmEsc(u.email) + '</span></label>';
    }
    partHtml += '</div></div>';

    var html = '<div class="crm-field">' +
      '<label>Название *</label>' +
      '<input id="crm-card-form-title" value="' + crmEscAttr(card.title) + '">' +
      '</div>' +
      '<div class="crm-field">' +
      '<label>Описание</label>' +
      '<textarea id="crm-card-form-desc">' + crmEsc(card.description || '') + '</textarea>' +
      '</div>';

    for (var i = 0; i < fieldsMeta.length; i++) {
      html += crmRenderFieldInput(fieldsMeta[i], fieldValues[fieldsMeta[i].id] || '');
      if (fieldsMeta[i].type === 'file' && card.files && card.files.length) {
        var fieldFiles = card.files.filter(function(f) { return f.field_id === fieldsMeta[i].id; });
        if (fieldFiles.length) {
          html += '<div style="margin-top:4px;padding-left:12px;font-size:11px;color:var(--text3);">Прикреплено:</div>';
          for (var j = 0; j < fieldFiles.length; j++) {
            var ff = fieldFiles[j];
            html += '<div class="crm-file-item" id="crm-edit-file-' + ff.id + '" style="font-size:11px;padding:2px 0 2px 12px;">' +
              '<a href="/uploads/' + ff.file_name + '" target="_blank">' + crmEsc(ff.original_name) + '</a>' +
              (ff.file_size ? '<span class="crm-file-size">' + (ff.file_size / 1024).toFixed(1) + ' KB</span>' : '') +
              '<button onclick="crmDeleteFile(' + ff.id + ', ' + cardId + ', function(){document.getElementById(\'crm-edit-file-' + ff.id + '\').remove();})" title="Удалить" style="background:none;border:none;color:var(--danger);cursor:pointer;margin-left:6px;">✕</button>' +
              '</div>';
          }
        }
      }
    }

    for (var i = 0; i < inactiveFields.length; i++) {
      html += crmRenderFieldInput(inactiveFields[i], fieldValues[inactiveFields[i].id] || '');
    }

    html += partHtml;

    crmShowModal('Редактировать карточку', html, [
      { label: 'Отмена', class: '', action: function() { crmCloseModal(); } },
      { label: 'Сохранить', class: 'btn-accent', action: function() {
        var title = document.getElementById('crm-card-form-title').value.trim();
        if (!title) { showToast('Введите название'); return; }
        var desc = document.getElementById('crm-card-form-desc').value.trim();
        var fieldsData = crmCollectFields(inactiveFields);
        var payload = { title: title, description: desc };
        if (fieldsData.length) payload.fields = fieldsData;
        http('PUT', '/api/crm/cards/' + cardId, payload, function(res) {
          if (!res.ok) { showToast(res.error || 'Ошибка'); return; }

          var checkboxes = document.querySelectorAll('.crm-part-checkbox');
          var userIds = [];
          for (var ci = 0; ci < checkboxes.length; ci++) {
            if (checkboxes[ci].checked) userIds.push(parseInt(checkboxes[ci].value, 10));
          }
          http('POST', '/api/crm/cards/' + cardId + '/participants', { user_ids: userIds }, function(partRes) {
            if (!partRes.ok) { showToast(partRes.error || 'Ошибка при сохранении участников'); return; }
            crmUploadCardFiles(cardId, function() {
              crmCloseModal();
              showToast('Сохранено');
            });
          });
        });
      } }
    ]);
  });
}

function crmAddFile(cardId, fieldId, cb) {
  var input = document.getElementById('crm-field-' + fieldId);
  if (!input || !input.files || !input.files.length) { if (cb) cb(); return; }
  var fd = new FormData();
  fd.append('card_id', cardId);
  fd.append('field_id', fieldId);
  for (var fi = 0; fi < input.files.length; fi++) {
    fd.append('file', input.files[fi]);
  }
  httpUpload('POST', '/api/crm/upload', fd, function(res) {
    if (!res.ok) { showToast(res.error || 'Ошибка загрузки'); return; }
    showToast('Загружено ' + (res.count || res.rows?.length || input.files.length) + ' файлов');
    if (cb) cb(res);
  });
}

function crmDeleteFile(fileId, cardId, onSuccess) {
  if (!confirm('Удалить файл?')) return;
  http('DELETE', '/api/crm/files/' + fileId, null, function(res) {
    if (res.ok) { showToast('Файл удалён'); if (onSuccess) onSuccess(); else crmOpenCard(cardId); }
    else { showToast(res.error || 'Ошибка удаления'); }
  });
}

function crmUploadCardFiles(cardId, callback) {
  var fieldsMeta = CRM_STORE.getFields();
  var fileFields = [];
  for (var i = 0; i < fieldsMeta.length; i++) {
    if (fieldsMeta[i].type !== 'file') continue;
    var el = document.getElementById('crm-field-' + fieldsMeta[i].id);
    if (el && el.files && el.files.length) fileFields.push(fieldsMeta[i]);
  }
  function next(idx) {
    if (idx >= fileFields.length) { if (callback) callback(); return; }
    crmAddFile(cardId, fileFields[idx].id, function(res) {
      next(idx + 1);
    });
  }
  next(0);
}

function crmDeleteCard(cardId) {
  if (!confirm('Удалить карточку?')) return;
  http('DELETE', '/api/crm/cards/' + cardId, null, function(res) {
    if (res.ok) { showToast('Карточка удалена'); crmCloseModal(); }
    else { showToast(res.error || 'Ошибка'); }
  });
}

function crmOpenCard(cardId) {
  http('GET', '/api/crm/cards/' + cardId, null, function(res) {
    if (!res.ok) { showToast(res.error || 'Ошибка'); return; }
    var card = res.row;
    var html = '';

    html += '<div style="font-size:16px;font-weight:600;margin-bottom:8px;">' + crmEsc(card.title) + '</div>';

    html += '<div style="font-size:11px;color:var(--text3);margin-bottom:12px;">' +
      'Создана: ' + (card.created_at || '').slice(0,10) +
      ' · Изменена: ' + (card.updated_at || '').slice(0,10) +
      '</div>';

    if (card.description) {
      html += '<div class="crm-field-value"><div class="crm-field-label">Описание</div><div class="crm-field-text">' + crmEsc(card.description) + '</div></div>';
    }

    if (card.fields && card.fields.length) {
      html += '<div style="margin-top:12px;"><div class="crm-field-label" style="margin-bottom:6px;">Поля</div>';
      for (var i = 0; i < card.fields.length; i++) {
        if (card.fields[i].type === 'file') continue;
        var isInactive = card.fields[i].is_active === false;
        html += '<div class="crm-field-value"><div class="crm-field-label">' + crmEsc(card.fields[i].name) + (isInactive ? ' <span style="color:var(--text3);font-size:11px;">(поле удалено)</span>' : '') + '</div><div class="crm-field-text">' + crmEsc(card.fields[i].value || '—') + '</div></div>';
      }
      html += '</div>';
    }

    if (card.files && card.files.length) {
      html += '<div style="margin-top:12px;"><div class="crm-field-label">Файлы</div><div class="crm-file-list">';
      for (var i = 0; i < card.files.length; i++) {
        html += '<div class="crm-file-item">' +
          '<a href="/uploads/' + card.files[i].file_name + '" target="_blank">' + crmEsc(card.files[i].original_name) + '</a>' +
          (card.files[i].file_size ? '<span class="crm-file-size">' + (card.files[i].file_size / 1024).toFixed(1) + ' KB</span>' : '') +
          '<button onclick="crmDeleteFile(' + card.files[i].id + ', ' + card.id + ')" title="Удалить файл" style="background:none;border:none;color:var(--danger);cursor:pointer;margin-left:auto;">✕</button>' +
          '</div>';
      }
      html += '</div></div>';
    }

    if (card.participants && card.participants.length) {
      html += '<div style="margin-top:12px;"><div class="crm-field-label">Участники</div><div class="crm-participant-list">';
      for (var i = 0; i < card.participants.length; i++) {
        html += '<span class="crm-participant">' + crmEsc(card.participants[i].first_name || card.participants[i].email) + '</span>';
      }
      html += '</div></div>';
    }

    if (card.fields) {
      var fileFields = [];
      for (var i = 0; i < card.fields.length; i++) {
        if (card.fields[i].type === 'file') fileFields.push(card.fields[i]);
      }
      if (fileFields.length) {
        html += '<div style="margin-top:12px;"><div class="crm-field-label">Загрузить файлы</div>';
        for (var i = 0; i < fileFields.length; i++) {
          var ff = fileFields[i];
          html += '<div style="display:flex;align-items:center;gap:8px;margin-top:6px;">' +
            '<span style="font-size:12px;min-width:80px;">' + crmEsc(ff.name) + '</span>' +
            '<input type="file" id="crm-field-' + ff.field_id + '" style="font-size:12px;flex:1;" multiple>' +
            '<button class="topbar-btn" onclick="crmAddFile(' + card.id + ',' + ff.field_id + ',function(){crmOpenCard(' + card.id + ');})">Загрузить</button>' +
            '</div>';
        }
        html += '</div>';
      }
    }

    html += '<div class="crm-modal-actions">' +
      '<button onclick="crmEditCard(' + card.id + ')" class="topbar-btn">Редактировать</button>' +
      '<button onclick="crmDeleteCard(' + card.id + ')" class="topbar-btn" style="color:var(--red);">Удалить</button>' +
      '</div>';

    crmShowModal('Карточка #' + card.id, html, []);
  });
}

function crmToggleView() {
  var newView = (CRM_RENDERER._view === 'board') ? 'list' : 'board';
  CRM_RENDERER.setView(newView);
  document.getElementById('crm-board').style.display = (newView === 'board') ? 'flex' : 'none';
  document.getElementById('crm-list').style.display = (newView === 'list') ? 'block' : 'none';
  CRM_RENDERER.render();
  CRM_RENDERER.applyFilter();
}

function crmApplyFilter() {
  CRM_RENDERER.applyFilter();
}

function crmPopulateFilterColumns() {
  var sel = document.getElementById('crm-filter-column');
  if (!sel) return;
  var currentVal = sel.value;
  sel.innerHTML = '<option value="">Все статусы</option>';
  var cols = CRM_STORE.getColumns();
  for (var i = 0; i < cols.length; i++) {
    var opt = document.createElement('option');
    opt.value = cols[i].id;
    opt.textContent = cols[i].name;
    sel.appendChild(opt);
  }
  sel.value = currentVal;
}

// ── Columns Management (admin) ─────────────────────────────

function crmManageColumns() {
  if (!CRM_STORE) return;
  var cols = CRM_STORE.getColumns();

  var html = '<div style="margin-bottom:10px;">' +
    '<div style="display:flex;gap:6px;">' +
    '<input id="crm-new-col-name" placeholder="Название колонки" style="flex:1;padding:7px 10px;background:var(--bg3);border:1px solid var(--border2);border-radius:var(--radius);color:var(--text);">' +
    '<button onclick="crmAddColumn()" class="topbar-btn btn-accent">+ Добавить</button>' +
    '</div></div><div id="crm-col-list">';

  for (var i = 0; i < cols.length; i++) {
    html += '<div class="crm-mgmt-item" data-col-id="' + cols[i].id + '">' +
      '<span class="crm-drag-handle">⠿</span>' +
      '<span class="crm-mgmt-name">' + crmEsc(cols[i].name) + '</span>' +
      '<button onclick="crmRenameColumn(' + cols[i].id + ')" title="Переименовать">✎</button>' +
      '<button onclick="crmDeleteColumn(' + cols[i].id + ')" title="Удалить">✕</button>' +
      '</div>';
  }
  html += '</div>';

  crmShowModal('Настройка колонок', html, [
    { label: 'Готово', class: 'btn-accent', action: function() { crmCloseModal(); } }
  ]);
}

function crmRefreshColumnsModal() {
  var colList = document.getElementById('crm-col-list');
  if (!colList) return;
  var cols = CRM_STORE.getColumns();
  var html = '';
  for (var i = 0; i < cols.length; i++) {
    html += '<div class="crm-mgmt-item" data-col-id="' + cols[i].id + '">' +
      '<span class="crm-drag-handle">⠿</span>' +
      '<span class="crm-mgmt-name">' + crmEsc(cols[i].name) + '</span>' +
      '<button onclick="crmRenameColumn(' + cols[i].id + ')" title="Переименовать">✎</button>' +
      '<button onclick="crmDeleteColumn(' + cols[i].id + ')" title="Удалить">✕</button>' +
      '</div>';
  }
  colList.innerHTML = html;
}

function crmAddColumn() {
  var name = document.getElementById('crm-new-col-name').value.trim();
  if (!name) { showToast('Введите название'); return; }
  http('POST', '/api/crm/columns', { name: name, sort_order: CRM_STORE.getColumns().length }, function(res) {
    if (res.ok) { document.getElementById('crm-new-col-name').value = ''; showToast('Колонка добавлена'); }
    else { showToast(res.error || 'Ошибка'); }
  });
}

function crmRenameColumn(colId) {
  var newName = prompt('Новое название:');
  if (!newName || !newName.trim()) return;
  http('PUT', '/api/crm/columns/' + colId, { name: newName.trim() }, function(res) {
    if (res.ok) { showToast('Переименовано'); }
    else { showToast(res.error || 'Ошибка'); }
  });
}

function crmDeleteColumn(colId) {
  if (!confirm('Удалить колонку? Карточки останутся без колонки.')) return;
  http('DELETE', '/api/crm/columns/' + colId, null, function(res) {
    if (res.ok) { showToast('Колонка удалена'); }
    else { showToast(res.error || 'Ошибка'); }
  });
}

// ── Fields Management (admin) ────────────────────────────

function crmManageFields() {
  if (!CRM_STORE) return;
  var fields = CRM_STORE.getFields();

  var types = ['text','textarea','number','date','select','file','checkbox','link'];
  var html = '<div style="margin-bottom:10px;">' +
    '<div style="display:flex;gap:6px;flex-wrap:wrap;">' +
    '<input id="crm-new-field-name" placeholder="Название" style="flex:1;min-width:120px;padding:7px 10px;background:var(--bg3);border:1px solid var(--border2);border-radius:var(--radius);color:var(--text);">' +
    '<select id="crm-new-field-type" onchange="crmToggleFieldOptions()" style="padding:7px 10px;background:var(--bg3);border:1px solid var(--border2);border-radius:var(--radius);color:var(--text);">';
  for (var i = 0; i < types.length; i++) {
    html += '<option value="' + types[i] + '">' + types[i] + '</option>';
  }
  html += '</select>' +
    '<button onclick="crmAddField()" class="topbar-btn btn-accent">+ Добавить</button>' +
    '</div>' +
    '<div id="crm-field-options-wrap" style="display:none;margin-top:6px;">' +
    '<input id="crm-new-field-options" placeholder="Варианты через запятую" style="width:100%;padding:7px 10px;background:var(--bg3);border:1px solid var(--border2);border-radius:var(--radius);color:var(--text);">' +
    '</div></div><div id="crm-field-list">';

  for (var i = 0; i < fields.length; i++) {
    var isSelect = fields[i].type === 'select';
    html += '<div class="crm-mgmt-item">' +
      '<span class="crm-mgmt-name">' + crmEsc(fields[i].name) + ' <span style="color:var(--text3);font-size:10px;">' + fields[i].type + '</span></span>';
    if (isSelect) {
      html += '<button onclick="crmEditFieldOptions(' + fields[i].id + ')" title="Изменить варианты" style="background:none;border:none;color:var(--text3);cursor:pointer;">⚙</button>';
    }
    html += '<button onclick="crmDeleteField(' + fields[i].id + ')" title="Удалить">✕</button>' +
      '</div>';
  }
  html += '</div><div id="crm-deleted-fields"></div>';

  crmShowModal('Настройка полей', html, [
    { label: 'Готово', class: 'btn-accent', action: function() { crmCloseModal(); } }
  ]);

  crmLoadDeletedFields();
}

function crmLoadDeletedFields() {
  http('GET', '/api/crm/fields/deleted', null, function(res) {
    var delContainer = document.getElementById('crm-deleted-fields');
    if (!delContainer) return;

    if (!res.ok || !res.rows || !res.rows.length) {
      delContainer.innerHTML = '';
      return;
    }

    var delHtml = '<hr style="margin:16px 0;border-color:var(--border2);">' +
      '<h4 style="margin:0 0 8px;color:var(--text3);font-size:13px;">Удалённые поля</h4>';
    for (var i = 0; i < res.rows.length; i++) {
      delHtml += '<div class="crm-mgmt-item" style="opacity:0.6;">' +
        '<span class="crm-mgmt-name">' + crmEsc(res.rows[i].name) + ' <span style="color:var(--text3);font-size:10px;">' + res.rows[i].type + '</span></span>' +
        '<button onclick="crmRestoreField(' + res.rows[i].id + ')" title="Восстановить" style="background:none;border:none;color:#4caf50;cursor:pointer;">↩ Восстановить</button>' +
        '</div>';
    }
    delContainer.innerHTML = delHtml;
  });
}

function crmRefreshFieldsModal() {
  var list = document.getElementById('crm-field-list');
  if (!list) return;
  var fields = CRM_STORE.getFields();
  var html = '';
  for (var i = 0; i < fields.length; i++) {
    var isSelect = fields[i].type === 'select';
    html += '<div class="crm-mgmt-item">' +
      '<span class="crm-mgmt-name">' + crmEsc(fields[i].name) +
      ' <span style="color:var(--text3);font-size:10px;">' + fields[i].type + '</span></span>';
    if (isSelect) {
      html += '<button onclick="crmEditFieldOptions(' + fields[i].id + ')" title="Изменить варианты" style="background:none;border:none;color:var(--text3);cursor:pointer;">⚙</button>';
    }
    html += '<button onclick="crmDeleteField(' + fields[i].id + ')" title="Удалить">✕</button>' +
      '</div>';
  }
  list.innerHTML = html;
}

function crmToggleFieldOptions() {
  var typeEl = document.getElementById('crm-new-field-type');
  var optsWrap = document.getElementById('crm-field-options-wrap');
  if (typeEl && optsWrap) {
    optsWrap.style.display = (typeEl.value === 'select') ? 'block' : 'none';
  }
}

function crmAddField() {
  var name = document.getElementById('crm-new-field-name').value.trim();
  var type = document.getElementById('crm-new-field-type').value;
  if (!name) { showToast('Введите название'); return; }
  var payload = { name: name, type: type, sort_order: CRM_STORE.getFields().length };
  if (type === 'select') {
    var opts = document.getElementById('crm-new-field-options').value;
    if (opts && opts.trim()) {
      payload.options = opts.split(',').map(function(s) { return s.trim(); }).filter(function(s) { return s; });
    }
  }
  http('POST', '/api/crm/fields', payload, function(res) {
    if (res.ok) { document.getElementById('crm-new-field-name').value = ''; showToast('Поле добавлено'); }
    else { showToast(res.error || 'Ошибка'); }
  });
}

function crmEditFieldOptions(fieldId) {
  var field = null;
  var allFields = CRM_STORE.getFields();
  for (var fi = 0; fi < allFields.length; fi++) {
    if (allFields[fi].id === fieldId) { field = allFields[fi]; break; }
  }
  if (!field) return;
  var currentOpts = (field.options && Array.isArray(field.options)) ? field.options.join(', ') : '';
  var optsStr = prompt('Введите варианты через запятую:', currentOpts);
  if (optsStr === null) return;
  var options = optsStr.split(',').map(function(s) { return s.trim(); }).filter(function(s) { return s; });
  http('PUT', '/api/crm/fields/' + fieldId, { name: field.name, type: 'select', options: options }, function(res) {
    if (res.ok) { showToast('Варианты обновлены'); }
    else { showToast(res.error || 'Ошибка'); }
  });
}

function crmDeleteField(fieldId) {
  if (!confirm('Удалить поле?')) return;
  http('DELETE', '/api/crm/fields/' + fieldId, null, function(res) {
    if (res.ok) { showToast('Поле удалено'); }
    else { showToast(res.error || 'Ошибка'); }
  });
}

function crmRestoreField(fieldId) {
  http('POST', '/api/crm/fields/' + fieldId + '/restore', null, function(res) {
    if (!res.ok) { showToast(res.error || 'Ошибка'); return; }
    showToast('Поле восстановлено');
  });
}

// ── Access Management (admin) ─────────────────────────────

function crmManageAccess() {
  http('GET', '/api/crm/users', null, function(usersRes) {
    if (!usersRes.ok) { showToast('Ошибка загрузки пользователей'); return; }
    http('GET', '/api/crm/access', null, function(accessRes) {
      if (!accessRes.ok) { showToast('Ошибка загрузки доступа'); return; }

      var accessIds = {};
      for (var i = 0; i < accessRes.rows.length; i++) {
        accessIds[accessRes.rows[i].id] = true;
      }

      var html = '';
      for (var i = 0; i < usersRes.rows.length; i++) {
        var u = usersRes.rows[i];
        var checked = accessIds[u.id] ? 'checked' : '';
        html += '<div class="crm-access-row">' +
          '<input type="checkbox" ' + checked + ' onchange="crmToggleAccess(' + u.id + ', this.checked)">' +
          '<span>' + crmEsc(u.first_name + ' ' + (u.last_name || '')) + '</span>' +
          '<span style="color:var(--text3);font-size:10px;">' + crmEsc(u.email) + '</span>' +
          '</div>';
      }

      crmShowModal('Настройка доступа к CRM', html, [
        { label: 'Готово', class: 'btn-accent', action: function() { crmCloseModal(); } }
      ]);
    });
  });
}

function crmToggleAccess(userId, grant) {
  if (grant) {
    http('POST', '/api/crm/access', { user_id: userId }, function(res) {
      if (!res.ok) showToast(res.error || 'Ошибка');
    });
  } else {
    http('DELETE', '/api/crm/access/' + userId, null, function(res) {
      if (!res.ok) showToast(res.error || 'Ошибка');
    });
  }
}

// ── Modal Helpers ─────────────────────────────────────────

function crmShowModal(title, bodyHtml, buttons) {
  var existing = document.getElementById('crm-modal-overlay');
  if (existing) existing.remove();

  var overlay = document.createElement('div');
  overlay.id = 'crm-modal-overlay';
  overlay.className = 'crm-modal';
  overlay.onclick = function(e) { if (e.target === overlay) crmCloseModal(); };

  var btnHtml = '';
  for (var i = 0; i < buttons.length; i++) {
    var b = buttons[i];
    btnHtml += '<button class="topbar-btn ' + (b.class || '') + '" onclick="crmModalAction(' + i + ')">' + crmEsc(b.label) + '</button>';
  }

  overlay.innerHTML = '<div class="crm-modal-content">' +
    '<div class="crm-modal-title">' + crmEsc(title) + '</div>' +
    bodyHtml +
    (btnHtml ? '<div class="crm-modal-actions">' + btnHtml + '</div>' : '') +
    '</div>';

  document.body.appendChild(overlay);
  window.__crmModalButtons = buttons;
}

function crmModalAction(index) {
  var btns = window.__crmModalButtons;
  if (btns && btns[index] && btns[index].action) btns[index].action();
}

function crmCloseModal() {
  var overlay = document.getElementById('crm-modal-overlay');
  if (overlay) overlay.remove();
  window.__crmModalButtons = null;
}

// ── Helpers ───────────────────────────────────────────────

function crmEsc(str) {
  if (str == null) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function crmEscAttr(str) {
  return crmEsc(str).replace(/'/g, '&#39;');
}
