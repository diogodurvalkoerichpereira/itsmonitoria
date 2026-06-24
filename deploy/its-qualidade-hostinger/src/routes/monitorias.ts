import { Router } from 'express';
import { db } from '../db.js';
import { calcularNota, type RespostaInput } from '../scoring.js';

export const monitoriasRouter = Router();

monitoriasRouter.get('/', async (req, res) => {
  const { operador_id, equipe_id, canal, status, de, ate, cpf } = req.query;
  const where: string[] = [];
  const params: unknown[] = [];
  if (operador_id) { where.push('m.operador_id = ?'); params.push(operador_id); }
  if (equipe_id) { where.push('o.equipe_id = ?'); params.push(equipe_id); }
  if (canal) { where.push('m.canal = ?'); params.push(canal); }
  if (status) { where.push('m.status = ?'); params.push(status); }
  if (de) { where.push('m.data_atendimento::date >= ?::date'); params.push(de); }
  if (ate) { where.push('m.data_atendimento::date <= ?::date'); params.push(ate); }
  if (cpf) { where.push('o.cpf LIKE ?'); params.push('%' + String(cpf) + '%'); }
  const clause = where.length ? 'WHERE ' + where.join(' AND ') : '';

  const rows = await db.prepare(`
    SELECT m.*, o.nome AS operador_nome, o.cpf AS operador_cpf, e.nome AS equipe_nome,
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

monitoriasRouter.get('/:id', async (req, res) => {
  const m = await db.prepare(`
    SELECT m.*, o.nome AS operador_nome, o.cpf AS operador_cpf, e.nome AS equipe_nome,
           u.nome AS monitor_nome, f.nome AS formulario_nome
    FROM monitorias m
    JOIN operadores o ON o.id = m.operador_id
    LEFT JOIN equipes e ON e.id = o.equipe_id
    JOIN usuarios u ON u.id = m.monitor_id
    JOIN formularios f ON f.id = m.formulario_id
    WHERE m.id = ?
  `).get(req.params.id);
  if (!m) return res.status(404).json({ erro: 'Monitoria nao encontrada' });

  const respostas = await db.prepare(`
    SELECT r.*, c.categoria, c.descricao, c.peso, c.fatal
    FROM respostas r JOIN criterios c ON c.id = r.criterio_id
    WHERE r.monitoria_id = ? ORDER BY c.ordem, c.id
  `).all(req.params.id);

  const contestacoes = await db
    .prepare('SELECT * FROM contestacoes WHERE monitoria_id = ? ORDER BY criado_em DESC')
    .all(req.params.id);

  res.json({ ...m, respostas, contestacoes });
});

monitoriasRouter.post('/', async (req, res) => {
  const {
    formulario_id, operador_id, data_atendimento, canal, protocolo, observacoes, respostas, status,
    operacao, telefone_cliente, tabulacao, produto, data_monitoria, monitoria_padrao,
    feedback_aplicado, data_feedback, status_feedback, sla, detalhe_sla
  } = req.body ?? {};

  if (!formulario_id || !operador_id || !Array.isArray(respostas)) {
    return res.status(400).json({ erro: 'Dados incompletos (formulario, operador e respostas)' });
  }
  const { nota, falhaCritica } = await calcularNota(formulario_id, respostas as RespostaInput[]);

  const mid = await db.transaction(async (tx) => {
    const info = await tx.prepare(`
      INSERT INTO monitorias
        (formulario_id, operador_id, monitor_id, data_atendimento, canal, protocolo, nota_final, falha_critica, status, observacoes,
         operacao, telefone_cliente, tabulacao, produto, data_monitoria, monitoria_padrao, feedback_aplicado, data_feedback, status_feedback, sla, detalhe_sla)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `).run(
      formulario_id, operador_id, req.usuario!.id,
      data_atendimento ?? null, canal ?? 'Telefone', protocolo ?? null,
      nota, falhaCritica ? 1 : 0, status ?? 'concluida', observacoes ?? null,
      operacao ?? null, telefone_cliente ?? null, tabulacao ?? null, produto ?? null,
      data_monitoria ?? null, monitoria_padrao ? 1 : 0, feedback_aplicado ? 1 : 0,
      data_feedback ?? null, status_feedback ?? 'Pendente', sla ?? null, detalhe_sla ?? null
    );
    const novoId = info.lastInsertRowid as number;
    const stmt = tx.prepare('INSERT INTO respostas (monitoria_id, criterio_id, valor, comentario) VALUES (?,?,?,?)');
    for (const r of respostas as RespostaInput[]) {
      await stmt.run(novoId, r.criterio_id, r.valor, r.comentario ?? null);
    }
    return novoId;
  });

  res.status(201).json({ id: mid, nota_final: nota, falha_critica: falhaCritica });
});

monitoriasRouter.put('/:id', async (req, res) => {
  const {
    formulario_id, operador_id, data_atendimento, canal, protocolo, observacoes, respostas, status,
    operacao, telefone_cliente, tabulacao, produto, data_monitoria, monitoria_padrao,
    feedback_aplicado, data_feedback, status_feedback, sla, detalhe_sla
  } = req.body ?? {};

  if (!formulario_id || !operador_id) {
    return res.status(400).json({ erro: 'Dados incompletos (formulario e operador)' });
  }

  // Se respostas forem fornecidas, recalcula a nota
  let notaFinal: number | undefined;
  let falhaCriticaVal: number | undefined;
  if (Array.isArray(respostas)) {
    const { nota, falhaCritica } = await calcularNota(formulario_id, respostas as RespostaInput[]);
    notaFinal = nota;
    falhaCriticaVal = falhaCritica ? 1 : 0;
  }

  await db.transaction(async (tx) => {
    // Busca nota_final e falha_critica atuais se nao forem recalculadas
    let nota = notaFinal;
    let fc = falhaCriticaVal;
    if (nota == null) {
      const atual = (await tx.prepare('SELECT nota_final, falha_critica FROM monitorias WHERE id=?').get(req.params.id)) as { nota_final: number, falha_critica: number } | undefined;
      nota = atual?.nota_final ?? 0;
      fc = atual?.falha_critica ?? 0;
    }

    await tx.prepare(`
      UPDATE monitorias
      SET formulario_id=?, operador_id=?, data_atendimento=?, canal=?, protocolo=?, nota_final=?, falha_critica=?, status=?, observacoes=?,
          operacao=?, telefone_cliente=?, tabulacao=?, produto=?, data_monitoria=?, monitoria_padrao=?, feedback_aplicado=?, data_feedback=?, status_feedback=?, sla=?, detalhe_sla=?
      WHERE id=?
    `).run(
      formulario_id, operador_id, data_atendimento ?? null, canal ?? 'Telefone', protocolo ?? null,
      nota, fc, status ?? 'concluida', observacoes ?? null,
      operacao ?? null, telefone_cliente ?? null, tabulacao ?? null, produto ?? null,
      data_monitoria ?? null, monitoria_padrao ? 1 : 0, feedback_aplicado ? 1 : 0,
      data_feedback ?? null, status_feedback ?? 'Pendente', sla ?? null, detalhe_sla ?? null,
      req.params.id
    );

    // Se respostas forem fornecidas, atualiza respostas
    if (Array.isArray(respostas)) {
      await tx.prepare('DELETE FROM respostas WHERE monitoria_id=?').run(req.params.id);
      const stmt = tx.prepare('INSERT INTO respostas (monitoria_id, criterio_id, valor, comentario) VALUES (?,?,?,?)');
      for (const r of respostas as RespostaInput[]) {
        await stmt.run(req.params.id, r.criterio_id, r.valor, r.comentario ?? null);
      }
    }
  });

  res.json({ ok: true });
});

monitoriasRouter.delete('/:id', async (req, res) => {
  await db.prepare('DELETE FROM monitorias WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});
