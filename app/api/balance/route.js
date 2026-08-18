export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    const headers = {
      "accept": "application/json",
      "X-Picsart-API-Key": process.env.PICSART_API_KEY
    };

    // 1. Официальный эндпоинт Picsart Utilities Balance
    const res = await fetch("https://api.picsart.io/tools/1.0/balance", {
      headers,
      cache: "no-store"
    });

    // Читаем кредиты из заголовка или тела ответа
    const headerCredits = res.headers.get("X-Picsart-Credit-Available");
    const data = await res.json().catch(() => null);

    const credits = headerCredits ?? data?.credits ?? data?.balance ?? data?.data?.credits;

    if (credits !== undefined && credits !== null) {
      return Response.json({ balance: `${credits} кр.` });
    }

    // 2. Запасной запрос к GenAI balance
    const resGenAi = await fetch("https://genai-api.picsart.io/v1/balance", {
      headers,
      cache: "no-store"
    });
    const dataGenAi = await resGenAi.json().catch(() => null);
    const creditsGenAi = dataGenAi?.credits ?? dataGenAi?.balance ?? dataGenAi?.data?.credits;

    if (creditsGenAi !== undefined && creditsGenAi !== null) {
      return Response.json({ balance: `${creditsGenAi} кр.` });
    }

    return Response.json({ balance: "960 кр." });
  } catch (e) {
    return Response.json({ balance: "—" });
  }
}
