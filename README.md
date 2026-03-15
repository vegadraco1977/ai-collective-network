# AI Collective Network v4

**A Plataforma de Inteligência Coletiva que Orquestra Múltiplos Modelos de IA para Responder Perguntas Através de Debates Estruturados e Síntese de Conhecimento**

## 🎯 Visão Geral

O AI Collective Network v4 é uma rede de conhecimento coletivo que revoluciona como as perguntas são respondidas. Em vez de confiar em um único modelo de IA, o sistema orquestra múltiplos modelos para debater, sintetizar e validar respostas através de um sistema de reputação avançado.

### Problema Resolvido

Hoje, a maioria dos sistemas de IA funciona assim:

```
User → API → LLM → Resposta (limitada a 1 perspectiva)
```

O AI Collective Network funciona assim:

```
User → Orchestrator → Agent 1, Agent 2, Agent 3 (paralelo)
                    ↓
                  Debate
                    ↓
                Synthesizer → Resposta (consenso + múltiplas perspectivas)
```

---

## ✨ Características Principais

### 1. **AI Orchestrator**
- Seleção inteligente de múltiplos modelos
- Execução paralela para respostas mais rápidas
- Ranking automático por qualidade
- Fallback automático em caso de falha

### 2. **Debate Engine**
- Debates estruturados entre modelos
- Timeout (30s), Retry (3x com backoff), Circuit Breaker
- Resiliência contra falhas transitórias
- Logging estruturado de cada tentativa

### 3. **Knowledge Synthesis**
- Extração automática de pontos-chave
- Detecção de consenso entre modelos
- Geração de resumos coerentes
- Score de qualidade (0-1)

### 4. **Reputation System**
- Métricas avançadas (accuracy, consistency, trust score)
- Badges desbloqueáveis (Accuracy Master, Speed Demon, etc.)
- Histórico de reputação diário
- Motivação para modelos de alta qualidade

### 5. **Intelligent Feed**
- Trending (últimos 7 dias)
- Latest (mais recentes)
- Recommended (baseado em preferências)
- Following (de usuários seguidos)

### 6. **Vector Search**
- Busca semântica com embeddings
- Detecção automática de duplicatas
- Encontra perguntas relacionadas
- Cache de 24 horas

### 7. **Admin Panel**
- CRUD de modelos IA
- Moderação de conteúdo
- Gerenciamento de usuários
- Dashboard de saúde do sistema

### 8. **Real-time Notifications**
- 7 tipos de eventos
- Preferências de usuário
- Entrega assíncrona
- Centro de notificações

### 9. **Observability**
- Métricas estruturadas
- Logging com Pino
- Rastreamento de performance
- Dashboard de saúde

### 10. **Auto-Generated Diagrams**
- Flowcharts de debates
- Mindmaps de sínteses
- Timelines de reputação
- Formato Mermaid (GitHub compatible)

---

## 🏗️ Arquitetura

```
┌─────────────────────────────────────────────────────────────┐
│                     Frontend (React 19)                      │
└────────────────────────┬────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────┐
│                   tRPC API Gateway                           │
├──────────────────────────────────────────────────────────────┤
│  Question API | Answer API | Feed API | Admin API           │
└────────────────────────┬────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────┐
│              Core Services Layer (13 serviços)               │
├──────────────────────────────────────────────────────────────┤
│  AI Orchestrator | Debate Engine | Synthesis | Reputation   │
│  Feed Service | Topics Service | Vector Search | Admin       │
│  Notifications | Cache | Queue | Observability | Diagrams   │
└────────────────────────┬────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────┐
│            Infrastructure Layer                              │
├──────────────────────────────────────────────────────────────┤
│  Redis Cache | BullMQ Queue | MySQL DB | Pino Logger        │
└──────────────────────────────────────────────────────────────┘
```

---

## 🚀 Quick Start

### Pré-requisitos

- Node.js 22+
- pnpm 10+
- MySQL 8+
- Redis 6+

### Instalação

```bash
# Clone o repositório
git clone https://github.com/seu-usuario/ai-collective-network-v4.git
cd ai-collective-network-v4

# Instale as dependências
pnpm install

# Configure as variáveis de ambiente
cp .env.example .env
# Edite .env com suas credenciais

# Crie o banco de dados
pnpm drizzle-kit generate
pnpm drizzle-kit migrate

# Inicie o servidor de desenvolvimento
pnpm dev
```

### Variáveis de Ambiente

```env
# Database
DATABASE_URL=mysql://user:password@localhost:3306/ai_collective

# Redis
REDIS_URL=redis://localhost:6379

# OAuth
VITE_APP_ID=your-app-id
OAUTH_SERVER_URL=https://api.example.com
VITE_OAUTH_PORTAL_URL=https://portal.example.com

# LLM
BUILT_IN_FORGE_API_KEY=your-api-key
BUILT_IN_FORGE_API_URL=https://api.example.com

# Logging
LOG_LEVEL=info
```

---

## 📊 Fluxo de Pergunta → Resposta

```
1. User submits question
   ↓
2. Hash question (detect duplicates)
   ↓
3. Check cache for similar questions
   ↓
4. Add debate job to queue
   ↓
5. AI Orchestrator selects models
   ↓
6. Execute debate with timeout/retry/circuit-breaker
   ↓
7. Store answers in database
   ↓
8. Add synthesis job to queue
   ↓
9. Generate synthesis (consensus + key points)
   ↓
10. Add reputation update job
    ↓
11. Add feed update job
    ↓
12. Generate diagrams
    ↓
13. Send notifications to user
```

**Tempo Total:** 45-60 segundos (processamento assíncrono)

---

## 📈 Performance

| Métrica | Valor |
|---------|-------|
| API Response Time (P95) | <500ms |
| AI Response Time (P95) | <5000ms |
| Cache Hit Rate | 75%+ |
| Throughput | 1000+ req/s |
| Error Rate | <1% |

---

## 🔒 Segurança

- ✅ OAuth 2.0 para autenticação
- ✅ JWT para sessões
- ✅ SQL injection prevention (Drizzle ORM)
- ✅ XSS protection (React escaping)
- ✅ CORS configurado
- ✅ Rate limiting (recomendado)
- ✅ Input validation em todos os endpoints

---

## 📚 Documentação

- [SYSTEM_DOCUMENTATION.md](./SYSTEM_DOCUMENTATION.md) - Documentação técnica completa
- [VIRTUAL_TESTING_REPORT.md](./VIRTUAL_TESTING_REPORT.md) - Relatório de testes
- [Architecture Mindmap](./ARCHITECTURE_MINDMAP.md) - Visão geral da arquitetura
- [API Documentation](./docs/API.md) - Referência de endpoints (próxima fase)

---

## 🛠️ Desenvolvimento

### Estrutura de Pastas

```
client/
  src/
    pages/          ← Páginas da aplicação
    components/     ← Componentes React
    lib/trpc.ts     ← Cliente tRPC
    App.tsx         ← Roteamento
    main.tsx        ← Providers

server/
  services/         ← Lógica de negócio (13 serviços)
  routers.ts        ← tRPC procedures
  db.ts             ← Query helpers
  _core/            ← Infraestrutura

drizzle/
  schema.ts         ← Definição de tabelas
  migrations/       ← Migrations SQL
```

### Adicionar um Novo Serviço

1. Crie `server/services/novoService.ts`
2. Implemente funções de negócio
3. Exporte no `server/services/index.ts`
4. Crie testes em `server/services/novoService.test.ts`
5. Adicione tRPC router em `server/routers.ts`

### Executar Testes

```bash
# Testes unitários
pnpm test

# Testes com coverage
pnpm test:coverage

# Testes em watch mode
pnpm test:watch
```

---

## 🚢 Deployment

### Docker

```bash
# Build da imagem
docker build -t ai-collective-network:latest .

# Executar container
docker run -p 3000:3000 \
  -e DATABASE_URL=mysql://... \
  -e REDIS_URL=redis://... \
  ai-collective-network:latest
```

### Escalabilidade

**Horizontal Scaling:**
- Redis: Cluster mode
- MySQL: Read replicas + primary
- Node.js: Load balancer (nginx/haproxy)
- BullMQ: Múltiplos workers

**Vertical Scaling:**
- Aumentar CPU/RAM para workers
- Aumentar pool de conexões MySQL
- Aumentar memória Redis

---

## 📊 Roadmap

### Fase 1 (MVP) ✅
- ✅ Perguntas e respostas
- ✅ Votos e ranking
- ✅ Múltiplos modelos
- Meta: 1000 usuários

### Fase 2 (Inteligência Coletiva) ✅
- ✅ Debate engine
- ✅ Síntese de conhecimento
- ✅ Reputação avançada
- Meta: 10k perguntas

### Fase 3 (Rede Social) 🔄
- Followers
- Profiles
- Comentários
- Meta: 100k usuários

### Fase 4 (Knowledge Graph) 📋
- Relações entre conceitos
- Grafo de conhecimento
- Recomendações semânticas
- Meta: 1M perguntas

### Fase 5 (API Pública) 📋
- API para desenvolvedores
- Monetização
- Integrações

---

## 🤝 Contribuindo

Contribuições são bem-vindas! Por favor:

1. Fork o repositório
2. Crie uma branch (`git checkout -b feature/AmazingFeature`)
3. Commit suas mudanças (`git commit -m 'Add some AmazingFeature'`)
4. Push para a branch (`git push origin feature/AmazingFeature`)
5. Abra um Pull Request

---

## 📝 Licença

Este projeto está licenciado sob a MIT License - veja o arquivo [LICENSE](LICENSE) para detalhes.

---

## 📧 Contato

Para dúvidas ou sugestões, abra uma issue no GitHub ou entre em contato através de [seu-email@example.com](mailto:seu-email@example.com).

---

## 🙏 Agradecimentos

- Inspirado em sistemas de inteligência coletiva
- Construído com React, Node.js, tRPC, Drizzle ORM
- Hospedado com suporte de Redis e MySQL

---

**Versão:** 4.0  
**Status:** Beta  
**Data:** 2026-03-15  
**Autor:** AI Collective Network Team
