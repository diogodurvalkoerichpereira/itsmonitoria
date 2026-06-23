import { Router } from 'express';
import { db, type DbLike } from '../db.js';

export const formulariosRouter = Router();

formulariosRouter.get('/', async (_req, res) => {
  const rows = await db.prepare(`
    SELECT f.*,
      (SELECT COUNT(*) FROM criterios c WHERE c.formulario_id = f.id) AS total_criterios
    FROM formularios f ORDER BY f.nome
  `).all();
  res.json(rows);
});

formulariosRouter.get('/:id', async (req, res) => {
  const form = await db.prepare('SELECT * FROM formularios WHERE id=?').get(req.params.id);
  if (!form) return res.status(404).json({ erro: 'Formulario nao encontrado' });
  const criterios = await db
    .prepare('SELECT * FROM criterios WHERE formulario_id=? ORDER BY ordem, id')
    .all(req.params.id);
  res.json({ ...form, criterios });
});

formulariosRouter.post('/', async (req, res) => {
  const { nome, descricao, criterios } = req.body ?? {};
  if (!nome) return res.status(400).json({ erro: 'Nome obrigatorio' });
  const fid = await db.transaction(async (tx) => {
    const info = await tx.prepare('INSERT INTO formularios (nome, descricao) VALUES (?,?)').run(nome, descricao ?? null);
    const novoId = info.lastInsertRowid as number;
    await inserirCriterios(tx, novoId, criterios);
    return novoId;
  });
  res.status(201).json({ id: fid });
});

formulariosRouter.put('/:id', async (req, res) => {
  const { nome, descricao, ativo, criterios } = req.body ?? {};
  const fid = Number(req.params.id);
  await db.transaction(async (tx) => {
    await tx.prepare('UPDATE formularios SET nome=?, descricao=?, ativo=? WHERE id=?')
      .run(nome, descricao ?? null, ativo ? 1 : 0, fid);
    if (Array.isArray(criterios)) {
      await tx.prepare('DELETE FROM criterios WHERE formulario_id=?').run(fid);
      await inserirCriterios(tx, fid, criterios);
    }
  });
  res.json({ ok: true });
});

formulariosRouter.delete('/:id', async (req, res) => {
  await db.prepare('DELETE FROM formularios WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

interface CriterioInput {
  categoria: string;
  descricao: string;
  peso?: number;
  fatal?: boolean;
}

async function inserirCriterios(tx: DbLike, formularioId: number, criterios: unknown): Promise<void> {
  if (!Array.isArray(criterios)) return;
  const stmt = tx.prepare(
    'INSERT INTO criterios (formulario_id, categoria, descricao, peso, fatal, ordem) VALUES (?,?,?,?,?,?)'
  );
  let i = 0;
  for (const c of criterios as CriterioInput[]) {
    await stmt.run(formularioId, c.categoria ?? 'Geral', c.descricao, c.peso ?? 1, c.fatal ? 1 : 0, i++);
  }
}
