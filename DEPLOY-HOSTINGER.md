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
   | **Start command** | `npm start` |
   | **Node.js version** | **24.x** (recomendado) — 22.x também funciona |

   > Não escolha Node **18** ou **20**: o app usa o SQLite nativo
   > (`node:sqlite`), que só existe a partir do Node **22**. Prefira o **24.x**,
   > onde o `node:sqlite` não exige nenhuma flag de inicialização. O
   > `package.json` já restringe via `engines` (`>=22 <25`) e o script `start`
   > sobe o app sem flags (`node dist/server.js`), funcionando tanto no modo
   > "npm start" quanto no modo "entry file" da Hostinger.

---

## 3. Variáveis de ambiente (obrigatório)

Em **Environment Variables**, adicione:

| Variável | Valor | Observação |
|----------|-------|-----------|
| `NODE_ENV` | `production` | Ativa cookies `Secure`, HSTS, `trust proxy` e **desliga os dados demo**. |
| `DATABASE_URL` | *(string do Postgres)* | **Obrigatória.** Conexão do Postgres/Supabase — ver seção 4. O app **não sobe** sem isso. |
| `DB_SCHEMA` | `its_qualidade` | **Recomendado** quando o Postgres é compartilhado (ex.: Supabase em uso). Isola as tabelas do app num schema próprio. Vazio = `public`. |
| `JWT_SECRET` | *(64+ hex aleatórios)* | Gere com o comando abaixo. O app **não sobe** sem isso em produção. |
| `ADMIN_NOME` | `Seu Nome` | Nome do primeiro administrador. |
| `ADMIN_EMAIL` | `voce@suaempresa.com.br` | E-mail do primeiro admin. |
| `ADMIN_PASSWORD` | *(mín. 8 caracteres)* | Senha do primeiro admin. **Troque após o 1º acesso.** |
| `DATA_DIR` | `/home/SEU_USUARIO/its-qualidade-data` | Pasta persistente só para **uploads/anexos** (o banco agora é Postgres). Ver seção 4. |
| `PORT` | *(não definir)* | A Hostinger injeta a porta automaticamente. |

Gerar um `JWT_SECRET` forte:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

> O admin inicial só é criado no **primeiro start** (quando o banco ainda
> não tem usuários). Depois, gerencie usuários pela própria aplicação.

---

## 4. Banco de dados (PostgreSQL / Supabase)

O app usa **PostgreSQL**. As tabelas são criadas **automaticamente no primeiro
start** (`CREATE TABLE IF NOT EXISTS`) — não é preciso rodar migrações à mão.

### Usando o Supabase

1. No painel do Supabase: **Project Settings → Database → Connection string**.
   Use o **Connection Pooler** (modo *Transaction*, porta `6543`), trocando
   `[YOUR-PASSWORD]` pela senha do banco:
   ```
   postgresql://postgres.<ref>:<senha>@aws-0-sa-east-1.pooler.supabase.com:6543/postgres
   ```
2. Defina essa string em `DATABASE_URL` (seção 3). O SSL é habilitado
   automaticamente para hosts gerenciados.
3. **Se o projeto Supabase já tiver outras tabelas em `public`** (recomendado
   no seu caso), defina `DB_SCHEMA=its_qualidade` para o app criar e usar um
   schema isolado, sem tocar nas tabelas existentes.

> **Backup/observabilidade:** ficam por conta do Supabase (backups automáticos,
> SQL editor, logs). Bem mais robusto que o SQLite em arquivo.

### Uploads (anexos)

Os arquivos de anexo ainda ficam em disco. Como a Hostinger reconstrói a pasta
do app a cada deploy, defina **`DATA_DIR`** apontando para uma pasta persistente
fora do projeto (ex.: `/home/SEU_USUARIO/its-qualidade-data`) para os uploads
sobreviverem aos redeploys. (Os dados do banco já estão seguros no Postgres.)

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
auto-deploy). Como os dados ficam no **Postgres** (e os uploads em `DATA_DIR`),
nada é perdido nos redeploys. Lembre-se: ao **alterar variáveis de ambiente**,
é preciso **redeploy**.

---

## Solução de problemas

| Sintoma | Causa provável | Solução |
|---------|----------------|---------|
| App não inicia, erro de `JWT_SECRET` | Variável ausente/curta | Defina `JWT_SECRET` com 32+ caracteres. |
| App não inicia, erro `DATABASE_URL ausente` | Conexão não definida | Defina `DATABASE_URL` com a string do Postgres/Supabase (seção 4). |
| Erro de conexão/SSL ao banco | String errada ou rede | Use o **pooler** do Supabase (porta 6543); confira host/senha. SSL é automático. |
| Tabelas aparecem no schema errado | `DB_SCHEMA` não definido | Defina `DB_SCHEMA=its_qualidade` para isolar do `public`. |
| Uploads somem a cada deploy | `DATA_DIR` não configurado | Aponte `DATA_DIR` para pasta persistente (seção 4). |
| Login não persiste / cai | Cookie `Secure` sem HTTPS | Garanta domínio com SSL ativo (a Hostinger faz isso). |
| Aparecem usuários/dados fictícios | `NODE_ENV` ≠ production ou `SEED_DEMO=true` | Defina `NODE_ENV=production` e deixe `SEED_DEMO` vazio. |
