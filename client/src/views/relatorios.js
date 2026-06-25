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

// Monta o relatorio completo em HTML e abre o dialogo de impressao do navegador,
// onde o usuario escolhe "Salvar como PDF". Sem dependencias externas.
function exportarPDF(secoes, meta) {
  const linhasTabela = (cols, linhas) =>
    (linhas && linhas.length)
      ? linhas.map((l) => `<tr>${cols.map((c) => `<td>${esc(String(l[c.key] ?? '—'))}</td>`).join('')}</tr>`).join('')
      : `<tr><td colspan="${cols.length}" style="text-align:center;color:#888">Sem dados</td></tr>`;

  const bloco = (titulo, cols, linhas) => `
    <h2>${esc(titulo)}</h2>
    <table>
      <thead><tr>${cols.map((c) => `<th>${esc(c.label)}</th>`).join('')}</tr></thead>
      <tbody>${linhasTabela(cols, linhas)}</tbody>
    </table>`;

  const agora = new Date().toLocaleString('pt-BR');
  const corpo = secoes.map((s) => bloco(s.titulo, s.colunas, s.linhas)).join('');
  const html = `<!doctype html><html lang="pt-br"><head><meta charset="utf-8">
    <title>Relatórios · iTS Qualidade</title>
    <style>
      * { box-sizing:border-box; }
      body { font-family:Arial,Helvetica,sans-serif; color:#1f2937; margin:24px; }
      .head { border-bottom:3px solid #ff6a00; padding-bottom:10px; margin-bottom:18px; }
      .head h1 { margin:0; font-size:20px; color:#1f2937; }
      .head .sub { font-size:12px; color:#6b7280; margin-top:4px; }
      h2 { font-size:14px; margin:22px 0 8px; color:#ff6a00; page-break-after:avoid; }
      table { width:100%; border-collapse:collapse; margin-bottom:8px; font-size:11px; page-break-inside:auto; }
      th,td { border:1px solid #e5e7eb; padding:6px 8px; text-align:left; }
      th { background:#f8fafc; font-weight:700; }
      tr { page-break-inside:avoid; }
      .foot { margin-top:20px; font-size:10px; color:#9ca3af; }
      @media print { body { margin:12mm; } @page { margin:12mm; } }
    </style></head><body>
    <div class="head">
      <h1>Relatórios · iTS Qualidade</h1>
      <div class="sub">Gerado em ${agora} · Meta de qualidade: ${meta}</div>
    </div>
    ${corpo}
    <div class="foot">Documento gerado automaticamente pelo módulo de Qualidade — ITSCS.</div>
    </body></html>`;

  const win = window.open('', '_blank');
  if (!win) { toast('Permita pop-ups para exportar o PDF', true); return; }
  win.document.write(html);
  win.document.close();
  win.focus();
  // aguarda o layout/render antes de abrir a impressao
  win.onload = () => setTimeout(() => win.print(), 250);
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
    <div class="section-title" style="display:flex;justify-content:space-between;align-items:center">
      <span>Gerenciar · Relatórios</span>
      <button class="its-btn its-btn-primary its-btn-sm" id="export-pdf" type="button">📄 Exportar PDF</button>
    </div>

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

  // Exportacao PDF: relatorio completo (todas as secoes), reaproveitando as
  // mesmas definicoes de colunas/dados do CSV.
  el.querySelector('#export-pdf').onclick = () => {
    exportarPDF([
      { titulo: 'Acompanhamento de Feedback (por equipe)', colunas: exports.fb[1], linhas: exports.fb[2] },
      { titulo: 'Operadores fora do SLA', colunas: exports.sla[1], linhas: exports.sla[2] },
      { titulo: 'Critérios mais reprovados', colunas: exports.crit[1], linhas: exports.crit[2] },
      { titulo: `Operadores abaixo da meta (< ${meta})`, colunas: exports.abaixo[1], linhas: exports.abaixo[2] },
      { titulo: 'Produtividade dos monitores', colunas: exports.mon[1], linhas: exports.mon[2] },
    ], meta);
  };
}
