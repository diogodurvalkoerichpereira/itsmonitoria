import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { db } from '../db.js';

export const operadoresRouter = Router();

const SENHA_MIN = 4; // senha do operador (usada só para assinar o feedback)

// Nunca expoe o senha_hash; devolve apenas se o operador ja tem senha definida.
operadoresRouter.get('/', async (_req, res) => {
  const rows = await db.prepare(`
    SELECT o.id, o.nome, o.matricula, o.cpf, o.equipe_id, o.cargo, o.data_admissao, o.ativo, o.criado_em,
      (o.senha_hash IS NOT NULL) AS tem_senha,
      e.nome AS equipe_nome,
      (SELECT COUNT(*) FROM monitorias m WHERE m.operador_id = o.id) AS total_monitorias,
      (SELECT ROUND(AVG(m.nota_final)::numeric,1) FROM monitorias m WHERE m.operador_id = o.id AND m.status != 'rascunho') AS nota_media
    FROM operadores o
    LEFT JOIN equipes e ON e.id = o.equipe_id
    ORDER BY o.nome
  `).all();
  res.json(rows);
});

operadoresRouter.post('/', async (req, res) => {
  const { nome, matricula, cpf, equipe_id, cargo, data_admissao, senha } = req.body ?? {};
  if (!nome) return res.status(400).json({ erro: 'Nome obrigatorio' });
  if (senha != null && String(senha).length > 0 && String(senha).length < SENHA_MIN) {
    return res.status(400).json({ erro: `A senha do operador deve ter ao menos ${SENHA_MIN} caracteres` });
  }
  const senhaHash = senha ? bcrypt.hashSync(String(senha), 8) : null;
  const info = await db
    .prepare('INSERT INTO operadores (nome, matricula, cpf, equipe_id, cargo, data_admissao, senha_hash) VALUES (?,?,?,?,?,?,?)')
    .run(nome, matricula ?? null, cpf ?? null, equipe_id ?? null, cargo ?? null, data_admissao ?? null, senhaHash);
  res.status(201).json({ id: info.lastInsertRowid });
});

operadoresRouter.put('/:id', async (req, res) => {
  const { nome, matricula, cpf, equipe_id, cargo, data_admissao, ativo, senha } = req.body ?? {};
  // senha vazia/ausente = mantem a atual; preenchida = redefine.
  if (senha != null && String(senha).length > 0 && String(senha).length < SENHA_MIN) {
    return res.status(400).json({ erro: `A senha do operador deve ter ao menos ${SENHA_MIN} caracteres` });
  }
  await db.prepare('UPDATE operadores SET nome=?, matricula=?, cpf=?, equipe_id=?, cargo=?, data_admissao=?, ativo=? WHERE id=?')
    .run(nome, matricula ?? null, cpf ?? null, equipe_id ?? null, cargo ?? null, data_admissao ?? null, ativo ? 1 : 0, req.params.id);
  if (senha && String(senha).length > 0) {
    await db.prepare('UPDATE operadores SET senha_hash=? WHERE id=?')
      .run(bcrypt.hashSync(String(senha), 8), req.params.id);
  }
  res.json({ ok: true });
});

operadoresRouter.delete('/:id', async (req, res) => {
  await db.prepare('DELETE FROM operadores WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});
