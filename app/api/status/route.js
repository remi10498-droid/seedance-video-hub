export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return new Response(JSON.stringify({ error: "Missing inference ID" }), { status: 400 });
    }

    const res = await fetch(`https://genai-api.picsart.io/v1/tasks/${id}`, {
      headers: {
        "accept": "application/json",
        "X-Picsart-API-Key": process.env.PICSART_API_KEY
      }
    });

    const data = await res.json();
    return new Response(JSON.stringify(data), { status: res.status });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}
