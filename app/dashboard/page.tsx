"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Shell } from "@/components/layout/shell";
import { createClient } from "@/lib/supabase/client";
import {
  DollarSign,
  CreditCard,
  AlertTriangle,
  MessageCircle,
} from "lucide-react";
import type { DashboardMetrics, Charge } from "@/types";

export default function DashboardPage() {
  const [metrics, setMetrics] = useState<DashboardMetrics>({
    totalToReceive: 0,
    totalToReceiveCount: 0,
    totalRecovered: 0,
    totalRecoveredCount: 0,
    overdueAmount: 0,
    overdueCount: 0,
    whatsappStatus: "DISCONNECTED",
  });
  const [recentCharges, setRecentCharges] = useState<Charge[]>([]);
  const supabase = createClient();

  useEffect(() => {
    async function loadDashboard() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("whatsapp_session_status")
        .eq("id", user.id)
        .single();

      const { data: chargesRaw } = await supabase
        .from("charges")
        .select("*, customers(name)")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(10);

      const charges = (chargesRaw || []) as Charge[];

      if (charges.length > 0) {
        setRecentCharges(charges);

        const pending = charges.filter((c) => c.status === "PENDING");
        const paid = charges.filter((c) => c.status === "PAID");
        const overdue = charges.filter((c) => c.status === "OVERDUE");

        setMetrics({
          totalToReceive: pending.reduce((sum: number, c: Charge) => sum + c.amount, 0),
          totalToReceiveCount: pending.length,
          totalRecovered: paid.reduce((sum: number, c: Charge) => sum + c.amount, 0),
          totalRecoveredCount: paid.length,
          overdueAmount: overdue.reduce((sum: number, c: Charge) => sum + c.amount, 0),
          overdueCount: overdue.length,
          whatsappStatus: profile?.whatsapp_session_status || "DISCONNECTED",
        });
      }
    }

    loadDashboard();
  }, []);

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);

  const statusConfig = {
    DISCONNECTED: { label: "Desconectado", variant: "destructive" as const },
    CONNECTING: { label: "Conectando...", variant: "secondary" as const },
    CONNECTED: { label: "Conectado", variant: "default" as const },
  };

  return (
    <Shell>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            Visão geral das suas cobranças e métricas
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total a Receber</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(metrics.totalToReceive)}</div>
              <p className="text-xs text-muted-foreground">{metrics.totalToReceiveCount} cobranças pendentes</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Recuperado</CardTitle>
              <CreditCard className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(metrics.totalRecovered)}</div>
              <p className="text-xs text-muted-foreground">{metrics.totalRecoveredCount} pagos</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Inadimplência</CardTitle>
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">{formatCurrency(metrics.overdueAmount)}</div>
              <p className="text-xs text-muted-foreground">{metrics.overdueCount} atrasados</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">WhatsApp</CardTitle>
              <MessageCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <Badge variant={statusConfig[metrics.whatsappStatus].variant}>
                {statusConfig[metrics.whatsappStatus].label}
              </Badge>
              <p className="text-xs text-muted-foreground mt-1">Status da conexão</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Cobranças Recentes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentCharges.map((charge) => (
                <div key={charge.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="space-y-1">
                    <p className="font-medium">{charge.customers?.name || "Cliente"}</p>
                    <p className="text-sm text-muted-foreground">
                      Vencimento: {new Date(charge.due_date).toLocaleDateString("pt-BR")}
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="font-bold">{formatCurrency(charge.amount)}</span>
                    <Badge variant={charge.status === "PAID" ? "default" : charge.status === "OVERDUE" ? "destructive" : "secondary"}>
                      {charge.status === "PAID" ? "Pago" : charge.status === "OVERDUE" ? "Atrasado" : "Pendente"}
                    </Badge>
                  </div>
                </div>
              ))}
              {recentCharges.length === 0 && (
                <p className="text-muted-foreground text-center py-8">Nenhuma cobrança cadastrada ainda.</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </Shell>
  );
}
