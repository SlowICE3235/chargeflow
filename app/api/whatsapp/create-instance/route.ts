import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST() {
  const token = process.env.ZAPI_TOKEN;

  if (!token) {
    return NextResponse.json({ error: "ZAPI_TOKEN not configured" }, { status: 500 });
  }

  try {
    // Cria uma nova instância na Z-API
    const response = await fetch(
      `https://api.z-api.io/token/${token}/create-instance`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error("Erro ao criar instância Z-API:", error);
      return NextResponse.json({ error: "Failed to create instance" }, { status: 500 });
    }

    const data = await response.json();
    // Z-API retorna { id: "...", token: "..." }
    const instanceId = data.id;

    if (!instanceId) {
      return NextResponse.json({ error: "Instance ID not returned" }, { status: 500 });
    }

    // Busca QR code da instância recém-criada
    const qrResponse = await fetch(
      `https://api.z-api.io/instances/${instanceId}/token/${token}/qr-code`,
      { method: "GET" }
    );

    let qrcode = null;
    if (qrResponse.ok) {
      const qrData = await qrResponse.json();
      qrcode = qrData.qrcode || null;
    }

    return NextResponse.json({ instanceId, qrcode });
  } catch (error) {
    console.error("Erro ao criar instância:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
