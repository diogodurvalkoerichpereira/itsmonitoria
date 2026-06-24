import { db } from './db.js';

// Configuracoes de e-mail editaveis em runtime (tela do admin). Os valores
// salvos no banco sobrepoem as variaveis de ambiente (SMTP_*/MAIL_FROM), que
// servem como padrao inicial.

export interface EmailConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  from: string;
}

const CHAVES = ['smtp_host', 'smtp_port', 'smtp_secure', 'smtp_user', 'smtp_pass', 'mail_from'] as const;

async function lerConfigsDb(): Promise<Record<string, string>> {
  const rows = (await db.prepare('SELECT chave, valor FROM configuracoes').all()) as Array<{ chave: string; valor: string }>;
  const out: Record<string, string> = {};
  for (const r of rows) out[r.chave] = r.valor;
  return out;
}

/** Config efetiva: banco sobrepoe ambiente. */
export async function getEmailConfig(): Promise<EmailConfig> {
  const c = await lerConfigsDb();
  const host = (c.smtp_host ?? process.env.SMTP_HOST ?? '').trim();
  const portStr = c.smtp_port ?? process.env.SMTP_PORT ?? '587';
  const port = Number(portStr) || 587;
  const secureStr = c.smtp_secure ?? process.env.SMTP_SECURE;
  const secure = secureStr != null ? secureStr === 'true' : port === 465;
  const user = (c.smtp_user ?? process.env.SMTP_USER ?? '').trim();
  const pass = c.smtp_pass ?? process.env.SMTP_PASS ?? '';
  const from = (c.mail_from ?? process.env.MAIL_FROM ?? (user ? `ITS Qualidade <${user}>` : '')).trim();
  return { host, port, secure, user, pass, from };
}

/** Salva apenas as chaves informadas (parcial). Senha vazia/ausente = mantem. */
export async function setEmailConfig(parcial: Partial<{
  smtp_host: string; smtp_port: string | number; smtp_secure: boolean | string;
  smtp_user: string; smtp_pass: string; mail_from: string;
}>): Promise<void> {
  const upsert = db.prepare(`
    INSERT INTO configuracoes (chave, valor, atualizado_em)
    VALUES (?, ?, to_char((now() AT TIME ZONE 'UTC'), 'YYYY-MM-DD HH24:MI:SS'))
    ON CONFLICT (chave) DO UPDATE SET valor = EXCLUDED.valor, atualizado_em = EXCLUDED.atualizado_em
  `);
  const set = async (chave: typeof CHAVES[number], valor: unknown) => {
    if (valor == null) return;
    const v = typeof valor === 'boolean' ? String(valor) : String(valor);
    await upsert.run(chave, v);
  };
  await set('smtp_host', parcial.smtp_host);
  await set('smtp_port', parcial.smtp_port);
  await set('smtp_secure', parcial.smtp_secure);
  await set('smtp_user', parcial.smtp_user);
  // senha so e gravada quando vem preenchida (nao apaga a existente)
  if (parcial.smtp_pass != null && String(parcial.smtp_pass).length > 0) {
    await set('smtp_pass', parcial.smtp_pass);
  }
  await set('mail_from', parcial.mail_from);
}
