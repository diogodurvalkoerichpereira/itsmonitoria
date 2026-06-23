# iTS Qualidade · Console de Monitoria

Módulo de Gestão de Qualidade do **iTS Customer Service**. Esta aplicação permite a monitoria de atendimentos, análise de indicadores em dashboards integrados, alinhamento de equipe com sessões de calibração e fluxo completo de contestação de notas pelos operadores.

---

## 🛠️ Tecnologias Utilizadas

### Backend
- **Node.js**: Plataforma de execução JavaScript/TypeScript.
- **Express**: Framework web minimalista e rápido.
- **PostgreSQL (`pg`)**: Banco de dados relacional robusto (compatível com Supabase). As tabelas são criadas automaticamente no primeiro start. Suporta schema dedicado via `DB_SCHEMA`.
- **TypeScript**: Tipagem estática para maior segurança e produtividade.
- **JWT (JSON Web Token)**: Autenticação via cookies seguros (`httpOnly`, `sameSite: lax`).
- **BcryptJS**: Hashing seguro de senhas.

### Frontend
- **HTML5 & CSS3**: Estrutura e estilização premium baseada em CSS variables, design responsivo, e micro-animações.
- **Vanilla JavaScript**: Arquitetura SPA (Single Page Application) modular com roteamento baseado em hashes.
- **Gráficos customizados**: Gráficos de barras estilizados e gráficos de linha dinâmicos desenhados diretamente em SVG para performance excelente e peso leve.

---

## 🚀 Como Executar o Projeto

### Pré-requisitos
- Node.js (v22+ recomendado).
- Um PostgreSQL acessível (local ou Supabase). Defina `DATABASE_URL` no `.env`.
- Gerenciador de pacotes npm.

### Instalação
1. Instale as dependências do projeto:
   ```bash
   npm install
   ```

2. Configure o banco. Copie `.env.example` para `.env` e defina `DATABASE_URL`
   (Postgres local ou Supabase). Ex. local:
   ```bash
   DATABASE_URL=postgresql://postgres:postgres@localhost:5432/its_qualidade
   ```

3. Execute em desenvolvimento (API com hot-reload + Vite no frontend):
   ```bash
   npm run dev
   ```

   - **Frontend (Vite dev):** [http://localhost:5173](http://localhost:5173) — use este no navegador.
   - **API (Express):** http://localhost:3000 (o Vite faz proxy de `/api`).

   As tabelas são criadas automaticamente e, em desenvolvimento, o banco é
   populado com dados de demonstração.

## 🚀 Publicação em Produção

1. **Configure as variáveis de ambiente.** Copie `.env.example` para `.env` e preencha:

   | Variável | Obrigatória | Descrição |
   |----------|:----------:|-----------|
   | `NODE_ENV` | sim | Use `production`. Ativa cookies `secure`, HSTS, `trust proxy` e **desliga os dados/usuários de demonstração**. |
   | `JWT_SECRET` | sim | Segredo de assinatura dos tokens (mín. 32 caracteres aleatórios). O app **não inicia** em produção sem ele. |
   | `ADMIN_EMAIL` / `ADMIN_PASSWORD` | sim* | Administrador inicial criado no primeiro start (*apenas se o banco ainda não tiver usuários). Senha mín. 8 caracteres. |
   | `PORT` | não | Porta HTTP (padrão `3000`). Em PaaS (ex.: Hostinger) é injetada automaticamente. |
   | `SEED_DEMO` | não | `true` para popular dados fictícios também em produção (não recomendado). |
   | `DATABASE_URL` | sim | String de conexão do Postgres/Supabase. O app **não sobe** sem ela. |
   | `DB_SCHEMA` | não | Schema dedicado (ex.: `its_qualidade`) para coexistir num Postgres compartilhado sem colidir com o `public`. Padrão: `public`. |
   | `DATA_DIR` | não | Caminho persistente para os **uploads/anexos** (o banco é Postgres). **Defina em hospedagens que reconstroem a pasta do app a cada deploy** (ex.: Hostinger via GitHub). Padrão: `./data`. |

   > **Versão do Node:** use **Node 24+** (recomendado) ou **22+** (não use 18/20). Os scripts sobem o app **sem flags** (`node dist/server.js`), então funciona tanto via `npm start` quanto se a hospedagem iniciar o arquivo de entrada diretamente.
   >
   > Para publicar na Hostinger (Web app Node.js), veja **[`DEPLOY-HOSTINGER.md`](./DEPLOY-HOSTINGER.md)**.

   Gere um segredo forte com:
   ```bash
   node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
   ```

2. **Build e start:**
   ```bash
   npm ci
   npm run build
   npm run start
   ```

3. **Coloque atrás de um reverse proxy com HTTPS** (Nginx, Caddy, Render, Railway…). O app já habilita `trust proxy` e cookies `secure` quando `NODE_ENV=production`.

### Docker (opcional)

```bash
docker build -t its-qualidade .
docker run -d -p 3000:3000 --env-file .env -v its_data:/app/data its-qualidade
```

Passe `DATABASE_URL` (e demais variáveis) via `--env-file .env`. Os **uploads**
ficam em `/app/data` — monte um volume para persistência. O **banco** é o
Postgres externo apontado por `DATABASE_URL`.

---

## 🔑 Credenciais

**Em desenvolvimento**, o banco é populado com dados fictícios e usuários de teste:

- **E-mail:** `admin@its.com.br` · **Senha:** `admin123`

> ⚠️ **Em produção esses usuários de demonstração NÃO são criados.** O primeiro administrador é definido por `ADMIN_EMAIL` / `ADMIN_PASSWORD`. Troque a senha após o primeiro acesso.

---

## 📦 Estrutura de Banco de Dados e Módulos

O banco de dados relacional PostgreSQL possui a seguinte estrutura:

- `usuarios`: Conta dos monitores, supervisores e administradores de qualidade.
- `equipes`: Cadastro das equipes de atendimento e seus supervisores.
- `operadores`: Cadastro dos operadores avaliados.
- `formularios`: Modelos de formulários ativos para avaliação de monitoria.
- `criterios`: Critérios individuais associados a cada formulário (com suporte a pesos e marcação de critérios **fatais**).
- `monitorias`: Avaliações executadas, guardando a nota final e o status do atendimento.
- `respostas`: Avaliações para cada critério na monitoria (comentários e status de conformidade).
- `contestacoes`: Recursos abertos por operadores para revisão de notas.
- `calibracoes`: Avaliações compartilhadas entre múltiplos monitores sobre um mesmo atendimento para medir o desvio padrão ($\sigma$) e alinhamento da equipe de qualidade.

---

## 💻 Módulos do Sistema

1. **Dashboard (📊 Análise)**: Visualização de KPIs como total de monitorias, nota média geral, taxa de aprovação (nota $\ge 80$), e falhas críticas ocorridas. Inclui gráficos de evolução mensal de nota e desempenho por canal.
2. **Monitorias (🎧 Atendimento)**: Registro e visualização detalhada de avaliações de atendimento por canais (Telefone, Chat, WhatsApp e E-mail).
3. **Contestações (⚖️ Recursos)**: Painel de controle para analisar e deferir/indeferir as contestações enviadas pelos operadores.
4. **Calibração (🎯 Alinhamento)**: Ferramenta essencial para alinhar a equipe de qualidade, comparando as avaliações feitas por diferentes monitores sob o mesmo protocolo de atendimento.
5. **Cadastros (👤 Configurações)**: Telas completas para gerenciar **Operadores**, **Equipes** e **Formulários de Avaliação** de forma intuitiva através de modals dinâmicos.
