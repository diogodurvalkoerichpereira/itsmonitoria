import { api } from '../api.js';
import { esc, scorePill, statusBadge, fmtData, openModal, toast, h } from '../ui.js';

// Avaliacao binaria: o criterio pontuou (100% do peso) ou nao pontuou (0%).
// Os identificadores 'conforme'/'nao_conforme' sao mantidos para preservar
// compatibilidade com monitorias ja gravadas (que podem ter 'parcial'/'na').
const VALORES = [
  ['conforme', 'Pontuou', 'sel-c', 'Pontuou'],
  ['nao_conforme', 'Não pontuou', 'sel-n', 'Não pontuou'],
];

function iconeAnexo(mime = '') {
  if (/^audio\//.test(mime)) return '🎵';
  if (/^image\//.test(mime)) return '🖼️';
  if (/^video\//.test(mime)) return '🎬';
  if (/pdf/.test(mime)) return '📕';
  return '📄';
}

// renderiza a lista de anexos de uma monitoria (com player de audio inline)
async function carregarAnexos(container, monitoriaId, comExcluir) {
  let lista = [];
  try { lista = await api.get('/monitorias/' + monitoriaId + '/anexos'); }
  catch { container.innerHTML = '<div style="font-size:.8rem;color:var(--its-danger)">Falha ao carregar anexos.</div>'; return; }
  if (!lista.length) { container.innerHTML = '<div style="font-size:.8rem;color:var(--its-muted)">Nenhum anexo.</div>'; return; }
  container.innerHTML = lista.map((a) => {
    const url = '/api/anexos/' + a.id + '/download';
    const mime = a.mime || '';
    const mb = (a.tamanho / 1024 / 1024).toFixed(2);
    return `<div class="its-card" style="margin-bottom:8px;padding:10px 12px">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:10px">
        <div>${iconeAnexo(mime)} <a href="${url}?download=1" target="_blank">${esc(a.nome_original)}</a>
          <span style="font-size:.72rem;color:var(--its-muted)">(${mb} MB)</span></div>
        ${comExcluir ? `<button class="its-btn its-btn-danger its-btn-sm" data-del-anexo="${a.id}">Excluir</button>` : ''}
      </div>
      ${/^audio\//.test(mime) ? `<audio controls preload="none" src="${url}" style="width:100%;margin-top:8px"></audio>` : ''}
      ${/^video\//.test(mime) ? `<video controls preload="none" src="${url}" style="width:100%;max-height:240px;margin-top:8px"></video>` : ''}
      ${/^image\//.test(mime) ? `<img src="${url}" style="max-width:100%;max-height:240px;margin-top:8px;border-radius:6px">` : ''}
    </div>`;
  }).join('');
  if (comExcluir) {
    container.querySelectorAll('[data-del-anexo]').forEach((b) => b.onclick = async () => {
      if (!confirm('Excluir este anexo?')) return;
      try { await api.delete('/anexos/' + b.dataset.delAnexo); carregarAnexos(container, monitoriaId, comExcluir); }
      catch (e) { toast(e.message, true); }
    });
  }
}

export async function monitoriasView(el) {
  el.innerHTML = '<div class="empty">Carregando...</div>';
  const [equipes, operadores] = await Promise.all([api.get('/equipes'), api.get('/operadores')]);

  el.innerHTML = `
    <div class="page-head">
      <div class="section-title" style="margin:0">Monitorias</div>
      <button class="its-btn its-btn-primary" id="nova">+ Nova monitoria</button>
    </div>
    <div class="filters its-card">
      <div class="form-group"><label class="its-label">Equipe</label>
        <select class="its-select" id="f-equipe"><option value="">Todas</option>
          ${equipes.map((e) => `<option value="${e.id}">${esc(e.nome)}</option>`).join('')}</select></div>
      <div class="form-group"><label class="its-label">Operador</label>
        <select class="its-select" id="f-operador"><option value="">Todos</option>
          ${operadores.map((o) => `<option value="${o.id}">${esc(o.nome)}${o.matricula ? ' · ' + esc(o.matricula) : ''}</option>`).join('')}</select></div>
      <div class="form-group"><label class="its-label">CPF do operador</label>
        <input class="its-input" id="f-cpf" placeholder="000.000.000-00" style="width:160px"></div>
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
    const op = el.querySelector('#f-operador').value;
    const cpf = el.querySelector('#f-cpf').value.trim();
    const ca = el.querySelector('#f-canal').value;
    const st = el.querySelector('#f-status').value;
    if (eq) q.set('equipe_id', eq);
    if (op) q.set('operador_id', op);
    if (cpf) q.set('cpf', cpf);
    if (ca) q.set('canal', ca);
    if (st) q.set('status', st);
    const mons = await api.get('/monitorias?' + q.toString());
    el.querySelector('#lista').innerHTML = `
      <table class="its-table">
        <thead>
          <tr>
            <th>Editar</th>
            <th>Excluir</th>
            <th>ID</th>
            <th>Questionario</th>
            <th>Data Atendimento</th>
            <th>Nota</th>
            <th>Operador</th>
            <th>CPF Operador</th>
            <th>Operacao</th>
            <th>Telefone Cliente</th>
            <th>Tabulação</th>
            <th>Equipe</th>
            <th>Produto</th>
            <th>Data Monitoria</th>
            <th>Monitor</th>
            <th>Monitoria Padrao</th>
            <th>Feedback Aplicado</th>
            <th>Data Feedback</th>
            <th>Status Feedback</th>
            <th>SLA</th>
            <th>Detalhe SLA</th>
          </tr>
        </thead>
        <tbody>
          ${mons.map((m) => `
            <tr class="row-click" data-id="${m.id}">
              <td><button class="its-btn its-btn-ghost its-btn-sm edit-btn" data-id="${m.id}">Editar</button></td>
              <td><button class="its-btn its-btn-danger its-btn-sm del-btn" data-id="${m.id}">Excluir</button></td>
              <td><b>${m.id}</b></td>
              <td>${esc(m.formulario_nome)}</td>
              <td>${fmtData(m.data_atendimento)}</td>
              <td>${m.falha_critica ? '<span class="its-badge badge-red">Falha crítica</span>' : scorePill(m.nota_final)}</td>
              <td>${esc(m.operador_nome)}</td>
              <td>${esc(m.operador_cpf || '—')}</td>
              <td>${esc(m.operacao || '—')}</td>
              <td>${esc(m.telefone_cliente || '—')}</td>
              <td>${esc(m.tabulacao || '—')}</td>
              <td>${esc(m.equipe_nome || '—')}</td>
              <td>${esc(m.produto || '—')}</td>
              <td>${fmtData(m.data_monitoria)}</td>
              <td>${esc(m.monitor_nome)}</td>
              <td>${m.monitoria_padrao ? 'Sim' : 'Não'}</td>
              <td>${m.feedback_aplicado ? 'Sim' : 'Não'}</td>
              <td>${fmtData(m.data_feedback)}</td>
              <td>${esc(m.status_feedback || '—')}</td>
              <td>${esc(m.sla || '—')}</td>
              <td>${esc(m.detalhe_sla || '—')}</td>
            </tr>`).join('') || `<tr><td colspan="21" class="empty">Nenhuma monitoria encontrada</td></tr>`}
        </tbody>
      </table>`;

    el.querySelectorAll('tr.row-click').forEach((tr) => {
      tr.onclick = (e) => {
        if (e.target.closest('.edit-btn') || e.target.closest('.del-btn')) return;
        detalhe(tr.dataset.id, carregar);
      };
    });

    el.querySelectorAll('.edit-btn').forEach((btn) => {
      btn.onclick = (e) => {
        e.stopPropagation();
        abrirMonitoria(Number(btn.dataset.id), carregar);
      };
    });

    el.querySelectorAll('.del-btn').forEach((btn) => {
      btn.onclick = async (e) => {
        e.stopPropagation();
        if (confirm('Deseja realmente excluir esta monitoria?')) {
          try {
            await api.delete('/monitorias/' + btn.dataset.id);
            toast('Monitoria excluída');
            carregar();
          } catch (err) {
            toast(err.message, true);
          }
        }
      };
    });
  }

  el.querySelector('#aplicar').onclick = carregar;
  el.querySelector('#nova').onclick = () => abrirMonitoria(null, carregar);
  await carregar();
}

// ---------- NOVA / EDITAR MONITORIA ----------
async function abrirMonitoria(id = null, reload) {
  const [forms, ops] = await Promise.all([api.get('/formularios'), api.get('/operadores')]);
  const ativos = forms.filter((f) => f.ativo);
  if (!ativos.length) return toast('Cadastre um formulário primeiro', true);

  let m = null;
  if (id) {
    m = await api.get('/monitorias/' + id);
  }

  const body = h(`<div>
    <div class="form-row">
      <div class="form-group"><label class="its-label">Formulário</label>
        <select class="its-select" id="m-form" ${m ? 'disabled' : ''}>${ativos.map((f) => `<option value="${f.id}" ${m?.formulario_id === f.id ? 'selected' : ''}>${esc(f.nome)}</option>`).join('')}</select></div>
      <div class="form-group"><label class="its-label">Operador</label>
        <select class="its-select" id="m-op">${ops.filter((o) => o.ativo || o.id === m?.operador_id).map((o) => `<option value="${o.id}" ${m?.operador_id === o.id ? 'selected' : ''}>${esc(o.nome)} ${o.matricula ? '· ' + esc(o.matricula) : ''}</option>`).join('')}</select></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label class="its-label">Data do atendimento</label><input class="its-input" type="date" id="m-data" value="${m?.data_atendimento || ''}"></div>
      <div class="form-group"><label class="its-label">Canal</label>
        <select class="its-select" id="m-canal">${['Telefone','Chat','WhatsApp','Email'].map((c) => `<option ${m?.canal === c ? 'selected' : ''}>${c}</option>`).join('')}</select></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label class="its-label">Protocolo</label><input class="its-input" id="m-prot" placeholder="PROT-00000" value="${esc(m?.protocolo || '')}"></div>
      <div class="form-group"><label class="its-label">Operação</label>
        <select class="its-select" id="m-operacao">${['Receptivo','Ativo','Suporte','Outros'].map((op) => `<option ${m?.operacao === op ? 'selected' : ''}>${op}</option>`).join('')}</select></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label class="its-label">Telefone Cliente</label><input class="its-input" id="m-tel" placeholder="(11) 99999-9999" value="${esc(m?.telefone_cliente || '')}"></div>
      <div class="form-group"><label class="its-label">Tabulação</label><input class="its-input" id="m-tab" placeholder="ex: Reclamação" value="${esc(m?.tabulacao || '')}"></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label class="its-label">Produto</label><input class="its-input" id="m-prod" placeholder="ex: Internet Fibra" value="${esc(m?.produto || '')}"></div>
      <div class="form-group"><label class="its-label">Data da Monitoria</label><input class="its-input" type="date" id="m-data-mon" value="${m?.data_monitoria || new Date().toISOString().slice(0, 10)}"></div>
    </div>
    <div class="form-row" style="margin-top: 8px; margin-bottom: 8px;">
      <div class="form-group" style="display:flex;align-items:center;gap:8px;margin-bottom:0"><label class="its-label" style="margin-bottom:0;display:flex;align-items:center;gap:6px"><input type="checkbox" id="m-padrao" ${m ? (m.monitoria_padrao ? 'checked' : '') : 'checked'}> Monitoria Padrão</label></div>
      <div class="form-group" style="display:flex;align-items:center;gap:8px;margin-bottom:0"><label class="its-label" style="margin-bottom:0;display:flex;align-items:center;gap:6px"><input type="checkbox" id="m-feed-ap" ${m?.feedback_aplicado ? 'checked' : ''}> Feedback Aplicado</label></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label class="its-label">Data do Feedback</label><input class="its-input" type="date" id="m-feed-data" value="${m?.data_feedback || ''}"></div>
      <div class="form-group"><label class="its-label">Status do Feedback</label>
        <select class="its-select" id="m-feed-status">${['Pendente','Realizado','Recusado'].map((sf) => `<option ${m?.status_feedback === sf ? 'selected' : ''}>${sf}</option>`).join('')}</select></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label class="its-label">SLA</label>
        <select class="its-select" id="m-sla">${['No Prazo','Tratativa Necessária','Excedido'].map((sl) => `<option ${m?.sla === sl ? 'selected' : ''}>${sl}</option>`).join('')}</select></div>
      <div class="form-group"><label class="its-label">Detalhe SLA</label><input class="its-input" id="m-sla-det" placeholder="ex: Dentro do prazo" value="${esc(m?.detalhe_sla || '')}"></div>
    </div>
    
    <div class="cat-head">Avaliação dos critérios</div>
    <div id="crit-area"><div class="empty">Selecione um formulário</div></div>
    <div class="form-group" style="margin-top:14px"><label class="its-label">Observações / feedback ao operador</label><textarea class="its-input" id="m-obs" rows="2">${esc(m?.observacoes || '')}</textarea></div>

    <div class="cat-head" style="margin-top:14px">Anexos (documentos e mídia)</div>
    <div class="form-group">
      <input type="file" id="m-anexos" multiple class="its-input"
        accept="audio/*,video/*,image/*,application/pdf,.doc,.docx,.xls,.xlsx,.txt">
      <div style="font-size:.74rem;color:var(--its-muted);margin-top:4px">Áudio, documentos, imagens ou vídeo. Até 10 arquivos, 50&nbsp;MB cada.</div>
    </div>
    <div id="m-anexos-exist"></div>

    <div class="its-alert alert-info" id="m-preview" style="margin-top:8px">Nota parcial: <b id="m-nota">—</b></div>
    <div id="m-notif-wrap" class="its-alert alert-warning hidden" style="margin-top:8px">
      📧 <b>Falha crítica:</b> ao salvar, supervisores, coordenadores e gerentes da equipe serão notificados automaticamente por e-mail.
    </div>
  </div>`);

  const area = body.querySelector('#crit-area');
  const respostas = new Map(); // criterio_id -> {valor, peso, fatal}
  let criterios = [];

  async function carregaCriterios(formId) {
    const f = await api.get('/formularios/' + formId);
    criterios = f.criterios;
    respostas.clear();
    const grupos = {};
    criterios.forEach((c) => {
      let valor = 'conforme';
      if (m && m.formulario_id === Number(formId)) {
        const respExistente = m.respostas.find((r) => r.criterio_id === c.id);
        if (respExistente) valor = respExistente.valor;
      }
      (grupos[c.categoria] ||= []).push(c);
      respostas.set(c.id, { valor, peso: c.peso, fatal: c.fatal });
    });

    area.innerHTML = Object.entries(grupos).map(([cat, items]) => `
      <div class="cat-head">${esc(cat)}</div>
      ${items.map((c) => {
        const respObj = respostas.get(c.id);
        return `
        <div class="crit-row" data-crit="${c.id}">
          <div>${esc(c.descricao)} <span style="color:var(--its-muted);font-size:.72rem">(peso ${c.peso})</span> ${c.fatal ? '<span class="fatal-tag">● FATAL</span>' : ''}</div>
          <div class="crit-opts">${VALORES.map((v) => `<button type="button" class="opt-btn ${v[0] === respObj.valor ? v[2] : ''}" data-v="${v[0]}">${v[1]}</button>`).join('')}</div>
        </div>`;
      }).join('')}
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
    // Aviso de notificacao automatica quando a planilha zera
    body.querySelector('#m-notif-wrap')?.classList.toggle('hidden', !fatal);
  }

  body.querySelector('#m-form').onchange = (e) => carregaCriterios(e.target.value);
  await carregaCriterios(m ? m.formulario_id : ativos[0].id);

  const salvar = h(`<button class="its-btn its-btn-primary">${m ? 'Salvar alterações' : 'Salvar monitoria'}</button>`);
  const { close } = openModal({ title: m ? 'Editar monitoria' : 'Nova monitoria', body, footer: salvar, lg: true });

  // em modo edicao, mostra os anexos ja existentes (com opcao de excluir)
  if (m) carregarAnexos(body.querySelector('#m-anexos-exist'), m.id, true);

  salvar.onclick = async () => {
    const payload = {
      formulario_id: Number(body.querySelector('#m-form').value),
      operador_id: Number(body.querySelector('#m-op').value),
      data_atendimento: body.querySelector('#m-data').value || null,
      canal: body.querySelector('#m-canal').value,
      protocolo: body.querySelector('#m-prot').value.trim(),
      observacoes: body.querySelector('#m-obs').value.trim(),
      operacao: body.querySelector('#m-operacao').value,
      telefone_cliente: body.querySelector('#m-tel').value.trim(),
      tabulacao: body.querySelector('#m-tab').value.trim(),
      produto: body.querySelector('#m-prod').value.trim(),
      data_monitoria: body.querySelector('#m-data-mon').value || null,
      monitoria_padrao: body.querySelector('#m-padrao').checked ? 1 : 0,
      feedback_aplicado: body.querySelector('#m-feed-ap').checked ? 1 : 0,
      data_feedback: body.querySelector('#m-feed-data').value || null,
      status_feedback: body.querySelector('#m-feed-status').value,
      sla: body.querySelector('#m-sla').value,
      detalhe_sla: body.querySelector('#m-sla-det').value.trim(),
      respostas: [...respostas.entries()].map(([criterio_id, r]) => ({ criterio_id, valor: r.valor })),
    };
    salvar.disabled = true;
    try {
      let monitoriaId;
      let msg;
      let res;
      if (m) {
        res = await api.put('/monitorias/' + m.id, payload);
        monitoriaId = m.id;
        msg = 'Monitoria atualizada';
      } else {
        res = await api.post('/monitorias', payload);
        monitoriaId = res.id;
        msg = `Monitoria salva · nota ${res.nota_final.toFixed(1)}`;
      }
      // envia os anexos selecionados (se houver)
      const fileInput = body.querySelector('#m-anexos');
      if (fileInput && fileInput.files.length) {
        const fd = new FormData();
        for (const f of fileInput.files) fd.append('arquivos', f);
        await api.upload('/monitorias/' + monitoriaId + '/anexos', fd);
        msg += ` · ${fileInput.files.length} anexo(s)`;
      }
      toast(msg);
      // Resultado da notificacao automatica aos gestores (falha critica)
      const n = res && res.notificacao;
      if (n) {
        if (n.enviado) toast(`📧 E-mail de falha crítica enviado a ${n.destinatarios.length} gestor(es)`);
        else toast('⚠️ Falha crítica — e-mail não enviado: ' + (n.motivo || 'erro desconhecido'), true);
      }
      close();
      reload();
    } catch (e) { salvar.disabled = false; toast(e.message, true); }
  };
}

// ---------- DETALHE ----------
async function detalhe(id, reload) {
  const m = await api.get('/monitorias/' + id);
  const grupos = {};
  m.respostas.forEach((r) => (grupos[r.categoria] ||= []).push(r));
  // 'conforme'/'nao_conforme' = Pontuou/Não pontuou. 'parcial'/'na' permanecem
  // mapeados para exibir corretamente monitorias antigas (modelo de 4 opcoes).
  const rotulo = { conforme: '<span class="its-badge badge-green">Pontuou</span>', parcial: '<span class="its-badge badge-orange">Parcial</span>', nao_conforme: '<span class="its-badge badge-red">Não pontuou</span>', na: '<span class="its-badge badge-gray">N/A</span>' };

  const body = h(`<div>
    <div class="card-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:16px">
      <div class="its-card"><div class="stat-label">Operador</div><b>${esc(m.operador_nome)}</b><div style="font-size:0.75rem;color:var(--its-muted)">CPF: ${esc(m.operador_cpf || '—')}</div></div>
      <div class="its-card"><div class="stat-label">Canal · Data Atend.</div><b>${esc(m.canal)} · ${fmtData(m.data_atendimento)}</b></div>
      <div class="its-card"><div class="stat-label">Monitor</div><b>${esc(m.monitor_nome)}</b></div>
      <div class="its-card"><div class="stat-label">Nota final</div>${m.falha_critica ? '<span class="its-badge badge-red">Falha crítica · 0</span>' : scorePill(m.nota_final)}</div>
    </div>
    
    <div class="its-card" style="margin-bottom:16px">
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:14px;font-size:0.8rem">
        <div><span style="color:var(--its-muted)">Operação:</span> <b>${esc(m.operacao || '—')}</b></div>
        <div><span style="color:var(--its-muted)">Telefone Cliente:</span> <b>${esc(m.telefone_cliente || '—')}</b></div>
        <div><span style="color:var(--its-muted)">Tabulação:</span> <b>${esc(m.tabulacao || '—')}</b></div>
        <div><span style="color:var(--its-muted)">Produto:</span> <b>${esc(m.produto || '—')}</b></div>
        <div><span style="color:var(--its-muted)">Data Monitoria:</span> <b>${fmtData(m.data_monitoria)}</b></div>
        <div><span style="color:var(--its-muted)">Monitoria Padrão:</span> <b>${m.monitoria_padrao ? 'Sim' : 'Não'}</b></div>
        <div><span style="color:var(--its-muted)">Feedback Aplicado:</span> <b>${m.feedback_aplicado ? 'Sim' : 'Não'}</b></div>
        <div><span style="color:var(--its-muted)">Data Feedback:</span> <b>${fmtData(m.data_feedback)}</b></div>
        <div><span style="color:var(--its-muted)">Status Feedback:</span> <b>${esc(m.status_feedback || '—')}</b></div>
        <div><span style="color:var(--its-muted)">SLA:</span> <b>${esc(m.sla || '—')}</b></div>
        <div style="grid-column: span 2"><span style="color:var(--its-muted)">Detalhe SLA:</span> <b>${esc(m.detalhe_sla || '—')}</b></div>
      </div>
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

    <div class="cat-head">Anexos</div>
    <div id="det-anexos"></div>
  </div>`);

  const footer = h(`<div style="display:flex;gap:8px">
    ${m.status !== 'contestada' ? '<button class="its-btn its-btn-outline" id="btn-contestar">Registrar contestação</button>' : ''}
  </div>`);
  const { close } = openModal({ title: `Monitoria · ${esc(m.protocolo || '#' + m.id)}`, body, footer, lg: true });
  carregarAnexos(body.querySelector('#det-anexos'), m.id, false);

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
