"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { Shell } from "@/components/layout/shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/client";
import { MessageCircle, QrCode, Unlink, CheckCircle, Loader2 } from "lucide-react";

type ConnectionStatus = "DISCONNECTED" | "CONNECTING" | "CONNECTED";

export default function WhatsAppPage() {
  const [status, setStatus] = useState<ConnectionStatus>("DISCONNECTED");
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);
  const [instanceId, setInstanceId] = useState("");
  const [instanceToken, setInstanceToken] = useState("");
  const supabase = createClient();

  useEffect(() => {
    loadStatus();
  }, []);

  async function loadStatus() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profile } = await supabase
      .from("profiles")
      .select("whatsapp_session_status, whatsapp_instance_id, whatsapp_instance_token")
      .eq("id", user.id)
      .single();

    if (profile) {
      setStatus(profile.whatsapp_session_status as ConnectionStatus);
      setInstanceId(profile.whatsapp_instance_id || "");
      setInstanceToken(profile.whatsapp_instance_token || "");
      if (profile.whatsapp_session_status === "CONNECTING" && profile.whatsapp_instance_id && profile.whatsapp_instance_token) {
        fetchQRCode(profile.whatsapp_instance_id, profile.whatsapp_instance_token);
      }
    }
  }

  async function fetchQRCode(id: string, token: string) {
    try {
      const response = await fetch(`/api/whatsapp/qrcode?instanceId=${id}&token=${token}`);
      const data = await response.json();
      if (data.qrcode) {
        setQrCode(data.qrcode);
      }
    } catch (error) {
      console.error("Erro ao buscar QR code:", error);
    }
  }

  const handleConnect = async () => {
    if (!instanceId || !instanceToken) {
      alert("Preencha o ID da instância e o Token da Z-API");
      return;
    }

    setLoading(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }

    // Salva no perfil
    await supabase
      .from("profiles")
      .update({
        whatsapp_session_status: "CONNECTING",
        whatsapp_instance_id: instanceId,
        whatsapp_instance_token: instanceToken,
      })
      .eq("id", user.id);

    setStatus("CONNECTING");
    fetchQRCode(instanceId, instanceToken);
    setLoading(false);
  };

  const handleCheckConnection = async () => {
    setChecking(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setChecking(false);
      return;
    }

    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("whatsapp_instance_id, whatsapp_instance_token")
        .eq("id", user.id)
        .single();

      if (!profile?.whatsapp_instance_id || !profile?.whatsapp_instance_token) {
        setChecking(false);
        return;
      }

      const response = await fetch(
        `/api/whatsapp/status?instanceId=${profile.whatsapp_instance_id}&token=${profile.whatsapp_instance_token}`
      );
      const result = await response.json();

      if (result.connected) {
        await supabase
          .from("profiles")
          .update({ whatsapp_session_status: "CONNECTED" })
          .eq("id", user.id);
        setStatus("CONNECTED");
        setQrCode(null);
      } else {
        fetchQRCode(profile.whatsapp_instance_id, profile.whatsapp_instance_token);
        alert("WhatsApp ainda não conectado. Escaneie o QR Code abaixo com seu celular.");
      }
    } catch (error) {
      console.error("Erro ao verificar conexão:", error);
    }

    setChecking(false);
  };

  const handleDisconnect = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase
      .from("profiles")
      .update({
        whatsapp_session_status: "DISCONNECTED",
        whatsapp_instance_id: null,
        whatsapp_instance_token: null,
      })
      .eq("id", user.id);

    setStatus("DISCONNECTED");
    setQrCode(null);
    setInstanceId("");
    setInstanceToken("");
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
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="instanceId">ID da Instância Z-API</Label>
                      <Input
                        id="instanceId"
                        placeholder="3F7EFE1AC0..."
                        value={instanceId}
                        onChange={(e) => setInstanceId(e.target.value)}
                      />
                      <p className="text-xs text-muted-foreground">Copie do painel da Z-API → Instâncias Web</p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="instanceToken">Token da Instância</Label>
                      <Input
                        id="instanceToken"
                        placeholder="5D7F8FB28E..."
                        value={instanceToken}
                        onChange={(e) => setInstanceToken(e.target.value)}
                      />
                      <p className="text-xs text-muted-foreground">Copie do painel da Z-API → Instâncias Web → Token</p>
                    </div>
                    <Button className="w-full" onClick={handleConnect} disabled={loading}>
                      {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <QrCode className="w-4 h-4 mr-2" />}
                      {loading ? "Buscando QR Code..." : "Conectar WhatsApp"}
                    </Button>
                  </div>
                )}

                {status === "CONNECTING" && (
                  <>
                    {qrCode && (
                      <div className="flex flex-col items-center space-y-4">
                        <img src={`data:image/png;base64,${qrCode}`} alt="QR Code WhatsApp" className="rounded-lg border w-48 h-48" />
                        <p className="text-sm text-muted-foreground text-center">
                          Abra o WhatsApp no celular e escaneie o QR Code acima
                        </p>
                      </div>
                    )}
                    {!qrCode && (
                      <div className="flex flex-col items-center space-y-4 py-8">
                        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                        <p className="text-sm text-muted-foreground">Buscando QR Code...</p>
                      </div>
                    )}
                    <Button className="w-full" onClick={handleCheckConnection} disabled={checking}>
                      {checking ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle className="w-4 h-4 mr-2" />}
                      {checking ? "Verificando..." : "Já escaneei — Verificar Conexão"}
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
              <CardTitle>Como conectar</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <h4 className="font-medium">1. Vá no painel da Z-API</h4>
                <p className="text-sm text-muted-foreground">Acesse <a href="https://app.z-api.io" target="_blank" className="text-primary underline">app.z-api.io</a> e copie o ID e Token da sua instância.</p>
              </div>
              <div className="space-y-2">
                <h4 className="font-medium">2. Cole os dados aqui</h4>
                <p className="text-sm text-muted-foreground">Cole o ID da Instância e o Token nos campos ao lado.</p>
              </div>
              <div className="space-y-2">
                <h4 className="font-medium">3. Clique em Conectar</h4>
                <p className="text-sm text-muted-foreground">O QR Code vai aparecer na tela. Escaneie com o WhatsApp do celular.</p>
              </div>
              <div className="space-y-2">
                <h4 className="font-medium">4. Verifique a conexão</h4>
                <p className="text-sm text-muted-foreground">Depois de escanear, clique em "Já escaneei — Verificar Conexão".</p>
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
