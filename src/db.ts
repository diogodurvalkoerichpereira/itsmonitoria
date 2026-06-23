import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { mkdirSync } from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = join(__dirname, '..', 'data');
mkdirSync(dataDir, { recursive: true });

const sqlite = new DatabaseSync(join(dataDir, 'qualidade.db'));
sqlite.exec('PRAGMA journal_mode = WAL');
sqlite.exec('PRAGMA foreign_keys = ON');

interface Stmt {
  get(...params: unknown[]): any;
  all(...params: unknown[]): any[];
  run(...params: unknown[]): { changes: number | bigint; lastInsertRowid: number | bigint };
}

/**
 * Wrapper fino sobre node:sqlite que expoe a mesma superficie usada nas rotas
 * (prepare/exec) e adiciona um helper de transacao no estilo better-sqlite3:
 *   const tx = db.transaction(() => { ... }); tx();
 */
export const db = {
  prepare: (sql: string): Stmt => sqlite.prepare(sql) as unknown as Stmt,
  exec: (sql: string) => sqlite.exec(sql),
  transaction<T>(fn: () => T): () => T {
    return () => {
      sqlite.exec('BEGIN');
      try {
        const r = fn();
        sqlite.exec('COMMIT');
        return r;
      } catch (e) {
        sqlite.exec('ROLLBACK');
        throw e;
      }
    };
  },
};

export function initSchema(): void {
  sqlite.exec(`
  CREATE TABLE IF NOT EXISTS usuarios (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    nome        TEXT NOT NULL,
    email       TEXT NOT NULL UNIQUE,
    senha_hash  TEXT NOT NULL,
    perfil      TEXT NOT NULL DEFAULT 'monitor',
    ativo       INTEGER NOT NULL DEFAULT 1,
    criado_em   TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS equipes (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    nome        TEXT NOT NULL,
    supervisor  TEXT,
    descricao   TEXT,
    ativo       INTEGER NOT NULL DEFAULT 1,
    criado_em   TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS operadores (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    nome          TEXT NOT NULL,
    matricula     TEXT UNIQUE,
    equipe_id     INTEGER REFERENCES equipes(id) ON DELETE SET NULL,
    cargo         TEXT,
    data_admissao TEXT,
    ativo         INTEGER NOT NULL DEFAULT 1,
    criado_em     TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS formularios (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    nome        TEXT NOT NULL,
    descricao   TEXT,
    ativo       INTEGER NOT NULL DEFAULT 1,
    criado_em   TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS criterios (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    formulario_id INTEGER NOT NULL REFERENCES formularios(id) ON DELETE CASCADE,
    categoria     TEXT NOT NULL,
    descricao     TEXT NOT NULL,
    peso          REAL NOT NULL DEFAULT 1,
    fatal         INTEGER NOT NULL DEFAULT 0,
    ordem         INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS monitorias (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    formulario_id   INTEGER NOT NULL REFERENCES formularios(id),
    operador_id     INTEGER NOT NULL REFERENCES operadores(id),
    monitor_id      INTEGER NOT NULL REFERENCES usuarios(id),
    data_atendimento TEXT,
    canal           TEXT DEFAULT 'Telefone',
    protocolo       TEXT,
    nota_final      REAL NOT NULL DEFAULT 0,
    falha_critica   INTEGER NOT NULL DEFAULT 0,
    status          TEXT NOT NULL DEFAULT 'concluida',
    observacoes     TEXT,
    criado_em       TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS respostas (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    monitoria_id INTEGER NOT NULL REFERENCES monitorias(id) ON DELETE CASCADE,
    criterio_id  INTEGER NOT NULL REFERENCES criterios(id),
    valor        TEXT NOT NULL DEFAULT 'conforme',
    comentario   TEXT
  );

  CREATE TABLE IF NOT EXISTS contestacoes (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    monitoria_id  INTEGER NOT NULL REFERENCES monitorias(id) ON DELETE CASCADE,
    motivo        TEXT NOT NULL,
    status        TEXT NOT NULL DEFAULT 'aberta',
    resposta      TEXT,
    nota_revisada REAL,
    criado_em     TEXT NOT NULL DEFAULT (datetime('now')),
    respondido_em TEXT
  );

  CREATE TABLE IF NOT EXISTS calibracoes (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    titulo        TEXT NOT NULL,
    formulario_id INTEGER NOT NULL REFERENCES formularios(id),
    operador_id   INTEGER REFERENCES operadores(id),
    protocolo     TEXT,
    data          TEXT,
    status        TEXT NOT NULL DEFAULT 'aberta',
    criado_em     TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS calibracao_notas (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    calibracao_id INTEGER NOT NULL REFERENCES calibracoes(id) ON DELETE CASCADE,
    monitor_id    INTEGER NOT NULL REFERENCES usuarios(id),
    nota          REAL NOT NULL,
    comentario    TEXT
  );
  `);
}
