// Helpers de UI

export function h(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function toast(msg, erro = false) {
  const t = h(`<div class="toast ${erro ? 'err' : ''}">${esc(msg)}</div>`);
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2800);
}

export function scorePill(nota) {
  const n = Number(nota) || 0;
  const cls = n >= 80 ? 'score-high' : n >= 60 ? 'score-mid' : 'score-low';
  return `<span class="score-pill ${cls}">${n.toFixed(1)}</span>`;
}

const STATUS = {
  concluida:   ['badge-green', 'Concluída'],
  contestada:  ['badge-orange', 'Contestada'],
  rascunho:    ['badge-gray', 'Rascunho'],
  aberta:      ['badge-blue', 'Aberta'],
  em_analise:  ['badge-orange', 'Em análise'],
  deferida:    ['badge-green', 'Deferida'],
  indeferida:  ['badge-red', 'Indeferida'],
  fechada:     ['badge-gray', 'Fechada'],
};
export function statusBadge(s) {
  const [cls, label] = STATUS[s] || ['badge-gray', s];
  return `<span class="its-badge ${cls}"><span class="badge-dot"></span>${label}</span>`;
}

export function fmtData(iso) {
  if (!iso) return '—';
  const d = new Date(iso.length <= 10 ? iso + 'T00:00:00' : iso);
  return d.toLocaleDateString('pt-BR');
}

// Modal
export function openModal({ title, body, footer, lg }) {
  const root = document.getElementById('modal-root');
  const overlay = h(`
    <div class="modal-overlay">
      <div class="modal ${lg ? 'lg' : ''}">
        <div class="modal-head"><h3>${esc(title)}</h3><button class="modal-close">&times;</button></div>
        <div class="modal-body"></div>
        <div class="modal-foot"></div>
      </div>
    </div>`);
  overlay.querySelector('.modal-body').append(typeof body === 'string' ? h(`<div>${body}</div>`) : body);
  if (footer) overlay.querySelector('.modal-foot').append(footer);
  const close = () => overlay.remove();
  overlay.querySelector('.modal-close').onclick = close;
  overlay.onclick = (e) => { if (e.target === overlay) close(); };
  root.append(overlay);
  return { overlay, close };
}

export function barChart(items, { color = 'orange', max = 100, suffix = '' } = {}) {
  if (!items.length) return '<div class="empty">Sem dados</div>';
  const maxVal = Math.max(max, ...items.map((i) => i.value));
  return items.map((i) => `
    <div class="bar-row">
      <span class="bar-label" title="${esc(i.label)}">${esc(i.label)}</span>
      <span class="bar-track"><span class="bar-fill ${color === 'blue' ? 'blue' : ''}" style="width:${(i.value / maxVal) * 100}%"></span></span>
      <span class="bar-val">${i.value}${suffix}</span>
    </div>`).join('');
}

// grafico de linha simples em SVG
export function lineChart(points, { w = 560, hgt = 180 } = {}) {
  if (points.length < 2) return '<div class="empty">Dados insuficientes para tendência</div>';
  const pad = 34;
  const vals = points.map((p) => p.value);
  const min = Math.min(...vals) - 5, max = Math.max(...vals) + 2;
  const range = max - min || 1;
  const px = (i) => pad + (i * (w - pad * 2)) / (points.length - 1);
  const py = (v) => hgt - pad - ((v - min) / range) * (hgt - pad * 1.4);
  const line = points.map((p, i) => `${px(i)},${py(p.value)}`).join(' ');
  const area = `${pad},${hgt - pad} ${line} ${px(points.length - 1)},${hgt - pad}`;
  const dots = points.map((p, i) =>
    `<circle cx="${px(i)}" cy="${py(p.value)}" r="3.5" fill="#E85928"/>
     <text x="${px(i)}" y="${py(p.value) - 9}" text-anchor="middle" font-size="10" font-weight="700" fill="#183c5a">${p.value}</text>`).join('');
  const labels = points.map((p, i) =>
    `<text x="${px(i)}" y="${hgt - 12}" text-anchor="middle" font-size="9.5" fill="#64748b">${esc(p.label)}</text>`).join('');
  return `<svg viewBox="0 0 ${w} ${hgt}" width="100%" preserveAspectRatio="xMidYMid meet">
    <polygon points="${area}" fill="#E8592815"/>
    <polyline points="${line}" fill="none" stroke="#E85928" stroke-width="2.5"/>
    ${dots}${labels}
  </svg>`;
}
