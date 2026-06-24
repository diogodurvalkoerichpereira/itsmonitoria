import nodemailer, { type Transporter } from 'nodemailer';

// Configuracao de SMTP via variaveis de ambiente. Enquanto nao estiver
// configurado, o envio e desativado de forma segura (apenas registra no log),
// sem quebrar o fluxo da aplicacao.
const HOST = process.env.SMTP_HOST?.trim();
const PORT = Number(process.env.SMTP_PORT) || 587;
const USER = process.env.SMTP_USER?.trim();
const PASS = process.env.SMTP_PASS;
// secure=true para porta 465 (SSL); false para 587/25 (STARTTLS).
const SECURE = process.env.SMTP_SECURE
  ? process.env.SMTP_SECURE === 'true'
  : PORT === 465;
const FROM = process.env.MAIL_FROM?.trim() || (USER ? `ITS Qualidade <${USER}>` : undefined);

let transporter: Transporter | null = null;

export function mailerConfigurado(): boolean {
  return Boolean(HOST && USER && PASS && FROM);
}

function getTransporter(): Transporter | null {
  if (!mailerConfigurado()) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: HOST,
      port: PORT,
      secure: SECURE,
      auth: { user: USER, pass: PASS },
    });
  }
  return transporter;
}

export interface EnvioResultado {
  enviado: boolean;
  motivo?: string;
}

export async function enviarEmail(opts: {
  para: string[];
  assunto: string;
  html: string;
  texto?: string;
}): Promise<EnvioResultado> {
  const destinatarios = (opts.para || []).filter(Boolean);
  if (!destinatarios.length) return { enviado: false, motivo: 'Nenhum destinatario com e-mail' };

  const t = getTransporter();
  if (!t) {
    console.warn('[mailer] SMTP nao configurado — e-mail NAO enviado para:', destinatarios.join(', '));
    return { enviado: false, motivo: 'SMTP nao configurado' };
  }

  try {
    await t.sendMail({
      from: FROM,
      to: destinatarios.join(', '),
      subject: opts.assunto,
      html: opts.html,
      text: opts.texto,
    });
    return { enviado: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[mailer] Falha ao enviar e-mail:', msg);
    return { enviado: false, motivo: msg };
  }
}
