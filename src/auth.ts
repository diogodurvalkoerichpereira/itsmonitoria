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
