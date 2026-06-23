import express from 'express';
import cookieParser from 'cookie-parser';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
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
import { feedbackRouter } from './routes/feedback.js';
import { anexosRouter } from './routes/anexos.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const IS_PROD = process.env.NODE_ENV === 'production';

initSchema();
seed();
garantirUsuariosBase();

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
app.use('/api', autenticar, anexosRouter);

// Frontend estatico
const publicDir = join(__dirname, '..', 'public');
app.use(express.static(publicDir));
app.get('*', (_req, res) => res.sendFile(join(publicDir, 'index.html')));

const PORT = Number(process.env.PORT) || 3000;
app.listen(PORT, () => {
  console.log(`\n  iTS Qualidade rodando na porta ${PORT} (${IS_PROD ? 'producao' : 'desenvolvimento'})`);
  if (!IS_PROD) {
    console.log(`  http://localhost:${PORT}  ·  login demo: admin@its.com.br / admin123\n`);
  } else {
    console.log('');
  }
});
