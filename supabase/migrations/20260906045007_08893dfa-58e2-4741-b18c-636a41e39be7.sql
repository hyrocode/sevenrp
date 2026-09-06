INSERT INTO public.server_templates (key, name, purpose, title, description, color, pin_message, enabled)
VALUES (
  'sugestoes_intro',
  'Sugestões | SEVEN ROLEPLAY',
  'sugestoes',
  '💡 SUGESTÕES | SEVEN ROLEPLAY',
  E'💡 **SUGESTÕES | SEVEN ROLEPLAY**\n\nO Seven Roleplay está em desenvolvimento, e queremos construir uma comunidade que também participe dessa evolução.\n\nEste espaço é destinado às suas ideias e sugestões para o projeto. Você pode sugerir sistemas, mecânicas, veículos, empregos, organizações, economia, mapa, interface, recursos de Roleplay e muito mais.\n\nAntes de publicar, tente explicar de forma clara:\n\n• O que você está sugerindo?\n• Como funcionaria?\n• O que isso acrescentaria ao jogo?\n\nTodas as sugestões serão avaliadas pela equipe. Uma ideia enviada aqui pode, futuramente, fazer parte do Seven Roleplay. 💜\n\n*Sua ideia também pode ajudar a construir esse mundo.*',
  '#7c5cff',
  true,
  true
)
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  purpose = EXCLUDED.purpose,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  pin_message = true,
  enabled = true;