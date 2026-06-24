// ============================================================
// auth.js — Авторизация
// ============================================================
function doLogin() {
  var email = document.getElementById('login-email').value.trim();
  var pass  = document.getElementById('login-pass').value;
  var err   = document.getElementById('login-err');
  err.classList.remove('show');
  if (!email || !pass) { err.textContent = 'Заполните email и пароль'; err.classList.add('show'); return; }
  http('POST', '/api/auth/login', {email:email, password:pass}, function(res) {
    if (res.ok) {
      TOKEN = res.token; USER = res.user;
      localStorage.setItem('cir_token', TOKEN);
      localStorage.setItem('cir_user', JSON.stringify(USER));
      applyUser(USER);
    } else { err.textContent = res.error || 'Ошибка'; err.classList.add('show'); }
  });
}

function applyUser(u) {
  document.getElementById('auth-screen').style.display = 'none';

  var parts = (u.name || '').split(' ');
  document.getElementById('sidebar-av').textContent = (((parts[0]||'')[0]||'') + ((parts[1]||'')[0]||'')).toUpperCase() || '??';
  document.getElementById('sidebar-uname').textContent = u.name || u.email;

  var roleMap = {admin:'Администратор', dispatcher:'Диспетчер', master:'Мастер', technologist:'Технолог', warehouse:'Кладовщик'};
  document.getElementById('sidebar-urole').textContent = roleMap[u.role] || u.role;

  // Управление видимостью пункта "Управление пользователями"
  var adminMenu = document.getElementById('admin-users-menu');
  if (adminMenu) {
    adminMenu.style.display = (u.role === 'admin') ? 'block' : 'none';
  }

  // CRM admin buttons
  var crmColsBtn = document.getElementById('crm-columns-btn');
  var crmFieldsBtn = document.getElementById('crm-fields-btn');
  var crmAccessBtn = document.getElementById('crm-access-btn');
  if (crmColsBtn) crmColsBtn.style.display = (u.role === 'admin') ? '' : 'none';
  if (crmFieldsBtn) crmFieldsBtn.style.display = (u.role === 'admin') ? '' : 'none';
  if (crmAccessBtn) crmAccessBtn.style.display = (u.role === 'admin') ? '' : 'none';

  loadRefs();
  initArc();
  showPanel('nomenclature');
}

function doLogout() {
  TOKEN = '';
  USER = null;
  localStorage.removeItem('cir_token');
  localStorage.removeItem('cir_user');

  document.getElementById('user-menu').classList.remove('show');

  // Скрываем меню и очищаем данные предыдущего пользователя
  var adminMenu = document.getElementById('admin-users-menu');
  if (adminMenu) adminMenu.style.display = 'none';
  var usersTbody = document.getElementById('users-tbody');
  if (usersTbody) usersTbody.innerHTML = '';
  var mrOps = document.getElementById('mr-ops-tbody');
  if (mrOps) mrOps.innerHTML = '';
  var mrArc = document.getElementById('mr-arc-tbody');
  if (mrArc) mrArc.innerHTML = '';
  var mrProd = document.getElementById('mr-prod-tbody');
  if (mrProd) mrProd.innerHTML = '';

  document.getElementById('auth-screen').style.display = 'flex';
}
