import { Router } from 'express';
import { db } from '../db.js';

export const formulariosRouter = Router();

formulariosRouter.get('/', (_req, res) => {
  const rows = db.prepare(`
    SELECT f.*,
      (SELECT COUNT(*) FROM criterios c WHERE c.formulario_id = f.id) AS total_criterios
    FROM formularios f ORDER BY f.nome
  `).all();
  res.json(rows);
});

formulariosRouter.get('/:id', (req, res) => {
  const form = db.prepare('SELECT * FROM formularios WHERE id=?').get(req.params.id);
  if (!form) return res.status(404).json({ erro: 'Formulario nao encontrado' });
  const criterios = db
    .prepare('SELECT * FROM criterios WHERE formulario_id=? ORDER BY ordem, id')
    .all(req.params.id);
  res.json({ ...form, criterios });
});

formulariosRouter.post('/', (req, res) => {
  const { nome, descricao, criterios } = req.body ?? {};
  if (!nome) return res.status(400).json({ erro: 'Nome obrigatorio' });
  const tx = db.transaction(() => {
    const info = db.prepare('INSERT INTO formularios (nome, descricao) VALUES (?,?)').run(nome, descricao ?? null);
    const fid = info.lastInsertRowid as number;
    inserirCriterios(fid, criterios);
    return fid;
  });
  res.status(201).json({ id: tx() });
});

formulariosRouter.put('/:id', (req, res) => {
  const { nome, descricao, ativo, criterios } = req.body ?? {};
  const fid = Number(req.params.id);
  const tx = db.transaction(() => {
    db.prepare('UPDATE formularios SET nome=?, descricao=?, ativo=? WHERE id=?')
      .run(nome, descricao ?? null, ativo ? 1 : 0, fid);
    if (Array.isArray(criterios)) {
      db.prepare('DELETE FROM criterios WHERE formulario_id=?').run(fid);
      inserirCriterios(fid, criterios);
    }
  });
  tx();
  res.json({ ok: true });
});

formulariosRouter.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM formularios WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

interface CriterioInput {
  categoria: string;
  descricao: string;
  peso?: number;
  fatal?: boolean;
}

function inserirCriterios(formularioId: number, criterios: unknown): void {
  if (!Array.isArray(criterios)) return;
  const stmt = db.prepare(
    'INSERT INTO criterios (formulario_id, categoria, descricao, peso, fatal, ordem) VALUES (?,?,?,?,?,?)'
  );
  (criterios as CriterioInput[]).forEach((c, i) => {
    stmt.run(formularioId, c.categoria ?? 'Geral', c.descricao, c.peso ?? 1, c.fatal ? 1 : 0, i);
  });
}
