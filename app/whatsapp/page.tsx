"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { Shell } from "@/components/layout/shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/client";
import { MessageCircle, QrCode, Unlink, ExternalLink, CheckCircle } from "lucide-react";

type ConnectionStatus = "DISCONNECTED" | "CONNECTING" | "CONNECTED";

export default function WhatsAppPage() {
  const [status, setStatus] = useState<ConnectionStatus>("DISCONNECTED");
  const [loading, setLoading] = useState(false);
  const [zapiUrl, setZapiUrl] = useState<string | null>(null);
  const supabase = createClient();

  useEffect(() => {
    loadStatus();
  }, []);

  async function loadStatus() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profile } = await supabase
      .from("profiles")
      .select("whatsapp_session_status, whatsapp_instance_id")
      .eq("id", user.id)
      .single();

    if (profile) {
      setStatus(profile.whatsapp_session_status as ConnectionStatus);
      if (profile.whatsapp_instance_id) {
        setZapiUrl(`https://app.z-api.io/app/instances/${profile.whatsapp_instance_id}`);
      }
    }
  }

  const handleConnect = async () => {
    setLoading(true);
    setStatus("CONNECTING");

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }

    // Abre o painel da Z-API em nova aba para o usuário escanear o QR code
    window.open("https://app.z-api.io", "_blank");

    await supabase
      .from("profiles")
      .update({ whatsapp_session_status: "CONNECTING" })
      .eq("id", user.id);

    setLoading(false);
  };

  const handleCheckConnection = async () => {
    setLoading(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }

    // Verifica via API da Z-API se está conectado
    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("whatsapp_instance_id")
        .eq("id", user.id)
        .single();

      if (!profile?.whatsapp_instance_id) {
        setLoading(false);
        return;
      }

      const response = await fetch(`/api/whatsapp/status?instanceId=${profile.whatsapp_instance_id}`);
      const result = await response.json();

      if (result.connected) {
        await supabase
          .from("profiles")
          .update({ whatsapp_session_status: "CONNECTED" })
          .eq("id", user.id);
        setStatus("CONNECTED");
      } else {
        alert("WhatsApp ainda não conectado. Escaneie o QR Code no painel da Z-API primeiro.");
      }
    } catch (error) {
      console.error("Erro ao verificar conexão:", error);
    }

    setLoading(false);
  };

  const handleDisconnect = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase
      .from("profiles")
      .update({ whatsapp_session_status: "DISCONNECTED" })
      .eq("id", user.id);

    setStatus("DISCONNECTED");
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
                    {loading ? "Abrindo Z-API..." : "Conectar WhatsApp"}
                  </Button>
                )}

                {status === "CONNECTING" && (
                  <>
                    <div className="rounded-lg bg-yellow-500/10 border border-yellow-500/20 p-4 text-center space-y-2">
                      <p className="text-sm font-medium text-yellow-600">Aguardando conexão</p>
                      <p className="text-xs text-muted-foreground">
                        Escaneie o QR Code no painel da Z-API e depois clique em "Verificar Conexão"
                      </p>
                    </div>
                    <Button className="w-full" onClick={handleCheckConnection} disabled={loading}>
                      <CheckCircle className="w-4 h-4 mr-2" />
                      {loading ? "Verificando..." : "Verificar Conexão"}
                    </Button>
                    <Button variant="outline" className="w-full" onClick={() => window.open("https://app.z-api.io", "_blank")}>
                      <ExternalLink className="w-4 h-4 mr-2" />
                      Abrir Painel Z-API
                    </Button>
                  </>
                )}

                {status === "CONNECTED" && (
                  <>
                    <div className="rounded-lg bg-green-500/10 border border-green-500/20 p-4 text-center">
                      <p className="text-sm font-medium text-green-600">WhatsApp conectado!</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        O sistema está pronto para enviar cobranças automaticamente.
                      </p>
                    </div>
                    <Button variant="destructive" className="w-full" onClick={handleDisconnect}>
                      <Unlink className="w-4 h-4 mr-2" />
                      Desconectar
                    </Button>
                  </>
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
                <h4 className="font-medium">1. Clique em "Conectar WhatsApp"</h4>
                <p className="text-sm text-muted-foreground">Isso vai abrir o painel da Z-API em uma nova aba.</p>
              </div>
              <div className="space-y-2">
                <h4 className="font-medium">2. Escaneie o QR Code no painel da Z-API</h4>
                <p className="text-sm text-muted-foreground">Abra o WhatsApp no celular, vá em Configurações → Dispositivos Conectados → Conectar Dispositivo.</p>
              </div>
              <div className="space-y-2">
                <h4 className="font-medium">3. Volte aqui e clique "Verificar Conexão"</h4>
                <p className="text-sm text-muted-foreground">O sistema vai confirmar que seu WhatsApp está conectado.</p>
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
