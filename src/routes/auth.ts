import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { db } from '../db.js';
import { gerarToken, autenticar } from '../auth.js';

export const authRouter = Router();

interface UsuarioRow {
  id: number;
  nome: string;
  email: string;
  senha_hash: string;
  perfil: string;
  ativo: number;
}

authRouter.post('/login', (req, res) => {
  const { email, senha } = req.body ?? {};
  if (!email || !senha) {
    return res.status(400).json({ erro: 'Informe email e senha' });
  }
  const usuario = db
    .prepare('SELECT * FROM usuarios WHERE email = ? AND ativo = 1')
    .get(String(email).toLowerCase().trim()) as UsuarioRow | undefined;

  if (!usuario || !bcrypt.compareSync(String(senha), usuario.senha_hash)) {
    return res.status(401).json({ erro: 'Credenciais invalidas' });
  }

  const payload = { id: usuario.id, nome: usuario.nome, email: usuario.email, perfil: usuario.perfil };
  const token = gerarToken(payload);
  res.cookie('token', token, { httpOnly: true, sameSite: 'lax', maxAge: 8 * 3600 * 1000 });
  res.json({ token, usuario: payload });
});

authRouter.post('/logout', (_req, res) => {
  res.clearCookie('token');
  res.json({ ok: true });
});

authRouter.get('/me', autenticar, (req, res) => {
  res.json({ usuario: req.usuario });
});
