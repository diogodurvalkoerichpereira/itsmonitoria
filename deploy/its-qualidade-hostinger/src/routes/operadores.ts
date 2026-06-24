import { Router } from 'express';
import { db } from '../db.js';

export const operadoresRouter = Router();

operadoresRouter.get('/', async (_req, res) => {
  const rows = await db.prepare(`
    SELECT o.*, e.nome AS equipe_nome,
      (SELECT COUNT(*) FROM monitorias m WHERE m.operador_id = o.id) AS total_monitorias,
      (SELECT ROUND(AVG(m.nota_final)::numeric,1) FROM monitorias m WHERE m.operador_id = o.id AND m.status != 'rascunho') AS nota_media
    FROM operadores o
    LEFT JOIN equipes e ON e.id = o.equipe_id
    ORDER BY o.nome
  `).all();
  res.json(rows);
});

operadoresRouter.post('/', async (req, res) => {
  const { nome, matricula, cpf, equipe_id, cargo, data_admissao } = req.body ?? {};
  if (!nome) return res.status(400).json({ erro: 'Nome obrigatorio' });
  const info = await db
    .prepare('INSERT INTO operadores (nome, matricula, cpf, equipe_id, cargo, data_admissao) VALUES (?,?,?,?,?,?)')
    .run(nome, matricula ?? null, cpf ?? null, equipe_id ?? null, cargo ?? null, data_admissao ?? null);
  res.status(201).json({ id: info.lastInsertRowid });
});

operadoresRouter.put('/:id', async (req, res) => {
  const { nome, matricula, cpf, equipe_id, cargo, data_admissao, ativo } = req.body ?? {};
  await db.prepare('UPDATE operadores SET nome=?, matricula=?, cpf=?, equipe_id=?, cargo=?, data_admissao=?, ativo=? WHERE id=?')
    .run(nome, matricula ?? null, cpf ?? null, equipe_id ?? null, cargo ?? null, data_admissao ?? null, ativo ? 1 : 0, req.params.id);
  res.json({ ok: true });
});

operadoresRouter.delete('/:id', async (req, res) => {
  await db.prepare('DELETE FROM operadores WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});
