// ============================================================
// auth.js — Авторизация
// ============================================================
console.log('🚀 nav.js ЗАГРУЖЕН УСПЕШНО');
function switchAuthTab(tab) {
  document.getElementById('tab-login').classList.toggle('active', tab==='login');
  document.getElementById('tab-register').classList.toggle('active', tab!=='login');
  document.getElementById('form-login').classList.toggle('active', tab==='login');
  document.getElementById('form-register').classList.toggle('active', tab!=='login');
}

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

function doRegister() {
  var fn = document.getElementById('reg-fname').value.trim();
  var ln = document.getElementById('reg-lname').value.trim();
  var em = document.getElementById('reg-email').value.trim();
  var pw = document.getElementById('reg-pass').value;
  var rl = document.getElementById('reg-role').value;
  var err = document.getElementById('reg-err');
  err.classList.remove('show');
  if (!fn || !em || !pw) { err.textContent = 'Заполните все поля'; err.classList.add('show'); return; }
  if (pw.length < 8) { err.textContent = 'Пароль минимум 8 символов'; err.classList.add('show'); return; }
  http('POST', '/api/auth/register', {firstName:fn,lastName:ln,email:em,password:pw,role:rl}, function(res) {
    if (res.ok) { showToast('Регистрация успешна!'); switchAuthTab('login'); document.getElementById('login-email').value = em; }
    else { err.textContent = res.error || 'Ошибка'; err.classList.add('show'); }
  });
}


function applyUser(u) {
  document.getElementById('auth-screen').style.display = 'none';
  
  var parts = (u.name || '').split(' ');
  document.getElementById('sidebar-av').textContent = (((parts[0]||'')[0]||'') + ((parts[1]||'')[0]||'')).toUpperCase() || '??';
  document.getElementById('sidebar-uname').textContent = u.name || u.email;
  
  var roleMap = {admin:'Администратор', dispatcher:'Диспетчер', master:'Мастер', technologist:'Технолог'};
  document.getElementById('sidebar-urole').textContent = roleMap[u.role] || u.role;

  // Управление видимостью пункта "Управление пользователями"
  var adminMenu = document.getElementById('admin-users-menu');
  if (adminMenu) {
    adminMenu.style.display = (u.role === 'admin') ? 'block' : 'none';
  }

  loadRefs();
  initArc();
}

function doLogout() {
  TOKEN = ''; 
  USER = null;
  localStorage.removeItem('cir_token');
  localStorage.removeItem('cir_user');
  
  document.getElementById('user-menu').classList.remove('show');
  
  // Скрываем меню админа при выходе
  var adminMenu = document.getElementById('admin-users-menu');
  if (adminMenu) adminMenu.style.display = 'none';

  document.getElementById('auth-screen').style.display = 'flex';
}
