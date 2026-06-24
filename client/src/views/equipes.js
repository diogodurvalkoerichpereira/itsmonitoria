import { api } from '../api.js';
import { esc, openModal, toast, h } from '../ui.js';

// Papeis de membro -> perfil correspondente no cadastro de Usuarios.
const PAPEIS = [
  { role: 'supervisores',  perfil: 'supervisor',  titulo: 'Supervisores' },
  { role: 'coordenadores', perfil: 'coordenador', titulo: 'Coordenadores' },
  { role: 'monitores',     perfil: 'monitor',     titulo: 'Monitores' },
  { role: 'gerentes',      perfil: 'gerente',     titulo: 'Gerentes' },
];

export async function equipesView(el) {
  el.innerHTML = '<div class="empty">Carregando...</div>';
  const [equipes, usuarios] = await Promise.all([
    api.get('/equipes'),
    api.get('/equipes/usuarios-disponiveis'),
  ]);
  // usuarios por perfil, para popular as listas de selecao
  const porPerfil = {};
  for (const p of PAPEIS) porPerfil[p.perfil] = usuarios.filter((u) => u.perfil === p.perfil);

  el.innerHTML = `
    <div class="page-head">
      <div class="section-title" style="margin:0">Equipes</div>
      <button class="its-btn its-btn-primary" id="nova-equipe">+ Nova equipe</button>
    </div>
    <div class="its-card table-wrap">
      <table class="its-table">
        <thead><tr>
          <th>Equipe</th>
          <th>Supervisores</th>
          <th>Coordenadores</th>
          <th>Monitores</th>
          <th>Gerentes</th>
          <th>Operadores</th>
          <th>Status</th>
          <th>Ações</th>
        </tr></thead>
        <tbody>
          ${equipes.map((e) => `
            <tr>
              <td><b>${esc(e.nome)}</b>${e.descricao ? `<div style="font-size:.75rem;color:var(--its-muted)">${esc(e.descricao)}</div>` : ''}</td>
              <td>${renderPessoasBadges(e.membros?.supervisores)}</td>
              <td>${renderPessoasBadges(e.membros?.coordenadores)}</td>
              <td>${renderPessoasBadges(e.membros?.monitores)}</td>
              <td>${renderPessoasBadges(e.membros?.gerentes)}</td>
              <td>${e.total_operadores}</td>
              <td>${e.ativo ? '<span class="its-badge badge-green">Ativa</span>' : '<span class="its-badge badge-gray">Inativa</span>'}</td>
              <td>
                <button class="its-btn its-btn-ghost its-btn-sm" data-edit="${e.id}">Editar</button>
                <button class="its-btn its-btn-ghost its-btn-sm" data-del="${e.id}" style="color:var(--its-danger)">Excluir</button>
              </td>
            </tr>`).join('') || '<tr><td colspan="8" class="empty">Nenhuma equipe</td></tr>'}
        </tbody>
      </table>
    </div>`;

  const secaoMembros = (p, selecionados) => `
    <div class="form-group membros-section">
      <label class="its-label membros-label">${p.titulo}</label>
      <div class="membros-list" data-role="${p.role}">
        ${selecionados.map((n) => membroTag(n)).join('')}
      </div>
      <div class="membros-add-row">
        <select class="its-select its-input-sm" data-add-input="${p.role}">
          <option value="">Selecione um usuário…</option>
          ${porPerfil[p.perfil].map((u) => `<option value="${esc(u.nome)}">${esc(u.nome)}</option>`).join('')}
        </select>
        <button type="button" class="its-btn its-btn-sm its-btn-outline" data-add-btn="${p.role}">+ Adicionar</button>
      </div>
      ${porPerfil[p.perfil].length === 0 ? `<div style="font-size:.72rem;color:var(--its-muted);margin-top:4px">Nenhum usuário com perfil ${p.perfil} cadastrado. Cadastre em Usuários.</div>` : ''}
    </div>`;

  const abrirModal = (e) => {
    const sel = (role) => e?.membros?.[role] || [];

    const f = h(`<form class="equipe-form">
      <div class="form-group"><label class="its-label">Nome da equipe</label><input class="its-input" name="nome" value="${esc(e?.nome || '')}" required></div>
      <div class="form-group"><label class="its-label">Descrição</label><textarea class="its-input" name="descricao" rows="2">${esc(e?.descricao || '')}</textarea></div>
      ${PAPEIS.map((p) => secaoMembros(p, sel(p.role))).join('')}
      ${e?.id ? `<label class="its-label" style="margin-top:.5rem"><input type="checkbox" name="ativo" ${e.ativo ? 'checked' : ''}> Equipe ativa</label>` : ''}
    </form>`);

    function wireRemove(tag) {
      const btn = tag.querySelector('.membro-remove');
      if (btn) btn.addEventListener('click', () => tag.remove());
    }
    f.querySelectorAll('.membro-tag').forEach(wireRemove);

    f.querySelectorAll('[data-add-btn]').forEach((btn) => {
      const role = btn.dataset.addBtn;
      const select = f.querySelector(`select[data-add-input="${role}"]`);
      const list = f.querySelector(`[data-role="${role}"]`);
      const addMembro = () => {
        const nome = select.value;
        if (!nome) return;
        const existing = [...list.querySelectorAll('.membro-tag')].map((t) => t.dataset.nome);
        if (existing.includes(nome)) { toast('Já adicionado', true); return; }
        list.insertAdjacentHTML('beforeend', membroTag(nome));
        wireRemove(list.lastElementChild);
        select.value = '';
      };
      btn.addEventListener('click', addMembro);
    });

    const salvar = h(`<button class="its-btn its-btn-primary">Salvar</button>`);
    const { close } = openModal({ title: e?.id ? 'Editar equipe' : 'Nova equipe', body: f, footer: salvar, lg: true });

    salvar.onclick = async () => {
      const fd = Object.fromEntries(new FormData(f));
      const collectNomes = (role) =>
        [...f.querySelectorAll(`[data-role="${role}"] .membro-tag`)].map((t) => t.dataset.nome);

      try {
        const payload = {
          ...fd,
          ativo: f.ativo ? f.ativo.checked : true,
          supervisor: collectNomes('supervisores')[0] || null,
          supervisores:  collectNomes('supervisores'),
          coordenadores: collectNomes('coordenadores'),
          monitores:     collectNomes('monitores'),
          gerentes:      collectNomes('gerentes'),
        };
        if (e?.id) await api.put('/equipes/' + e.id, payload);
        else await api.post('/equipes', payload);
        close(); toast('Equipe salva'); equipesView(el);
      } catch (err) { toast(err.message, true); }
    };
  };

  el.querySelector('#nova-equipe').onclick = () => abrirModal(null);
  el.querySelectorAll('[data-edit]').forEach((b) =>
    b.onclick = () => abrirModal(equipes.find((e) => e.id == b.dataset.edit)));
  el.querySelectorAll('[data-del]').forEach((b) =>
    b.onclick = async () => {
      if (!confirm('Excluir esta equipe?')) return;
      try { await api.del('/equipes/' + b.dataset.del); toast('Equipe excluída'); equipesView(el); }
      catch (err) { toast(err.message, true); }
    });
}

function membroTag(nome) {
  return `<span class="membro-tag" data-nome="${esc(nome)}">
    <span class="membro-nome">${esc(nome)}</span>
    <button type="button" class="membro-remove" title="Remover">&times;</button>
  </span>`;
}

function renderPessoasBadges(arr) {
  if (!arr || arr.length === 0) return '<span style="color:var(--its-muted)">—</span>';
  return arr.map((n) => `<span class="pessoa-badge">${esc(n)}</span>`).join(' ');
}
