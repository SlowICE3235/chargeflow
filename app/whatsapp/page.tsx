"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { Shell } from "@/components/layout/shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/client";
import { MessageCircle, QrCode, RefreshCw, Unlink } from "lucide-react";

type ConnectionStatus = "DISCONNECTED" | "CONNECTING" | "CONNECTED";

export default function WhatsAppPage() {
  const [status, setStatus] = useState<ConnectionStatus>("DISCONNECTED");
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    loadStatus();
  }, []);

  async function loadStatus() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profile } = await supabase
      .from("profiles")
      .select("whatsapp_session_status")
      .eq("id", user.id)
      .single();

    if (profile) {
      setStatus(profile.whatsapp_session_status as ConnectionStatus);
    }
  }

  const handleConnect = async () => {
    setLoading(true);
    setStatus("CONNECTING");
    setTimeout(() => {
      setQrCode("https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=whatsapp-auth-simulated");
      setLoading(false);
    }, 1500);
  };

  const handleDisconnect = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase
      .from("profiles")
      .update({ whatsapp_session_status: "DISCONNECTED" })
      .eq("id", user.id);

    setStatus("DISCONNECTED");
    setQrCode(null);
  };

  const handleSimulateConnected = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase
      .from("profiles")
      .update({ whatsapp_session_status: "CONNECTED" })
      .eq("id", user.id);

    setStatus("CONNECTED");
    setQrCode(null);
  };

  const statusConfig = {
    DISCONNECTED: { label: "Desconectado", color: "text-destructive", badge: "destructive" as const },
    CONNECTING: { label: "Conectando...", color: "text-yellow-500", badge: "secondary" as const },
    CONNECTED: { label: "Conectado", color: "text-green-500", badge: "default" as const },
  };

  return (
    <Shell>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Conexão WhatsApp</h1>
          <p className="text-muted-foreground">Conecte seu WhatsApp para enviar cobranças automaticamente</p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageCircle className="w-5 h-5" />
                Status da Conexão
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Status atual:</span>
                <Badge variant={statusConfig[status].badge}>{statusConfig[status].label}</Badge>
              </div>

              <div className="space-y-3">
                {status === "DISCONNECTED" && (
                  <Button className="w-full" onClick={handleConnect} disabled={loading}>
                    <QrCode className="w-4 h-4 mr-2" />
                    {loading ? "Gerando QR Code..." : "Conectar WhatsApp"}
                  </Button>
                )}

                {status === "CONNECTING" && qrCode && (
                  <>
                    <div className="flex flex-col items-center space-y-4">
                      <img src={qrCode} alt="QR Code WhatsApp" className="rounded-lg border" />
                      <p className="text-sm text-muted-foreground text-center">Escaneie o QR Code com seu WhatsApp</p>
                    </div>
                    <Button variant="outline" className="w-full" onClick={handleSimulateConnected}>
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Simular Conexão (Dev)
                    </Button>
                  </>
                )}

                {status === "CONNECTED" && (
                  <Button variant="destructive" className="w-full" onClick={handleDisconnect}>
                    <Unlink className="w-4 h-4 mr-2" />
                    Desconectar
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Instruções</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <h4 className="font-medium">1. Clique em Conectar</h4>
                <p className="text-sm text-muted-foreground">O sistema gerará um QR Code para autenticação.</p>
              </div>
              <div className="space-y-2">
                <h4 className="font-medium">2. Escaneie com seu WhatsApp</h4>
                <p className="text-sm text-muted-foreground">Abra o WhatsApp no celular, vá em Configurações &gt; Dispositivos Conectados &gt; Conectar Dispositivo.</p>
              </div>
              <div className="space-y-2">
                <h4 className="font-medium">3. Pronto! Cobranças automáticas</h4>
                <p className="text-sm text-muted-foreground">O sistema enviará lembretes de cobrança automaticamente nos horários programados.</p>
              </div>

              <div className="rounded-lg bg-muted p-4">
                <p className="text-sm font-medium">Dica Anti-Bloqueio:</p>
                <p className="text-sm text-muted-foreground mt-1">O sistema envia mensagens com intervalos aleatórios de 30-60 segundos para evitar bloqueios do WhatsApp.</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </Shell>
  );
}
