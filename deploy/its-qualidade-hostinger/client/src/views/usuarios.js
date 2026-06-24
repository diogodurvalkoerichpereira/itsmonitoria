import { api } from '../api.js';
import { esc, openModal, toast, h } from '../ui.js';

// [valor, rotulo, nivel, classe-badge]
export const PERFIS = [
  ['monitor', 'Monitor', 1, 'badge-gray'],
  ['supervisor', 'Supervisor', 2, 'badge-blue'],
  ['coordenador', 'Coordenador', 3, 'badge-blue'],
  ['gerente', 'Gerente', 4, 'badge-orange'],
  ['admin', 'Administrador', 5, 'badge-red'],
];
const nivelDe = (p) => PERFIS.find((x) => x[0] === p)?.[2] || 0;
const labelDe = (p) => PERFIS.find((x) => x[0] === p)?.[1] || p;
const badgeDe = (p) => PERFIS.find((x) => x[0] === p)?.[3] || 'badge-gray';

export async function usuariosView(el) {
  el.innerHTML = '<div class="empty">Carregando...</div>';
  const usuarios = await api.get('/usuarios');
  const eu = window.ITS_USER || {};
  const meuNivel = nivelDe(eu.perfil);

  el.innerHTML = `
    <div class="page-head">
      <div class="section-title" style="margin:0">Gestão de Usuários</div>
      <button class="its-btn its-btn-primary" id="novo">+ Novo usuário</button>
    </div>
    <div class="its-alert alert-info">
      <div><b>Níveis de acesso:</b> Monitor (executa monitorias e calibração) · Supervisor (+ operadores e contestações) ·
      Coordenador (+ equipes e formulários) · Gerente (+ gestão de usuários) · Administrador (acesso total).
      Você só pode criar/atribuir perfis até o seu próprio nível.</div>
    </div>
    <div class="its-card table-wrap">
      <table class="its-table">
        <thead><tr><th>Nome</th><th>E-mail</th><th>Perfil</th><th>Status</th><th>Criado em</th><th>Ações</th></tr></thead>
        <tbody>
          ${usuarios.map((u) => `
            <tr>
              <td><b>${esc(u.nome)}</b>${u.id === eu.id ? ' <span class="its-badge badge-gray">você</span>' : ''}</td>
              <td>${esc(u.email)}</td>
              <td><span class="its-badge ${badgeDe(u.perfil)}">${labelDe(u.perfil)}</span></td>
              <td>${u.ativo ? '<span class="its-badge badge-green">Ativo</span>' : '<span class="its-badge badge-gray">Inativo</span>'}</td>
              <td>${(u.criado_em || '').slice(0, 10).split('-').reverse().join('/')}</td>
              <td style="white-space:nowrap">
                <button class="its-btn its-btn-ghost its-btn-sm" data-edit="${u.id}">Editar</button>
                ${u.id !== eu.id ? `<button class="its-btn its-btn-danger its-btn-sm" data-del="${u.id}">Excluir</button>` : ''}
              </td>
            </tr>`).join('') || '<tr><td colspan="6" class="empty">Nenhum usuário</td></tr>'}
        </tbody>
      </table>
    </div>`;

  // perfis que o usuario logado pode atribuir (no maximo o proprio nivel)
  const perfilOptions = (sel) => PERFIS.filter((p) => p[2] <= meuNivel)
    .map((p) => `<option value="${p[0]}" ${sel === p[0] ? 'selected' : ''}>${p[1]}</option>`).join('');

  const abrir = (u) => {
    const novo = !u;
    const form = h(`<form>
      <div class="form-row">
        <div class="form-group"><label class="its-label">Nome</label><input class="its-input" name="nome" value="${esc(u?.nome || '')}" required></div>
        <div class="form-group"><label class="its-label">E-mail</label><input class="its-input" type="email" name="email" value="${esc(u?.email || '')}" required></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label class="its-label">Perfil</label><select class="its-select" name="perfil">${perfilOptions(u?.perfil)}</select></div>
        <div class="form-group"><label class="its-label">${novo ? 'Senha' : 'Nova senha (em branco mantém)'}</label><input class="its-input" type="password" name="senha" ${novo ? 'required' : ''} placeholder="mínimo 6 caracteres"></div>
      </div>
      ${u ? `<label class="its-label" style="display:flex;gap:6px;align-items:center"><input type="checkbox" name="ativo" ${u.ativo ? 'checked' : ''}> Usuário ativo</label>` : ''}
      <div id="u-erro" class="its-alert alert-error hidden" style="margin-top:10px"></div>
    </form>`);
    const salvar = h(`<button class="its-btn its-btn-primary">Salvar</button>`);
    const { close } = openModal({ title: novo ? 'Novo usuário' : 'Editar usuário', body: form, footer: salvar });
    const erro = form.querySelector('#u-erro');
    salvar.onclick = async () => {
      erro.classList.add('hidden');
      const fd = Object.fromEntries(new FormData(form));
      const payload = { nome: fd.nome, email: fd.email, perfil: fd.perfil };
      if (fd.senha) payload.senha = fd.senha;
      if (u) payload.ativo = form.ativo ? form.ativo.checked : true;
      salvar.disabled = true;
      try {
        if (u) await api.put('/usuarios/' + u.id, payload);
        else await api.post('/usuarios', payload);
        close(); toast('Usuário salvo'); usuariosView(el);
      } catch (e) {
        salvar.disabled = false;
        erro.textContent = e.message;
        erro.classList.remove('hidden');
      }
    };
  };

  el.querySelector('#novo').onclick = () => abrir(null);
  el.querySelectorAll('[data-edit]').forEach((b) => b.onclick = () => abrir(usuarios.find((u) => u.id == b.dataset.edit)));
  el.querySelectorAll('[data-del]').forEach((b) => b.onclick = async () => {
    if (!confirm('Excluir este usuário?')) return;
    try { await api.delete('/usuarios/' + b.dataset.del); toast('Usuário excluído'); usuariosView(el); }
    catch (e) { toast(e.message, true); }
  });
}
