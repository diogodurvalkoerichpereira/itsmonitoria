import { api } from '../api.js';
import { esc, scorePill, statusBadge, fmtData, openModal, toast, h } from '../ui.js';

const VALORES = [
  ['conforme', 'C', 'sel-c', 'Conforme'],
  ['parcial', 'P', 'sel-p', 'Parcial'],
  ['nao_conforme', 'NC', 'sel-n', 'Não conf.'],
  ['na', 'N/A', 'sel-na', 'N/A'],
];

export async function monitoriasView(el) {
  el.innerHTML = '<div class="empty">Carregando...</div>';
  const [equipes] = await Promise.all([api.get('/equipes')]);

  el.innerHTML = `
    <div class="page-head">
      <div class="section-title" style="margin:0">Monitorias</div>
      <button class="its-btn its-btn-primary" id="nova">+ Nova monitoria</button>
    </div>
    <div class="filters its-card">
      <div class="form-group"><label class="its-label">Equipe</label>
        <select class="its-select" id="f-equipe"><option value="">Todas</option>
          ${equipes.map((e) => `<option value="${e.id}">${esc(e.nome)}</option>`).join('')}</select></div>
      <div class="form-group"><label class="its-label">Canal</label>
        <select class="its-select" id="f-canal"><option value="">Todos</option>
          ${['Telefone','Chat','WhatsApp','Email'].map((c) => `<option>${c}</option>`).join('')}</select></div>
      <div class="form-group"><label class="its-label">Status</label>
        <select class="its-select" id="f-status"><option value="">Todos</option>
          <option value="concluida">Concluída</option><option value="contestada">Contestada</option></select></div>
      <button class="its-btn its-btn-secondary its-btn-sm" id="aplicar">Filtrar</button>
    </div>
    <div class="its-card table-wrap" id="lista"></div>`;

  async function carregar() {
    const q = new URLSearchParams();
    const eq = el.querySelector('#f-equipe').value;
    const ca = el.querySelector('#f-canal').value;
    const st = el.querySelector('#f-status').value;
    if (eq) q.set('equipe_id', eq);
    if (ca) q.set('canal', ca);
    if (st) q.set('status', st);
    const mons = await api.get('/monitorias?' + q.toString());
    el.querySelector('#lista').innerHTML = `
      <table class="its-table">
        <thead><tr><th>Data</th><th>Protocolo</th><th>Operador</th><th>Equipe</th><th>Canal</th><th>Monitor</th><th>Nota</th><th>Status</th></tr></thead>
        <tbody>
          ${mons.map((m) => `
            <tr class="row-click" data-id="${m.id}">
              <td>${fmtData(m.data_atendimento)}</td>
              <td>${esc(m.protocolo || '—')}</td>
              <td>${esc(m.operador_nome)}</td>
              <td>${esc(m.equipe_nome || '—')}</td>
              <td>${esc(m.canal)}</td>
              <td>${esc(m.monitor_nome)}</td>
              <td>${m.falha_critica ? '<span class="its-badge badge-red">Falha crítica</span>' : scorePill(m.nota_final)}</td>
              <td>${statusBadge(m.status)}</td>
            </tr>`).join('') || '<tr><td colspan="8" class="empty">Nenhuma monitoria encontrada</td></tr>'}
        </tbody>
      </table>`;
    el.querySelectorAll('[data-id]').forEach((tr) => tr.onclick = () => detalhe(tr.dataset.id, carregar));
  }

  el.querySelector('#aplicar').onclick = carregar;
  el.querySelector('#nova').onclick = () => novaMonitoria(carregar);
  await carregar();
}

// ---------- NOVA MONITORIA ----------
async function novaMonitoria(reload) {
  const [forms, ops] = await Promise.all([api.get('/formularios'), api.get('/operadores')]);
  const ativos = forms.filter((f) => f.ativo);
  if (!ativos.length) return toast('Cadastre um formulário primeiro', true);

  const body = h(`<div>
    <div class="form-row">
      <div class="form-group"><label class="its-label">Formulário</label>
        <select class="its-select" id="m-form">${ativos.map((f) => `<option value="${f.id}">${esc(f.nome)}</option>`).join('')}</select></div>
      <div class="form-group"><label class="its-label">Operador</label>
        <select class="its-select" id="m-op">${ops.filter((o) => o.ativo).map((o) => `<option value="${o.id}">${esc(o.nome)} ${o.matricula ? '· ' + esc(o.matricula) : ''}</option>`).join('')}</select></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label class="its-label">Data do atendimento</label><input class="its-input" type="date" id="m-data"></div>
      <div class="form-group"><label class="its-label">Canal</label>
        <select class="its-select" id="m-canal">${['Telefone','Chat','WhatsApp','Email'].map((c) => `<option>${c}</option>`).join('')}</select></div>
    </div>
    <div class="form-group"><label class="its-label">Protocolo</label><input class="its-input" id="m-prot" placeholder="PROT-00000"></div>
    <div class="cat-head">Avaliação dos critérios</div>
    <div id="crit-area"><div class="empty">Selecione um formulário</div></div>
    <div class="form-group" style="margin-top:14px"><label class="its-label">Observações / feedback ao operador</label><textarea class="its-input" id="m-obs" rows="2"></textarea></div>
    <div class="its-alert alert-info" id="m-preview" style="margin-top:8px">Nota parcial: <b id="m-nota">—</b></div>
  </div>`);

  const area = body.querySelector('#crit-area');
  const respostas = new Map(); // criterio_id -> {valor, peso, fatal}
  let criterios = [];

  async function carregaCriterios(formId) {
    const f = await api.get('/formularios/' + formId);
    criterios = f.criterios;
    respostas.clear();
    const grupos = {};
    criterios.forEach((c) => { (grupos[c.categoria] ||= []).push(c); respostas.set(c.id, { valor: 'conforme', peso: c.peso, fatal: c.fatal }); });
    area.innerHTML = Object.entries(grupos).map(([cat, items]) => `
      <div class="cat-head">${esc(cat)}</div>
      ${items.map((c) => `
        <div class="crit-row" data-crit="${c.id}">
          <div>${esc(c.descricao)} <span style="color:var(--its-muted);font-size:.72rem">(peso ${c.peso})</span> ${c.fatal ? '<span class="fatal-tag">● FATAL</span>' : ''}</div>
          <div class="crit-opts">${VALORES.map((v) => `<button type="button" class="opt-btn ${v[0] === 'conforme' ? v[2] : ''}" data-v="${v[0]}">${v[1]}</button>`).join('')}</div>
        </div>`).join('')}
    `).join('');
    area.querySelectorAll('.crit-row').forEach((row) => {
      const cid = Number(row.dataset.crit);
      row.querySelectorAll('.opt-btn').forEach((btn) => {
        btn.onclick = () => {
          row.querySelectorAll('.opt-btn').forEach((b) => b.className = 'opt-btn');
          const cls = { conforme: 'sel-c', parcial: 'sel-p', nao_conforme: 'sel-n', na: 'sel-na' }[btn.dataset.v];
          btn.classList.add(cls);
          respostas.get(cid).valor = btn.dataset.v;
          atualizaNota();
        };
      });
    });
    atualizaNota();
  }

  function atualizaNota() {
    let obt = 0, apl = 0, fatal = false;
    const fator = { conforme: 1, parcial: 0.5, nao_conforme: 0, na: 0 };
    respostas.forEach((r) => {
      if (r.valor === 'na') return;
      apl += r.peso; obt += r.peso * fator[r.valor];
      if (r.fatal && r.valor === 'nao_conforme') fatal = true;
    });
    const nota = fatal ? 0 : apl ? Math.round((obt / apl) * 1000) / 10 : 0;
    const prev = body.querySelector('#m-preview');
    prev.className = 'its-alert ' + (fatal ? 'alert-error' : nota >= 80 ? 'alert-success' : 'alert-warning');
    body.querySelector('#m-nota').textContent = fatal ? '0,0 — FALHA CRÍTICA' : nota.toFixed(1).replace('.', ',');
  }

  body.querySelector('#m-form').onchange = (e) => carregaCriterios(e.target.value);
  await carregaCriterios(ativos[0].id);

  const salvar = h(`<button class="its-btn its-btn-primary">Salvar monitoria</button>`);
  const { close } = openModal({ title: 'Nova monitoria', body, footer: salvar, lg: true });
  salvar.onclick = async () => {
    const payload = {
      formulario_id: Number(body.querySelector('#m-form').value),
      operador_id: Number(body.querySelector('#m-op').value),
      data_atendimento: body.querySelector('#m-data').value || null,
      canal: body.querySelector('#m-canal').value,
      protocolo: body.querySelector('#m-prot').value.trim(),
      observacoes: body.querySelector('#m-obs').value.trim(),
      respostas: [...respostas.entries()].map(([criterio_id, r]) => ({ criterio_id, valor: r.valor })),
    };
    try {
      const res = await api.post('/monitorias', payload);
      close();
      toast(`Monitoria salva · nota ${res.nota_final.toFixed(1)}`);
      reload();
    } catch (e) { toast(e.message, true); }
  };
}

// ---------- DETALHE ----------
async function detalhe(id, reload) {
  const m = await api.get('/monitorias/' + id);
  const grupos = {};
  m.respostas.forEach((r) => (grupos[r.categoria] ||= []).push(r));
  const rotulo = { conforme: '<span class="its-badge badge-green">Conforme</span>', parcial: '<span class="its-badge badge-orange">Parcial</span>', nao_conforme: '<span class="its-badge badge-red">Não conforme</span>', na: '<span class="its-badge badge-gray">N/A</span>' };

  const body = h(`<div>
    <div class="card-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:16px">
      <div class="its-card"><div class="stat-label">Operador</div><b>${esc(m.operador_nome)}</b></div>
      <div class="its-card"><div class="stat-label">Canal · Data</div><b>${esc(m.canal)} · ${fmtData(m.data_atendimento)}</b></div>
      <div class="its-card"><div class="stat-label">Monitor</div><b>${esc(m.monitor_nome)}</b></div>
      <div class="its-card"><div class="stat-label">Nota final</div>${m.falha_critica ? '<span class="its-badge badge-red">Falha crítica · 0</span>' : scorePill(m.nota_final)}</div>
    </div>
    ${m.observacoes ? `<div class="its-alert alert-info"><b>Observações:</b>&nbsp;${esc(m.observacoes)}</div>` : ''}
    ${Object.entries(grupos).map(([cat, items]) => `
      <div class="cat-head">${esc(cat)}</div>
      ${items.map((r) => `<div class="crit-row" style="grid-template-columns:1fr auto">
        <div>${esc(r.descricao)} ${r.fatal ? '<span class="fatal-tag">● FATAL</span>' : ''}</div>
        <div>${rotulo[r.valor] || r.valor}</div></div>`).join('')}
    `).join('')}
    ${m.contestacoes?.length ? `<div class="cat-head">Contestações</div>${m.contestacoes.map((c) => `
      <div class="its-alert alert-warning"><div><b>${statusBadge(c.status)}</b><br>${esc(c.motivo)}${c.resposta ? `<br><i>Resposta: ${esc(c.resposta)}</i>` : ''}</div></div>`).join('')}` : ''}
  </div>`);

  const footer = h(`<div style="display:flex;gap:8px">
    ${m.status !== 'contestada' ? '<button class="its-btn its-btn-outline" id="btn-contestar">Registrar contestação</button>' : ''}
  </div>`);
  const { close } = openModal({ title: `Monitoria · ${esc(m.protocolo || '#' + m.id)}`, body, footer, lg: true });

  const bc = footer.querySelector('#btn-contestar');
  if (bc) bc.onclick = () => {
    const f = h(`<form><div class="form-group"><label class="its-label">Motivo da contestação</label><textarea class="its-input" name="motivo" rows="3" required></textarea></div></form>`);
    const salvar = h(`<button class="its-btn its-btn-primary">Enviar contestação</button>`);
    const m2 = openModal({ title: 'Contestar monitoria', body: f, footer: salvar });
    salvar.onclick = async () => {
      const motivo = f.motivo.value.trim();
      if (!motivo) return toast('Informe o motivo', true);
      try { await api.post('/contestacoes', { monitoria_id: m.id, motivo }); m2.close(); close(); toast('Contestação registrada'); reload(); }
      catch (e) { toast(e.message, true); }
    };
  };
}
