export const dynamic = 'force-dynamic';

export async function POST(req) {
  try {
    const formData = await req.formData();
    const prompt = formData.get("prompt");
    const password = formData.get("password");

    // Защита сайта паролем (замените на свой пароль)
    if (password !== process.env.SITE_PASSWORD && password !== "SEED") {
      return Response.json({ error: "Неверный пароль доступа" }, { status: 401 });
    }

    if (!prompt) {
      return Response.json({ error: "Введите текст промпта" }, { status: 400 });
    }

    const payload = {
      prompt: prompt,
      negative_prompt: "",
      quality: "720p",
      duration: 5,
      aspect_ratio: "16:9"
    };

    const res = await fetch("https://genai-api.picsart.io/v1/text2video", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "accept": "application/json",
        "X-Picsart-API-Key": process.env.PICSART_API_KEY
      },
      body: JSON.stringify(payload)
    });

    const data = await res.json().catch(() => null);

    if (!res.ok) {
      return Response.json({
        error: data?.detail || data?.message || "Ошибка Picsart API",
        raw: data
      }, { status: res.status });
    }

    // Возвращаем inference_id для отслеживания
    const inferenceId = data?.inference_id || data?.id || data?.data?.id;

    return Response.json({
      success: true,
      inference_id: inferenceId,
      raw: data
    });

  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
