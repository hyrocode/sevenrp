# Plano — Painel administrativo SEVEN ROLEPLAY

## Objetivo
Construir um painel administrativo completo, responsivo e demonstrativo, abrindo diretamente no Dashboard, com a direção visual Midnight Neon escolhida.

## Estrutura visual
- Shell único com sidebar integrada, recolhível no desktop e em drawer no mobile.
- Header contextual com busca, notificações e identidade administrativa demonstrativa.
- Dark premium obsidiana, roxo discreto, superfícies translúcidas moderadas, bordas finas e raios contidos.
- Hierarquia densa e escaneável, com estados claros de status, alerta, sucesso e risco.

## Áreas e fluxos
1. Dashboard: KPIs, atividade semanal, saúde do bot, distribuição de membros, alertas, ações rápidas e logs recentes.
2. Servidor: visão geral, canais, cargos e automações em estado demonstrativo.
3. Moderação: ocorrências, sanções, fila de revisão e histórico.
4. Tickets: fila, prioridades, categorias, responsáveis e painel de atendimento.
5. Economia: indicadores, transações recentes e controles visuais de risco.
6. Logs: filtros, busca e tabela detalhada de eventos.
7. Comandos: catálogo, uso, status e configuração visual dos comandos.
8. Configurações: preferências gerais e toggles demonstrativos, sem conexão externa.

## Dados e interação
- Centralizar todos os dados demonstrativos em um módulo tipado, separado das páginas, pronto para futura troca por Lovable Cloud.
- Implementar navegação real entre rotas, sidebar colapsável, busca/filtros locais, tabs, seleção de períodos e feedback visual das ações.
- Não implementar autenticação, login, Discord, tokens, bot, worker ou integrações externas.

## Responsividade e validação
- Adaptar grids, tabelas, navegação e ações para desktop, tablet e mobile sem sobreposição.
- Verificar rotas, controles principais, estados vazios e layout em viewports desktop e mobile.

## Detalhes técnicos
- TanStack Router com uma rota por área e metadata exclusiva por rota.
- Componentes pequenos e reutilizáveis para shell, cards, gráficos leves, tabelas, badges e controles.
- Tailwind v4 com tokens semânticos definidos em `src/styles.css`; ícones consistentes e sem cores hardcoded nos componentes.
