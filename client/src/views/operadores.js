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
    <div class="filters its-card">
      <div class="form-group"><label class="its-label">Nome</label>
        <input class="its-input" id="f-nome" placeholder="Buscar por nome" style="width:200px"></div>
      <div class="form-group"><label class="its-label">CPF</label>
        <input class="its-input" id="f-cpf" placeholder="000.000.000-00" style="width:160px"></div>
      <div class="form-group"><label class="its-label">Equipe</label>
        <select class="its-select" id="f-equipe"><option value="">Todas</option>
          ${equipes.map((e) => `<option value="${e.id}">${esc(e.nome)}</option>`).join('')}</select></div>
      <button class="its-btn its-btn-ghost its-btn-sm" id="f-limpar">Limpar</button>
    </div>
    <div class="its-card table-wrap">
      <table class="its-table">
        <thead><tr><th>Matrícula</th><th>Nome</th><th>CPF</th><th>Equipe</th><th>Cargo</th><th>Monitorias</th><th>Nota média</th><th>Senha</th><th>Status</th><th>Ações</th></tr></thead>
        <tbody id="ops-tbody"></tbody>
      </table>
    </div>`;

  const tbody = el.querySelector('#ops-tbody');
  const fNome = el.querySelector('#f-nome');
  const fCpf = el.querySelector('#f-cpf');
  const fEquipe = el.querySelector('#f-equipe');

  function render() {
    const nome = fNome.value.trim().toLowerCase();
    const cpf = fCpf.value.trim();
    const eq = fEquipe.value;
    const lista = ops.filter((o) =>
      (!nome || (o.nome || '').toLowerCase().includes(nome)) &&
      (!cpf || (o.cpf || '').includes(cpf)) &&
      (!eq || String(o.equipe_id) === eq));
    tbody.innerHTML = lista.map((o) => `
      <tr>
        <td>${esc(o.matricula || '—')}</td>
        <td>${esc(o.nome)}</td>
        <td>${esc(o.cpf || '—')}</td>
        <td>${esc(o.equipe_nome || '—')}</td>
        <td>${esc(o.cargo || '—')}</td>
        <td>${o.total_monitorias || 0}</td>
        <td>${o.nota_media != null ? scorePill(o.nota_media) : '—'}</td>
        <td>${o.tem_senha ? '<span class="its-badge badge-green">Definida</span>' : '<span class="its-badge badge-orange">Pendente</span>'}</td>
        <td>${o.ativo ? '<span class="its-badge badge-green">Ativo</span>' : '<span class="its-badge badge-gray">Inativo</span>'}</td>
        <td><button class="its-btn its-btn-ghost its-btn-sm" data-edit="${o.id}">Editar</button></td>
      </tr>`).join('') || `<tr><td colspan="10" class="empty">Nenhum operador encontrado</td></tr>`;
    tbody.querySelectorAll('[data-edit]').forEach((b) =>
      b.onclick = () => abrir(ops.find((o) => o.id == b.dataset.edit)));
  }

  fNome.oninput = render;
  fCpf.oninput = render;
  fEquipe.onchange = render;
  el.querySelector('#f-limpar').onclick = () => { fNome.value = ''; fCpf.value = ''; fEquipe.value = ''; render(); };

  const form = (o) => {
    const obj = o || {};
    const opts = equipes.map((e) => `<option value="${e.id}" ${obj.equipe_id === e.id ? 'selected' : ''}>${esc(e.nome)}</option>`).join('');
    return h(`<form>
      <div class="form-row">
        <div class="form-group"><label class="its-label">Nome</label><input class="its-input" name="nome" value="${esc(obj.nome || '')}" required></div>
        <div class="form-group"><label class="its-label">Matrícula</label><input class="its-input" name="matricula" value="${esc(obj.matricula || '')}"></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label class="its-label">CPF</label><input class="its-input" name="cpf" value="${esc(obj.cpf || '')}" placeholder="000.000.000-00"></div>
        <div class="form-group"><label class="its-label">Cargo</label><input class="its-input" name="cargo" value="${esc(obj.cargo || '')}"></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label class="its-label">Equipe</label><select class="its-select" name="equipe_id"><option value="">—</option>${opts}</select></div>
        <div class="form-group"><label class="its-label">Data de admissão</label><input class="its-input" type="date" name="data_admissao" value="${esc(obj.data_admissao || '')}"></div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="its-label">Senha do operador ${obj.id ? '(deixe em branco para manter)' : '(para assinar o feedback)'}</label>
          <input class="its-input" type="password" name="senha" autocomplete="new-password" placeholder="${obj.id && obj.tem_senha ? '•••••• (senha já definida)' : 'Mínimo 4 caracteres'}">
          <div style="font-size:.74rem;color:var(--its-muted);margin-top:4px">Usada pelo operador para confirmar a ciência do feedback (substitui o CPF).</div>
        </div>
      </div>
      ${obj.id ? `<label class="its-label"><input type="checkbox" name="ativo" ${obj.ativo ? 'checked' : ''}> Ativo</label>` : ''}
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

  el.querySelector('#novo').onclick = () => abrir({});
  render();
}
