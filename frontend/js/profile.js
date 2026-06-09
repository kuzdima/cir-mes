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
  api('GET', '/api/users').then(res => {
    if (!res.ok) {
      alert(res.error || 'Нет доступа');
      return;
    }

    const tbody = document.getElementById('users-tbody');
    tbody.innerHTML = res.users.map(user => {
      const fullName = `${user.first_name || ''} ${user.last_name || ''}`.trim() || '—';
      const shortHash = user.password_hash ? user.password_hash.substring(0, 25) + '...' : '—';
      const lastLogin = user.last_login 
        ? new Date(user.last_login).toLocaleString('ru-RU', {dateStyle: 'short', timeStyle: 'short'}) 
        : '—';

      return `
        <tr>
          <td><strong>${fullName}</strong></td>
          <td>${user.email}</td>
          <td><span class="badge">${user.role}</span></td>
          <td style="color: ${user.is_active ? '#4ade80' : '#f87171'}">
            ${user.is_active ? '● Активен' : '● Заблокирован'}
          </td>
          <td style="font-family: monospace; font-size: 12px; color: #64748b;">
            ${shortHash}
          </td>
          <td>${lastLogin}</td>
          <td>${new Date(user.created_at).toLocaleDateString('ru-RU')}</td>
        </tr>
      `;
    }).join('');
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


function updateSidebarUserInfo() {
  if (!USER) return;

  const fullName = USER.name || `${USER.firstName || ''} ${USER.lastName || ''}`.trim();

  document.getElementById('sidebar-uname').textContent = fullName || 'Пользователь';
  
  const initials = fullName.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  document.getElementById('sidebar-av').textContent = initials || '??';
}