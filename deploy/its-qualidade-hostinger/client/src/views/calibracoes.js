import { api } from '../api.js';
import { esc, fmtData, statusBadge, scorePill, openModal, toast, h } from '../ui.js';

export async function calibracoesView(el) {
  el.innerHTML = '<div class="empty">Carregando...</div>';
  const [lista, forms, ops] = await Promise.all([
    api.get('/calibracoes'), api.get('/formularios'), api.get('/operadores'),
  ]);

  const desvioBadge = (d) => {
    const cls = d <= 3 ? 'badge-green' : d <= 7 ? 'badge-orange' : 'badge-red';
    const txt = d <= 3 ? 'Alinhada' : d <= 7 ? 'Atenção' : 'Desalinhada';
    return `<span class="its-badge ${cls}">σ ${d} · ${txt}</span>`;
  };

  el.innerHTML = `
    <div class="page-head">
      <div class="section-title" style="margin:0">Calibração da Equipe de Qualidade</div>
      <button class="its-btn its-btn-primary" id="nova">+ Nova calibração</button>
    </div>
    <div class="its-alert alert-info">Na calibração, vários monitores avaliam o mesmo atendimento. O <b>desvio padrão (σ)</b> mede o quanto a equipe está alinhada nos critérios.</div>
    <div class="its-card table-wrap">
      <table class="its-table">
        <thead><tr><th>Título</th><th>Operador</th><th>Data</th><th>Avaliadores</th><th>Média</th><th>Amplitude</th><th>Alinhamento</th><th>Status</th><th></th></tr></thead>
        <tbody>
          ${lista.map((c) => `
            <tr>
              <td><b>${esc(c.titulo)}</b></td>
              <td>${esc(c.operador_nome || '—')}</td>
              <td>${fmtData(c.data)}</td>
              <td>${c.total_avaliadores}</td>
              <td>${c.total_avaliadores ? scorePill(c.media) : '—'}</td>
              <td>${c.amplitude}</td>
              <td>${c.total_avaliadores >= 2 ? desvioBadge(c.desvio) : '<span class="its-badge badge-gray">—</span>'}</td>
              <td>${statusBadge(c.status)}</td>
              <td><button class="its-btn its-btn-ghost its-btn-sm" data-id="${c.id}">Abrir</button></td>
            </tr>`).join('') || '<tr><td colspan="9" class="empty">Nenhuma calibração</td></tr>'}
        </tbody>
      </table>
    </div>`;

  el.querySelector('#nova').onclick = () => {
    const ativos = forms.filter((f) => f.ativo);
    const body = h(`<form>
      <div class="form-group"><label class="its-label">Título</label><input class="its-input" name="titulo" placeholder="Calibração Mensal - ..." required></div>
      <div class="form-row">
        <div class="form-group"><label class="its-label">Formulário</label><select class="its-select" name="formulario_id">${ativos.map((f) => `<option value="${f.id}">${esc(f.nome)}</option>`).join('')}</select></div>
        <div class="form-group"><label class="its-label">Operador avaliado</label><select class="its-select" name="operador_id"><option value="">—</option>${ops.map((o) => `<option value="${o.id}">${esc(o.nome)}</option>`).join('')}</select></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label class="its-label">Protocolo</label><input class="its-input" name="protocolo"></div>
        <div class="form-group"><label class="its-label">Data</label><input class="its-input" type="date" name="data"></div>
      </div>
    </form>`);
    const salvar = h(`<button class="its-btn its-btn-primary">Criar</button>`);
    const { close } = openModal({ title: 'Nova calibração', body, footer: salvar });
    salvar.onclick = async () => {
      const fd = Object.fromEntries(new FormData(body));
      if (!fd.titulo) return toast('Informe o título', true);
      try { await api.post('/calibracoes', { ...fd, operador_id: fd.operador_id || null }); close(); toast('Calibração criada'); calibracoesView(el); }
      catch (e) { toast(e.message, true); }
    };
  };

  el.querySelectorAll('[data-id]').forEach((b) => b.onclick = async () => {
    const c = await api.get('/calibracoes/' + b.dataset.id);
    const body = h(`<div>
      <div class="card-grid" style="grid-template-columns:repeat(3,1fr)">
        <div class="its-card"><div class="stat-value">${c.media}</div><div class="stat-label">Média</div></div>
        <div class="its-card"><div class="stat-value">${c.desvio}</div><div class="stat-label">Desvio padrão (σ)</div></div>
        <div class="its-card"><div class="stat-value">${c.amplitude}</div><div class="stat-label">Amplitude</div></div>
      </div>
      <div class="cat-head" style="margin-top:16px">Notas dos avaliadores</div>
      <table class="its-table"><thead><tr><th>Monitor</th><th>Nota</th><th>Comentário</th></tr></thead><tbody>
        ${(c.notas || []).map((n) => `<tr><td>${esc(n.monitor_nome)}</td><td>${scorePill(n.nota)}</td><td>${esc(n.comentario || '—')}</td></tr>`).join('') || '<tr><td colspan="3" class="empty">Sem notas lançadas</td></tr>'}
      </tbody></table>
      <div class="cat-head" style="margin-top:16px">Lançar minha avaliação</div>
      <div class="form-row">
        <div class="form-group"><label class="its-label">Minha nota (0–100)</label><input class="its-input" type="number" id="cal-nota" min="0" max="100" step="0.1"></div>
        <div class="form-group"><label class="its-label">Comentário</label><input class="its-input" id="cal-com"></div>
      </div>
    </div>`);
    const salvar = h(`<button class="its-btn its-btn-primary">Lançar nota</button>`);
    const { close } = openModal({ title: esc(c.titulo), body, footer: salvar, lg: true });
    salvar.onclick = async () => {
      const nota = Number(body.querySelector('#cal-nota').value);
      if (!nota && nota !== 0) return toast('Informe sua nota', true);
      try { await api.post(`/calibracoes/${c.id}/notas`, { nota, comentario: body.querySelector('#cal-com').value.trim() }); close(); toast('Nota lançada'); calibracoesView(el); }
      catch (e) { toast(e.message, true); }
    };
  });
}
