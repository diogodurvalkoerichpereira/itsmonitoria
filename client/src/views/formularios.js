import { api } from '../api.js';
import { esc, openModal, toast, h } from '../ui.js';

export async function formulariosView(el) {
  el.innerHTML = '<div class="empty">Carregando...</div>';
  const forms = await api.get('/formularios');

  el.innerHTML = `
    <div class="page-head">
      <div class="section-title" style="margin:0">Formulários de Monitoria</div>
      <button class="its-btn its-btn-primary" id="novo">+ Novo formulário</button>
    </div>
    <div class="its-card table-wrap">
      <table class="its-table">
        <thead><tr><th>Formulário</th><th>Descrição</th><th>Critérios</th><th>Status</th><th>Ações</th></tr></thead>
        <tbody>
          ${forms.map((f) => `
            <tr>
              <td><b>${esc(f.nome)}</b></td>
              <td>${esc(f.descricao || '—')}</td>
              <td>${f.total_criterios}</td>
              <td>${f.ativo ? '<span class="its-badge badge-green">Ativo</span>' : '<span class="its-badge badge-gray">Inativo</span>'}</td>
              <td style="white-space:nowrap">
                <button class="its-btn its-btn-ghost its-btn-sm" data-edit="${f.id}">Editar</button>
                <button class="its-btn its-btn-danger its-btn-sm" data-del="${f.id}" data-nome="${esc(f.nome)}">Excluir</button>
              </td>
            </tr>`).join('') || '<tr><td colspan="5" class="empty">Nenhum formulário</td></tr>'}
        </tbody>
      </table>
    </div>`;

  const linhaCriterio = (c = {}) => h(`
    <div class="crit-row" data-crit-id="${c.id ?? ''}" style="grid-template-columns:1fr 130px 70px 60px auto">
      <input class="its-input crit-desc" placeholder="Descrição do critério" value="${esc(c.descricao || '')}">
      <input class="its-input crit-cat" placeholder="Categoria" value="${esc(c.categoria || 'Geral')}">
      <input class="its-input crit-peso" type="number" min="1" step="1" placeholder="Peso" value="${c.peso ?? 10}">
      <label style="font-size:.7rem;text-align:center;color:var(--its-danger);font-weight:700">
        <input type="checkbox" class="crit-fatal" ${c.fatal ? 'checked' : ''}><br>Fatal
      </label>
      <button type="button" class="its-btn its-btn-ghost its-btn-sm rem">✕</button>
    </div>`);

  const abrir = async (id) => {
    let form = { nome: '', descricao: '', ativo: 1, criterios: [] };
    if (id) form = await api.get('/formularios/' + id);

    const body = h(`<div>
      <div class="form-group"><label class="its-label">Nome</label><input class="its-input" id="f-nome" value="${esc(form.nome)}"></div>
      <div class="form-group"><label class="its-label">Descrição</label><input class="its-input" id="f-desc" value="${esc(form.descricao || '')}"></div>
      <div id="f-erro" class="its-alert alert-error hidden"></div>
      <div class="cat-head">Critérios de avaliação</div>
      <div style="font-size:.74rem;color:var(--its-muted);margin-bottom:6px">Preencha a <b>descrição</b> de cada critério. Linhas sem descrição são ignoradas.</div>
      <div id="crit-list"></div>
      <button type="button" class="its-btn its-btn-outline its-btn-sm" id="add-crit" style="margin-top:8px">+ Adicionar critério</button>
    </div>`);
    const list = body.querySelector('#crit-list');
    (form.criterios.length ? form.criterios : [{}]).forEach((c) => {
      const row = linhaCriterio(c);
      row.querySelector('.rem').onclick = () => row.remove();
      list.append(row);
    });
    body.querySelector('#add-crit').onclick = () => {
      const row = linhaCriterio();
      row.querySelector('.rem').onclick = () => row.remove();
      list.append(row);
    };

    const salvar = h(`<button class="its-btn its-btn-primary">Salvar</button>`);
    const { close } = openModal({ title: id ? 'Editar formulário' : 'Novo formulário', body, footer: salvar, lg: true });
    const erroBox = body.querySelector('#f-erro');
    const mostrarErro = (msg) => { erroBox.textContent = msg; erroBox.classList.remove('hidden'); };
    salvar.onclick = async () => {
      erroBox.classList.add('hidden');
      const criterios = [...list.querySelectorAll('.crit-row')].map((r) => ({
        id: r.dataset.critId ? Number(r.dataset.critId) : undefined,
        descricao: r.querySelector('.crit-desc').value.trim(),
        categoria: r.querySelector('.crit-cat').value.trim() || 'Geral',
        peso: Number(r.querySelector('.crit-peso').value) || 1,
        fatal: r.querySelector('.crit-fatal').checked,
      })).filter((c) => c.descricao);
      const payload = {
        nome: body.querySelector('#f-nome').value.trim(),
        descricao: body.querySelector('#f-desc').value.trim(),
        ativo: 1, criterios,
      };
      if (!payload.nome) return mostrarErro('Informe o nome do formulário.');
      if (!criterios.length) return mostrarErro('Adicione ao menos um critério com descrição preenchida.');
      salvar.disabled = true;
      try {
        if (id) await api.put('/formularios/' + id, payload);
        else await api.post('/formularios', payload);
        close(); toast('Formulário salvo'); formulariosView(el);
      } catch (e) {
        salvar.disabled = false;
        mostrarErro('Erro ao salvar: ' + e.message);
      }
    };
  };

  el.querySelector('#novo').onclick = () => abrir(null);
  el.querySelectorAll('[data-edit]').forEach((b) => b.onclick = () => abrir(b.dataset.edit));
  el.querySelectorAll('[data-del]').forEach((b) => b.onclick = async () => {
    if (!confirm(`Excluir o formulário "${b.dataset.nome}"?\n\nOs critérios serão removidos. Monitorias já existentes que usam este formulário podem ser afetadas.`)) return;
    try {
      await api.delete('/formularios/' + b.dataset.del);
      toast('Formulário excluído');
      formulariosView(el);
    } catch (e) {
      toast('Não foi possível excluir: ' + e.message, true);
    }
  });
}
