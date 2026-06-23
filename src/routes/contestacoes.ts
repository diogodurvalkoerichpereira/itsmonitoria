import { Router } from 'express';
import { db } from '../db.js';

export const contestacoesRouter = Router();

contestacoesRouter.get('/', async (req, res) => {
  const { status } = req.query;
  const clause = status ? 'WHERE c.status = ?' : '';
  const params = status ? [status] : [];
  const rows = await db.prepare(`
    SELECT c.*, m.protocolo, m.nota_final, m.canal,
           o.nome AS operador_nome, f.nome AS formulario_nome
    FROM contestacoes c
    JOIN monitorias m ON m.id = c.monitoria_id
    JOIN operadores o ON o.id = m.operador_id
    JOIN formularios f ON f.id = m.formulario_id
    ${clause}
    ORDER BY CASE c.status WHEN 'aberta' THEN 0 WHEN 'em_analise' THEN 1 ELSE 2 END, c.criado_em DESC
  `).all(...params);
  res.json(rows);
});

contestacoesRouter.post('/', async (req, res) => {
  const { monitoria_id, motivo } = req.body ?? {};
  if (!monitoria_id || !motivo) return res.status(400).json({ erro: 'Monitoria e motivo obrigatorios' });
  const id = await db.transaction(async (tx) => {
    const info = await tx.prepare('INSERT INTO contestacoes (monitoria_id, motivo) VALUES (?,?)')
      .run(monitoria_id, motivo);
    await tx.prepare("UPDATE monitorias SET status='contestada' WHERE id=?").run(monitoria_id);
    return info.lastInsertRowid;
  });
  res.status(201).json({ id });
});

// Analisar / responder contestacao
contestacoesRouter.put('/:id', async (req, res) => {
  const { status, resposta, nota_revisada } = req.body ?? {};
  const cont = (await db.prepare('SELECT * FROM contestacoes WHERE id=?').get(req.params.id)) as
    | { monitoria_id: number }
    | undefined;
  if (!cont) return res.status(404).json({ erro: 'Contestacao nao encontrada' });

  await db.transaction(async (tx) => {
    const respondido = status === 'deferida' || status === 'indeferida'
      ? "to_char((now() AT TIME ZONE 'UTC'), 'YYYY-MM-DD HH24:MI:SS')"
      : 'respondido_em';
    await tx.prepare(`UPDATE contestacoes SET status=?, resposta=?, nota_revisada=?, respondido_em=${respondido} WHERE id=?`)
      .run(status, resposta ?? null, nota_revisada ?? null, req.params.id);

    if (status === 'deferida' && nota_revisada != null) {
      await tx.prepare("UPDATE monitorias SET nota_final=?, status='concluida' WHERE id=?")
        .run(nota_revisada, cont.monitoria_id);
    } else if (status === 'indeferida') {
      await tx.prepare("UPDATE monitorias SET status='concluida' WHERE id=?").run(cont.monitoria_id);
    }
  });
  res.json({ ok: true });
});
