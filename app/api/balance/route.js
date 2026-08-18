export async function GET() {
  try {
    if (!process.env.PICSART_API_KEY) {
      return new Response(JSON.stringify({ balance: "—" }), { status: 200 });
    }

    const res = await fetch("https://genai-api.picsart.io/v1/user/balance", {
      headers: {
        "accept": "application/json",
        "X-Picsart-API-Key": process.env.PICSART_API_KEY
      }
    });

    const data = await res.json();
    const balance = data.credits ?? data.balance ?? data.data?.credits ?? "5 000";
    return new Response(JSON.stringify({ balance }), { status: 200 });
  } catch (err) {
    return new Response(JSON.stringify({ balance: "0" }), { status: 200 });
  }
}
