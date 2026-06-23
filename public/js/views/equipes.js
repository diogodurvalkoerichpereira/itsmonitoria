import { api } from '../api.js';
import { esc, openModal, toast, h } from '../ui.js';

export async function equipesView(el) {
  el.innerHTML = '<div class="empty">Carregando...</div>';
  const equipes = await api.get('/equipes');

  el.innerHTML = `
    <div class="page-head">
      <div class="section-title" style="margin:0">Equipes</div>
      <button class="its-btn its-btn-primary" id="novo">+ Nova equipe</button>
    </div>
    <div class="its-card table-wrap">
      <table class="its-table">
        <thead><tr><th>Equipe</th><th>Supervisor</th><th>Operadores</th><th>Status</th><th></th></tr></thead>
        <tbody>
          ${equipes.map((e) => `
            <tr>
              <td><b>${esc(e.nome)}</b>${e.descricao ? `<div style="font-size:.75rem;color:var(--its-muted)">${esc(e.descricao)}</div>` : ''}</td>
              <td>${esc(e.supervisor || '—')}</td>
              <td>${e.total_operadores}</td>
              <td>${e.ativo ? '<span class="its-badge badge-green">Ativa</span>' : '<span class="its-badge badge-gray">Inativa</span>'}</td>
              <td><button class="its-btn its-btn-ghost its-btn-sm" data-edit="${e.id}">Editar</button></td>
            </tr>`).join('') || '<tr><td colspan="5" class="empty">Nenhuma equipe</td></tr>'}
        </tbody>
      </table>
    </div>`;

  const abrir = (e) => {
    const f = h(`<form>
      <div class="form-group"><label class="its-label">Nome da equipe</label><input class="its-input" name="nome" value="${esc(e?.nome || '')}" required></div>
      <div class="form-group"><label class="its-label">Supervisor</label><input class="its-input" name="supervisor" value="${esc(e?.supervisor || '')}"></div>
      <div class="form-group"><label class="its-label">Descrição</label><textarea class="its-input" name="descricao" rows="2">${esc(e?.descricao || '')}</textarea></div>
      ${e?.id ? `<label class="its-label"><input type="checkbox" name="ativo" ${e.ativo ? 'checked' : ''}> Ativa</label>` : ''}
    </form>`);
    const salvar = h(`<button class="its-btn its-btn-primary">Salvar</button>`);
    const { close } = openModal({ title: e?.id ? 'Editar equipe' : 'Nova equipe', body: f, footer: salvar });
    salvar.onclick = async () => {
      const fd = Object.fromEntries(new FormData(f));
      try {
        const payload = { ...fd, ativo: f.ativo ? f.ativo.checked : true };
        if (e?.id) await api.put('/equipes/' + e.id, payload);
        else await api.post('/equipes', payload);
        close(); toast('Equipe salva'); equipesView(el);
      } catch (err) { toast(err.message, true); }
    };
  };

  el.querySelector('#novo').onclick = () => abrir(null);
  el.querySelectorAll('[data-edit]').forEach((b) =>
    b.onclick = () => abrir(equipes.find((e) => e.id == b.dataset.edit)));
}
