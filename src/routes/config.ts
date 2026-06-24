import { Router } from 'express';
import { getEmailConfig, setEmailConfig } from '../config-store.js';
import { enviarEmail } from '../mailer.js';

export const configRouter = Router();

// Retorna a config de e-mail SEM expor a senha (apenas se ja existe uma).
configRouter.get('/email', async (_req, res) => {
  const c = await getEmailConfig();
  res.json({
    host: c.host,
    port: c.port,
    secure: c.secure,
    user: c.user,
    from: c.from,
    tem_senha: Boolean(c.pass),
  });
});

// Salva a config (parcial). Senha em branco mantem a atual.
configRouter.put('/email', async (req, res) => {
  const { host, port, secure, user, pass, from } = req.body ?? {};
  await setEmailConfig({
    smtp_host: host,
    smtp_port: port,
    smtp_secure: secure,
    smtp_user: user,
    smtp_pass: pass,
    mail_from: from,
  });
  res.json({ ok: true });
});

// Envia um e-mail de teste para validar a configuracao atual.
configRouter.post('/email/testar', async (req, res) => {
  const { para } = req.body ?? {};
  if (!para) return res.status(400).json({ erro: 'Informe o e-mail de destino do teste' });
  const r = await enviarEmail({
    para: [String(para)],
    assunto: '[ITS Qualidade] Teste de configuração de e-mail',
    html: '<p>Este é um <b>e-mail de teste</b> enviado pela tela de Configurações.</p><p>Se você recebeu, o envio de notificações está funcionando ✅.</p>',
    texto: 'E-mail de teste do ITS Qualidade. Se voce recebeu, o envio esta funcionando.',
  });
  if (!r.enviado) return res.status(400).json({ erro: r.motivo || 'Falha ao enviar' });
  res.json({ ok: true });
});
