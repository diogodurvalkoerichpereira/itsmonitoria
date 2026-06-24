import nodemailer from 'nodemailer';
import { getEmailConfig } from './config-store.js';

// O envio usa a configuracao efetiva (banco sobrepoe as variaveis de ambiente).
// Enquanto host/usuario/senha/remetente nao estiverem completos, o envio e
// desativado de forma segura (apenas registra no log), sem quebrar o fluxo.

export async function mailerConfigurado(): Promise<boolean> {
  const c = await getEmailConfig();
  return Boolean(c.host && c.user && c.pass && c.from);
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

  const c = await getEmailConfig();
  if (!(c.host && c.user && c.pass && c.from)) {
    console.warn('[mailer] SMTP nao configurado — e-mail NAO enviado para:', destinatarios.join(', '));
    return { enviado: false, motivo: 'SMTP nao configurado' };
  }

  try {
    const transporter = nodemailer.createTransport({
      host: c.host,
      port: c.port,
      secure: c.secure,
      auth: { user: c.user, pass: c.pass },
    });
    await transporter.sendMail({
      from: c.from,
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
