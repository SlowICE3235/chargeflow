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
    const response = await fetch(
      `https://api.z-api.io/instances/${instanceId}/token/${token}/qr-code`,
      { method: "GET" }
    );

    if (!response.ok) {
      return NextResponse.json({ qrcode: null }, { status: 200 });
    }

    const data = await response.json();
    return NextResponse.json({ qrcode: data.qrcode || null });
  } catch (error) {
    console.error("Erro ao buscar QR code:", error);
    return NextResponse.json({ qrcode: null }, { status: 200 });
  }
}
