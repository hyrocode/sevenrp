import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Json } from "./json";
import { READABLE_TABLES, SEARCH_FIELDS, WRITABLE_TABLES } from "./tables";

type ListInput = {
  table: string;
  page?: number;
  pageSize?: number;
  search?: string;
  orderBy?: string;
  ascending?: boolean;
  filters?: Record<string, string | number | boolean | null>;
};

function assertReadable(table: string) {
  if (!(READABLE_TABLES as readonly string[]).includes(table)) throw new Error(`Tabela não permitida: ${table}`);
}
function assertWritable(table: string) {
  if (!(WRITABLE_TABLES as readonly string[]).includes(table)) throw new Error(`Tabela não gravável: ${table}`);
}

export const listRecords = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: ListInput) => input)
  .handler(async ({ data, context }) => {
    assertReadable(data.table);
    const page = Math.max(1, data.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, data.pageSize ?? 20));
    const from = (page - 1) * pageSize;

    let query = context.supabase
      .from(data.table as never)
      .select("*", { count: "exact" })
      .range(from, from + pageSize - 1);

    const order = data.orderBy ?? "created_at";
    query = query.order(order, { ascending: data.ascending ?? false });

    for (const [key, value] of Object.entries(data.filters ?? {})) {
      if (value === null || value === "" || value === undefined) continue;
      query = query.eq(key, value as never);
    }

    const term = (data.search ?? "").trim();
    const fields = SEARCH_FIELDS[data.table] ?? [];
    if (term && fields.length) {
      query = query.or(fields.map((field) => `${field}.ilike.%${term}%`).join(","));
    }

    const { data: rows, error, count } = await query;
    if (error) throw new Error(error.message);
    return { rows: (rows ?? []) as Array<Record<string, Json>>, count: count ?? 0, page, pageSize };
  });

export const countRecords = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { table: string; filters?: Record<string, string | number | boolean> }) => input)
  .handler(async ({ data, context }) => {
    assertReadable(data.table);
    let query = context.supabase.from(data.table as never).select("id", { count: "exact", head: true });
    for (const [key, value] of Object.entries(data.filters ?? {})) query = query.eq(key, value as never);
    const { count, error } = await query;
    if (error) throw new Error(error.message);
    return { count: count ?? 0 };
  });

export const saveRecord = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { table: string; id?: string | null; values: Record<string, Json> }) => input)
  .handler(async ({ data, context }) => {
    assertWritable(data.table);
    const { writeAudit } = await import("./audit.server");

    let result;
    if (data.id) {
      result = await context.supabase
        .from(data.table as never)
        .update(data.values as never)
        .eq("id", data.id)
        .select()
        .maybeSingle();
    } else {
      result = await context.supabase
        .from(data.table as never)
        .insert(data.values as never)
        .select()
        .maybeSingle();
    }
    if (result.error) throw new Error(result.error.message);

    const row = result.data as Record<string, Json> | null;
    await writeAudit({
      actorId: context.userId,
      actorLabel: (context.claims["email"] as string) ?? "Administrador",
      action: data.id ? "update" : "create",
      entity: data.table,
      entityId: (row?.["id"] as string) ?? data.id ?? null,
      targetLabel: (row?.["name"] ?? row?.["title"] ?? row?.["reference"] ?? row?.["term"] ?? null) as string | null,
      metadata: { fields: Object.keys(data.values) },
    });
    return { record: row };
  });

export const deleteRecord = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { table: string; id: string; label?: string }) => input)
  .handler(async ({ data, context }) => {
    assertWritable(data.table);
    const { writeAudit } = await import("./audit.server");
    const { error } = await context.supabase.from(data.table as never).delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    await writeAudit({
      actorId: context.userId,
      actorLabel: (context.claims["email"] as string) ?? "Administrador",
      action: "delete",
      entity: data.table,
      entityId: data.id,
      targetLabel: data.label ?? null,
      status: "warning",
    });
    return { ok: true };
  });

export const getSession = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const [{ data: profile }, { data: roles }] = await Promise.all([
      context.supabase.from("profiles").select("*").eq("id", context.userId).maybeSingle(),
      context.supabase.from("user_roles").select("role").eq("user_id", context.userId),
    ]);
    return {
      userId: context.userId,
      email: (context.claims["email"] as string) ?? null,
      profile,
      roles: (roles ?? []).map((r) => r.role as string),
    };
  });
