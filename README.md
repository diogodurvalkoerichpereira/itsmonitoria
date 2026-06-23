# iTS Qualidade · Console de Monitoria

Módulo de Gestão de Qualidade do **iTS Customer Service**. Esta aplicação permite a monitoria de atendimentos, análise de indicadores em dashboards integrados, alinhamento de equipe com sessões de calibração e fluxo completo de contestação de notas pelos operadores.

---

## 🛠️ Tecnologias Utilizadas

### Backend
- **Node.js**: Plataforma de execução JavaScript/TypeScript.
- **Express**: Framework web minimalista e rápido.
- **SQLite (`node:sqlite`)**: Banco de dados relacional leve com modo WAL habilitado e integridade de chaves estrangeiras.
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
- Node.js (v22+ recomendado, devido à funcionalidade nativa do SQLite `node:sqlite`).
- Gerenciador de pacotes npm.

### Instalação
1. Instale as dependências do projeto:
   ```bash
   npm install
   ```

2. Execute o servidor de desenvolvimento com hot-reload automático:
   ```bash
   npm run dev
   ```
   
   O projeto estará disponível em [http://localhost:3000](http://localhost:3000).

### Build e Produção
1. Compile o projeto TypeScript para JavaScript:
   ```bash
   npm run build
   ```

2. Inicie o servidor em modo de produção:
   ```bash
   npm run start
   ```

---

## 🔑 Credenciais de Demonstração

Ao iniciar a aplicação pela primeira vez, o banco de dados é automaticamente populado com dados fictícios de teste e credenciais padrão:

- **E-mail:** `admin@its.com.br`
- **Senha:** `admin123`

---

## 📦 Estrutura de Banco de Dados e Módulos

O banco de dados relacional SQLite (`data/qualidade.db`) possui a seguinte estrutura:

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
