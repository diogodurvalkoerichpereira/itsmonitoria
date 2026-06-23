import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { db } from '../db.js';
import { gerarToken, autenticar } from '../auth.js';

export const authRouter = Router();

const IS_PROD = process.env.NODE_ENV === 'production';
const COOKIE_MAX_AGE = 8 * 3600 * 1000;

// ---- Rate limit simples (in-memory) contra forca bruta no login ----
const TENTATIVAS_MAX = 8;
const JANELA_MS = 15 * 60 * 1000;
const tentativas = new Map<string, { count: number; reset: number }>();

function limiteAtingido(chave: string): boolean {
  const agora = Date.now();
  const reg = tentativas.get(chave);
  if (!reg || agora > reg.reset) {
    tentativas.set(chave, { count: 1, reset: agora + JANELA_MS });
    return false;
  }
  reg.count += 1;
  return reg.count > TENTATIVAS_MAX;
}

function limparTentativas(chave: string): void {
  tentativas.delete(chave);
}

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

  const emailNorm = String(email).toLowerCase().trim();
  const chave = `${req.ip}:${emailNorm}`;
  if (limiteAtingido(chave)) {
    return res.status(429).json({ erro: 'Muitas tentativas. Tente novamente em alguns minutos.' });
  }

  const usuario = db
    .prepare('SELECT * FROM usuarios WHERE email = ? AND ativo = 1')
    .get(emailNorm) as UsuarioRow | undefined;

  if (!usuario || !bcrypt.compareSync(String(senha), usuario.senha_hash)) {
    return res.status(401).json({ erro: 'Credenciais invalidas' });
  }

  limparTentativas(chave);
  const payload = { id: usuario.id, nome: usuario.nome, email: usuario.email, perfil: usuario.perfil };
  const token = gerarToken(payload);
  res.cookie('token', token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: IS_PROD,
    maxAge: COOKIE_MAX_AGE,
  });
  res.json({ token, usuario: payload });
});

authRouter.post('/logout', (_req, res) => {
  res.clearCookie('token', { httpOnly: true, sameSite: 'lax', secure: IS_PROD });
  res.json({ ok: true });
});

authRouter.get('/me', autenticar, (req, res) => {
  res.json({ usuario: req.usuario });
});
