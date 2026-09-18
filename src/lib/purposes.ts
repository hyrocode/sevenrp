// Finalidades de canal configuráveis por ID real do Discord (client-safe).
export const CHANNEL_PURPOSES = [
  { key: "regras", label: "Regras", hint: "Texto" },
  { key: "boas_vindas", label: "Boas-vindas", hint: "Texto" },
  { key: "avisos", label: "Avisos", hint: "Texto/Anúncios" },
  { key: "suporte", label: "Suporte", hint: "Texto" },
  { key: "sugestoes", label: "Sugestões", hint: "Fórum (post inicial fixado)" },
  { key: "logs", label: "Logs", hint: "Texto" },
] as const;

export type ChannelPurpose = (typeof CHANNEL_PURPOSES)[number]["key"];
