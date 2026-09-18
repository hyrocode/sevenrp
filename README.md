# Welcome to your Lovable project

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Open your project in the [Lovable editor](https://lovable.dev) and keep building.

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: connect the project to GitHub and every change made in Lovable is committed straight to your repository.
- **Full ownership**: this code is yours. Push to your repository and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

## Built with

- TanStack Start
- TypeScript
- React
- Tailwind CSS

## Integração Discord e limitação de gateway

Este backend roda em ambiente **serverless** (execução por requisição, sem processo residente).
Por isso **não é possível manter uma conexão Discord Gateway persistente 24/7 aqui**. O painel nunca
exibe "bot online" sem prova: enquanto nenhum worker externo enviar heartbeat, o estado mostrado é
"Bot offline" / "Worker não conectado".

### O que funciona de verdade neste ambiente
- Teste real do token do bot (`DISCORD_BOT_TOKEN`, segredo apenas do backend — nunca exposto ao cliente).
- Sincronização real de guild, canais, cargos e membros pela API REST oficial.
- Geração da URL OAuth2 oficial com permissões mínimas selecionáveis.
- Registro de slash commands via REST + endpoint de interações com verificação de assinatura Ed25519.
- Publicação de embeds, punições via REST, auditoria completa e fila de ações.

### Contrato do worker persistente externo
Um processo Node/Bun com `discord.js` (VPS, container ou máquina própria) conecta ao gateway e fala com
estas rotas usando o cabeçalho `Authorization: Bearer $WORKER_SHARED_SECRET`:

| Rota | Método | Função |
| --- | --- | --- |
| `/api/public/worker/heartbeat` | POST | Informa que o worker está vivo (latência, shards, versão). |
| `/api/public/worker/events` | POST | Envia eventos do gateway (mensagens, entradas, NSFW, raid). |
| `/api/public/worker/actions` | GET/POST | Busca ações pendentes e reporta o resultado da execução. |

Segredos necessários no backend: `DISCORD_BOT_TOKEN`, `DISCORD_PUBLIC_KEY` (interações) e
`WORKER_SHARED_SECRET` (worker externo).


## Inicialização do servidor (canais, templates, boas-vindas)

- `/inicializacao` mapeia finalidades (regras, boas-vindas, avisos, suporte, sugestões, logs) para **IDs reais** de canais já existentes. Nenhum canal é criado automaticamente.
- Ao salvar um canal, o backend valida de verdade as permissões do bot (roles + overwrites) e avisa o que falta.
- Templates institucionais são publicados via REST e guardam `message_id`: republicar **edita a mesma mensagem** (sem duplicar) e refixa quando configurado. Se a mensagem foi apagada no Discord, o sistema republica.
- Boas-vindas geram um banner composto como **embed nativo do Discord** (imagem de fundo, avatar, título/subtítulo, cor de destaque e número de membro). O runtime serverless deste stack não permite rasterizar imagem (SVG → PNG) no servidor, por isso não há anexo PNG — o banner é renderizado pelo próprio Discord. O disparo automático por novo membro depende do worker externo enviando `{"type":"member_join", guildId, authorId, authorLabel, avatarUrl, memberNumber}` para `/api/public/worker/events`. Sem gateway persistente o painel não simula bot online.
- Botão “Enviar teste real” dispara uma boas-vindas verificável no Discord usando a configuração salva.
