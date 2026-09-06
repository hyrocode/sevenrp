import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  ssr: false,
  beforeLoad: () => {
    throw redirect({ to: "/dashboard" });
  },
  head: () => ({
    meta: [
      { title: "SEVEN ROLEPLAY — Painel Administrativo" },
      { name: "description", content: "Central administrativa oficial do SEVEN ROLEPLAY: moderação, tickets, economia e automações." },
      { property: "og:title", content: "SEVEN ROLEPLAY — Painel Administrativo" },
      { property: "og:description", content: "Central administrativa oficial do SEVEN ROLEPLAY." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => null,
});
