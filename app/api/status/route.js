export const dynamic = 'force-dynamic';

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return new Response(JSON.stringify({ error: "Missing task/inference ID" }), { status: 400 });
    }

    const headers = {
      "accept": "application/json",
      "X-Picsart-API-Key": process.env.PICSART_API_KEY
    };

    // Опрашиваем эндпоинты Picsart
    let res = await fetch(`https://genai-api.picsart.io/v1/tasks?id=${id}`, { headers });
    if (res.status === 404) {
      res = await fetch(`https://genai-api.picsart.io/v1/inferences/${id}`, { headers });
    }
    if (res.status === 404) {
      res = await fetch(`https://genai-api.picsart.io/v1/tasks/${id}`, { headers });
    }

    // Если Picsart еще формирует задачу и вернул 404, не роняем клиент — отправляем PENDING
    if (res.status === 404) {
      return new Response(JSON.stringify({ status: "IN_PROGRESS", data: { status: "IN_PROGRESS" } }), { status: 200 });
    }

    const data = await res.json();
    return new Response(JSON.stringify(data), { status: 200 });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message, status: "IN_PROGRESS" }), { status: 200 });
  }
}
