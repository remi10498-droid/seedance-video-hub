export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
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

    // 1. Проверяем стандартный таск-эндпоинт Picsart с query-параметром
    let res = await fetch(`https://genai-api.picsart.io/v1/tasks?id=${id}`, { headers });
    
    // 2. Если не найден, пробуем прямой путь через task id
    if (res.status === 404) {
      res = await fetch(`https://genai-api.picsart.io/v1/tasks/${id}`, { headers });
    }

    // 3. Если не найден, пробуем путь inferences
    if (res.status === 404) {
      res = await fetch(`https://genai-api.picsart.io/v1/inferences/${id}`, { headers });
    }

    const data = await res.json();
    return new Response(JSON.stringify(data), { status: res.status });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}
