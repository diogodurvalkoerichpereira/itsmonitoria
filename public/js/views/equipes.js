import { api } from '../api.js';
import { esc, openModal, toast, h } from '../ui.js';

export async function equipesView(el) {
  el.innerHTML = '<div class="empty">Carregando...</div>';
  const equipes = await api.get('/equipes');

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
              <td>${renderPessoasBadges(e.membros?.monitores)}</td>
              <td>${renderPessoasBadges(e.membros?.gerentes)}</td>
              <td>${e.total_operadores}</td>
              <td>${e.ativo ? '<span class="its-badge badge-green">Ativa</span>' : '<span class="its-badge badge-gray">Inativa</span>'}</td>
              <td>
                <button class="its-btn its-btn-ghost its-btn-sm" data-edit="${e.id}">Editar</button>
                <button class="its-btn its-btn-ghost its-btn-sm" data-del="${e.id}" style="color:var(--its-danger)">Excluir</button>
              </td>
            </tr>`).join('') || '<tr><td colspan="7" class="empty">Nenhuma equipe</td></tr>'}
        </tbody>
      </table>
    </div>`;

  const abrirModal = (e) => {
    const sup = e?.membros?.supervisores || [];
    const mon = e?.membros?.monitores || [];
    const ger = e?.membros?.gerentes || [];

    const f = h(`<form class="equipe-form">
      <div class="form-group"><label class="its-label">Nome da equipe</label><input class="its-input" name="nome" value="${esc(e?.nome || '')}" required></div>
      <div class="form-group"><label class="its-label">Descrição</label><textarea class="its-input" name="descricao" rows="2">${esc(e?.descricao || '')}</textarea></div>

      <div class="form-group membros-section">
        <label class="its-label membros-label">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          Supervisores
        </label>
        <div class="membros-list" data-role="supervisores">
          ${sup.map((n) => membroTag(n)).join('')}
        </div>
        <div class="membros-add-row">
          <input class="its-input its-input-sm" placeholder="Nome do supervisor" data-add-input="supervisores">
          <button type="button" class="its-btn its-btn-sm its-btn-outline" data-add-btn="supervisores">+ Adicionar</button>
        </div>
      </div>

      <div class="form-group membros-section">
        <label class="its-label membros-label">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
          Monitores
        </label>
        <div class="membros-list" data-role="monitores">
          ${mon.map((n) => membroTag(n)).join('')}
        </div>
        <div class="membros-add-row">
          <input class="its-input its-input-sm" placeholder="Nome do monitor" data-add-input="monitores">
          <button type="button" class="its-btn its-btn-sm its-btn-outline" data-add-btn="monitores">+ Adicionar</button>
        </div>
      </div>

      <div class="form-group membros-section">
        <label class="its-label membros-label">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
          Gerentes
        </label>
        <div class="membros-list" data-role="gerentes">
          ${ger.map((n) => membroTag(n)).join('')}
        </div>
        <div class="membros-add-row">
          <input class="its-input its-input-sm" placeholder="Nome do gerente" data-add-input="gerentes">
          <button type="button" class="its-btn its-btn-sm its-btn-outline" data-add-btn="gerentes">+ Adicionar</button>
        </div>
      </div>

      ${e?.id ? `<label class="its-label" style="margin-top:.5rem"><input type="checkbox" name="ativo" ${e.ativo ? 'checked' : ''}> Equipe ativa</label>` : ''}
    </form>`);

    // Wire up add buttons
    f.querySelectorAll('[data-add-btn]').forEach((btn) => {
      const role = btn.dataset.addBtn;
      const input = f.querySelector(`[data-add-input="${role}"]`);
      const list = f.querySelector(`[data-role="${role}"]`);

      const addMembro = () => {
        const nome = input.value.trim();
        if (!nome) return;
        // Avoid duplicates
        const existing = [...list.querySelectorAll('.membro-tag')].map((t) => t.dataset.nome);
        if (existing.includes(nome)) { toast('Já adicionado', true); return; }
        list.insertAdjacentHTML('beforeend', membroTag(nome));
        wireRemove(list.lastElementChild);
        input.value = '';
        input.focus();
      };

      btn.addEventListener('click', addMembro);
      input.addEventListener('keydown', (ev) => {
        if (ev.key === 'Enter') { ev.preventDefault(); addMembro(); }
      });
    });

    // Wire remove buttons for existing tags
    function wireRemove(tag) {
      const btn = tag.querySelector('.membro-remove');
      if (btn) btn.addEventListener('click', () => tag.remove());
    }
    f.querySelectorAll('.membro-tag').forEach(wireRemove);

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
          supervisores: collectNomes('supervisores'),
          monitores:    collectNomes('monitores'),
          gerentes:     collectNomes('gerentes'),
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
  return arr.map((n) =>
    `<span class="pessoa-badge">${esc(n)}</span>`
  ).join(' ');
}
