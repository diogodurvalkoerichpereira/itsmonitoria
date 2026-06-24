import { Router } from 'express';
import { db } from '../db.js';

export const relatoriosRouter = Router();

// Relatorios gerenciais (guia "Gerenciar"). Somente leitura, agregacoes sobre
// as monitorias concluidas. O acesso e protegido por nivel no server.ts.
const CONCLUIDAS = "status != 'rascunho'";
const META = 80; // nota minima de aprovacao

relatoriosRouter.get('/', async (_req, res) => {
  // ---- Acompanhamento de feedback ----
  const feedbackResumo = await db.prepare(`
    SELECT
      COUNT(*) AS total,
      SUM(CASE WHEN feedback_aplicado=1 THEN 1 ELSE 0 END) AS realizados,
      SUM(CASE WHEN COALESCE(feedback_aplicado,0)=0 THEN 1 ELSE 0 END) AS pendentes,
      ROUND(100.0 * SUM(CASE WHEN feedback_aplicado=1 THEN 1 ELSE 0 END) / NULLIF(COUNT(*),0),1) AS pct_aplicado
    FROM monitorias WHERE ${CONCLUIDAS}
  `).get();

  const feedbackPorEquipe = await db.prepare(`
    SELECT e.nome AS equipe, COUNT(*) AS total,
      SUM(CASE WHEN m.feedback_aplicado=1 THEN 1 ELSE 0 END) AS realizados,
      SUM(CASE WHEN COALESCE(m.feedback_aplicado,0)=0 THEN 1 ELSE 0 END) AS pendentes
    FROM monitorias m
    JOIN operadores o ON o.id = m.operador_id
    LEFT JOIN equipes e ON e.id = o.equipe_id
    WHERE m.${CONCLUIDAS}
    GROUP BY e.nome ORDER BY pendentes DESC, total DESC
  `).all();

  // ---- SLA de qualidade ----
  const slaDistribuicao = await db.prepare(`
    SELECT COALESCE(NULLIF(TRIM(sla),''),'(sem SLA)') AS sla, COUNT(*) AS total
    FROM monitorias WHERE ${CONCLUIDAS}
    GROUP BY COALESCE(NULLIF(TRIM(sla),''),'(sem SLA)') ORDER BY total DESC
  `).all();

  const slaForaPrazo = await db.prepare(`
    SELECT o.nome AS operador, e.nome AS equipe, COUNT(*) AS fora_sla
    FROM monitorias m
    JOIN operadores o ON o.id = m.operador_id
    LEFT JOIN equipes e ON e.id = o.equipe_id
    WHERE m.${CONCLUIDAS} AND m.sla = 'Tratativa Necessária'
    GROUP BY o.nome, e.nome ORDER BY fora_sla DESC LIMIT 30
  `).all();

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
    WHERE m.${CONCLUIDAS}
    GROUP BY c.id, c.categoria, c.descricao, c.fatal
    HAVING SUM(CASE WHEN r.valor='nao_conforme' THEN 1 ELSE 0 END) > 0
    ORDER BY reprovas DESC, pct_reprova DESC LIMIT 20
  `).all();

  // ---- Operadores abaixo da meta ----
  const operadoresAbaixoMeta = await db.prepare(`
    SELECT o.nome AS operador, e.nome AS equipe, COUNT(m.id) AS total,
      ROUND(AVG(m.nota_final)::numeric,1) AS nota_media,
      SUM(CASE WHEN m.falha_critica=1 THEN 1 ELSE 0 END) AS falhas_criticas
    FROM monitorias m
    JOIN operadores o ON o.id = m.operador_id
    LEFT JOIN equipes e ON e.id = o.equipe_id
    WHERE m.${CONCLUIDAS}
    GROUP BY o.id, e.nome
    HAVING COUNT(m.id) > 0 AND AVG(m.nota_final) < ${META}
    ORDER BY nota_media ASC
  `).all();

  // ---- Produtividade dos monitores ----
  const produtividadeMonitores = await db.prepare(`
    SELECT u.nome AS monitor, COUNT(m.id) AS total,
      ROUND(AVG(m.nota_final)::numeric,1) AS nota_media_aplicada,
      SUM(CASE WHEN m.feedback_aplicado=1 THEN 1 ELSE 0 END) AS feedbacks,
      SUM(CASE WHEN m.falha_critica=1 THEN 1 ELSE 0 END) AS falhas_criticas
    FROM monitorias m
    JOIN usuarios u ON u.id = m.monitor_id
    WHERE m.${CONCLUIDAS}
    GROUP BY u.id, u.nome HAVING COUNT(m.id) > 0 ORDER BY total DESC
  `).all();

  res.json({
    meta: META,
    feedback: { resumo: feedbackResumo, porEquipe: feedbackPorEquipe },
    sla: { distribuicao: slaDistribuicao, foraPrazo: slaForaPrazo },
    criteriosReprovados,
    operadoresAbaixoMeta,
    produtividadeMonitores,
  });
});
