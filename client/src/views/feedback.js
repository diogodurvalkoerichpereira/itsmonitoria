import { api } from '../api.js';
import { esc, scorePill, fmtData, openModal, toast, h } from '../ui.js';
import { carregarAnexos } from './monitorias.js';

// Avaliacao binaria: Pontuou / Não pontuou. 'parcial'/'na' mantidos para
// exibir corretamente monitorias gravadas no modelo antigo (4 opcoes).
const ROTULO = {
  conforme: '<span class="its-badge badge-green">Pontuou</span>',
  parcial: '<span class="its-badge badge-orange">Parcial</span>',
  nao_conforme: '<span class="its-badge badge-red">Não pontuou</span>',
  na: '<span class="its-badge badge-gray">N/A</span>',
};

export async function feedbackView(el) {
  el.innerHTML = '<div class="empty">Carregando...</div>';
  const [equipes] = await Promise.all([api.get('/equipes')]);

  el.innerHTML = `
    <div class="section-title">Feedback de Monitorias</div>
    <div class="its-alert alert-info">Apresente a avaliação ao operador. Após a apresentação, o operador confirma a ciência <b>assinando com a senha</b>. Só então o feedback é registrado como realizado.</div>
    <div class="filters its-card">
      <div class="form-group"><label class="its-label">Situação</label>
        <select class="its-select" id="f-status">
          <option value="pendente">Pendentes</option>
          <option value="realizado">Realizados</option>
          <option value="">Todos</option>
        </select></div>
      <div class="form-group"><label class="its-label">Equipe</label>
        <select class="its-select" id="f-equipe"><option value="">Todas</option>
          ${equipes.map((e) => `<option value="${e.id}">${esc(e.nome)}</option>`).join('')}</select></div>
      <div class="form-group"><label class="its-label">Nome do operador</label>
        <input class="its-input" id="f-nome" placeholder="Buscar nome" style="width:170px"></div>
      <div class="form-group"><label class="its-label">CPF</label>
        <input class="its-input" id="f-cpf" placeholder="000.000.000-00" style="width:150px"></div>
      <div class="form-group"><label class="its-label">Feedback em</label>
        <input class="its-input" type="date" id="f-data" style="width:160px"></div>
      <button class="its-btn its-btn-ghost its-btn-sm" id="f-limpar">Limpar</button>
    </div>
    <div class="its-card table-wrap" id="lista"></div>`;

  async function carregar() {
    const q = new URLSearchParams();
    const st = el.querySelector('#f-status').value;
    const eq = el.querySelector('#f-equipe').value;
    const nome = el.querySelector('#f-nome').value.trim();
    const cpf = el.querySelector('#f-cpf').value.trim();
    const data = el.querySelector('#f-data').value;
    if (st) q.set('status_feedback', st);
    if (eq) q.set('equipe_id', eq);
    if (nome) q.set('nome', nome);
    if (cpf) q.set('cpf', cpf);
    if (data) q.set('feedback_em', data);
    const itens = await api.get('/feedback?' + q.toString());
    el.querySelector('#lista').innerHTML = `
      <table class="its-table">
        <thead><tr><th>Data atend.</th><th>Protocolo</th><th>Operador</th><th>Equipe</th><th>Monitor</th><th>Nota</th><th>Situação</th><th>Feedback em</th><th>Feedback por</th><th>Ação</th></tr></thead>
        <tbody>
          ${itens.map((m) => `
            <tr>
              <td>${fmtData(m.data_atendimento)}</td>
              <td>${esc(m.protocolo || '—')}</td>
              <td>${esc(m.operador_nome)}</td>
              <td>${esc(m.equipe_nome || '—')}</td>
              <td>${esc(m.monitor_nome || '—')}</td>
              <td>${m.falha_critica ? '<span class="its-badge badge-red">Falha crítica</span>' : scorePill(m.nota_final)}</td>
              <td>${m.feedback_aplicado
                ? '<span class="its-badge badge-green"><span class="badge-dot"></span>Realizado</span>'
                : '<span class="its-badge badge-orange"><span class="badge-dot"></span>Pendente</span>'}</td>
              <td>${m.feedback_aplicado ? fmtData(m.data_feedback) : '—'}</td>
              <td>${m.feedback_aplicado ? esc(m.feedback_aplicado_por_nome || '—') : '—'}</td>
              <td>${m.feedback_aplicado
                ? `<button class="its-btn its-btn-ghost its-btn-sm" data-ver="${m.id}">Ver</button>`
                : `<button class="its-btn its-btn-primary its-btn-sm" data-fb="${m.id}">Aplicar feedback</button>`}</td>
            </tr>`).join('') || '<tr><td colspan="10" class="empty">Nenhum atendimento nesta situação</td></tr>'}
        </tbody>
      </table>`;
    el.querySelectorAll('[data-fb]').forEach((b) => b.onclick = () => aplicar(b.dataset.fb, carregar));
    el.querySelectorAll('[data-ver]').forEach((b) => b.onclick = () => aplicar(b.dataset.ver, carregar, true));
  }

  el.querySelector('#f-status').onchange = carregar;  // filtros instantaneos
  el.querySelector('#f-equipe').onchange = carregar;
  el.querySelector('#f-data').onchange = carregar;
  el.querySelector('#f-nome').oninput = carregar;
  el.querySelector('#f-cpf').oninput = carregar;
  el.querySelector('#f-limpar').onclick = () => {
    el.querySelector('#f-status').value = '';
    el.querySelector('#f-equipe').value = '';
    el.querySelector('#f-nome').value = '';
    el.querySelector('#f-cpf').value = '';
    el.querySelector('#f-data').value = '';
    carregar();
  };
  await carregar();
}

// scorecard read-only da avaliacao
function scorecard(m) {
  const grupos = {};
  m.respostas.forEach((r) => (grupos[r.categoria] ||= []).push(r));
  return `
    <div class="card-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:14px">
      <div class="its-card"><div class="stat-label">Operador</div><b>${esc(m.operador_nome)}</b></div>
      <div class="its-card"><div class="stat-label">Protocolo · Canal</div><b>${esc(m.protocolo || '—')} · ${esc(m.canal)}</b></div>
      <div class="its-card"><div class="stat-label">Data atend.</div><b>${fmtData(m.data_atendimento)}</b></div>
      <div class="its-card"><div class="stat-label">Nota final</div>${m.falha_critica ? '<span class="its-badge badge-red">Falha crítica · 0</span>' : scorePill(m.nota_final)}</div>
    </div>
    <div class="card-grid" style="grid-template-columns:repeat(3,1fr);margin-bottom:14px">
      <div class="its-card"><div class="stat-label">Operação</div><b>${esc(m.operacao || '—')}</b></div>
      <div class="its-card"><div class="stat-label">Produto</div><b>${esc(m.produto || '—')}</b></div>
      <div class="its-card"><div class="stat-label">Tabulação</div><b>${esc(m.tabulacao || '—')}</b></div>
    </div>
    ${m.observacoes ? `<div class="its-alert alert-info"><b>Observações da monitoria:</b>&nbsp;${esc(m.observacoes)}</div>` : ''}
    ${Object.entries(grupos).map(([cat, items]) => `
      <div class="cat-head">${esc(cat)}</div>
      ${items.map((r) => `<div class="crit-row" style="grid-template-columns:1fr auto">
        <div>${esc(r.descricao)} ${r.fatal ? '<span class="fatal-tag">● FATAL</span>' : ''}</div>
        <div>${ROTULO[r.valor] || r.valor}</div></div>`).join('')}
    `).join('')}`;
}

async function aplicar(id, reload, somenteVer = false) {
  const m = await api.get('/monitorias/' + id);
  // busca o registro de feedback (cpf assinado / observacao) via lista detalhada
  const realizado = !!m.feedback_aplicado;

  const realizadoBloco = m.feedback_concordou === 0
    ? `<div class="its-alert alert-warning" style="margin-top:14px">
         <div><b>Feedback realizado — operador NÃO concordou.</b> Assinado em ${fmtData(m.data_feedback)} · senha confirmada.
         <br><b>Motivo da discordância:</b> ${esc(m.feedback_discordancia || '—')}
         ${m.feedback_observacao ? `<br><b>Observação:</b> ${esc(m.feedback_observacao)}` : ''}
         <br><i>Uma contestação foi aberta para análise.</i></div>
       </div>`
    : `<div class="its-alert alert-success" style="margin-top:14px">
         <div><b>Feedback realizado — operador concordou.</b> Assinado em ${fmtData(m.data_feedback)} · senha do operador confirmada.
         ${m.feedback_observacao ? `<br><b>Observação do feedback:</b> ${esc(m.feedback_observacao)}` : ''}</div>
       </div>`;

  const aplicarBloco = `
    <div class="cat-head" style="margin-top:16px">Posicionamento do operador</div>
    <div class="form-group">
      <label class="its-label">O operador concorda com a avaliação?</label>
      <select class="its-select" id="fb-concorda">
        <option value="sim">Sim, concorda com a avaliação</option>
        <option value="nao">Não concorda com a avaliação</option>
      </select>
    </div>
    <div class="form-group hidden" id="fb-disc-wrap">
      <label class="its-label">Motivo da discordância</label>
      <textarea class="its-input" id="fb-disc" rows="2" placeholder="Descreva o ponto discordado pelo operador..."></textarea>
      <div style="font-size:.74rem;color:var(--its-muted);margin-top:4px">Ao registrar discordância, uma contestação é aberta automaticamente para análise do supervisor.</div>
    </div>
    <div class="cat-head" style="margin-top:6px">Assinatura do operador</div>
    <div class="its-alert alert-warning">O operador declara <b>ciência</b> da avaliação acima (concordando ou não). Confirme digitando a <b>senha do operador</b>.</div>
    <div class="form-group"><label class="its-label">Observação do feedback (opcional)</label><textarea class="its-input" id="fb-obs" rows="2" placeholder="Pontos reforçados, plano de ação..."></textarea></div>
    <div class="form-row">
      <div class="form-group"><label class="its-label">Senha do operador (assinatura)</label><input class="its-input" type="password" id="fb-senha" autocomplete="off" placeholder="Senha do operador"></div>
    </div>
    <div id="fb-erro" class="its-alert alert-error hidden"></div>`;

  const editavel = !(somenteVer || realizado);
  const anexosBloco = `<div class="cat-head" style="margin-top:16px">Anexos da monitoria</div><div id="fb-anexos"><div class="empty">Carregando anexos...</div></div>`;
  const body = h(`<div>${scorecard(m)}${anexosBloco}${editavel ? aplicarBloco : realizadoBloco}</div>`);
  const footer = editavel
    ? h(`<button class="its-btn its-btn-primary">Confirmar assinatura e registrar</button>`)
    : null;
  const { close } = openModal({ title: somenteVer ? 'Feedback realizado' : 'Aplicar feedback ao operador', body, footer, lg: true });

  // Mostra os anexos inseridos na monitoria (audio/imagem/video/documento), read-only
  carregarAnexos(body.querySelector('#fb-anexos'), id, false);

  if (editavel) {
    const selConcorda = body.querySelector('#fb-concorda');
    const discWrap = body.querySelector('#fb-disc-wrap');
    selConcorda.onchange = () => {
      const discorda = selConcorda.value === 'nao';
      discWrap.classList.toggle('hidden', !discorda);
      footer.textContent = discorda ? 'Registrar discordância e assinatura' : 'Confirmar assinatura e registrar';
    };
    footer.onclick = async () => {
      const erro = body.querySelector('#fb-erro');
      erro.classList.add('hidden');
      const mostrar = (msg) => { erro.textContent = msg; erro.classList.remove('hidden'); };
      const concorda = selConcorda.value === 'sim';
      const discordancia = body.querySelector('#fb-disc').value.trim();
      const senha = body.querySelector('#fb-senha').value;
      if (!concorda && !discordancia) return mostrar('Informe o motivo da discordância.');
      if (!senha) return mostrar('Informe a senha do operador.');
      footer.disabled = true;
      try {
        await api.post(`/feedback/${id}/aplicar`, {
          senha,
          observacao: body.querySelector('#fb-obs').value.trim(),
          concordou: concorda,
          discordancia: concorda ? null : discordancia,
        });
        close();
        toast(concorda ? 'Feedback registrado com assinatura' : 'Discordância registrada — contestação aberta');
        reload();
      } catch (e) {
        footer.disabled = false;
        mostrar(e.message);
      }
    };
  }
}
