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

initSchema();
seed();
garantirUsuariosBase();

const app = express();
app.use(express.json());
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
  console.log(`\n  iTS Qualidade rodando em http://localhost:${PORT}`);
  console.log(`  Login: admin@its.com.br  /  senha: admin123\n`);
});
