import { api, setToken } from './api.js';
import { dashboardView } from './views/dashboard.js';
import { monitoriasView } from './views/monitorias.js';
import { operadoresView } from './views/operadores.js';
import { equipesView } from './views/equipes.js';
import { formulariosView } from './views/formularios.js';
import { calibracoesView } from './views/calibracoes.js';
import { contestacoesView } from './views/contestacoes.js';

const NAV = [
  { grupo: 'Análise' },
  { id: 'dashboard', ic: '📊', label: 'Dashboard', view: dashboardView },
  { id: 'monitorias', ic: '🎧', label: 'Monitorias', view: monitoriasView },
  { id: 'contestacoes', ic: '⚖️', label: 'Contestações', view: contestacoesView },
  { id: 'calibracoes', ic: '🎯', label: 'Calibração', view: calibracoesView },
  { grupo: 'Cadastros' },
  { id: 'operadores', ic: '👤', label: 'Operadores', view: operadoresView },
  { id: 'equipes', ic: '👥', label: 'Equipes', view: equipesView },
  { id: 'formularios', ic: '📝', label: 'Formulários', view: formulariosView },
];

const loginView = document.getElementById('login-view');
const appView = document.getElementById('app-view');
const content = document.getElementById('content');

function montarMenu() {
  const nav = document.getElementById('sidebar-nav');
  nav.innerHTML = NAV.map((n) =>
    n.grupo ? `<div class="sidebar-group">${n.grupo}</div>`
            : `<div class="sidebar-item" data-id="${n.id}"><span class="ic">${n.ic}</span>${n.label}</div>`
  ).join('');
  nav.querySelectorAll('[data-id]').forEach((item) => item.onclick = () => navegar(item.dataset.id));
}

async function navegar(id) {
  const item = NAV.find((n) => n.id === id) || NAV.find((n) => n.id === 'dashboard');
  document.querySelectorAll('.sidebar-item').forEach((el) =>
    el.classList.toggle('active', el.dataset.id === item.id));
  document.getElementById('topbar-title').textContent = item.label;
  location.hash = item.id;
  try {
    await item.view(content);
  } catch (e) {
    content.innerHTML = `<div class="its-alert alert-error">Erro ao carregar: ${e.message}</div>`;
  }
}

function entrarApp(usuario) {
  loginView.classList.add('hidden');
  appView.classList.remove('hidden');
  document.getElementById('user-nome').textContent = usuario.nome;
  document.getElementById('user-perfil').textContent = ({ admin: 'Administrador', supervisor: 'Supervisor', monitor: 'Monitor' })[usuario.perfil] || usuario.perfil;
  document.getElementById('user-avatar').textContent = usuario.nome.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();
  montarMenu();
  navegar(location.hash.slice(1) || 'dashboard');
}

// Login
document.getElementById('login-form').onsubmit = async (e) => {
  e.preventDefault();
  const erro = document.getElementById('login-error');
  erro.classList.add('hidden');
  try {
    const { token, usuario } = await api.post('/auth/login', {
      email: document.getElementById('login-email').value,
      senha: document.getElementById('login-senha').value,
    });
    setToken(token);
    entrarApp(usuario);
  } catch (err) {
    erro.textContent = err.message;
    erro.classList.remove('hidden');
  }
};

document.getElementById('btn-logout').onclick = async () => {
  try { await api.post('/auth/logout'); } catch {}
  setToken(null);
  location.hash = '';
  appView.classList.add('hidden');
  loginView.classList.remove('hidden');
};

// Auto-login se houver sessão válida
(async () => {
  try {
    const { usuario } = await api.get('/auth/me');
    if (usuario) entrarApp(usuario);
  } catch { /* sem sessão */ }
})();
