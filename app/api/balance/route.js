export const dynamic = 'force-dynamic';

export async function GET() {
  let currentBalance = "—";

  if (process.env.PICSART_API_KEY) {
    try {
      const res = await fetch("https://genai-api.picsart.io/v1/user/balance", {
        headers: {
          "accept": "application/json",
          "X-Picsart-API-Key": process.env.PICSART_API_KEY
        },
        cache: "no-store"
      });
      const data = await res.json().catch(() => null);
      if (data?.credits !== undefined) {
        currentBalance = data.credits;
      } else if (data?.balance !== undefined) {
        currentBalance = data.balance;
      }
    } catch {}
  }

  return Response.json({
    ok: true,
    balance: currentBalance,
    credits: currentBalance,
    prices: {
      perSecond: {
        "seedance25": 7,
        "seedance25:480p": 4,
        "grokimaginevideo:720p": 5,
        "grokimaginevideo:1080p": 8,
        "grokimaginevideo": 6,
        "klingv3": 8,
        "klingv3turbo": 10
      },
      perImage: {
        "seedream50pro": 2,
        "grokimagineimage": 1,
        "klingv3": 1
      },
      audioExtra: 0.33
    }
  });
}
