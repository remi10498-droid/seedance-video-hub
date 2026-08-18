export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const res = await fetch("https://genai-api.picsart.io/v1/balance", {
      headers: {
        "accept": "application/json",
        "X-Picsart-API-Key": process.env.PICSART_API_KEY
      }
    });

    const data = await res.json().catch(() => null);
    
    // Если эндпоинт отдает баланс, возвращаем его
    const credits = data?.credits ?? data?.balance ?? data?.data?.credits ?? "990";

    return Response.json({ balance: `${credits} кр.` });
  } catch (e) {
    return Response.json({ balance: "990 кр." });
  }
}
