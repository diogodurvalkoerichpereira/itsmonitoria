# 🚀 Deploy na Hostinger (Web App Node.js)

Guia para publicar o **iTS Qualidade** na Hostinger usando o recurso
**Sites → Adicionar site → Web app Node.js** (deploy direto do GitHub),
disponível nos planos **Business** e **Cloud**.

> ⚠️ A **Hospedagem Web/compartilhada comum** (só PHP) **não** roda este app.
> É preciso o recurso **Web app Node.js** (Business/Cloud) ou uma **VPS**.

---

## 1. Pré-requisitos

- Repositório no GitHub com este código (branch a publicar).
- Plano Hostinger **Business** ou **Cloud** com **Web app Node.js**.
- Um domínio/subdomínio (pode usar o temporário `*.hostingersite.com` no início).

---

## 2. Criar o app no hPanel

1. hPanel → **Sites** → **Adicionar site** → **Web app Node.js**.
2. **Connect GitHub** → autorize e selecione este repositório e a branch.
3. Configure os comandos (a Hostinger normalmente detecta sozinha):

   | Campo | Valor |
   |-------|-------|
   | **Install command** | `npm ci` |
   | **Build command** | `npm run build` |
   | **Start command** | `npm run start` |
   | **Node.js version** | **22.x** (recomendado) ou **24.x** |

   > Não escolha Node **18** ou **20**: o app usa o SQLite nativo
   > (`node:sqlite`), que só existe a partir do Node **22**. O `package.json`
   > já restringe via `engines` (`>=22 <25`).

---

## 3. Variáveis de ambiente (obrigatório)

Em **Environment Variables**, adicione:

| Variável | Valor | Observação |
|----------|-------|-----------|
| `NODE_ENV` | `production` | Ativa cookies `Secure`, HSTS, `trust proxy` e **desliga os dados demo**. |
| `JWT_SECRET` | *(64+ hex aleatórios)* | Gere com o comando abaixo. O app **não sobe** sem isso em produção. |
| `ADMIN_NOME` | `Seu Nome` | Nome do primeiro administrador. |
| `ADMIN_EMAIL` | `voce@suaempresa.com.br` | E-mail do primeiro admin. |
| `ADMIN_PASSWORD` | *(mín. 8 caracteres)* | Senha do primeiro admin. **Troque após o 1º acesso.** |
| `DATA_DIR` | `/home/SEU_USUARIO/its-qualidade-data` | **Crítico** — ver seção 4. |
| `PORT` | *(não definir)* | A Hostinger injeta a porta automaticamente. |

Gerar um `JWT_SECRET` forte:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

> O admin inicial só é criado no **primeiro start** (quando o banco ainda
> não tem usuários). Depois, gerencie usuários pela própria aplicação.

---

## 4. Persistência do banco (NÃO PULE ISTO)

O banco SQLite e os uploads ficam, por padrão, em `./data` dentro do projeto.
A cada **redeploy via GitHub a Hostinger reconstrói a pasta do app** — o que
**apagaria todos os dados**.

Para evitar isso, este projeto suporta a variável **`DATA_DIR`**, que move o
banco e os uploads para um caminho **fora** da pasta do app:

1. No **File Manager** (ou via SSH) crie uma pasta persistente, ex.:
   `/home/SEU_USUARIO/its-qualidade-data`
2. Defina `DATA_DIR` apontando para ela (seção 3).

Assim, `qualidade.db` e a pasta `uploads/` sobrevivem a todos os deploys.

> **Backup:** faça cópia periódica de `DATA_DIR` (basta copiar a pasta).
> Para um backup consistente do SQLite, prefira copiar com o app parado
> ou use `sqlite3 qualidade.db ".backup arquivo.db"`.

---

## 5. Domínio e HTTPS

1. Conecte seu domínio/subdomínio ao app (**Conectar domínio** no painel).
2. A Hostinger provê **SSL/HTTPS** e atua como reverse proxy — o app já
   habilita `trust proxy` e cookies `Secure` quando `NODE_ENV=production`.

---

## 6. Publicar e verificar

1. Clique em **Deploy**. Acompanhe o log (install → build → start).
2. No log de start deve aparecer:
   `iTS Qualidade rodando na porta XXXX (producao)`
   e, no primeiro deploy, `Administrador inicial criado: <seu email>`.
3. Acesse o domínio e faça login com `ADMIN_EMAIL` / `ADMIN_PASSWORD`.

---

## 7. Atualizações futuras

Faça `git push` na branch publicada e clique em **Redeploy** (ou ative o
auto-deploy). Como o banco está em `DATA_DIR`, os dados são preservados.
Lembre-se: ao **alterar variáveis de ambiente**, é preciso **redeploy**.

---

## Solução de problemas

| Sintoma | Causa provável | Solução |
|---------|----------------|---------|
| App não inicia, erro de `JWT_SECRET` | Variável ausente/curta | Defina `JWT_SECRET` com 32+ caracteres. |
| `Cannot find module 'node:sqlite'` | Node 18/20 selecionado | Mude para Node **22.x** ou **24.x**. |
| Dados somem a cada deploy | `DATA_DIR` não configurado | Aponte `DATA_DIR` para pasta persistente (seção 4). |
| Login não persiste / cai | Cookie `Secure` sem HTTPS | Garanta domínio com SSL ativo (a Hostinger faz isso). |
| Aparecem usuários/dados fictícios | `NODE_ENV` ≠ production ou `SEED_DEMO=true` | Defina `NODE_ENV=production` e deixe `SEED_DEMO` vazio. |
