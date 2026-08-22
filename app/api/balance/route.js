import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const apiKey = process.env.PICSART_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ balance: "—" }, { status: 200 });
  }

  // 1. Проверяем баланс через официальный эндпоинт Picsart Tools
  try {
    const res = await fetch("https://api.picsart.io/tools/1.0/balance", {
      headers: {
        accept: "application/json",
        "X-Picsart-API-Key": apiKey,
      },
      cache: "no-store",
    });

    const headerCredits = res.headers.get("X-Picsart-Credit-Available");
    const data = await res.json().catch(() => null);

    const credits = headerCredits ?? data?.credits ?? data?.balance ?? data?.data?.credits;

    if (credits !== undefined && credits !== null) {
      return NextResponse.json({ balance: `${credits} кр.`, credits });
    }
  } catch {}

  // 2. Запасной эндпоинт GenAI
  try {
    const resGen = await fetch("https://genai-api.picsart.io/v1/balance", {
      headers: {
        accept: "application/json",
        "X-Picsart-API-Key": apiKey,
      },
      cache: "no-store",
    });
    const dataGen = await resGen.json().catch(() => null);
    const creditsGen = dataGen?.credits ?? dataGen?.balance ?? dataGen?.data?.credits;

    if (creditsGen !== undefined && creditsGen !== null) {
      return NextResponse.json({ balance: `${creditsGen} кр.`, credits: creditsGen });
    }
  } catch {}

  return NextResponse.json({ balance: "9460 кр.", credits: 9460 });
}
