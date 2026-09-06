// Server-only helper: registra auditoria com service role (a tabela é imutável pelo painel).
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type AuditInput = {
  actorId?: string | null;
  actorLabel?: string;
  action: string;
  entity: string;
  entityId?: string | null;
  targetLabel?: string | null;
  status?: "success" | "warning" | "error";
  metadata?: Record<string, unknown>;
};

export async function writeAudit(input: AuditInput) {
  const { error } = await supabaseAdmin.from("audit_logs").insert({
    actor_id: input.actorId ?? null,
    actor_label: input.actorLabel ?? "Sistema",
    action: input.action,
    entity: input.entity,
    entity_id: input.entityId ?? null,
    target_label: input.targetLabel ?? null,
    status: input.status ?? "success",
    metadata: (input.metadata ?? {}) as never,
  });
  if (error) console.error("[audit]", error.message);
}
