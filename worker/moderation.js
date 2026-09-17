import { PermissionFlagsBits } from "discord.js";

const URL_PATTERN = /(?:https?:\/\/|www\.)[^\s<>()]+/giu;
const DOMAIN_PATTERN = /\b(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}(?:\/[^\s<>()]*)?/giu;
const ZERO_WIDTH_PATTERN = `[\\u200B-\\u200D\\uFEFF]`;
const TRAILING_PUNCTUATION_PATTERN = /[\]})>,.!?:;'"“”’]+$/u;

export const LINK_WARNING_TEXT = "Por gentileza, é proibido o compartilhamento de links aqui.";

function normalizeText(content) {
  return String(content || "").replace(new RegExp(ZERO_WIDTH_PATTERN, "gu"), "");
}

function trimCandidate(candidate) {
  return String(candidate || "")
    .trim()
    .replace(/^[<([{“”'"`]+/u, "")
    .replace(TRAILING_PUNCTUATION_PATTERN, "");
}

function parseCandidate(candidate) {
  const raw = trimCandidate(candidate);
  if (!raw) return null;

  const value = /^[a-z][a-z\d+.-]*:\/\//iu.test(raw) ? raw : `https://${raw}`;
  try {
    const parsed = new URL(value);
    const host = parsed.hostname.toLowerCase();
    if (!host || !host.includes(".")) return null;

    const isDiscordInvite =
      ((host === "discord.gg" || host === "discord.me") && /^\/[a-z0-9-]+/iu.test(parsed.pathname)) ||
      ((host === "discordapp.com" || host === "discord.com") && /^\/invite\/[a-z0-9-]+/iu.test(parsed.pathname));

    return {
      host,
      kind: isDiscordInvite ? "discord_invite" : "external_url",
    };
  } catch {
    return null;
  }
}

/** Detecta links comuns, convites Discord e links mascarados em Markdown. */
export function detectExternalLink(content) {
  const normalized = normalizeText(content);
  if (!normalized) return null;

  const candidates = [
    ...(normalized.match(URL_PATTERN) || []),
    ...(normalized.match(DOMAIN_PATTERN) || []),
  ];
  const seen = new Set();

  for (const candidate of candidates) {
    const parsed = parseCandidate(candidate);
    if (!parsed) continue;
    const key = `${parsed.kind}:${parsed.host}`;
    if (seen.has(key)) continue;
    seen.add(key);
    return parsed;
  }

  return null;
}

/** Moderadores e administradores podem compartilhar links sem o filtro interromper o trabalho deles. */
export function isModerationExempt(member) {
  const permissions = member?.permissions;
  return Boolean(
    permissions?.has?.(PermissionFlagsBits.Administrator) ||
    permissions?.has?.(PermissionFlagsBits.ManageMessages),
  );
}

export function buildLinkWarning(userId) {
  return `<@${userId}> ${LINK_WARNING_TEXT}`;
}
