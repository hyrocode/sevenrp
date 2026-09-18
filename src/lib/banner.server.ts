// Server-only: monta o "banner" de boas-vindas como embed rico do Discord.
// Nota de runtime: o backend serverless deste stack não permite rasterizar SVG->PNG
// (binários WebAssembly não podem ir no bundle do servidor), então o banner é
// composto com os recursos nativos do Discord: imagem enviada como anexo real
// (ou URL) + avatar + textos.

export type BannerOptions = {
  title: string;
  subtitle: string;
  username: string;
  accent: string;
  avatarUrl?: string | null;
  backgroundUrl?: string | null;
  memberNumber?: number | null;
};

export function buildWelcomeEmbed(options: BannerOptions) {
  const accent = /^#[0-9a-fA-F]{6}$/.test(options.accent) ? options.accent : "#7c5cff";
  const color = Number.parseInt(accent.replace("#", ""), 16);
  return {
    title: options.title,
    description: `**${options.username}**\n${options.subtitle}`,
    color: Number.isNaN(color) ? 8149247 : color,
    ...(options.avatarUrl ? { thumbnail: { url: options.avatarUrl } } : {}),
    ...(options.backgroundUrl ? { image: { url: options.backgroundUrl } } : {}),
    ...(options.memberNumber ? { footer: { text: `Membro nº ${options.memberNumber}` } } : {}),
  };
}
