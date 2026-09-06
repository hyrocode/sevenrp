# Etapa 2 — Do painel visual ao sistema real

Sem redesenho: sidebar, header, grids, espaçamentos, tipografia, dark/roxo/glass, densidade e responsividade permanecem exatamente como aprovados. Só a origem dos dados e o comportamento mudam.

## Validação de infraestrutura (feita antes de qualquer status)

O backend deste projeto roda em ambiente serverless (execução por requisição, sem processo residente). Isso significa, de forma objetiva:

- **Não é possível manter uma conexão Discord Gateway persistente 24/7 aqui.** Não haverá simulação de worker, heartbeat, uptime ou "bot online".
- **É possível, e será implementado:** toda a camada REST oficial do Discord (validar token, ler guild, canais, cargos, membros, registrar slash commands, enviar embeds/mensagens, aplicar punições) mais webhooks/interactions HTTP.
- **Slash commands funcionam sem gateway** via Interactions Endpoint (verificação de assinatura Ed25519), então serão implementados de verdade.
- Eventos que exigem gateway (mensagens em tempo real → anti-spam, bloqueio de termos, NSFW, anti-raid) ficam com **regras, fila e persistência prontas no backend**, expostas por uma API contratada para um **worker externo persistente** que o usuário poderá conectar depois com um segredo compartilhado. Enquanto nenhum worker enviar heartbeat, o produto mostra "Bot offline" / "Worker não conectado" — nunca "online".

Sem Vercel e sem infraestrutura externa desnecessária.

## Autenticação (necessária agora)

Roles, permissões, auditoria e RLS exigem identidade. Será adicionado login (e-mail/senha + Google) com tabela separada `user_roles` (owner/admin/moderador/suporte/viewer) e função `has_role`. O Dashboard continua sendo a tela inicial para quem já está autenticado.

## Banco de dados (relacional e indexado)

Tabelas com RLS, GRANTs, timestamps e índices: `profiles`, `user_roles`, `guild_config`, `channels`, `roles`, `members`, `tickets` + `ticket_messages`, `moderation_cases`, `punishments`, `suggestions` + `suggestion_votes`, `blocked_terms` (com allowlist/contexto para reduzir falso positivo), `spam_rules`, `nsfw_reviews` (fila por metadados, sem armazenar mídia), `raid_rules` + `raid_events`, `embeds`, `welcome_config`, `economy_transactions`, `commands`, `audit_logs`, `worker_heartbeats`.
Storage: bucket para banners/artes de boas-vindas com políticas de acesso.

## Backend (server functions + rotas HTTP)

- Sync real de guild/canais/cargos/membros pela API do Discord.
- Teste real do token (chamada autenticada ao Discord, retorna nome/ID do bot) — token vive só como secret do backend, nunca é lido, exibido, logado ou devolvido ao cliente.
- Geração da URL OAuth2 oficial com permissões mínimas por escopo escolhido no wizard.
- CRUD de embeds, boas-vindas, termos bloqueados, anti-spam, anti-raid, sugestões, tickets, punições.
- Auditoria automática de toda ação administrativa.
- Endpoints `/api/public/*` para interactions do Discord (assinatura verificada) e para o worker externo (segredo compartilhado, heartbeat, ingestão de eventos, entrega de ações pendentes).

## Frontend (mesma pele, comportamento real)

- Remoção completa de `src/data/demo.ts` e de qualquer mock.
- Cada página passa a usar TanStack Query com loading (skeletons no mesmo formato dos cards), erro e vazio explícito: "Sem dados", "Não conectado", "Configuração necessária", "Bot offline".
- Auditoria de cada botão, toggle, filtro e formulário existente: tudo passa a persistir, com toasts e modais de confirmação para ações destrutivas. Nenhum controle morto.
- Paginação real nas tabelas, filtros e busca no servidor, realtime nos logs e tickets.
- Configurações ganha o wizard Discord em etapas (token → teste → seleção de guild → sync → permissões/OAuth → slash commands) e um cartão honesto de status do worker persistente.

## Documentação

`README.md` e um aviso dentro do produto descrevem a limitação do gateway e o contrato para plugar o worker persistente externo depois.

## Ordem de execução

1. Auth + schema/RLS/storage 2. Camada Discord REST + secrets + wizard 3. Migração de cada página para dados reais 4. Moderação/automação + fila + auditoria 5. Interactions/slash + contrato do worker 6. Testes dos fluxos possíveis (desktop e mobile).
