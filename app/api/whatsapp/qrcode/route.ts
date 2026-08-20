import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const instanceId = searchParams.get("instanceId");
  const token = searchParams.get("token");

  if (!instanceId || !token) {
    return NextResponse.json({ error: "instanceId and token required" }, { status: 400 });
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
