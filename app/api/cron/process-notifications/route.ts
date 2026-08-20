import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import type { Charge, Customer, NotificationTriggerType } from "@/types";

// Lazy initialization para evitar erro durante build
let supabaseAdminInstance: ReturnType<typeof createClient> | null = null;

function getSupabaseAdmin() {
  if (!supabaseAdminInstance) {
    const url = "https://ldjvjhlwmbsbvntppzil.supabase.co";
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      throw new Error("Supabase URL and Service Role Key are required");
    }
    supabaseAdminInstance = createClient(url, key, {
      auth: { persistSession: false }
    });
  }
  return supabaseAdminInstance;
}

// Templates de mensagem
const templates: Record<NotificationTriggerType, string> = {
  BEFORE_2_DAYS:
    "Olá {NOME_CLIENTE}, tudo bem? Passando para lembrar que sua fatura no valor de R$ {VALOR} vence em 2 dias ({DATA_VENCIMENTO}). Você pode efetuar o pagamento diretamente pelo link: {LINK_PAGAMENTO}. Dúvidas, estou à disposição!",
  ON_DUE_DATE:
    "Olá {NOME_CLIENTE}, tudo bem? Passando para lembrar que sua fatura no valor de R$ {VALOR} vence hoje ({DATA_VENCIMENTO}). Você pode efetuar o pagamento diretamente pelo link: {LINK_PAGAMENTO}. Dúvidas, estou à disposição!",
  AFTER_3_DAYS:
    "Olá {NOME_CLIENTE}, tudo bem? Notamos que sua fatura no valor de R$ {VALOR} venceu há 3 dias ({DATA_VENCIMENTO}). Por favor, regularize o pagamento pelo link: {LINK_PAGAMENTO}. Em caso de dúvidas, entre em contato.",
};

function formatMessage(
  template: string,
  customer: Customer,
  charge: Charge
): string {
  return template
    .replace("{NOME_CLIENTE}", customer.name)
    .replace("{VALOR}", charge.amount.toFixed(2).replace(".", ","))
    .replace("{DATA_VENCIMENTO}", new Date(charge.due_date).toLocaleDateString("pt-BR"))
    .replace("{LINK_PAGAMENTO}", charge.payment_link_or_pix || "");
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function sendWhatsAppMessage(
  phone: string,
  message: string,
  instanceId: string
): Promise<boolean> {
  try {
    const token = process.env.ZAPI_TOKEN;
    if (!token || !instanceId) {
      console.log("[Z-API] Token ou Instance ID não configurado");
      return false;
    }

    const response = await fetch(
      `https://api.z-api.io/instances/${instanceId}/token/${token}/send-text`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, message }),
      }
    );
    return response.ok;
  } catch (error) {
    console.error("Erro ao enviar mensagem:", error);
    return false;
  }
}

// Helper para queries sem tipagem
function db(table: string) {
  return getSupabaseAdmin().from(table) as any;
}

export async function GET(request: Request) {
  // Verifica autorização
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const twoDaysLater = new Date(today);
  twoDaysLater.setDate(today.getDate() + 2);

  const threeDaysAgo = new Date(today);
  threeDaysAgo.setDate(today.getDate() - 3);

  const results = {
    before2Days: 0,
    onDueDate: 0,
    after3Days: 0,
    errors: 0,
  };

  // 1. Lembrete Preventivo (-2 Dias)
  const { data: before2DaysCharges } = await db("charges")
    .select("*, customers(*), profiles(whatsapp_instance_id)")
    .eq("status", "PENDING")
    .eq("due_date", twoDaysLater.toISOString().split("T")[0]);

  if (before2DaysCharges) {
    for (const charge of before2DaysCharges) {
      const { data: alreadySent } = await db("notification_logs")
        .select("id")
        .eq("charge_id", charge.id)
        .eq("trigger_type", "BEFORE_2_DAYS")
        .single();

      if (!alreadySent) {
        const message = formatMessage(
          templates.BEFORE_2_DAYS,
          charge.customers as Customer,
          charge as Charge
        );

        const success = await sendWhatsAppMessage(
          (charge.customers as Customer).phone,
          message,
          charge.profiles?.whatsapp_instance_id || ""
        );

        await db("notification_logs").insert({
          charge_id: charge.id,
          trigger_type: "BEFORE_2_DAYS",
          status: success ? "SUCCESS" : "FAILED",
          message_body: message,
        });

        if (success) results.before2Days++;
        else results.errors++;

        // Delay anti-bloqueio: 30-60 segundos
        await sleep(30000 + Math.random() * 30000);
      }
    }
  }

  // 2. Lembrete do Dia (Vencimento)
  const { data: onDueDateCharges } = await db("charges")
    .select("*, customers(*), profiles(whatsapp_instance_id)")
    .eq("status", "PENDING")
    .eq("due_date", today.toISOString().split("T")[0]);

  if (onDueDateCharges) {
    for (const charge of onDueDateCharges) {
      const { data: alreadySent } = await db("notification_logs")
        .select("id")
        .eq("charge_id", charge.id)
        .eq("trigger_type", "ON_DUE_DATE")
        .single();

      if (!alreadySent) {
        const message = formatMessage(
          templates.ON_DUE_DATE,
          charge.customers as Customer,
          charge as Charge
        );

        const success = await sendWhatsAppMessage(
          (charge.customers as Customer).phone,
          message,
          charge.profiles?.whatsapp_instance_id || ""
        );

        await db("notification_logs").insert({
          charge_id: charge.id,
          trigger_type: "ON_DUE_DATE",
          status: success ? "SUCCESS" : "FAILED",
          message_body: message,
        });

        if (success) results.onDueDate++;
        else results.errors++;

        await sleep(30000 + Math.random() * 30000);
      }
    }
  }

  // 3. Lembrete de Cobrança (+3 Dias)
  // Atualiza status para OVERDUE
  await db("charges")
    .update({ status: "OVERDUE" })
    .eq("status", "PENDING")
    .lt("due_date", today.toISOString().split("T")[0]);

  const { data: after3DaysCharges } = await db("charges")
    .select("*, customers(*), profiles(whatsapp_instance_id)")
    .eq("status", "OVERDUE")
    .eq("due_date", threeDaysAgo.toISOString().split("T")[0]);

  if (after3DaysCharges) {
    for (const charge of after3DaysCharges) {
      const { data: alreadySent } = await db("notification_logs")
        .select("id")
        .eq("charge_id", charge.id)
        .eq("trigger_type", "AFTER_3_DAYS")
        .single();

      if (!alreadySent) {
        const message = formatMessage(
          templates.AFTER_3_DAYS,
          charge.customers as Customer,
          charge as Charge
        );

        const success = await sendWhatsAppMessage(
          (charge.customers as Customer).phone,
          message,
          charge.profiles?.whatsapp_instance_id || ""
        );

        await db("notification_logs").insert({
          charge_id: charge.id,
          trigger_type: "AFTER_3_DAYS",
          status: success ? "SUCCESS" : "FAILED",
          message_body: message,
        });

        if (success) results.after3Days++;
        else results.errors++;

        await sleep(30000 + Math.random() * 30000);
      }
    }
  }

  return NextResponse.json({
    success: true,
    processed: results,
    timestamp: new Date().toISOString(),
  });
}
