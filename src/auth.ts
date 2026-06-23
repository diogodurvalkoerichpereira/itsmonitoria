import jwt from 'jsonwebtoken';
import type { Request, Response, NextFunction } from 'express';

const SECRET = process.env.JWT_SECRET || 'its-qualidade-dev-secret-troque-em-producao';
const EXPIRES = '8h';

export interface TokenPayload {
  id: number;
  nome: string;
  email: string;
  perfil: string;
}

export function gerarToken(payload: TokenPayload): string {
  return jwt.sign(payload, SECRET, { expiresIn: EXPIRES });
}

declare global {
  // eslint-disable-next-line no-var
  namespace Express {
    interface Request {
      usuario?: TokenPayload;
    }
  }
}

export function autenticar(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.slice(7) : req.cookies?.token;
  if (!token) {
    res.status(401).json({ erro: 'Nao autenticado' });
    return;
  }
  try {
    req.usuario = jwt.verify(token, SECRET) as TokenPayload;
    next();
  } catch {
    res.status(401).json({ erro: 'Sessao invalida ou expirada' });
  }
}

export function exigirPerfil(...perfis: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.usuario || !perfis.includes(req.usuario.perfil)) {
      res.status(403).json({ erro: 'Sem permissao para esta acao' });
      return;
    }
    next();
  };
}

// ---------- Hierarquia de perfis (RBAC) ----------
// Quanto maior o nivel, mais permissoes. Mantido em um unico lugar para
// auditabilidade e segregacao de acesso.
export const NIVEIS: Record<string, number> = {
  monitor: 1,
  supervisor: 2,
  coordenador: 3,
  gerente: 4,
  admin: 5,
};

export function nivelDe(perfil: string | undefined): number {
  return (perfil && NIVEIS[perfil]) || 0;
}

/** Exige que o usuario tenha pelo menos o nivel informado (em qualquer metodo). */
export function exigirNivel(min: number) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (nivelDe(req.usuario?.perfil) < min) {
      res.status(403).json({ erro: 'Sem permissao para esta acao' });
      return;
    }
    next();
  };
}

/**
 * Libera leitura (GET) para qualquer usuario autenticado, mas exige o nivel
 * minimo para operacoes de escrita (POST/PUT/DELETE). Usado nos cadastros,
 * para nao quebrar fluxos de leitura (ex.: monitor precisa listar operadores
 * ao criar uma monitoria) mantendo a escrita protegida.
 */
export function exigirNivelEscrita(min: number) {
  const guard = exigirNivel(min);
  return (req: Request, res: Response, next: NextFunction): void => {
    if (req.method === 'GET') return next();
    return guard(req, res, next);
  };
}
