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
    <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
      <div>
        {eyebrow && (
          <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-[#A5B4FC]">
            {eyebrow}
          </p>
        )}
        <h2 className="text-xl font-bold tracking-tight text-white sm:text-2xl">
          {title}
        </h2>
        <p className="mt-1 max-w-2xl text-xs text-slate-400">
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
        "relative overflow-hidden rounded-2xl border border-white/[0.06] bg-[#121824]/90 shadow-[0_10px_30px_rgba(0,0,0,0.4)] backdrop-blur-xl",
        className
      )}
    >
      {(title || action) && (
        <div className="flex items-center justify-between gap-3 border-b border-white/[0.05] px-5 py-3.5">
          <div>
            {title && <h3 className="text-sm font-bold tracking-tight text-white">{title}</h3>}
            {description && <p className="mt-0.5 text-[11px] text-slate-400">{description}</p>}
          </div>
          {action}
        </div>
      )}
      <div className="p-5">{children}</div>
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
  const accentColor =
    tone === "success"
      ? "#10B981"
      : tone === "warning"
      ? "#F59E0B"
      : tone === "danger"
      ? "#EF4444"
      : tone === "info"
      ? "#3B82F6"
      : tone === "secondary" || tone === "purple"
      ? "#8B5CF6"
      : "#6366F1";

  return (
    <article className="metric-card group relative">
      {/* Top bar accent gradient */}
      <div
        className="absolute left-0 right-0 top-0 h-[2px] opacity-70 transition-opacity group-hover:opacity-100"
        style={{ background: `linear-gradient(90deg, ${accentColor}, transparent)` }}
      />

      <div className="mb-3 flex items-start justify-between">
        <span className="text-[10.5px] font-bold uppercase tracking-wider text-slate-400">
          {label}
        </span>
        <div
          className="flex size-9 items-center justify-center rounded-xl transition-transform group-hover:scale-105"
          style={{
            background: `${accentColor}18`,
            border: `1px solid ${accentColor}30`,
          }}
        >
          <Icon className="size-4" style={{ color: accentColor }} />
        </div>
      </div>

      <div className="mb-2 text-[26px] font-bold tracking-tight text-white leading-none">
        {value}
      </div>

      <p className="text-[11px] text-slate-400">
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

  return (
    <span className={cn("badge", toneClasses)}>
      <span
        className={cn(
          "size-1.5 rounded-full shrink-0",
          tone === "success" && "bg-emerald-400 shadow-[0_0_6px_#10B981]",
          tone === "warning" && "bg-amber-400 shadow-[0_0_6px_#F59E0B]",
          tone === "danger" && "bg-rose-400 shadow-[0_0_6px_#EF4444]",
          (tone === "primary" || tone === "secondary" || tone === "purple") && "bg-purple-400 shadow-[0_0_6px_#8B5CF6]",
          tone === "info" && "bg-blue-400 shadow-[0_0_6px_#3B82F6]",
          tone === "muted" && "bg-slate-500"
        )}
      />
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
    <div className="overflow-hidden rounded-xl border border-white/[0.05] bg-black/20">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[680px] text-left">
          <thead>
            <tr>
              {headers.map((header) => (
                <th key={header} className="table-header">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.03]">
            {children}
          </tbody>
        </table>
      </div>
    </div>
  );
}