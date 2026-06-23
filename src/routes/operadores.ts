import { Router } from 'express';
import { db } from '../db.js';

export const operadoresRouter = Router();

operadoresRouter.get('/', (_req, res) => {
  const rows = db.prepare(`
    SELECT o.*, e.nome AS equipe_nome,
      (SELECT COUNT(*) FROM monitorias m WHERE m.operador_id = o.id) AS total_monitorias,
      (SELECT ROUND(AVG(m.nota_final),1) FROM monitorias m WHERE m.operador_id = o.id AND m.status != 'rascunho') AS nota_media
    FROM operadores o
    LEFT JOIN equipes e ON e.id = o.equipe_id
    ORDER BY o.nome
  `).all();
  res.json(rows);
});

operadoresRouter.post('/', (req, res) => {
  const { nome, matricula, cpf, equipe_id, cargo, data_admissao } = req.body ?? {};
  if (!nome) return res.status(400).json({ erro: 'Nome obrigatorio' });
  const info = db
    .prepare('INSERT INTO operadores (nome, matricula, cpf, equipe_id, cargo, data_admissao) VALUES (?,?,?,?,?,?)')
    .run(nome, matricula ?? null, cpf ?? null, equipe_id ?? null, cargo ?? null, data_admissao ?? null);
  res.status(201).json({ id: info.lastInsertRowid });
});

operadoresRouter.put('/:id', (req, res) => {
  const { nome, matricula, cpf, equipe_id, cargo, data_admissao, ativo } = req.body ?? {};
  db.prepare('UPDATE operadores SET nome=?, matricula=?, cpf=?, equipe_id=?, cargo=?, data_admissao=?, ativo=? WHERE id=?')
    .run(nome, matricula ?? null, cpf ?? null, equipe_id ?? null, cargo ?? null, data_admissao ?? null, ativo ? 1 : 0, req.params.id);
  res.json({ ok: true });
});

operadoresRouter.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM operadores WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});
