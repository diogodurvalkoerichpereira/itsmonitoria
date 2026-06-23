import { api } from '../api.js';
import { esc, barChart, lineChart, scorePill } from '../ui.js';

export async function dashboardView(el) {
  el.innerHTML = '<div class="empty">Carregando indicadores...</div>';
  const d = await api.get('/dashboard');
  const r = d.resumo || {};

  const stat = (ico, bg, val, label) => `
    <div class="its-card stat-card">
      <div class="stat-ico" style="background:${bg}1a;color:${bg}">${ico}</div>
      <div><div class="stat-value">${val}</div><div class="stat-label">${label}</div></div>
    </div>`;

  const mesNome = (m) => {
    if (!m) return '—';
    const [y, mm] = m.split('-');
    return ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'][+mm - 1] + '/' + y.slice(2);
  };

  el.innerHTML = `
    <div class="section-title">Visão Geral da Qualidade</div>
    <div class="card-grid">
      ${stat('📋', '#183c5a', r.total_monitorias ?? 0, 'Monitorias realizadas')}
      ${stat('⭐', '#E85928', (r.nota_media ?? 0) + '%', 'Nota média geral')}
      ${stat('✅', '#16a34a', (r.pct_aprovacao ?? 0) + '%', 'Taxa de aprovação (≥80)')}
      ${stat('⚠️', '#dc2626', r.falhas_criticas ?? 0, 'Falhas críticas')}
    </div>

    <div class="grid-2" style="margin-bottom:14px">
      <div class="its-card">
        <div class="chart-title">Evolução da nota média (mensal)</div>
        ${lineChart((d.evolucao || []).map((e) => ({ label: mesNome(e.mes), value: e.nota_media })))}
      </div>
      <div class="its-card">
        <div class="chart-title">Nota média por equipe</div>
        ${barChart((d.porEquipe || []).map((e) => ({ label: e.equipe, value: e.nota_media })), { color: 'blue' })}
      </div>
    </div>

    <div class="grid-2" style="margin-bottom:14px">
      <div class="its-card">
        <div class="chart-title">Conformidade por categoria (menor → maior)</div>
        ${barChart((d.porCategoria || []).map((c) => ({ label: c.categoria, value: c.conformidade })), { suffix: '%' })}
      </div>
      <div class="its-card">
        <div class="chart-title">Volume e nota por canal</div>
        ${(d.porCanal || []).length ? `<table class="its-table"><thead><tr><th>Canal</th><th>Monitorias</th><th>Nota média</th></tr></thead><tbody>
          ${d.porCanal.map((c) => `<tr><td>${esc(c.canal)}</td><td>${c.total}</td><td>${scorePill(c.nota_media)}</td></tr>`).join('')}
        </tbody></table>` : '<div class="empty">Sem dados</div>'}
      </div>
    </div>

    <div class="its-card">
      <div class="chart-title">Ranking de operadores ${d.contestacoesAbertas ? `· <span class="its-badge badge-orange">${d.contestacoesAbertas} contestações abertas</span>` : ''}</div>
      <div class="table-wrap">
        <table class="its-table">
          <thead><tr><th>#</th><th>Operador</th><th>Equipe</th><th>Monitorias</th><th>Nota média</th></tr></thead>
          <tbody>
            ${(d.rankingOperadores || []).map((o, i) => `
              <tr><td>${i + 1}º</td><td>${esc(o.operador)}</td><td>${esc(o.equipe || '—')}</td><td>${o.total}</td><td>${scorePill(o.nota_media)}</td></tr>
            `).join('') || '<tr><td colspan="5" class="empty">Sem dados</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>
  `;
}
