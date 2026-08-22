import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const apiKey = process.env.PICSART_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "PICSART_API_KEY не настроен" }, { status: 500 });
    }

    const response = await fetch("https://api.picsart.com/genai/v1/balance", {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      cache: "no-store",
    });

    const data = await response.json().catch(() => null);

    if (!response.ok || !data) {
      return NextResponse.json({ balance: "Активен", credits: 0 });
    }

    const credits = data.credits ?? data.balance ?? data.data?.credits ?? 0;
    return NextResponse.json({ balance: `${credits} кр.`, credits });
  } catch (error) {
    return NextResponse.json({ balance: "—", error: error.message }, { status: 500 });
  }
}
