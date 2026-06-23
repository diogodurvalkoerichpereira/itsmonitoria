import { api } from '../api.js';
import { esc, scorePill, statusBadge, fmtData, openModal, toast, h } from '../ui.js';

export async function contestacoesView(el) {
  el.innerHTML = '<div class="empty">Carregando...</div>';
  const lista = await api.get('/contestacoes');

  el.innerHTML = `
    <div class="section-title">Gestão de Contestações</div>
    <div class="its-card table-wrap">
      <table class="its-table">
        <thead><tr><th>Aberta em</th><th>Protocolo</th><th>Operador</th><th>Nota</th><th>Motivo</th><th>Status</th><th></th></tr></thead>
        <tbody>
          ${lista.map((c) => `
            <tr>
              <td>${fmtData(c.criado_em)}</td>
              <td>${esc(c.protocolo || '—')}</td>
              <td>${esc(c.operador_nome)}</td>
              <td>${scorePill(c.nota_final)}</td>
              <td style="max-width:280px">${esc(c.motivo)}</td>
              <td>${statusBadge(c.status)}</td>
              <td>${['aberta', 'em_analise'].includes(c.status) ? `<button class="its-btn its-btn-primary its-btn-sm" data-id="${c.id}">Analisar</button>` : '—'}</td>
            </tr>`).join('') || '<tr><td colspan="7" class="empty">Nenhuma contestação</td></tr>'}
        </tbody>
      </table>
    </div>`;

  el.querySelectorAll('[data-id]').forEach((b) => b.onclick = () => {
    const c = lista.find((x) => x.id == b.dataset.id);
    const body = h(`<div>
      <div class="its-alert alert-info"><div><b>${esc(c.operador_nome)}</b> · Protocolo ${esc(c.protocolo || '—')} · Nota atual ${Number(c.nota_final).toFixed(1)}<br>${esc(c.motivo)}</div></div>
      <div class="form-group"><label class="its-label">Decisão</label>
        <select class="its-select" id="dec">
          <option value="em_analise">Manter em análise</option>
          <option value="deferida">Deferir (ajustar nota)</option>
          <option value="indeferida">Indeferir</option>
        </select></div>
      <div class="form-group hidden" id="nota-wrap"><label class="its-label">Nova nota (0–100)</label><input class="its-input" type="number" id="nova-nota" min="0" max="100" step="0.1" value="${Number(c.nota_final).toFixed(1)}"></div>
      <div class="form-group"><label class="its-label">Resposta ao operador</label><textarea class="its-input" id="resp" rows="3"></textarea></div>
    </div>`);
    body.querySelector('#dec').onchange = (e) =>
      body.querySelector('#nota-wrap').classList.toggle('hidden', e.target.value !== 'deferida');

    const salvar = h(`<button class="its-btn its-btn-primary">Salvar decisão</button>`);
    const { close } = openModal({ title: 'Analisar contestação', body, footer: salvar });
    salvar.onclick = async () => {
      const status = body.querySelector('#dec').value;
      const payload = { status, resposta: body.querySelector('#resp').value.trim() };
      if (status === 'deferida') payload.nota_revisada = Number(body.querySelector('#nova-nota').value);
      try { await api.put('/contestacoes/' + c.id, payload); close(); toast('Decisão registrada'); contestacoesView(el); }
      catch (e) { toast(e.message, true); }
    };
  });
}
