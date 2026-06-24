import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { db } from '../db.js';
import { NIVEIS, nivelDe } from '../auth.js';

export const usuariosRouter = Router();

const PERFIS_VALIDOS = Object.keys(NIVEIS);

interface UsuarioRow {
  id: number;
  perfil: string;
  ativo: number;
}

usuariosRouter.get('/', async (_req, res) => {
  const rows = await db.prepare(`
    SELECT id, nome, email, perfil, ativo, criado_em
    FROM usuarios ORDER BY perfil DESC, nome
  `).all();
  res.json(rows);
});

usuariosRouter.post('/', async (req, res) => {
  const { nome, email, senha, perfil } = req.body ?? {};
  if (!nome || !email || !senha || !perfil) {
    return res.status(400).json({ erro: 'Informe nome, e-mail, senha e perfil' });
  }
  if (!PERFIS_VALIDOS.includes(perfil)) {
    return res.status(400).json({ erro: 'Perfil invalido' });
  }
  // Nao permite criar usuario com nivel acima do proprio (minimo privilegio)
  if (nivelDe(perfil) > nivelDe(req.usuario!.perfil)) {
    return res.status(403).json({ erro: 'Voce nao pode criar um perfil acima do seu' });
  }
  if (String(senha).length < 6) {
    return res.status(400).json({ erro: 'A senha deve ter ao menos 6 caracteres' });
  }
  const emailNorm = String(email).toLowerCase().trim();
  const existe = await db.prepare('SELECT id FROM usuarios WHERE email = ?').get(emailNorm);
  if (existe) return res.status(409).json({ erro: 'Ja existe um usuario com este e-mail' });

  const info = await db.prepare('INSERT INTO usuarios (nome, email, senha_hash, perfil) VALUES (?,?,?,?)')
    .run(nome, emailNorm, bcrypt.hashSync(String(senha), 8), perfil);
  res.status(201).json({ id: info.lastInsertRowid });
});

usuariosRouter.put('/:id', async (req, res) => {
  const { nome, email, perfil, ativo, senha } = req.body ?? {};
  const id = Number(req.params.id);
  const alvo = (await db.prepare('SELECT id, perfil, ativo FROM usuarios WHERE id=?').get(id)) as UsuarioRow | undefined;
  if (!alvo) return res.status(404).json({ erro: 'Usuario nao encontrado' });

  if (perfil && !PERFIS_VALIDOS.includes(perfil)) {
    return res.status(400).json({ erro: 'Perfil invalido' });
  }
  // Nao permite elevar alguem acima do proprio nivel
  if (perfil && nivelDe(perfil) > nivelDe(req.usuario!.perfil)) {
    return res.status(403).json({ erro: 'Voce nao pode atribuir um perfil acima do seu' });
  }
  // Nao permite que o usuario rebaixe ou desative a si mesmo (evita auto-trancamento)
  if (id === req.usuario!.id) {
    if (perfil && perfil !== alvo.perfil) {
      return res.status(400).json({ erro: 'Voce nao pode alterar o proprio perfil' });
    }
    if (ativo === false || ativo === 0) {
      return res.status(400).json({ erro: 'Voce nao pode desativar o proprio usuario' });
    }
  }
  // Protege o ultimo admin ativo
  if (alvo.perfil === 'admin' && (perfil && perfil !== 'admin' || ativo === false || ativo === 0)) {
    const adminsAtivos = ((await db.prepare("SELECT COUNT(*) AS n FROM usuarios WHERE perfil='admin' AND ativo=1").get()) as { n: number }).n;
    if (adminsAtivos <= 1) {
      return res.status(400).json({ erro: 'Nao e possivel rebaixar/desativar o ultimo administrador ativo' });
    }
  }

  const emailNorm = email ? String(email).toLowerCase().trim() : undefined;
  if (emailNorm) {
    const dup = await db.prepare('SELECT id FROM usuarios WHERE email=? AND id<>?').get(emailNorm, id);
    if (dup) return res.status(409).json({ erro: 'Ja existe um usuario com este e-mail' });
  }

  await db.prepare('UPDATE usuarios SET nome=COALESCE(?,nome), email=COALESCE(?,email), perfil=COALESCE(?,perfil), ativo=? WHERE id=?')
    .run(nome ?? null, emailNorm ?? null, perfil ?? null, ativo ? 1 : 0, id);

  if (senha) {
    if (String(senha).length < 6) return res.status(400).json({ erro: 'A senha deve ter ao menos 6 caracteres' });
    await db.prepare('UPDATE usuarios SET senha_hash=? WHERE id=?').run(bcrypt.hashSync(String(senha), 8), id);
  }
  res.json({ ok: true });
});

usuariosRouter.delete('/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (id === req.usuario!.id) return res.status(400).json({ erro: 'Voce nao pode excluir o proprio usuario' });
  const alvo = (await db.prepare('SELECT perfil FROM usuarios WHERE id=?').get(id)) as { perfil: string } | undefined;
  if (!alvo) return res.status(404).json({ erro: 'Usuario nao encontrado' });
  if (alvo.perfil === 'admin') {
    const adminsAtivos = ((await db.prepare("SELECT COUNT(*) AS n FROM usuarios WHERE perfil='admin' AND ativo=1").get()) as { n: number }).n;
    if (adminsAtivos <= 1) return res.status(400).json({ erro: 'Nao e possivel excluir o ultimo administrador' });
  }
  // monitorias referenciam o monitor; bloqueia exclusao se houver vinculo
  const vinculo = ((await db.prepare('SELECT COUNT(*) AS n FROM monitorias WHERE monitor_id=?').get(id)) as { n: number }).n;
  if (vinculo > 0) {
    return res.status(409).json({ erro: `Usuario possui ${vinculo} monitoria(s) vinculada(s). Desative-o em vez de excluir.` });
  }
  await db.prepare('DELETE FROM usuarios WHERE id=?').run(id);
  res.json({ ok: true });
});
