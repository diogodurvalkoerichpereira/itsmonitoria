import { api } from '../api.js';
import { esc, scorePill, openModal, toast, h } from '../ui.js';

export async function operadoresView(el) {
  el.innerHTML = '<div class="empty">Carregando...</div>';
  const [ops, equipes] = await Promise.all([api.get('/operadores'), api.get('/equipes')]);

  el.innerHTML = `
    <div class="page-head">
      <div class="section-title" style="margin:0">Operadores</div>
      <button class="its-btn its-btn-primary" id="novo">+ Novo operador</button>
    </div>
    <div class="its-card table-wrap">
      <table class="its-table">
        <thead><tr><th>Matrícula</th><th>Nome</th><th>Equipe</th><th>Cargo</th><th>Monitorias</th><th>Nota média</th><th>Status</th><th></th></tr></thead>
        <tbody>
          ${ops.map((o) => `
            <tr>
              <td>${esc(o.matricula || '—')}</td>
              <td>${esc(o.nome)}</td>
              <td>${esc(o.equipe_nome || '—')}</td>
              <td>${esc(o.cargo || '—')}</td>
              <td>${o.total_monitorias || 0}</td>
              <td>${o.nota_media != null ? scorePill(o.nota_media) : '—'}</td>
              <td>${o.ativo ? '<span class="its-badge badge-green">Ativo</span>' : '<span class="its-badge badge-gray">Inativo</span>'}</td>
              <td><button class="its-btn its-btn-ghost its-btn-sm" data-edit="${o.id}">Editar</button></td>
            </tr>`).join('') || '<tr><td colspan="8" class="empty">Nenhum operador cadastrado</td></tr>'}
        </tbody>
      </table>
    </div>`;

  const form = (o = {}) => {
    const opts = equipes.map((e) => `<option value="${e.id}" ${o.equipe_id === e.id ? 'selected' : ''}>${esc(e.nome)}</option>`).join('');
    return h(`<form>
      <div class="form-row">
        <div class="form-group"><label class="its-label">Nome</label><input class="its-input" name="nome" value="${esc(o.nome || '')}" required></div>
        <div class="form-group"><label class="its-label">Matrícula</label><input class="its-input" name="matricula" value="${esc(o.matricula || '')}"></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label class="its-label">Equipe</label><select class="its-select" name="equipe_id"><option value="">—</option>${opts}</select></div>
        <div class="form-group"><label class="its-label">Cargo</label><input class="its-input" name="cargo" value="${esc(o.cargo || '')}"></div>
      </div>
      <div class="form-group"><label class="its-label">Data de admissão</label><input class="its-input" type="date" name="data_admissao" value="${esc(o.data_admissao || '')}"></div>
      ${o.id ? `<label class="its-label"><input type="checkbox" name="ativo" ${o.ativo ? 'checked' : ''}> Ativo</label>` : ''}
    </form>`);
  };

  const abrir = (o) => {
    const f = form(o);
    const salvar = h(`<button class="its-btn its-btn-primary">Salvar</button>`);
    const { close } = openModal({ title: o?.id ? 'Editar operador' : 'Novo operador', body: f, footer: salvar });
    salvar.onclick = async () => {
      const fd = Object.fromEntries(new FormData(f));
      const payload = { ...fd, equipe_id: fd.equipe_id || null, ativo: f.ativo ? f.ativo.checked : true };
      try {
        if (o?.id) await api.put('/operadores/' + o.id, payload);
        else await api.post('/operadores', payload);
        close(); toast('Operador salvo'); operadoresView(el);
      } catch (e) { toast(e.message, true); }
    };
  };

  el.querySelector('#novo').onclick = () => abrir(null);
  el.querySelectorAll('[data-edit]').forEach((b) =>
    b.onclick = () => abrir(ops.find((o) => o.id == b.dataset.edit)));
}
