import pg from 'pg';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { mkdirSync } from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
// Diretorio dos uploads (anexos) em disco. O banco agora e Postgres, mas os
// arquivos ainda ficam no filesystem. Em hospedagens que reconstroem a pasta
// do app a cada deploy, aponte DATA_DIR para um caminho persistente.
export const dataDir = process.env.DATA_DIR
  ? resolve(process.env.DATA_DIR)
  : join(__dirname, '..', 'data');
mkdirSync(dataDir, { recursive: true });

// node-postgres devolve int8 (bigint) e numeric como string por padrao.
// Para manter o comportamento do codigo (que sempre tratou contagens/medias
// como numeros, igual ao SQLite), convertemos esses tipos para number.
pg.types.setTypeParser(20, (v) => (v === null ? null : Number(v)));   // int8
pg.types.setTypeParser(1700, (v) => (v === null ? null : Number(v))); // numeric

const { Pool } = pg;

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error(
    'DATABASE_URL ausente. Defina a string de conexao do Postgres (ex.: Supabase) antes de iniciar.'
  );
}

// SSL: provedores gerenciados (Supabase, etc.) exigem TLS. Em Postgres local
// (localhost/127.0.0.1) ou com PGSSL=disable, desliga.
const isLocal = /@(localhost|127\.0\.0\.1)/.test(connectionString) || process.env.PGSSL === 'disable';

// Schema dedicado (opcional). Util para hospedar este app em um projeto
// Postgres/Supabase compartilhado sem colidir com as tabelas do schema public.
// Ex.: DB_SCHEMA=its_qualidade. Vazio = usa o schema public.
const SCHEMA = process.env.DB_SCHEMA?.trim();
const schemaIdent = SCHEMA && /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(SCHEMA) ? SCHEMA : undefined;

export const pool = new Pool({
  connectionString,
  ssl: isLocal ? false : { rejectUnauthorized: false },
  max: Number(process.env.PGPOOL_MAX) || 10,
  // search_path garante que todas as queries (sem prefixo) usem o schema do app.
  options: schemaIdent ? `-c search_path=${schemaIdent},public` : undefined,
});

// Converte placeholders no estilo SQLite (?) para o do Postgres ($1, $2, ...).
function toPg(sql: string): string {
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
}

type QueryFn = (sql: string, params: unknown[]) => Promise<pg.QueryResult>;

export interface Stmt {
  get(...params: unknown[]): Promise<any>;
  all(...params: unknown[]): Promise<any[]>;
  run(...params: unknown[]): Promise<{ changes: number; lastInsertRowid: number | undefined }>;
}

function makeStmt(sql: string, query: QueryFn): Stmt {
  const pgsql = toPg(sql);
  // Para INSERTs sem RETURNING, anexa "RETURNING id" para emular lastInsertRowid
  // do SQLite. Todas as tabelas tem coluna id serial.
  const isInsert = /^\s*insert\b/i.test(sql) && !/\breturning\b/i.test(sql);
  const runSql = isInsert ? `${pgsql} RETURNING id` : pgsql;
  return {
    async get(...params) {
      const r = await query(pgsql, params);
      return r.rows[0];
    },
    async all(...params) {
      const r = await query(pgsql, params);
      return r.rows;
    },
    async run(...params) {
      const r = await query(runSql, params);
      return { changes: r.rowCount ?? 0, lastInsertRowid: r.rows?.[0]?.id as number | undefined };
    },
  };
}

export interface DbLike {
  prepare(sql: string): Stmt;
  exec(sql: string): Promise<void>;
}

const poolQuery: QueryFn = (sql, params) => pool.query(sql, params);

function makeDb(query: QueryFn): DbLike {
  return {
    prepare: (sql) => makeStmt(sql, query),
    exec: async (sql) => {
      await query(sql, []);
    },
  };
}

/**
 * Camada de acesso a dados sobre o Postgres (node-postgres), expondo a mesma
 * superficie usada nas rotas (prepare().get/all/run, exec) — porem assincrona.
 *
 * Transacoes recebem um `tx` com a mesma interface, amarrado a um unico client:
 *   await db.transaction(async (tx) => {
 *     const { lastInsertRowid } = await tx.prepare('INSERT ...').run(...);
 *     await tx.prepare('INSERT ...').run(...);
 *   });
 */
export const db = {
  ...makeDb(poolQuery),
  async transaction<T>(fn: (tx: DbLike) => Promise<T>): Promise<T> {
    const client = await pool.connect();
    const txQuery: QueryFn = (sql, params) => client.query(sql, params);
    try {
      await client.query('BEGIN');
      const result = await fn(makeDb(txQuery));
      await client.query('COMMIT');
      return result;
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  },
};

// Default de timestamp em texto no formato do SQLite ('YYYY-MM-DD HH:MM:SS' UTC),
// para preservar o comportamento das colunas de data (mantidas como TEXT).
const NOW_TEXT = "to_char((now() AT TIME ZONE 'UTC'), 'YYYY-MM-DD HH24:MI:SS')";

export async function initSchema(): Promise<void> {
  // Cria o schema dedicado antes das tabelas (nao depende do search_path).
  if (schemaIdent) {
    await db.exec(`CREATE SCHEMA IF NOT EXISTS ${schemaIdent}`);
  }

  await db.exec(`
  CREATE TABLE IF NOT EXISTS usuarios (
    id          SERIAL PRIMARY KEY,
    nome        TEXT NOT NULL,
    email       TEXT NOT NULL UNIQUE,
    senha_hash  TEXT NOT NULL,
    perfil      TEXT NOT NULL DEFAULT 'monitor',
    ativo       INTEGER NOT NULL DEFAULT 1,
    criado_em   TEXT NOT NULL DEFAULT (${NOW_TEXT})
  );

  CREATE TABLE IF NOT EXISTS equipes (
    id          SERIAL PRIMARY KEY,
    nome        TEXT NOT NULL,
    supervisor  TEXT,
    descricao   TEXT,
    ativo       INTEGER NOT NULL DEFAULT 1,
    criado_em   TEXT NOT NULL DEFAULT (${NOW_TEXT})
  );

  CREATE TABLE IF NOT EXISTS equipe_membros (
    id        SERIAL PRIMARY KEY,
    equipe_id INTEGER NOT NULL REFERENCES equipes(id) ON DELETE CASCADE,
    nome      TEXT NOT NULL,
    papel     TEXT NOT NULL CHECK(papel IN ('supervisor','monitor','coordenador','gerente')),
    criado_em TEXT NOT NULL DEFAULT (${NOW_TEXT}),
    UNIQUE(equipe_id, nome, papel)
  );

  CREATE TABLE IF NOT EXISTS operadores (
    id            SERIAL PRIMARY KEY,
    nome          TEXT NOT NULL,
    matricula     TEXT UNIQUE,
    cpf           TEXT,
    equipe_id     INTEGER REFERENCES equipes(id) ON DELETE SET NULL,
    cargo         TEXT,
    data_admissao TEXT,
    senha_hash    TEXT,
    ativo         INTEGER NOT NULL DEFAULT 1,
    criado_em     TEXT NOT NULL DEFAULT (${NOW_TEXT})
  );

  CREATE TABLE IF NOT EXISTS formularios (
    id          SERIAL PRIMARY KEY,
    nome        TEXT NOT NULL,
    descricao   TEXT,
    ativo       INTEGER NOT NULL DEFAULT 1,
    criado_em   TEXT NOT NULL DEFAULT (${NOW_TEXT})
  );

  CREATE TABLE IF NOT EXISTS criterios (
    id            SERIAL PRIMARY KEY,
    formulario_id INTEGER NOT NULL REFERENCES formularios(id) ON DELETE CASCADE,
    categoria     TEXT NOT NULL,
    descricao     TEXT NOT NULL,
    peso          DOUBLE PRECISION NOT NULL DEFAULT 1,
    fatal         INTEGER NOT NULL DEFAULT 0,
    ordem         INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS monitorias (
    id                SERIAL PRIMARY KEY,
    formulario_id     INTEGER NOT NULL REFERENCES formularios(id),
    operador_id       INTEGER NOT NULL REFERENCES operadores(id),
    monitor_id        INTEGER NOT NULL REFERENCES usuarios(id),
    data_atendimento  TEXT,
    canal             TEXT DEFAULT 'Telefone',
    protocolo         TEXT,
    nota_final        DOUBLE PRECISION NOT NULL DEFAULT 0,
    falha_critica     INTEGER NOT NULL DEFAULT 0,
    status            TEXT NOT NULL DEFAULT 'concluida',
    observacoes       TEXT,
    operacao          TEXT,
    telefone_cliente  TEXT,
    tabulacao         TEXT,
    produto           TEXT,
    data_monitoria    TEXT DEFAULT (${NOW_TEXT}),
    monitoria_padrao  INTEGER DEFAULT 1,
    feedback_aplicado INTEGER DEFAULT 0,
    data_feedback     TEXT,
    status_feedback   TEXT DEFAULT 'Pendente',
    sla               TEXT,
    detalhe_sla       TEXT,
    criado_em         TEXT NOT NULL DEFAULT (${NOW_TEXT})
  );

  CREATE TABLE IF NOT EXISTS respostas (
    id           SERIAL PRIMARY KEY,
    monitoria_id INTEGER NOT NULL REFERENCES monitorias(id) ON DELETE CASCADE,
    criterio_id  INTEGER NOT NULL REFERENCES criterios(id),
    valor        TEXT NOT NULL DEFAULT 'conforme',
    comentario   TEXT
  );

  CREATE TABLE IF NOT EXISTS contestacoes (
    id            SERIAL PRIMARY KEY,
    monitoria_id  INTEGER NOT NULL REFERENCES monitorias(id) ON DELETE CASCADE,
    motivo        TEXT NOT NULL,
    status        TEXT NOT NULL DEFAULT 'aberta',
    resposta      TEXT,
    nota_revisada DOUBLE PRECISION,
    criado_em     TEXT NOT NULL DEFAULT (${NOW_TEXT}),
    respondido_em TEXT
  );

  CREATE TABLE IF NOT EXISTS calibracoes (
    id            SERIAL PRIMARY KEY,
    titulo        TEXT NOT NULL,
    formulario_id INTEGER NOT NULL REFERENCES formularios(id),
    operador_id   INTEGER REFERENCES operadores(id),
    protocolo     TEXT,
    data          TEXT,
    status        TEXT NOT NULL DEFAULT 'aberta',
    criado_em     TEXT NOT NULL DEFAULT (${NOW_TEXT})
  );

  CREATE TABLE IF NOT EXISTS calibracao_notas (
    id            SERIAL PRIMARY KEY,
    calibracao_id INTEGER NOT NULL REFERENCES calibracoes(id) ON DELETE CASCADE,
    monitor_id    INTEGER NOT NULL REFERENCES usuarios(id),
    nota          DOUBLE PRECISION NOT NULL,
    comentario    TEXT
  );

  CREATE TABLE IF NOT EXISTS anexos (
    id            SERIAL PRIMARY KEY,
    monitoria_id  INTEGER NOT NULL REFERENCES monitorias(id) ON DELETE CASCADE,
    nome_original TEXT NOT NULL,
    nome_arquivo  TEXT NOT NULL,
    mime          TEXT,
    tamanho       INTEGER,
    criado_em     TEXT NOT NULL DEFAULT (${NOW_TEXT})
  );

  CREATE TABLE IF NOT EXISTS configuracoes (
    chave         TEXT PRIMARY KEY,
    valor         TEXT,
    atualizado_em TEXT NOT NULL DEFAULT (${NOW_TEXT})
  );
  `);

  // Migrations seguras para bancos ja existentes (Postgres suporta IF NOT EXISTS).
  const addColumn = (table: string, col: string, type: string) =>
    db.exec(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS ${col} ${type}`);

  await addColumn('operadores', 'cpf', 'TEXT');
  // Senha do operador para assinatura do feedback (substitui a confirmacao por CPF).
  await addColumn('operadores', 'senha_hash', 'TEXT');
  await addColumn('monitorias', 'operacao', 'TEXT');
  await addColumn('monitorias', 'telefone_cliente', 'TEXT');
  await addColumn('monitorias', 'tabulacao', 'TEXT');
  await addColumn('monitorias', 'produto', 'TEXT');
  await addColumn('monitorias', 'data_monitoria', `TEXT DEFAULT (${NOW_TEXT})`);
  await addColumn('monitorias', 'monitoria_padrao', 'INTEGER DEFAULT 1');
  await addColumn('monitorias', 'feedback_aplicado', 'INTEGER DEFAULT 0');
  await addColumn('monitorias', 'data_feedback', 'TEXT');
  await addColumn('monitorias', 'status_feedback', "TEXT DEFAULT 'Pendente'");
  await addColumn('monitorias', 'sla', 'TEXT');
  await addColumn('monitorias', 'detalhe_sla', 'TEXT');
  // Feedback assinado pelo operador (aceite via CPF apos apresentacao)
  await addColumn('monitorias', 'feedback_assinatura_cpf', 'TEXT');
  await addColumn('monitorias', 'feedback_observacao', 'TEXT');
  // Posicionamento do operador no feedback (concorda x discorda)
  await addColumn('monitorias', 'feedback_concordou', 'INTEGER');
  await addColumn('monitorias', 'feedback_discordancia', 'TEXT');

  // Inclui 'coordenador' nos papeis de membro de equipe (bancos ja existentes
  // foram criados com o CHECK antigo: supervisor/monitor/gerente).
  await db.exec(`ALTER TABLE equipe_membros DROP CONSTRAINT IF EXISTS equipe_membros_papel_check`);
  await db.exec(`ALTER TABLE equipe_membros ADD CONSTRAINT equipe_membros_papel_check CHECK (papel IN ('supervisor','monitor','coordenador','gerente'))`);
}
