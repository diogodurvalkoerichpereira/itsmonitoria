import { Router } from 'express';
import { db, type DbLike } from '../db.js';

export const formulariosRouter = Router();

formulariosRouter.get('/', async (_req, res) => {
  const rows = await db.prepare(`
    SELECT f.*,
      (SELECT COUNT(*) FROM criterios c WHERE c.formulario_id = f.id AND c.ativo = 1) AS total_criterios
    FROM formularios f ORDER BY f.nome
  `).all();
  res.json(rows);
});

formulariosRouter.get('/:id', async (req, res) => {
  const form = await db.prepare('SELECT * FROM formularios WHERE id=?').get(req.params.id);
  if (!form) return res.status(404).json({ erro: 'Formulario nao encontrado' });
  // Apenas criterios ativos no editor (os desativados ficam so para o historico).
  const criterios = await db
    .prepare('SELECT * FROM criterios WHERE formulario_id=? AND ativo=1 ORDER BY ordem, id')
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
      await sincronizarCriterios(tx, fid, criterios);
    }
  });
  res.json({ ok: true });
});

formulariosRouter.delete('/:id', async (req, res) => {
  await db.prepare('DELETE FROM formularios WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

interface CriterioInput {
  id?: number;
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

/**
 * Sincroniza os criterios de um formulario sem quebrar o historico:
 *  - criterio com id existente -> ATUALIZA (preserva o vinculo com respostas);
 *  - criterio sem id -> INSERE;
 *  - criterio existente que sumiu da lista -> DELETA se nao tiver respostas,
 *    senao faz soft-delete (ativo=0) para manter o historico das monitorias.
 */
async function sincronizarCriterios(tx: DbLike, formularioId: number, criterios: unknown): Promise<void> {
  if (!Array.isArray(criterios)) return;
  const enviados = criterios as CriterioInput[];

  const existentes = (await tx.prepare('SELECT id FROM criterios WHERE formulario_id=?').all(formularioId)) as Array<{ id: number }>;
  const idsExistentes = new Set(existentes.map((r) => r.id));
  const idsMantidos = new Set<number>();

  const upd = tx.prepare('UPDATE criterios SET categoria=?, descricao=?, peso=?, fatal=?, ordem=?, ativo=1 WHERE id=?');
  const ins = tx.prepare('INSERT INTO criterios (formulario_id, categoria, descricao, peso, fatal, ordem) VALUES (?,?,?,?,?,?)');

  let ordem = 0;
  for (const c of enviados) {
    const cid = c.id != null ? Number(c.id) : null;
    if (cid && idsExistentes.has(cid)) {
      await upd.run(c.categoria ?? 'Geral', c.descricao, c.peso ?? 1, c.fatal ? 1 : 0, ordem, cid);
      idsMantidos.add(cid);
    } else {
      await ins.run(formularioId, c.categoria ?? 'Geral', c.descricao, c.peso ?? 1, c.fatal ? 1 : 0, ordem);
    }
    ordem++;
  }

  for (const id of idsExistentes) {
    if (idsMantidos.has(id)) continue;
    const usado = await tx.prepare('SELECT 1 AS x FROM respostas WHERE criterio_id=? LIMIT 1').get(id);
    if (usado) await tx.prepare('UPDATE criterios SET ativo=0 WHERE id=?').run(id);
    else await tx.prepare('DELETE FROM criterios WHERE id=?').run(id);
  }
}
