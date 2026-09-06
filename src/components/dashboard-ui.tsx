import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function PageHeader({ eyebrow, title, description, actions }: { eyebrow?: string; title: string; description: string; actions?: React.ReactNode }) {
  return <div className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div>{eyebrow && <p className="mb-2 text-xs font-semibold uppercase text-primary">{eyebrow}</p>}<h2 className="text-2xl font-semibold sm:text-3xl">{title}</h2><p className="mt-1 max-w-2xl text-sm text-muted-foreground">{description}</p></div>{actions && <div className="flex flex-wrap gap-2">{actions}</div>}</div>;
}

export function Panel({ title, description, action, className, children }: { title?: string; description?: string; action?: React.ReactNode; className?: string; children: React.ReactNode }) {
  return <section className={cn("overflow-hidden rounded-lg border border-border bg-card/70 shadow-panel backdrop-blur-md", className)}>{(title || action) && <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4"><div>{title && <h3 className="font-semibold">{title}</h3>}{description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}</div>{action}</div>}<div className="p-5">{children}</div></section>;
}

export function StatCard({ label, value, detail, icon: Icon, tone = "primary" }: { label: string; value: string; detail: string; icon: LucideIcon; tone?: "primary" | "success" | "warning" | "info" }) {
  return <article className="rounded-lg border border-border bg-card/60 p-5 shadow-panel backdrop-blur-md"><div className="flex items-start justify-between"><div><p className="text-sm text-muted-foreground">{label}</p><p className="mt-2 text-3xl font-semibold">{value}</p></div><div className={cn("flex size-10 items-center justify-center rounded-md", tone === "primary" && "bg-primary/12 text-primary", tone === "success" && "bg-success/12 text-success", tone === "warning" && "bg-warning/12 text-warning", tone === "info" && "bg-info/12 text-info")}><Icon className="size-5" /></div></div><p className="mt-3 text-xs text-muted-foreground">{detail}</p></article>;
}

export function StatusBadge({ children, tone = "muted" }: { children: React.ReactNode; tone?: "primary" | "success" | "warning" | "danger" | "info" | "muted" }) {
  return <span className={cn("inline-flex whitespace-nowrap rounded px-2 py-1 text-[10px] font-semibold uppercase", tone === "primary" && "bg-primary/12 text-primary", tone === "success" && "bg-success/12 text-success", tone === "warning" && "bg-warning/12 text-warning", tone === "danger" && "bg-destructive/12 text-destructive", tone === "info" && "bg-info/12 text-info", tone === "muted" && "bg-muted text-muted-foreground")}>{children}</span>;
}

export function DataTable({ headers, children }: { headers: string[]; children: React.ReactNode }) {
  return <div className="overflow-x-auto"><table className="w-full min-w-[680px] text-left"><thead><tr className="border-b border-border">{headers.map((header) => <th key={header} className="px-3 py-3 text-[11px] font-semibold uppercase text-muted-foreground">{header}</th>)}</tr></thead><tbody>{children}</tbody></table></div>;
}