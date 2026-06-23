import { Router } from 'express';
import { db } from '../db.js';
import { calcularNota, type RespostaInput } from '../scoring.js';

export const monitoriasRouter = Router();

monitoriasRouter.get('/', (req, res) => {
  const { operador_id, equipe_id, canal, status, de, ate } = req.query;
  const where: string[] = [];
  const params: unknown[] = [];
  if (operador_id) { where.push('m.operador_id = ?'); params.push(operador_id); }
  if (equipe_id) { where.push('o.equipe_id = ?'); params.push(equipe_id); }
  if (canal) { where.push('m.canal = ?'); params.push(canal); }
  if (status) { where.push('m.status = ?'); params.push(status); }
  if (de) { where.push('date(m.data_atendimento) >= date(?)'); params.push(de); }
  if (ate) { where.push('date(m.data_atendimento) <= date(?)'); params.push(ate); }
  const clause = where.length ? 'WHERE ' + where.join(' AND ') : '';

  const rows = db.prepare(`
    SELECT m.*, o.nome AS operador_nome, e.nome AS equipe_nome,
           u.nome AS monitor_nome, f.nome AS formulario_nome,
           (SELECT COUNT(*) FROM contestacoes c WHERE c.monitoria_id = m.id AND c.status IN ('aberta','em_analise')) AS contestacao_aberta
    FROM monitorias m
    JOIN operadores o ON o.id = m.operador_id
    LEFT JOIN equipes e ON e.id = o.equipe_id
    JOIN usuarios u ON u.id = m.monitor_id
    JOIN formularios f ON f.id = m.formulario_id
    ${clause}
    ORDER BY m.criado_em DESC
    LIMIT 500
  `).all(...params);
  res.json(rows);
});

monitoriasRouter.get('/:id', (req, res) => {
  const m = db.prepare(`
    SELECT m.*, o.nome AS operador_nome, e.nome AS equipe_nome,
           u.nome AS monitor_nome, f.nome AS formulario_nome
    FROM monitorias m
    JOIN operadores o ON o.id = m.operador_id
    LEFT JOIN equipes e ON e.id = o.equipe_id
    JOIN usuarios u ON u.id = m.monitor_id
    JOIN formularios f ON f.id = m.formulario_id
    WHERE m.id = ?
  `).get(req.params.id);
  if (!m) return res.status(404).json({ erro: 'Monitoria nao encontrada' });

  const respostas = db.prepare(`
    SELECT r.*, c.categoria, c.descricao, c.peso, c.fatal
    FROM respostas r JOIN criterios c ON c.id = r.criterio_id
    WHERE r.monitoria_id = ? ORDER BY c.ordem, c.id
  `).all(req.params.id);

  const contestacoes = db
    .prepare('SELECT * FROM contestacoes WHERE monitoria_id = ? ORDER BY criado_em DESC')
    .all(req.params.id);

  res.json({ ...m, respostas, contestacoes });
});

monitoriasRouter.post('/', (req, res) => {
  const { formulario_id, operador_id, data_atendimento, canal, protocolo, observacoes, respostas, status } = req.body ?? {};
  if (!formulario_id || !operador_id || !Array.isArray(respostas)) {
    return res.status(400).json({ erro: 'Dados incompletos (formulario, operador e respostas)' });
  }
  const { nota, falhaCritica } = calcularNota(formulario_id, respostas as RespostaInput[]);

  const tx = db.transaction(() => {
    const info = db.prepare(`
      INSERT INTO monitorias
        (formulario_id, operador_id, monitor_id, data_atendimento, canal, protocolo, nota_final, falha_critica, status, observacoes)
      VALUES (?,?,?,?,?,?,?,?,?,?)
    `).run(
      formulario_id, operador_id, req.usuario!.id,
      data_atendimento ?? null, canal ?? 'Telefone', protocolo ?? null,
      nota, falhaCritica ? 1 : 0, status ?? 'concluida', observacoes ?? null
    );
    const mid = info.lastInsertRowid as number;
    const stmt = db.prepare('INSERT INTO respostas (monitoria_id, criterio_id, valor, comentario) VALUES (?,?,?,?)');
    for (const r of respostas as RespostaInput[]) {
      stmt.run(mid, r.criterio_id, r.valor, r.comentario ?? null);
    }
    return mid;
  });

  res.status(201).json({ id: tx(), nota_final: nota, falha_critica: falhaCritica });
});

monitoriasRouter.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM monitorias WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});
