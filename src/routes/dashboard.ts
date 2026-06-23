import { Router } from 'express';
import { db } from '../db.js';

export const dashboardRouter = Router();

dashboardRouter.get('/', (_req, res) => {
  const concluidas = "status != 'rascunho'";

  const resumo = db.prepare(`
    SELECT
      COUNT(*) AS total_monitorias,
      ROUND(AVG(nota_final),1) AS nota_media,
      SUM(CASE WHEN falha_critica=1 THEN 1 ELSE 0 END) AS falhas_criticas,
      ROUND(100.0 * SUM(CASE WHEN nota_final >= 80 THEN 1 ELSE 0 END) / COUNT(*),1) AS pct_aprovacao
    FROM monitorias WHERE ${concluidas}
  `).get();

  const contestacoesAbertas = (db.prepare(
    "SELECT COUNT(*) AS n FROM contestacoes WHERE status IN ('aberta','em_analise')"
  ).get() as { n: number }).n;

  const porEquipe = db.prepare(`
    SELECT e.nome AS equipe, COUNT(m.id) AS total, ROUND(AVG(m.nota_final),1) AS nota_media
    FROM monitorias m
    JOIN operadores o ON o.id = m.operador_id
    JOIN equipes e ON e.id = o.equipe_id
    WHERE m.${concluidas}
    GROUP BY e.id ORDER BY nota_media DESC
  `).all();

  const rankingOperadores = db.prepare(`
    SELECT o.nome AS operador, e.nome AS equipe, COUNT(m.id) AS total, ROUND(AVG(m.nota_final),1) AS nota_media
    FROM monitorias m
    JOIN operadores o ON o.id = m.operador_id
    LEFT JOIN equipes e ON e.id = o.equipe_id
    WHERE m.${concluidas}
    GROUP BY o.id HAVING total > 0 ORDER BY nota_media DESC
  `).all();

  const porCanal = db.prepare(`
    SELECT canal, COUNT(*) AS total, ROUND(AVG(nota_final),1) AS nota_media
    FROM monitorias WHERE ${concluidas} GROUP BY canal ORDER BY total DESC
  `).all();

  const evolucao = db.prepare(`
    SELECT strftime('%Y-%m', data_atendimento) AS mes, COUNT(*) AS total, ROUND(AVG(nota_final),1) AS nota_media
    FROM monitorias
    WHERE ${concluidas} AND data_atendimento IS NOT NULL
    GROUP BY mes ORDER BY mes
  `).all();

  // desempenho por categoria de criterio (% de conformidade)
  const porCategoria = db.prepare(`
    SELECT c.categoria,
      ROUND(100.0 * SUM(CASE r.valor WHEN 'conforme' THEN 1 WHEN 'parcial' THEN 0.5 ELSE 0 END)
            / SUM(CASE WHEN r.valor='na' THEN 0 ELSE 1 END), 1) AS conformidade
    FROM respostas r
    JOIN criterios c ON c.id = r.criterio_id
    JOIN monitorias m ON m.id = r.monitoria_id
    WHERE m.${concluidas} AND r.valor != 'na'
    GROUP BY c.categoria ORDER BY conformidade ASC
  `).all();

  res.json({ resumo, contestacoesAbertas, porEquipe, rankingOperadores, porCanal, evolucao, porCategoria });
});
