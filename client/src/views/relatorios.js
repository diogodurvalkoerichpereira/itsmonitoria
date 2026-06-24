import { api } from '../api.js';
import { esc, barChart, scorePill, toast } from '../ui.js';

// Gera e baixa um CSV a partir de um array de objetos. `colunas` define a ordem
// e os rotulos do cabecalho: [{ key, label }].
function baixarCSV(nomeArquivo, colunas, linhas) {
  if (!linhas || !linhas.length) { toast('Nada para exportar', true); return; }
  const escCsv = (v) => {
    const s = String(v ?? '');
    return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const head = colunas.map((c) => escCsv(c.label)).join(';');
  const body = linhas.map((l) => colunas.map((c) => escCsv(l[c.key])).join(';')).join('\n');
  // BOM para o Excel reconhecer UTF-8 (acentos)
  const blob = new Blob(['﻿' + head + '\n' + body], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = nomeArquivo;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

function tabela(cabecalhos, linhasHtml) {
  return `<div class="table-wrap"><table class="its-table">
    <thead><tr>${cabecalhos.map((h) => `<th>${h}</th>`).join('')}</tr></thead>
    <tbody>${linhasHtml || `<tr><td colspan="${cabecalhos.length}" class="empty">Sem dados</td></tr>`}</tbody>
  </table></div>`;
}

function botaoExport(id, label = 'Exportar CSV') {
  return `<button class="its-btn btn-ghost btn-sm" data-export="${id}" type="button">⬇ ${label}</button>`;
}

export async function relatoriosView(el) {
  el.innerHTML = '<div class="empty">Carregando relatórios...</div>';
  const d = await api.get('/relatorios');
  const meta = d.meta ?? 80;

  const fb = d.feedback?.resumo || {};
  const fbEquipe = d.feedback?.porEquipe || [];
  const slaDist = d.sla?.distribuicao || [];
  const slaFora = d.sla?.foraPrazo || [];
  const criterios = d.criteriosReprovados || [];
  const abaixo = d.operadoresAbaixoMeta || [];
  const monitores = d.produtividadeMonitores || [];

  el.innerHTML = `
    <div class="section-title">Gerenciar · Relatórios</div>

    <!-- Acompanhamento de Feedback -->
    <div class="its-card" style="margin-bottom:14px">
      <div class="chart-title" style="display:flex;justify-content:space-between;align-items:center">
        <span>Acompanhamento de Feedback</span>${botaoExport('fb')}
      </div>
      <div class="card-grid" style="margin-bottom:10px">
        <div class="its-card stat-card"><div><div class="stat-value">${fb.total ?? 0}</div><div class="stat-label">Monitorias</div></div></div>
        <div class="its-card stat-card"><div><div class="stat-value">${fb.realizados ?? 0}</div><div class="stat-label">Feedbacks realizados</div></div></div>
        <div class="its-card stat-card"><div><div class="stat-value">${fb.pendentes ?? 0}</div><div class="stat-label">Pendentes</div></div></div>
        <div class="its-card stat-card"><div><div class="stat-value">${fb.pct_aplicado ?? 0}%</div><div class="stat-label">% aplicado</div></div></div>
      </div>
      ${tabela(['Equipe', 'Total', 'Realizados', 'Pendentes'],
        fbEquipe.map((r) => `<tr><td>${esc(r.equipe || '—')}</td><td>${r.total}</td><td>${r.realizados}</td>
          <td>${r.pendentes > 0 ? `<span class="its-badge badge-orange">${r.pendentes}</span>` : '0'}</td></tr>`).join(''))}
    </div>

    <!-- SLA de Qualidade -->
    <div class="grid-2" style="margin-bottom:14px">
      <div class="its-card">
        <div class="chart-title">Distribuição de SLA</div>
        ${barChart(slaDist.map((s) => ({ label: s.sla, value: s.total })), { color: 'blue', max: Math.max(1, ...slaDist.map((s) => s.total)) })}
      </div>
      <div class="its-card">
        <div class="chart-title" style="display:flex;justify-content:space-between;align-items:center">
          <span>Operadores fora do SLA</span>${botaoExport('sla')}
        </div>
        ${tabela(['Operador', 'Equipe', 'Fora do SLA'],
          slaFora.map((r) => `<tr><td>${esc(r.operador)}</td><td>${esc(r.equipe || '—')}</td>
            <td><span class="its-badge badge-red">${r.fora_sla}</span></td></tr>`).join(''))}
      </div>
    </div>

    <!-- Criterios mais reprovados -->
    <div class="its-card" style="margin-bottom:14px">
      <div class="chart-title" style="display:flex;justify-content:space-between;align-items:center">
        <span>Critérios mais reprovados (onde treinar)</span>${botaoExport('crit')}
      </div>
      ${tabela(['Categoria', 'Critério', 'Reprovas', 'Avaliações', '% reprova'],
        criterios.map((r) => `<tr>
          <td>${esc(r.categoria)}</td>
          <td>${esc(r.descricao)} ${r.fatal ? '<span class="fatal-tag">● FATAL</span>' : ''}</td>
          <td>${r.reprovas}</td><td>${r.avaliacoes}</td>
          <td><span class="its-badge ${r.pct_reprova >= 20 ? 'badge-red' : 'badge-orange'}">${r.pct_reprova ?? 0}%</span></td>
        </tr>`).join(''))}
    </div>

    <!-- Operadores abaixo da meta -->
    <div class="its-card" style="margin-bottom:14px">
      <div class="chart-title" style="display:flex;justify-content:space-between;align-items:center">
        <span>Operadores abaixo da meta (&lt; ${meta})</span>${botaoExport('abaixo')}
      </div>
      ${tabela(['#', 'Operador', 'Equipe', 'Monitorias', 'Nota média', 'Falhas críticas'],
        abaixo.map((r, i) => `<tr><td>${i + 1}º</td><td>${esc(r.operador)}</td><td>${esc(r.equipe || '—')}</td>
          <td>${r.total}</td><td>${scorePill(r.nota_media)}</td>
          <td>${r.falhas_criticas > 0 ? `<span class="its-badge badge-red">${r.falhas_criticas}</span>` : '0'}</td></tr>`).join(''))}
    </div>

    <!-- Produtividade dos monitores -->
    <div class="its-card">
      <div class="chart-title" style="display:flex;justify-content:space-between;align-items:center">
        <span>Produtividade dos monitores</span>${botaoExport('mon')}
      </div>
      ${tabela(['Monitor', 'Monitorias', 'Nota média aplicada', 'Feedbacks', 'Falhas críticas'],
        monitores.map((r) => `<tr><td>${esc(r.monitor)}</td><td>${r.total}</td>
          <td>${scorePill(r.nota_media_aplicada)}</td><td>${r.feedbacks}</td>
          <td>${r.falhas_criticas}</td></tr>`).join(''))}
    </div>
  `;

  // Exportacoes CSV
  const exports = {
    fb:    ['feedback-por-equipe.csv', [{ key: 'equipe', label: 'Equipe' }, { key: 'total', label: 'Total' }, { key: 'realizados', label: 'Realizados' }, { key: 'pendentes', label: 'Pendentes' }], fbEquipe],
    sla:   ['operadores-fora-sla.csv', [{ key: 'operador', label: 'Operador' }, { key: 'equipe', label: 'Equipe' }, { key: 'fora_sla', label: 'Fora do SLA' }], slaFora],
    crit:  ['criterios-reprovados.csv', [{ key: 'categoria', label: 'Categoria' }, { key: 'descricao', label: 'Criterio' }, { key: 'reprovas', label: 'Reprovas' }, { key: 'avaliacoes', label: 'Avaliacoes' }, { key: 'pct_reprova', label: '% reprova' }], criterios],
    abaixo:['operadores-abaixo-meta.csv', [{ key: 'operador', label: 'Operador' }, { key: 'equipe', label: 'Equipe' }, { key: 'total', label: 'Monitorias' }, { key: 'nota_media', label: 'Nota media' }, { key: 'falhas_criticas', label: 'Falhas criticas' }], abaixo],
    mon:   ['produtividade-monitores.csv', [{ key: 'monitor', label: 'Monitor' }, { key: 'total', label: 'Monitorias' }, { key: 'nota_media_aplicada', label: 'Nota media aplicada' }, { key: 'feedbacks', label: 'Feedbacks' }, { key: 'falhas_criticas', label: 'Falhas criticas' }], monitores],
  };
  el.querySelectorAll('[data-export]').forEach((btn) => {
    btn.onclick = () => {
      const cfg = exports[btn.dataset.export];
      if (cfg) baixarCSV(cfg[0], cfg[1], cfg[2]);
    };
  });
}
