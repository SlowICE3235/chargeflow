import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const instanceId = searchParams.get("instanceId");

  if (!instanceId) {
    return NextResponse.json({ error: "instanceId required" }, { status: 400 });
  }

  const token = process.env.ZAPI_TOKEN;

  if (!token) {
    return NextResponse.json({ error: "ZAPI_TOKEN not configured" }, { status: 500 });
  }

  try {
    // Verifica o status da instância na Z-API
    const response = await fetch(
      `https://api.z-api.io/instances/${instanceId}/token/${token}/status`,
      { method: "GET" }
    );

    if (!response.ok) {
      return NextResponse.json({ connected: false }, { status: 200 });
    }

    const data = await response.json();
    // Z-API retorna { connected: true } quando conectado
    return NextResponse.json({ connected: data.connected === true });
  } catch (error) {
    console.error("Erro ao verificar status Z-API:", error);
    return NextResponse.json({ connected: false }, { status: 200 });
  }
}
