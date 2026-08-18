export const dynamic = 'force-dynamic';

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return new Response(JSON.stringify({ error: "Missing ID" }), { 
        status: 400, 
        headers: { "Content-Type": "application/json" } 
      });
    }

    const headers = {
      "accept": "application/json",
      "X-Picsart-API-Key": process.env.PICSART_API_KEY
    };

    // 1. Проверяем статус в Picsart
    let res = await fetch(`https://genai-api.picsart.io/v1/inferences/${id}`, { headers });
    
    if (res.status === 404) {
      res = await fetch(`https://genai-api.picsart.io/v1/tasks/${id}`, { headers });
    }
    if (res.status === 404) {
      res = await fetch(`https://genai-api.picsart.io/v1/tasks?id=${id}`, { headers });
    }

    // Если Picsart ответил 404 (видео ещё в очереди), не отдаем браузеру ошибку 404!
    // Отдаем статус 200 "В процессе", чтобы сайт продолжал спокойно ждать
    if (res.status === 404 || !res.ok) {
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
    // При любой непредвиденной ошибке не ломаем страницу, а просим повторить опрос
    return new Response(JSON.stringify({ status: "IN_PROGRESS", state: "processing" }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  }
}
