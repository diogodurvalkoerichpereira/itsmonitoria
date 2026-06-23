import { Router } from 'express';
import { db } from '../db.js';

export const equipesRouter = Router();

equipesRouter.get('/', (_req, res) => {
  const rows = db.prepare(`
    SELECT e.*, (SELECT COUNT(*) FROM operadores o WHERE o.equipe_id = e.id AND o.ativo = 1) AS total_operadores
    FROM equipes e ORDER BY e.nome
  `).all();
  res.json(rows);
});

equipesRouter.post('/', (req, res) => {
  const { nome, supervisor, descricao } = req.body ?? {};
  if (!nome) return res.status(400).json({ erro: 'Nome obrigatorio' });
  const info = db
    .prepare('INSERT INTO equipes (nome, supervisor, descricao) VALUES (?, ?, ?)')
    .run(nome, supervisor ?? null, descricao ?? null);
  res.status(201).json({ id: info.lastInsertRowid });
});

equipesRouter.put('/:id', (req, res) => {
  const { nome, supervisor, descricao, ativo } = req.body ?? {};
  db.prepare('UPDATE equipes SET nome=?, supervisor=?, descricao=?, ativo=? WHERE id=?')
    .run(nome, supervisor ?? null, descricao ?? null, ativo ? 1 : 0, req.params.id);
  res.json({ ok: true });
});

equipesRouter.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM equipes WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});
