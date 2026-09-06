import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, ChevronLeft, ChevronRight, Inbox, Loader2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataTable, Panel, StatusBadge } from "@/components/dashboard-ui";
import { listRecords } from "@/lib/data.functions";
import type { Json } from "@/lib/json";

export type Column = {
  key: string;
  label: string;
  render?: (row: Record<string, Json>) => React.ReactNode;
  tone?: (row: Record<string, Json>) => "success" | "warning" | "danger" | "info" | "purple" | "muted";
};

export function formatDate(value: Json | undefined) {
  if (typeof value !== "string") return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export function EmptyState({ title, description, action }: { title: string; description: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-white/[0.08] bg-black/20 px-6 py-12 text-center">
      <div className="flex size-10 items-center justify-center rounded-xl bg-white/[0.04] text-slate-400 border border-white/[0.06]">
        <Inbox className="size-5" />
      </div>
      <div>
        <p className="text-xs font-bold text-white">{title}</p>
        <p className="mt-1 text-[11px] text-slate-400 max-w-sm">{description}</p>
      </div>
      {action}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-rose-500/25 bg-rose-500/10 px-6 py-10 text-center">
      <AlertTriangle className="size-6 text-rose-400" />
      <p className="max-w-md text-xs text-rose-300">{message}</p>
      {onRetry && <Button size="sm" variant="danger" onClick={onRetry}>Tentar novamente</Button>}
    </div>
  );
}

export function LoadingRows({ columns }: { columns: number }) {
  return (
    <>
      {Array.from({ length: 5 }).map((_, rowIndex) => (
        <tr key={rowIndex} className="table-row">
          {Array.from({ length: columns }).map((__, cellIndex) => (
            <td key={cellIndex} className="px-3.5 py-3">
              <div className="h-4 w-full animate-pulse rounded bg-white/[0.04]" />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

export function useRecords(table: string, options: { page: number; search?: string; filters?: Record<string, string | number | boolean | null>; orderBy?: string; pageSize?: number }) {
  const fetchRecords = useServerFn(listRecords);
  return useQuery({
    queryKey: ["records", table, options],
    queryFn: () =>
      fetchRecords({
        data: {
          table,
          page: options.page,
          pageSize: options.pageSize ?? 10,
          ...(options.search ? { search: options.search } : {}),
          ...(options.filters ? { filters: options.filters } : {}),
          ...(options.orderBy ? { orderBy: options.orderBy } : {}),
        },
      }),
    placeholderData: (previous) => previous,
  });
}

export function RecordPanel({
  table,
  title,
  description,
  columns,
  emptyTitle,
  emptyDescription,
  emptyAction,
  filters,
  orderBy,
  toolbar,
  initialSearch = "",
}: {
  table: string;
  title: string;
  description?: string;
  columns: Column[];
  emptyTitle: string;
  emptyDescription: string;
  emptyAction?: React.ReactNode;
  filters?: Record<string, string | number | boolean | null>;
  orderBy?: string;
  toolbar?: React.ReactNode;
  initialSearch?: string;
}) {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState(initialSearch);
  const query = useRecords(table, { page, search, ...(filters ? { filters } : {}), ...(orderBy ? { orderBy } : {}) });
  const rows = query.data?.rows ?? [];
  const total = query.data?.count ?? 0;
  const pageSize = query.data?.pageSize ?? 10;
  const pages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <Panel
      title={title}
      {...(description ? { description } : {})}
      {...(toolbar ? { action: toolbar } : {})}
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-56 flex-1 max-w-sm items-center gap-2 rounded-xl border border-white/[0.08] bg-[#060911]/70 px-3 py-1.5">
          <Search className="size-3.5 text-slate-400" />
          <input
            value={search}
            onChange={(event) => { setSearch(event.target.value); setPage(1); }}
            placeholder="Filtrar registros..."
            className="w-full bg-transparent text-xs text-white outline-none placeholder:text-slate-500"
          />
        </div>
        <span className="text-[11px] font-medium text-slate-400">
          {query.isFetching ? <Loader2 className="size-3.5 animate-spin text-indigo-400" /> : `${total} registro(s)`}
        </span>
      </div>

      {query.isError ? (
        <ErrorState message={query.error instanceof Error ? query.error.message : "Falha ao carregar os dados."} onRetry={() => void query.refetch()} />
      ) : !query.isLoading && rows.length === 0 ? (
        <EmptyState title={emptyTitle} description={emptyDescription} {...(emptyAction ? { action: emptyAction } : {})} />
      ) : (
        <>
          <DataTable headers={columns.map((column) => column.label)}>
            {query.isLoading ? (
              <LoadingRows columns={columns.length} />
            ) : (
              rows.map((row, index) => (
                <tr key={String(row["id"] ?? index)} className="table-row">
                  {columns.map((column) => (
                    <td key={column.key} className="px-3.5 py-3 text-xs text-slate-300">
                      {column.render
                        ? column.render(row)
                        : column.tone
                          ? <StatusBadge tone={column.tone(row)}>{String(row[column.key] ?? "—")}</StatusBadge>
                          : String(row[column.key] ?? "—")}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </DataTable>
          {pages > 1 && (
            <div className="mt-4 flex items-center justify-between border-t border-white/[0.05] pt-3">
              <span className="text-[11px] text-slate-400 font-medium">Página {page} de {pages}</span>
              <div className="flex gap-2">
                <Button size="sm" variant="ghost" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>
                  <ChevronLeft className="size-3.5" />Anterior
                </Button>
                <Button size="sm" variant="ghost" disabled={page >= pages} onClick={() => setPage((value) => value + 1)}>
                  Próxima<ChevronRight className="size-3.5" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </Panel>
  );
}
