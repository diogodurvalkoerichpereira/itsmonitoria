import express from 'express';
import 'express-async-errors';
import cookieParser from 'cookie-parser';
import dns from 'node:dns';

// Força IPv4 no Node.js (resolve ECONNREFUSED no Supabase em VPS com IPv6 quebrado)
dns.setDefaultResultOrder('ipv4first');

import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { existsSync } from 'node:fs';
import { initSchema } from './db.js';
import { seed, garantirUsuariosBase } from './seed.js';
import { autenticar, exigirNivel, exigirNivelEscrita, NIVEIS } from './auth.js';
import { authRouter } from './routes/auth.js';
import { equipesRouter } from './routes/equipes.js';
import { operadoresRouter } from './routes/operadores.js';
import { formulariosRouter } from './routes/formularios.js';
import { monitoriasRouter } from './routes/monitorias.js';
import { contestacoesRouter } from './routes/contestacoes.js';
import { calibracoesRouter } from './routes/calibracoes.js';
import { dashboardRouter } from './routes/dashboard.js';
import { usuariosRouter } from './routes/usuarios.js';
import { relatoriosRouter } from './routes/relatorios.js';
import { feedbackRouter } from './routes/feedback.js';
import { anexosRouter } from './routes/anexos.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const IS_PROD = process.env.NODE_ENV === 'production';

await initSchema();
await seed();
await garantirUsuariosBase();

const app = express();

// Atras de um reverse proxy (Nginx, Render, Railway, etc.) para que cookies
// `secure` e req.ip funcionem corretamente em producao.
if (IS_PROD) app.set('trust proxy', 1);

// Cabecalhos de seguranca basicos (sem dependencias extras).
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-DNS-Prefetch-Control', 'off');
  if (IS_PROD) {
    res.setHeader('Strict-Transport-Security', 'max-age=15552000; includeSubDomains');
  }
  next();
});

app.use(express.json({ limit: '2mb' }));
app.use(cookieParser());

// API publica
app.use('/api/auth', authRouter);

// API protegida
app.use('/api/dashboard', autenticar, dashboardRouter);
app.use('/api/equipes', autenticar, exigirNivelEscrita(NIVEIS.coordenador), equipesRouter);
app.use('/api/operadores', autenticar, exigirNivelEscrita(NIVEIS.supervisor), operadoresRouter);
app.use('/api/formularios', autenticar, exigirNivelEscrita(NIVEIS.coordenador), formulariosRouter);
app.use('/api/monitorias', autenticar, monitoriasRouter);
app.use('/api/feedback', autenticar, feedbackRouter);
app.use('/api/contestacoes', autenticar, contestacoesRouter);
app.use('/api/calibracoes', autenticar, calibracoesRouter);
app.use('/api/usuarios', autenticar, exigirNivel(NIVEIS.gerente), usuariosRouter);
app.use('/api/relatorios', autenticar, exigirNivel(NIVEIS.supervisor), relatoriosRouter);
app.use('/api', autenticar, anexosRouter);

// Frontend: build do Vite (gerado em dist/client por `npm run build`).
// Em producao o Express serve esses arquivos. Em desenvolvimento o frontend
// roda no Vite dev server (porta 5173) com proxy para esta API, entao o
// diretorio pode nao existir aqui — nesse caso so a API responde.
const clientDir = join(__dirname, 'client');
const indexHtml = join(clientDir, 'index.html');
if (existsSync(indexHtml)) {
  app.use(express.static(clientDir));
  app.get('*', (_req, res) => res.sendFile(indexHtml));
} else {
  app.get('*', (_req, res) =>
    res.status(404).json({ erro: 'Frontend nao compilado. Rode `npm run build` ou use o Vite dev (npm run dev:client).' })
  );
}

// Tratador de erros: captura excecoes (inclusive de handlers async, via
// express-async-errors) e responde JSON em vez de deixar a requisicao travar.
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[erro]', err);
  if (res.headersSent) return;
  res.status(500).json({ erro: 'Erro interno do servidor' });
});

// PORT pode ser um numero (ex.: 3000) ou um caminho de socket Unix (string),
// como o Phusion Passenger usado por algumas hospedagens (Hostinger). Por isso
// NAO convertemos para Number: o app.listen aceita ambos, e converter um socket
// para Number daria NaN, fazendo o app escutar na porta errada (causa de 503).
const PORT: string | number = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n  iTS Qualidade rodando em ${PORT} (${IS_PROD ? 'producao' : 'desenvolvimento'})`);
  if (!IS_PROD) {
    console.log(`  http://localhost:${PORT}  ·  login demo: admin@its.com.br / admin123\n`);
  } else {
    console.log('');
  }
});
