function openPersonalCabinet() {
  document.getElementById('personal-cabinet').style.display = 'flex';
  
  // Заполняем данные
  document.getElementById('cabinet-name').textContent = USER.name || 'Пользователь';
  document.getElementById('cabinet-email').textContent = USER.email || '';
  document.getElementById('cabinet-role').textContent = 
    {admin:'Администратор', technologist:'Технолог', master:'Мастер', dispatcher:'Диспетчер'}[USER.role] || USER.role;

  document.getElementById('cabinet-av').textContent = 
    ((USER.name || '').split(' ').map(w => w[0]).join('') || '??').toUpperCase();
}

function closePersonalCabinet() {
  document.getElementById('personal-cabinet').style.display = 'none';
}

function toggleUserMenu() {
  document.getElementById('user-menu').classList.toggle('show');
}

// Заглушки для будущих функций
function changePassword() {
  alert('Функция смены пароля в разработке');
}



function loadProfileData() {
  // Если пользователь не авторизован — выходим
  if (!USER || !USER.id) return;

  // Принудительно запрашиваем свежие данные с сервера
  api('GET', `/api/profile/me`).then(res => {   // новый маршрут
    if (res.ok && res.user) {
      // Обновляем глобальный USER свежими данными
      USER = {
        ...USER,
        name: `${res.user.first_name} ${res.user.last_name}`.trim(),
        email: res.user.email,
        firstName: res.user.first_name,
        lastName: res.user.last_name,
        role: res.user.role
      };
    }

    // Обновляем интерфейс
    document.getElementById('profile-name').textContent = USER.name || 'Пользователь';
    document.getElementById('profile-email').textContent = USER.email || '';

    const roleMap = {
      admin: 'Администратор',
      technologist: 'Технолог',
      master: 'Мастер',
      dispatcher: 'Диспетчер'
    };
    document.getElementById('profile-role').textContent = roleMap[USER.role] || USER.role;

    const initials = (USER.name || '??')
      .split(' ')
      .map(w => w[0])
      .join('')
      .toUpperCase();
    
    document.getElementById('profile-av').textContent = initials;

    updateSidebarUserInfo();
  }).catch(() => {
    // Если запрос не удался — показываем то, что есть
    document.getElementById('profile-name').textContent = USER.name || 'Пользователь';
    document.getElementById('profile-email').textContent = USER.email || '';
    updateSidebarUserInfo();
  });
}


function loadAllUsers() {
  api('GET', '/api/users').then(function(res) {
    if (!res.ok) { alert(res.error || 'Нет доступа'); return; }
    var cnt = document.getElementById('users-count');
    if (cnt) cnt.textContent = 'Всего: ' + res.users.length;
    var roleMap = {admin:'Администратор', technologist:'Технолог', master:'Мастер', dispatcher:'Диспетчер'};
    var tbody = document.getElementById('users-tbody');
    tbody.innerHTML = res.users.map(function(user) {
      var fullName = ((user.first_name || '') + ' ' + (user.last_name || '')).trim() || '—';
      var lastLogin = user.last_login
        ? new Date(user.last_login).toLocaleString('ru-RU', {dateStyle:'short', timeStyle:'short'})
        : '—';
      var isSelf = USER && user.id === USER.id;
      var sf = (user.first_name || '').replace(/'/g,"\\'");
      var sl = (user.last_name  || '').replace(/'/g,"\\'");
      var se = (user.email      || '').replace(/'/g,"\\'");
      var sn = fullName.replace(/'/g,"\\'");
      return '<tr>'
        + '<td><strong>' + fullName + '</strong></td>'
        + '<td>' + user.email + '</td>'
        + '<td><span class="badge">' + (roleMap[user.role] || user.role) + '</span></td>'
        + '<td style="color:' + (user.is_active ? '#4ade80' : '#f87171') + '">'
        + (user.is_active ? '● Активен' : '● Заблокирован') + '</td>'
        + '<td>' + lastLogin + '</td>'
        + '<td>' + new Date(user.created_at).toLocaleDateString('ru-RU') + '</td>'
        + '<td style="white-space:nowrap">'
        + '<button onclick="adminOpenEditUser(' + user.id + ',\'' + sf + '\',\'' + sl + '\',\'' + se + '\',\'' + user.role + '\',' + user.is_active + ')" '
        + 'style="padding:3px 8px;font-size:11px;background:#334155;border:1px solid var(--border);border-radius:4px;color:var(--text2);cursor:pointer;margin-right:4px">✏️ Изменить</button>'
        + '<button onclick="adminOpenChangePassword(' + user.id + ',\'' + sn + '\')" '
        + 'style="padding:3px 8px;font-size:11px;background:#334155;border:1px solid var(--border);border-radius:4px;color:var(--text2);cursor:pointer;margin-right:4px">🔑 Пароль</button>'
        + (!isSelf
          ? '<button onclick="adminDeleteUser(' + user.id + ',\'' + sn + '\')" '
          + 'style="padding:3px 8px;font-size:11px;background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.4);border-radius:4px;color:#f87171;cursor:pointer">🗑 Удалить</button>'
          : '<span style="font-size:10px;color:var(--text3);padding:3px 6px;">— вы —</span>')
        + '</td></tr>';
    }).join('');
  });
}

// ====================== ADMIN: CRUD ПОЛЬЗОВАТЕЛЕЙ ======================

function adminOpenAddUser() {
  document.getElementById('admin-user-modal-title').textContent = 'Добавить пользователя';
  document.getElementById('admin-edit-id').value = '';
  document.getElementById('admin-edit-firstname').value = '';
  document.getElementById('admin-edit-lastname').value = '';
  document.getElementById('admin-edit-email').value = '';
  document.getElementById('admin-edit-role').value = 'master';
  document.getElementById('admin-edit-active').value = 'true';
  document.getElementById('admin-edit-password').value = '';
  document.getElementById('admin-edit-pass-wrap').style.display = '';
  document.getElementById('admin-user-modal-err').style.display = 'none';
  document.getElementById('admin-user-modal').style.display = 'flex';
}

function adminOpenEditUser(id, firstName, lastName, email, role, isActive) {
  document.getElementById('admin-user-modal-title').textContent = 'Редактировать пользователя';
  document.getElementById('admin-edit-id').value = id;
  document.getElementById('admin-edit-firstname').value = firstName;
  document.getElementById('admin-edit-lastname').value = lastName;
  document.getElementById('admin-edit-email').value = email;
  document.getElementById('admin-edit-role').value = role;
  document.getElementById('admin-edit-active').value = isActive ? 'true' : 'false';
  document.getElementById('admin-edit-pass-wrap').style.display = 'none';
  document.getElementById('admin-user-modal-err').style.display = 'none';
  document.getElementById('admin-user-modal').style.display = 'flex';
}

function adminCloseUserModal() {
  document.getElementById('admin-user-modal').style.display = 'none';
}

function adminSaveUser() {
  var id        = document.getElementById('admin-edit-id').value;
  var firstName = document.getElementById('admin-edit-firstname').value.trim();
  var lastName  = document.getElementById('admin-edit-lastname').value.trim();
  var email     = document.getElementById('admin-edit-email').value.trim();
  var role      = document.getElementById('admin-edit-role').value;
  var isActive  = document.getElementById('admin-edit-active').value === 'true';
  var password  = document.getElementById('admin-edit-password').value;
  var errEl     = document.getElementById('admin-user-modal-err');

  if (!firstName || !email) {
    errEl.textContent = 'Имя и email обязательны';
    errEl.style.display = 'block';
    return;
  }
  if (!id && (!password || password.length < 6)) {
    errEl.textContent = 'Пароль обязателен (минимум 6 символов)';
    errEl.style.display = 'block';
    return;
  }

  var body = { firstName: firstName, lastName: lastName, email: email, role: role, isActive: isActive };
  if (!id) body.password = password;

  api(id ? 'PUT' : 'POST', id ? '/api/users/' + id : '/api/users', body).then(function(res) {
    if (res.ok) {
      adminCloseUserModal();
      loadAllUsers();
    } else {
      errEl.textContent = res.error || 'Ошибка сохранения';
      errEl.style.display = 'block';
    }
  });
}

function adminOpenChangePassword(id, name) {
  document.getElementById('admin-pass-uid').value = id;
  document.getElementById('admin-pass-user-name').textContent = 'Пользователь: ' + name;
  document.getElementById('admin-new-pass').value = '';
  document.getElementById('admin-pass-modal-err').style.display = 'none';
  document.getElementById('admin-pass-modal').style.display = 'flex';
}

function adminClosePassModal() {
  document.getElementById('admin-pass-modal').style.display = 'none';
}

function adminSavePassword() {
  var id    = document.getElementById('admin-pass-uid').value;
  var pass  = document.getElementById('admin-new-pass').value;
  var errEl = document.getElementById('admin-pass-modal-err');
  if (!pass || pass.length < 6) {
    errEl.textContent = 'Минимум 6 символов';
    errEl.style.display = 'block';
    return;
  }
  api('PUT', '/api/users/' + id + '/password', { password: pass }).then(function(res) {
    if (res.ok) {
      adminClosePassModal();
      alert('✅ Пароль изменён');
    } else {
      errEl.textContent = res.error || 'Ошибка';
      errEl.style.display = 'block';
    }
  });
}

function adminDeleteUser(id, name) {
  if (!confirm('Удалить пользователя «' + name + '»?\n\nЭто действие нельзя отменить!')) return;
  api('DELETE', '/api/users/' + id).then(function(res) {
    if (res.ok) { loadAllUsers(); }
    else { alert('Ошибка: ' + (res.error || 'неизвестная')); }
  });
}

// ====================== РЕДАКТИРОВАНИЕ ПРОФИЛЯ ======================

function editProfile() {
  if (!USER) return;

  document.getElementById('edit-firstname').value = USER.name ? USER.name.split(' ')[0] : '';
  document.getElementById('edit-lastname').value = USER.name ? USER.name.split(' ').slice(1).join(' ') : '';
  document.getElementById('edit-email').value = USER.email || '';

  document.getElementById('edit-profile-modal').style.display = 'flex';
}

function closeEditProfile() {
  document.getElementById('edit-profile-modal').style.display = 'none';
}

function saveProfile() {
  const firstName = document.getElementById('edit-firstname').value.trim();
  const lastName  = document.getElementById('edit-lastname').value.trim();
  const email     = document.getElementById('edit-email').value.trim();

  if (!firstName) {
    alert('Имя обязательно');
    return;
  }

  api('PUT', '/api/profile', {
    firstName: firstName,
    lastName: lastName,
    email: email
  }).then(res => {
    if (res.ok) {
      // Обновляем данные текущего пользователя
      USER.name = `${firstName} ${lastName}`.trim();
      USER.email = email;

      alert('✅ Профиль успешно обновлён!');

      closeEditProfile();
      
      // Обновляем текущий кабинет и сайдбар
      loadProfileData();
      updateSidebarUserInfo();

      // === Автоматическое обновление списка пользователей у админа ===
      const usersPanel = document.getElementById('panel-users');
      if (usersPanel && usersPanel.classList.contains('active')) {
        setTimeout(() => {
          loadAllUsers();
        }, 400);
      }

    } else {
      alert(res.error || 'Ошибка сохранения');
    }
  }).catch(() => {
    alert('Ошибка соединения с сервером');
  });
}


function loadMyRecords() {
  api('GET', '/api/profile/my-records').then(function(res) {
    if (!res.ok) return;

    function fmt(dt) {
      if (!dt) return '—';
      return new Date(dt).toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' });
    }
    function e(v) { return v || '—'; }

    // Технологические операции
    var opsEl = document.getElementById('mr-ops-tbody');
    var opsCount = document.getElementById('mr-ops-count');
    if (opsEl) {
      if (opsCount) opsCount.textContent = res.techOps.length;
      opsEl.innerHTML = res.techOps.length ? res.techOps.map(function(r) {
        return '<tr>'
          + '<td style="font-family:monospace;font-size:10px;color:#60a5fa">' + e(r.classifier_code) + '</td>'
          + '<td>' + e(r.product_name) + '</td>'
          + '<td style="text-align:center;font-weight:700;color:var(--amber-text)">' + e(r.operation_number) + '</td>'
          + '<td style="color:#34d399">' + e(r.operation_name) + '</td>'
          + '<td style="font-size:10px;color:var(--text3)">' + fmt(r.created_at) + '</td>'
          + '</tr>';
      }).join('') : '<tr><td colspan="5" style="text-align:center;color:var(--text3);padding:16px;">Нет записей</td></tr>';
    }

    // Структуры изделий
    var arcEl = document.getElementById('mr-arc-tbody');
    var arcCount = document.getElementById('mr-arc-count');
    if (arcEl) {
      if (arcCount) arcCount.textContent = res.archiveItems.length;
      arcEl.innerHTML = res.archiveItems.length ? res.archiveItems.map(function(r) {
        var aid = e(r.assembly_id);
        return '<tr style="cursor:pointer" onclick="mrOpenArchive(\'' + aid.replace(/'/g,"\\'") + '\')" title="Открыть структуру в архиве">'
          + '<td style="font-family:monospace;font-size:10px;color:#60a5fa">' + aid + '</td>'
          + '<td style="font-weight:600">' + e(r.item_name) + '</td>'
          + '<td style="font-family:monospace;font-size:10px;color:var(--text2)">' + e(r.classifier) + '</td>'
          + '<td><span class="badge" style="font-size:9px">' + e(r.object_type) + '</span></td>'
          + '<td style="font-size:10px;color:var(--text3)">' + fmt(r.created_at) + '</td>'
          + '</tr>';
      }).join('') : '<tr><td colspan="5" style="text-align:center;color:var(--text3);padding:16px;">Нет записей</td></tr>';
    }

    // Производственные наряды
    var prodEl = document.getElementById('mr-prod-tbody');
    var prodCount = document.getElementById('mr-prod-count');
    if (prodEl) {
      if (prodCount) prodCount.textContent = res.productionOrders.length;
      prodEl.innerHTML = res.productionOrders.length ? res.productionOrders.map(function(r) {
        return '<tr>'
          + '<td style="font-family:monospace;font-weight:700;color:var(--accent)">' + e(r.narad_number) + '</td>'
          + '<td>' + e(r.product_name) + '</td>'
          + '<td><span class="badge">' + e(r.status) + '</span></td>'
          + '<td style="font-size:10px;color:var(--text3)">' + fmt(r.created_at) + '</td>'
          + '</tr>';
      }).join('') : '<tr><td colspan="4" style="text-align:center;color:var(--text3);padding:16px;">Нет записей</td></tr>';
    }
  }).catch(function() {
    ['mr-ops-tbody','mr-arc-tbody','mr-prod-tbody'].forEach(function(id) {
      var el = document.getElementById(id);
      if (el) el.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--text3);padding:16px;">Ошибка загрузки</td></tr>';
    });
  });
}

function mrOpenArchive(assemblyId) {
  showPanel('nomenclature');
  if (typeof switchNomTab === 'function') switchNomTab('archive');
  setTimeout(function() {
    var searchEl = document.getElementById('arc-search');
    if (searchEl) {
      searchEl.value = assemblyId;
      if (typeof arcFilterArchive === 'function') arcFilterArchive(assemblyId);
    }
  }, 100);
}

function updateSidebarUserInfo() {
  if (!USER) return;

  const fullName = USER.name || `${USER.firstName || ''} ${USER.lastName || ''}`.trim();

  document.getElementById('sidebar-uname').textContent = fullName || 'Пользователь';
  
  const initials = fullName.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  document.getElementById('sidebar-av').textContent = initials || '??';
}