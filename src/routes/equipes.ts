import { Router } from 'express';
import { db } from '../db.js';

export const equipesRouter = Router();

/** Helper: retorna membros agrupados por papel para uma equipe */
function getMembros(equipeId: number | bigint) {
  const rows = db.prepare(
    'SELECT id, nome, papel FROM equipe_membros WHERE equipe_id = ? ORDER BY papel, nome'
  ).all(equipeId) as Array<{ id: number; nome: string; papel: string }>;
  return {
    supervisores: rows.filter((r) => r.papel === 'supervisor').map((r) => r.nome),
    monitores:    rows.filter((r) => r.papel === 'monitor').map((r) => r.nome),
    gerentes:     rows.filter((r) => r.papel === 'gerente').map((r) => r.nome),
  };
}

/** Helper: substitui todos os membros de uma equipe */
function syncMembros(
  equipeId: number | bigint,
  supervisores: string[],
  monitores: string[],
  gerentes: string[]
) {
  db.prepare('DELETE FROM equipe_membros WHERE equipe_id = ?').run(equipeId);

  const ins = db.prepare(
    'INSERT OR IGNORE INTO equipe_membros (equipe_id, nome, papel) VALUES (?, ?, ?)'
  );
  for (const nome of (supervisores || []).filter(Boolean)) ins.run(equipeId, nome.trim(), 'supervisor');
  for (const nome of (monitores || []).filter(Boolean))    ins.run(equipeId, nome.trim(), 'monitor');
  for (const nome of (gerentes || []).filter(Boolean))     ins.run(equipeId, nome.trim(), 'gerente');
}

equipesRouter.get('/', (_req, res) => {
  const rows = db.prepare(`
    SELECT e.*, (SELECT COUNT(*) FROM operadores o WHERE o.equipe_id = e.id AND o.ativo = 1) AS total_operadores
    FROM equipes e ORDER BY e.nome
  `).all() as Array<Record<string, unknown>>;

  const result = rows.map((e) => ({
    ...e,
    membros: getMembros(e.id as number),
  }));
  res.json(result);
});

equipesRouter.get('/:id', (req, res) => {
  const row = db.prepare(`
    SELECT e.*, (SELECT COUNT(*) FROM operadores o WHERE o.equipe_id = e.id AND o.ativo = 1) AS total_operadores
    FROM equipes e WHERE e.id = ?
  `).get(req.params.id) as Record<string, unknown> | undefined;
  if (!row) return res.status(404).json({ erro: 'Equipe nao encontrada' });
  res.json({ ...row, membros: getMembros(row.id as number) });
});

equipesRouter.post('/', (req, res) => {
  const { nome, supervisor, descricao, supervisores, monitores, gerentes } = req.body ?? {};
  if (!nome) return res.status(400).json({ erro: 'Nome obrigatorio' });
  const info = db
    .prepare('INSERT INTO equipes (nome, supervisor, descricao) VALUES (?, ?, ?)')
    .run(nome, supervisor ?? null, descricao ?? null);

  // Sync membros (campo "supervisor" legado mantido para retrocompatibilidade)
  syncMembros(info.lastInsertRowid, supervisores || [], monitores || [], gerentes || []);

  res.status(201).json({ id: info.lastInsertRowid });
});

equipesRouter.put('/:id', (req, res) => {
  const { nome, supervisor, descricao, ativo, supervisores, monitores, gerentes } = req.body ?? {};
  db.prepare('UPDATE equipes SET nome=?, supervisor=?, descricao=?, ativo=? WHERE id=?')
    .run(nome, supervisor ?? null, descricao ?? null, ativo ? 1 : 0, req.params.id);

  // Sync membros
  syncMembros(Number(req.params.id), supervisores || [], monitores || [], gerentes || []);

  res.json({ ok: true });
});

equipesRouter.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM equipe_membros WHERE equipe_id = ?').run(req.params.id);
  db.prepare('DELETE FROM equipes WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});
