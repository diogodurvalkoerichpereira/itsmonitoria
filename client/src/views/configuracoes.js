import { api } from '../api.js';
import { toast, h } from '../ui.js';

export async function configuracoesView(el) {
  el.innerHTML = '<div class="empty">Carregando configurações...</div>';
  const c = await api.get('/config/email');

  el.innerHTML = `
    <div class="section-title">Configurações · E-mail de notificações</div>
    <div class="its-alert alert-info">Estes dados são usados para enviar os e-mails de notificação (ex.: falha crítica). O <b>remetente</b> é o e-mail que aparece como origem. Em geral o remetente deve ser o mesmo do usuário SMTP autenticado, senão o servidor pode recusar o envio.</div>
    <div class="its-card" style="max-width:640px">
      <form id="cfg-form">
        <div class="form-group">
          <label class="its-label">Remetente (e-mail de envio)</label>
          <input class="its-input" name="from" value="${attr(c.from)}" placeholder="ITS Qualidade &lt;licita@itscs.com.br&gt;">
          <div style="font-size:.74rem;color:var(--its-muted);margin-top:4px">Aceita o formato "Nome &lt;email@dominio&gt;" ou só o e-mail.</div>
        </div>

        <div class="cat-head" style="margin-top:10px">Servidor SMTP</div>
        <div class="form-row">
          <div class="form-group"><label class="its-label">Host</label><input class="its-input" name="host" value="${attr(c.host)}" placeholder="mail.itscs.com.br"></div>
          <div class="form-group" style="max-width:120px"><label class="its-label">Porta</label><input class="its-input" name="port" type="number" value="${attr(c.port)}" placeholder="465"></div>
        </div>
        <div class="form-row">
          <div class="form-group"><label class="its-label">Usuário (conta SMTP)</label><input class="its-input" name="user" value="${attr(c.user)}" placeholder="licita@itscs.com.br" autocomplete="username"></div>
          <div class="form-group"><label class="its-label">Senha ${c.tem_senha ? '(deixe em branco para manter)' : ''}</label><input class="its-input" name="pass" type="password" autocomplete="new-password" placeholder="${c.tem_senha ? '•••••• (definida)' : 'Senha do e-mail'}"></div>
        </div>
        <label class="its-label" style="display:flex;align-items:center;gap:8px">
          <input type="checkbox" name="secure" ${c.secure ? 'checked' : ''}> Conexão segura SSL (porta 465). Desmarque para 587/STARTTLS.
        </label>

        <div style="display:flex;gap:10px;margin-top:16px;flex-wrap:wrap">
          <button class="its-btn its-btn-primary" id="cfg-salvar" type="button">Salvar configurações</button>
        </div>
      </form>

      <div class="cat-head" style="margin-top:18px">Enviar e-mail de teste</div>
      <div class="form-row" style="align-items:flex-end">
        <div class="form-group"><label class="its-label">Enviar teste para</label><input class="its-input" id="cfg-teste-email" placeholder="seu-email@dominio.com"></div>
        <button class="its-btn its-btn-outline" id="cfg-testar" type="button" style="margin-bottom:2px">Enviar teste</button>
      </div>
      <div style="font-size:.74rem;color:var(--its-muted)">Salve as configurações antes de testar. O teste usa a configuração já salva.</div>
    </div>`;

  const form = el.querySelector('#cfg-form');

  el.querySelector('#cfg-salvar').onclick = async () => {
    const fd = Object.fromEntries(new FormData(form));
    const payload = {
      from: fd.from?.trim() || '',
      host: fd.host?.trim() || '',
      port: Number(fd.port) || 587,
      user: fd.user?.trim() || '',
      secure: form.secure.checked,
    };
    // senha só vai se preenchida (mantém a atual caso em branco)
    if (fd.pass && fd.pass.length > 0) payload.pass = fd.pass;
    try {
      await api.put('/config/email', payload);
      toast('Configurações salvas');
      configuracoesView(el);
    } catch (e) { toast(e.message, true); }
  };

  el.querySelector('#cfg-testar').onclick = async () => {
    const para = el.querySelector('#cfg-teste-email').value.trim();
    if (!para) return toast('Informe um e-mail de destino', true);
    const btn = el.querySelector('#cfg-testar');
    btn.disabled = true;
    try {
      await api.post('/config/email/testar', { para });
      toast('E-mail de teste enviado para ' + para);
    } catch (e) { toast('Falha no teste: ' + e.message, true); }
    finally { btn.disabled = false; }
  };
}

function attr(v) {
  return String(v ?? '').replace(/"/g, '&quot;');
}
