import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col justify-between gap-3 border-b border-white/[0.06] pb-4 sm:flex-row sm:items-end">
      <div>
        {eyebrow && (
          <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
            {eyebrow}
          </p>
        )}
        <h2 className="text-lg font-semibold tracking-tight text-zinc-100">
          {title}
        </h2>
        <p className="mt-0.5 text-xs text-zinc-400 max-w-2xl">
          {description}
        </p>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Panel({
  title,
  description,
  action,
  className,
  children,
}: {
  title?: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className={cn(
        "overflow-hidden rounded-xl border border-white/[0.08] bg-[#11141D]",
        className
      )}
    >
      {(title || action) && (
        <div className="flex items-center justify-between gap-3 border-b border-white/[0.06] px-4 py-3">
          <div>
            {title && <h3 className="text-xs font-semibold text-zinc-200">{title}</h3>}
            {description && <p className="mt-0.5 text-[11px] text-zinc-400">{description}</p>}
          </div>
          {action}
        </div>
      )}
      <div className="p-4">{children}</div>
    </section>
  );
}

export function StatCard({
  label,
  value,
  detail,
  icon: Icon,
  tone = "primary",
}: {
  label: string;
  value: string;
  detail: string;
  icon: LucideIcon;
  tone?: "primary" | "secondary" | "purple" | "success" | "warning" | "danger" | "info";
}) {
  return (
    <article className="group rounded-xl border border-white/[0.08] bg-[#11141D] p-4 transition-colors hover:border-white/[0.14]">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-medium text-zinc-400">
          {label}
        </span>
        <div className="flex size-7 items-center justify-center rounded-md border border-white/[0.06] bg-white/[0.03] text-zinc-400">
          <Icon className="size-3.5" />
        </div>
      </div>

      <div className="mt-2 text-2xl font-semibold tracking-tight text-zinc-100">
        {value}
      </div>

      <p className="mt-1 text-[11px] text-zinc-500 truncate">
        {detail}
      </p>
    </article>
  );
}

export function StatusBadge({
  children,
  tone = "muted",
}: {
  children: React.ReactNode;
  tone?: "primary" | "secondary" | "purple" | "success" | "warning" | "danger" | "info" | "muted";
}) {
  const toneClasses = {
    primary: "badge-purple",
    secondary: "badge-purple",
    purple: "badge-purple",
    success: "badge-success",
    warning: "badge-warning",
    danger: "badge-danger",
    info: "badge-info",
    muted: "badge-muted",
  }[tone] || "badge-muted";

  const dotClasses = {
    success: "bg-emerald-400",
    warning: "bg-amber-400",
    danger: "bg-rose-400",
    primary: "bg-purple-400",
    secondary: "bg-purple-400",
    purple: "bg-purple-400",
    info: "bg-sky-400",
    muted: "bg-zinc-500",
  }[tone] || "bg-zinc-500";

  return (
    <span className={cn("badge", toneClasses)}>
      <span className={cn("size-1.5 rounded-full shrink-0", dotClasses)} />
      {children}
    </span>
  );
}

export function DataTable({
  headers,
  children,
}: {
  headers: string[];
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-x-auto rounded-lg border border-white/[0.07]">
      <table className="w-full text-left text-xs border-collapse">
        <thead>
          <tr>
            {headers.map((header) => (
              <th key={header} className="table-header">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-white/[0.04] bg-[#0E1118]">
          {children}
        </tbody>
      </table>
    </div>
  );
}