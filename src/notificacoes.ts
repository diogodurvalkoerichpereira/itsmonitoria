import { db } from './db.js';
import { enviarEmail, mailerConfigurado, type EnvioResultado } from './mailer.js';

interface MonitoriaInfo {
  id: number;
  protocolo: string | null;
  canal: string | null;
  data_atendimento: string | null;
  nota_final: number;
  operador_nome: string;
  equipe_id: number | null;
  equipe_nome: string | null;
  monitor_nome: string;
}

/**
 * Resolve os e-mails dos gestores da equipe do operador:
 *  - supervisores e gerentes: nomes em equipe_membros casados (por nome) com a
 *    tabela usuarios para obter o e-mail;
 *  - coordenadores: todos os usuarios com perfil 'coordenador' (o modelo de
 *    equipe nao guarda coordenador por equipe).
 * Retorna e-mails distintos de usuarios ativos.
 */
async function resolverDestinatarios(equipeId: number | null): Promise<string[]> {
  const emails = new Set<string>();

  if (equipeId != null) {
    const rows = (await db.prepare(`
      SELECT DISTINCT u.email
      FROM equipe_membros em
      JOIN usuarios u ON lower(trim(u.nome)) = lower(trim(em.nome))
      WHERE em.equipe_id = ? AND em.papel IN ('supervisor','gerente')
        AND u.ativo = 1 AND u.email IS NOT NULL
    `).all(equipeId)) as Array<{ email: string }>;
    for (const r of rows) if (r.email) emails.add(r.email.trim().toLowerCase());
  }

  const coords = (await db.prepare(
    "SELECT email FROM usuarios WHERE perfil = 'coordenador' AND ativo = 1 AND email IS NOT NULL"
  ).all()) as Array<{ email: string }>;
  for (const r of coords) if (r.email) emails.add(r.email.trim().toLowerCase());

  return [...emails];
}

function montarEmail(m: MonitoriaInfo): { assunto: string; html: string; texto: string } {
  const assunto = `[Qualidade] Falha crítica — ${m.operador_nome}${m.protocolo ? ' · ' + m.protocolo : ''}`;
  const linhas = [
    ['Operador', m.operador_nome],
    ['Equipe', m.equipe_nome || '—'],
    ['Protocolo', m.protocolo || '—'],
    ['Canal', m.canal || '—'],
    ['Data do atendimento', m.data_atendimento || '—'],
    ['Monitor responsável', m.monitor_nome],
    ['Nota final', '0 (falha crítica)'],
  ];
  const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;color:#1f2937;max-width:560px">
      <h2 style="color:#dc2626;margin:0 0 4px">⚠️ Falha crítica em monitoria</h2>
      <p style="margin:0 0 14px;color:#4b5563">Uma monitoria foi registrada com <b>falha crítica</b> (planilha zerada). Recomenda-se tratativa com o operador.</p>
      <table style="border-collapse:collapse;width:100%">
        ${linhas.map(([k, v]) => `<tr>
          <td style="padding:6px 10px;background:#f8fafc;border:1px solid #e5e7eb;font-weight:600;width:42%">${k}</td>
          <td style="padding:6px 10px;border:1px solid #e5e7eb">${v}</td></tr>`).join('')}
      </table>
      <p style="margin:16px 0 0;font-size:12px;color:#9ca3af">Mensagem automática · ITS Qualidade (módulo de monitoria)</p>
    </div>`;
  const texto =
    `Falha crítica em monitoria (planilha zerada)\n\n` +
    linhas.map(([k, v]) => `${k}: ${v}`).join('\n') +
    `\n\nMensagem automática · ITS Qualidade`;
  return { assunto, html, texto };
}

export interface NotificacaoResultado extends EnvioResultado {
  destinatarios: string[];
}

/** Notifica os gestores da equipe sobre uma monitoria com falha crítica. */
export async function notificarFalhaCritica(monitoriaId: number): Promise<NotificacaoResultado> {
  const m = (await db.prepare(`
    SELECT m.id, m.protocolo, m.canal, m.data_atendimento, m.nota_final,
           o.nome AS operador_nome, o.equipe_id, e.nome AS equipe_nome, u.nome AS monitor_nome
    FROM monitorias m
    JOIN operadores o ON o.id = m.operador_id
    LEFT JOIN equipes e ON e.id = o.equipe_id
    JOIN usuarios u ON u.id = m.monitor_id
    WHERE m.id = ?
  `).get(monitoriaId)) as MonitoriaInfo | undefined;

  if (!m) return { enviado: false, motivo: 'Monitoria nao encontrada', destinatarios: [] };

  const destinatarios = await resolverDestinatarios(m.equipe_id);
  if (!destinatarios.length) {
    return {
      enviado: false,
      destinatarios: [],
      motivo: 'Nenhum gestor da equipe com e-mail cadastrado (verifique se os nomes dos membros conferem com os Usuários)',
    };
  }
  if (!mailerConfigurado()) {
    return { enviado: false, destinatarios, motivo: 'SMTP nao configurado' };
  }

  const { assunto, html, texto } = montarEmail(m);
  const r = await enviarEmail({ para: destinatarios, assunto, html, texto });
  return { ...r, destinatarios };
}
