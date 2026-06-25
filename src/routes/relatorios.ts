import { Router } from 'express';
import { db } from '../db.js';

export const relatoriosRouter = Router();

// Relatorios gerenciais (guia "Gerenciar"). Somente leitura, agregacoes sobre
// as monitorias concluidas. O acesso e protegido por nivel no server.ts.
const META = 80; // nota minima de aprovacao

// Monta a clausula WHERE com os filtros opcionais (periodo, equipe, monitor,
// canal). `alias` e o prefixo da tabela monitorias na query (ex.: 'm.'). Como
// os mesmos filtros sao aplicados em todas as agregacoes, devolve a clausula e
// os parametros na ordem dos placeholders (?).
function filtroMonitorias(q: Record<string, unknown>, alias = ''): { where: string; params: unknown[] } {
  const p = alias ? `${alias}.` : '';
  const cond: string[] = [`${p}status != 'rascunho'`];
  const params: unknown[] = [];
  const { de, ate, canal, monitor_id, equipe_id } = q;
  if (de) { cond.push(`${p}data_atendimento::date >= ?::date`); params.push(de); }
  if (ate) { cond.push(`${p}data_atendimento::date <= ?::date`); params.push(ate); }
  if (canal) { cond.push(`${p}canal = ?`); params.push(canal); }
  if (monitor_id) { cond.push(`${p}monitor_id = ?`); params.push(monitor_id); }
  if (equipe_id) { cond.push(`${p}operador_id IN (SELECT id FROM operadores WHERE equipe_id = ?)`); params.push(equipe_id); }
  return { where: cond.join(' AND '), params };
}

relatoriosRouter.get('/', async (req, res) => {
  const q = req.query as Record<string, unknown>;
  // Filtros sem alias (queries com FROM monitorias) e com alias 'm'.
  const f = filtroMonitorias(q);
  const fm = filtroMonitorias(q, 'm');

  // ---- Acompanhamento de feedback ----
  const feedbackResumo = await db.prepare(`
    SELECT
      COUNT(*) AS total,
      SUM(CASE WHEN feedback_aplicado=1 THEN 1 ELSE 0 END) AS realizados,
      SUM(CASE WHEN COALESCE(feedback_aplicado,0)=0 THEN 1 ELSE 0 END) AS pendentes,
      ROUND(100.0 * SUM(CASE WHEN feedback_aplicado=1 THEN 1 ELSE 0 END) / NULLIF(COUNT(*),0),1) AS pct_aplicado
    FROM monitorias WHERE ${f.where}
  `).get(...f.params);

  const feedbackPorEquipe = await db.prepare(`
    SELECT e.nome AS equipe, COUNT(*) AS total,
      SUM(CASE WHEN m.feedback_aplicado=1 THEN 1 ELSE 0 END) AS realizados,
      SUM(CASE WHEN COALESCE(m.feedback_aplicado,0)=0 THEN 1 ELSE 0 END) AS pendentes
    FROM monitorias m
    JOIN operadores o ON o.id = m.operador_id
    LEFT JOIN equipes e ON e.id = o.equipe_id
    WHERE ${fm.where}
    GROUP BY e.nome ORDER BY pendentes DESC, total DESC
  `).all(...fm.params);

  // ---- SLA de qualidade ----
  const slaDistribuicao = await db.prepare(`
    SELECT COALESCE(NULLIF(TRIM(sla),''),'(sem SLA)') AS sla, COUNT(*) AS total
    FROM monitorias WHERE ${f.where}
    GROUP BY COALESCE(NULLIF(TRIM(sla),''),'(sem SLA)') ORDER BY total DESC
  `).all(...f.params);

  const slaForaPrazo = await db.prepare(`
    SELECT o.nome AS operador, e.nome AS equipe, COUNT(*) AS fora_sla
    FROM monitorias m
    JOIN operadores o ON o.id = m.operador_id
    LEFT JOIN equipes e ON e.id = o.equipe_id
    WHERE ${fm.where} AND m.sla = 'Tratativa Necessária'
    GROUP BY o.nome, e.nome ORDER BY fora_sla DESC LIMIT 30
  `).all(...fm.params);

  // ---- Criterios mais reprovados (onde treinar) ----
  // 'nao_conforme' = "Não pontuou" no modelo binario atual.
  const criteriosReprovados = await db.prepare(`
    SELECT c.categoria, c.descricao, c.fatal,
      SUM(CASE WHEN r.valor='nao_conforme' THEN 1 ELSE 0 END) AS reprovas,
      SUM(CASE WHEN r.valor='na' THEN 0 ELSE 1 END) AS avaliacoes,
      ROUND(100.0 * SUM(CASE WHEN r.valor='nao_conforme' THEN 1 ELSE 0 END)
            / NULLIF(SUM(CASE WHEN r.valor='na' THEN 0 ELSE 1 END),0),1) AS pct_reprova
    FROM respostas r
    JOIN criterios c ON c.id = r.criterio_id
    JOIN monitorias m ON m.id = r.monitoria_id
    WHERE ${fm.where}
    GROUP BY c.id, c.categoria, c.descricao, c.fatal
    HAVING SUM(CASE WHEN r.valor='nao_conforme' THEN 1 ELSE 0 END) > 0
    ORDER BY reprovas DESC, pct_reprova DESC LIMIT 20
  `).all(...fm.params);

  // ---- Operadores abaixo da meta ----
  const operadoresAbaixoMeta = await db.prepare(`
    SELECT o.nome AS operador, e.nome AS equipe, COUNT(m.id) AS total,
      ROUND(AVG(m.nota_final)::numeric,1) AS nota_media,
      SUM(CASE WHEN m.falha_critica=1 THEN 1 ELSE 0 END) AS falhas_criticas
    FROM monitorias m
    JOIN operadores o ON o.id = m.operador_id
    LEFT JOIN equipes e ON e.id = o.equipe_id
    WHERE ${fm.where}
    GROUP BY o.id, e.nome
    HAVING COUNT(m.id) > 0 AND AVG(m.nota_final) < ${META}
    ORDER BY nota_media ASC
  `).all(...fm.params);

  // ---- Produtividade dos monitores ----
  const produtividadeMonitores = await db.prepare(`
    SELECT u.nome AS monitor, COUNT(m.id) AS total,
      ROUND(AVG(m.nota_final)::numeric,1) AS nota_media_aplicada,
      SUM(CASE WHEN m.feedback_aplicado=1 THEN 1 ELSE 0 END) AS feedbacks,
      SUM(CASE WHEN m.falha_critica=1 THEN 1 ELSE 0 END) AS falhas_criticas
    FROM monitorias m
    JOIN usuarios u ON u.id = m.monitor_id
    WHERE ${fm.where}
    GROUP BY u.id, u.nome HAVING COUNT(m.id) > 0 ORDER BY total DESC
  `).all(...fm.params);

  res.json({
    meta: META,
    feedback: { resumo: feedbackResumo, porEquipe: feedbackPorEquipe },
    sla: { distribuicao: slaDistribuicao, foraPrazo: slaForaPrazo },
    criteriosReprovados,
    operadoresAbaixoMeta,
    produtividadeMonitores,
  });
});
