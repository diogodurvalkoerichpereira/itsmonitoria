import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { db } from '../db.js';

export const feedbackRouter = Router();

// Lista atendimentos monitorados para feedback (pendentes e realizados)
feedbackRouter.get('/', async (req, res) => {
  const { status_feedback, operador_id, equipe_id, nome, cpf, feedback_em } = req.query;
  const where: string[] = ["m.status != 'rascunho'"];
  const params: unknown[] = [];
  if (status_feedback === 'pendente') where.push('m.feedback_aplicado = 0');
  else if (status_feedback === 'realizado') where.push('m.feedback_aplicado = 1');
  if (operador_id) { where.push('m.operador_id = ?'); params.push(operador_id); }
  if (equipe_id) { where.push('o.equipe_id = ?'); params.push(equipe_id); }
  if (nome) { where.push('o.nome LIKE ?'); params.push('%' + String(nome) + '%'); }
  if (cpf) { where.push('o.cpf LIKE ?'); params.push('%' + String(cpf) + '%'); }
  if (feedback_em) { where.push('m.data_feedback::date = ?::date'); params.push(feedback_em); }

  const rows = await db.prepare(`
    SELECT m.id, m.protocolo, m.canal, m.data_atendimento, m.nota_final, m.falha_critica,
           m.feedback_aplicado, m.data_feedback, m.status_feedback, m.feedback_assinatura_cpf,
           o.nome AS operador_nome, o.cpf AS operador_cpf, e.nome AS equipe_nome,
           u.nome AS monitor_nome, f.nome AS formulario_nome
    FROM monitorias m
    JOIN operadores o ON o.id = m.operador_id
    LEFT JOIN equipes e ON e.id = o.equipe_id
    JOIN usuarios u ON u.id = m.monitor_id
    JOIN formularios f ON f.id = m.formulario_id
    WHERE ${where.join(' AND ')}
    ORDER BY m.feedback_aplicado ASC, m.data_atendimento DESC
    LIMIT 1000
  `).all(...params);
  res.json(rows);
});

interface MonAlvo {
  id: number;
  feedback_aplicado: number;
  operador_cpf: string | null;
  operador_senha_hash: string | null;
}

// Aplica o feedback: o operador assina confirmando ciencia, validando a SENHA.
feedbackRouter.post('/:id/aplicar', async (req, res) => {
  const { senha, observacao, concordou, discordancia } = req.body ?? {};
  const m = (await db.prepare(`
    SELECT m.id, m.feedback_aplicado, o.cpf AS operador_cpf, o.senha_hash AS operador_senha_hash
    FROM monitorias m JOIN operadores o ON o.id = m.operador_id
    WHERE m.id = ?
  `).get(req.params.id)) as MonAlvo | undefined;

  if (!m) return res.status(404).json({ erro: 'Monitoria nao encontrada' });
  if (m.feedback_aplicado) return res.status(409).json({ erro: 'Feedback ja aplicado para esta monitoria' });
  if (!m.operador_senha_hash) {
    return res.status(400).json({ erro: 'Operador sem senha cadastrada. Defina uma senha para o operador antes de aplicar o feedback.' });
  }
  if (!senha) return res.status(400).json({ erro: 'Informe a senha do operador para a assinatura' });
  if (!bcrypt.compareSync(String(senha), m.operador_senha_hash)) {
    return res.status(400).json({ erro: 'Senha do operador incorreta' });
  }

  // concordou ausente = concorda (compatibilidade); false = discorda
  const concordouVal = concordou === false ? 0 : 1;
  const motivo = String(discordancia ?? '').trim();
  if (concordouVal === 0 && !motivo) {
    return res.status(400).json({ erro: 'Informe o motivo da discordancia' });
  }

  await db.transaction(async (tx) => {
    await tx.prepare(`
      UPDATE monitorias
      SET feedback_aplicado = 1, data_feedback = to_char((now() AT TIME ZONE 'UTC'), 'YYYY-MM-DD HH24:MI:SS'),
          status_feedback = ?, feedback_assinatura_cpf = ?, feedback_observacao = ?,
          feedback_concordou = ?, feedback_discordancia = ?
      WHERE id = ?
    `).run(
      concordouVal ? 'Realizado' : 'Realizado - Discordancia',
      m.operador_cpf, observacao ?? null,
      concordouVal, concordouVal ? null : motivo, req.params.id
    );

    // discordancia gera uma contestacao para analise do supervisor
    if (concordouVal === 0) {
      await tx.prepare('INSERT INTO contestacoes (monitoria_id, motivo, status) VALUES (?,?,?)')
        .run(req.params.id, 'Discordancia no feedback: ' + motivo, 'aberta');
      await tx.prepare("UPDATE monitorias SET status='contestada' WHERE id=?").run(req.params.id);
    }
  });

  res.json({ ok: true, concordou: !!concordouVal, contestacao_aberta: concordouVal === 0 });
});
