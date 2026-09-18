import { createFileRoute } from "@tanstack/react-router";
import { SectionPage } from "@/components/section-page";

export const Route = createFileRoute("/_authenticated/logs")({
  validateSearch: (search: Record<string, unknown>) => (typeof search["q"] === "string" && search["q"] ? { q: search["q"] } : {}),
  head: () => ({ meta: [{ title: "Logs — SEVEN ROLEPLAY" }, { name: "description", content: "Auditoria operacional SEVEN ROLEPLAY." }, { property: "og:title", content: "Logs — SEVEN ROLEPLAY" }, { property: "og:description", content: "Eventos administrativos e automações." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }),
  component: LogsPage,
});

function LogsPage() {
  const search = Route.useSearch();
  return <SectionPage section="logs" initialSearch={"q" in search ? search.q : ""} />;
}
