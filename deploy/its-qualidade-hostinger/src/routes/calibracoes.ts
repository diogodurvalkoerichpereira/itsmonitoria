import { Router } from 'express';
import { db } from '../db.js';

export const calibracoesRouter = Router();

// media e desvio padrao das notas dos avaliadores -> mede o alinhamento da equipe de qualidade
function estatisticas(notas: number[]) {
  if (notas.length === 0) return { media: 0, desvio: 0, amplitude: 0 };
  const media = notas.reduce((a, b) => a + b, 0) / notas.length;
  const variancia = notas.reduce((a, b) => a + (b - media) ** 2, 0) / notas.length;
  return {
    media: Math.round(media * 10) / 10,
    desvio: Math.round(Math.sqrt(variancia) * 10) / 10,
    amplitude: Math.round((Math.max(...notas) - Math.min(...notas)) * 10) / 10,
  };
}

calibracoesRouter.get('/', async (_req, res) => {
  const rows = (await db.prepare(`
    SELECT c.*, f.nome AS formulario_nome, o.nome AS operador_nome
    FROM calibracoes c
    JOIN formularios f ON f.id = c.formulario_id
    LEFT JOIN operadores o ON o.id = c.operador_id
    ORDER BY c.criado_em DESC
  `).all()) as Array<{ id: number }>;
  const out = await Promise.all(rows.map(async (c) => {
    const notas = (await db.prepare('SELECT nota FROM calibracao_notas WHERE calibracao_id=?')
      .all(c.id)) as Array<{ nota: number }>;
    return { ...c, total_avaliadores: notas.length, ...estatisticas(notas.map((n) => n.nota)) };
  }));
  res.json(out);
});

calibracoesRouter.get('/:id', async (req, res) => {
  const c = await db.prepare(`
    SELECT c.*, f.nome AS formulario_nome, o.nome AS operador_nome
    FROM calibracoes c
    JOIN formularios f ON f.id = c.formulario_id
    LEFT JOIN operadores o ON o.id = c.operador_id
    WHERE c.id=?
  `).get(req.params.id);
  if (!c) return res.status(404).json({ erro: 'Calibracao nao encontrada' });
  const notas = (await db.prepare(`
    SELECT cn.*, u.nome AS monitor_nome
    FROM calibracao_notas cn JOIN usuarios u ON u.id = cn.monitor_id
    WHERE cn.calibracao_id=? ORDER BY cn.nota DESC
  `).all(req.params.id)) as Array<{ nota: number }>;
  res.json({ ...c, notas, ...estatisticas(notas.map((n) => n.nota)) });
});

calibracoesRouter.post('/', async (req, res) => {
  const { titulo, formulario_id, operador_id, protocolo, data } = req.body ?? {};
  if (!titulo || !formulario_id) return res.status(400).json({ erro: 'Titulo e formulario obrigatorios' });
  const info = await db.prepare(
    'INSERT INTO calibracoes (titulo, formulario_id, operador_id, protocolo, data) VALUES (?,?,?,?,?)'
  ).run(titulo, formulario_id, operador_id ?? null, protocolo ?? null, data ?? null);
  res.status(201).json({ id: info.lastInsertRowid });
});

calibracoesRouter.post('/:id/notas', async (req, res) => {
  const { nota, comentario } = req.body ?? {};
  if (nota == null) return res.status(400).json({ erro: 'Nota obrigatoria' });
  // upsert: cada monitor lanca uma nota por calibracao
  const existe = (await db.prepare('SELECT id FROM calibracao_notas WHERE calibracao_id=? AND monitor_id=?')
    .get(req.params.id, req.usuario!.id)) as { id: number } | undefined;
  if (existe) {
    await db.prepare('UPDATE calibracao_notas SET nota=?, comentario=? WHERE id=?')
      .run(nota, comentario ?? null, existe.id);
  } else {
    await db.prepare('INSERT INTO calibracao_notas (calibracao_id, monitor_id, nota, comentario) VALUES (?,?,?,?)')
      .run(req.params.id, req.usuario!.id, nota, comentario ?? null);
  }
  res.json({ ok: true });
});

calibracoesRouter.put('/:id', async (req, res) => {
  const { status } = req.body ?? {};
  await db.prepare('UPDATE calibracoes SET status=? WHERE id=?').run(status ?? 'aberta', req.params.id);
  res.json({ ok: true });
});
