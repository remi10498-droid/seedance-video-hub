export const dynamic = 'force-dynamic';

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return new Response(JSON.stringify({ error: "Missing ID" }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }

    const headers = {
      "accept": "application/json",
      "X-Picsart-API-Key": process.env.PICSART_API_KEY
    };

    // Проверяем все возможные варианты роутов статуса Picsart
    let res = await fetch(`https://genai-api.picsart.io/v1/inferences/${id}`, { headers });
    
    if (res.status === 404) {
      res = await fetch(`https://genai-api.picsart.io/v1/tasks/${id}`, { headers });
    }
    if (res.status === 404) {
      res = await fetch(`https://genai-api.picsart.io/v1/tasks?id=${id}`, { headers });
    }

    if (!res.ok) {
      // Всегда возвращаем HTTP 200 клиенту со статусом IN_PROGRESS, пока генерация идет
      return new Response(JSON.stringify({ status: "IN_PROGRESS", state: "processing" }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }

    const data = await res.json();
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });

  } catch (err) {
    return new Response(JSON.stringify({ status: "IN_PROGRESS", state: "processing" }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  }
}
