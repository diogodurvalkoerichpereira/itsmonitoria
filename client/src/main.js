import '../styles/app.css';
import { api, setToken } from './api.js';
import { dashboardView } from './views/dashboard.js';
import { monitoriasView } from './views/monitorias.js';
import { operadoresView } from './views/operadores.js';
import { equipesView } from './views/equipes.js';
import { formulariosView } from './views/formularios.js';
import { calibracoesView } from './views/calibracoes.js';
import { contestacoesView } from './views/contestacoes.js';
import { usuariosView } from './views/usuarios.js';
import { feedbackView } from './views/feedback.js';
import { relatoriosView } from './views/relatorios.js';
import { configuracoesView } from './views/configuracoes.js';

const NIVEIS = { monitor: 1, supervisor: 2, coordenador: 3, gerente: 4, admin: 5 };
const PERFIL_LABEL = { monitor: 'Monitor', supervisor: 'Supervisor', coordenador: 'Coordenador', gerente: 'Gerente', admin: 'Administrador' };

// nivel = perfil minimo necessario para ver/abrir o item
const NAV = [
  { grupo: 'Análise' },
  { id: 'dashboard', ic: '📊', label: 'Dashboard', view: dashboardView, nivel: 1 },
  { id: 'monitorias', ic: '🎧', label: 'Monitorias', view: monitoriasView, nivel: 1 },
  { id: 'feedback', ic: '✍️', label: 'Feedback', view: feedbackView, nivel: 1 },
  { id: 'contestacoes', ic: '⚖️', label: 'Contestações', view: contestacoesView, nivel: 2 },
  { id: 'calibracoes', ic: '🎯', label: 'Calibração', view: calibracoesView, nivel: 1 },
  { grupo: 'Gestão' },
  { id: 'relatorios', ic: '📈', label: 'Gerenciar', view: relatoriosView, nivel: 2 },
  { grupo: 'Cadastros' },
  { id: 'operadores', ic: '👤', label: 'Operadores', view: operadoresView, nivel: 2 },
  { id: 'equipes', ic: '👥', label: 'Equipes', view: equipesView, nivel: 3 },
  { id: 'formularios', ic: '📝', label: 'Formulários', view: formulariosView, nivel: 3 },
  { grupo: 'Administração' },
  { id: 'usuarios', ic: '🔐', label: 'Usuários', view: usuariosView, nivel: 4 },
  { id: 'configuracoes', ic: '⚙️', label: 'Configurações', view: configuracoesView, nivel: 5 },
];

let nivelUsuario = 0;

const loginView = document.getElementById('login-view');
const appView = document.getElementById('app-view');
const content = document.getElementById('content');

function montarMenu() {
  const nav = document.getElementById('sidebar-nav');
  let html = '';
  let grupoPendente = null;
  for (const n of NAV) {
    if (n.grupo) { grupoPendente = n.grupo; continue; }
    if (nivelUsuario < n.nivel) continue; // oculta itens sem permissao
    if (grupoPendente) { html += `<div class="sidebar-group">${grupoPendente}</div>`; grupoPendente = null; }
    html += `<div class="sidebar-item" data-id="${n.id}"><span class="ic">${n.ic}</span>${n.label}</div>`;
  }
  nav.innerHTML = html;
  nav.querySelectorAll('[data-id]').forEach((item) => item.onclick = () => navegar(item.dataset.id));
}

async function navegar(id) {
  let item = NAV.find((n) => n.id === id && !n.grupo);
  // bloqueia acesso a telas sem permissao (defesa no front; backend tambem valida)
  if (!item || nivelUsuario < item.nivel) item = NAV.find((n) => n.id === 'dashboard');
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
  window.ITS_USER = usuario;
  nivelUsuario = NIVEIS[usuario.perfil] || 0;
  loginView.classList.add('hidden');
  appView.classList.remove('hidden');
  document.getElementById('user-nome').textContent = usuario.nome;
  document.getElementById('user-perfil').textContent = PERFIL_LABEL[usuario.perfil] || usuario.perfil;
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

function voltarParaLogin() {
  setToken(null);
  location.hash = '';
  appView.classList.add('hidden');
  loginView.classList.remove('hidden');
}

document.getElementById('btn-logout').onclick = async () => {
  try { await api.post('/auth/logout'); } catch {}
  voltarParaLogin();
};

// Se qualquer chamada autenticada receber 401, volta ao login (sem recarregar)
window.addEventListener('its:sessao-expirada', () => {
  if (!appView.classList.contains('hidden')) voltarParaLogin();
});

// Auto-login se houver sessão válida
(async () => {
  try {
    const { usuario } = await api.get('/auth/me');
    if (usuario) entrarApp(usuario);
  } catch { /* sem sessão: permanece na tela de login */ }
})();
