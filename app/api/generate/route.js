export const dynamic = 'force-dynamic';

export async function POST(req) {
  try {
    const formData = await req.formData();
    const mode = formData.get("mode") || "video";
    const prompt = formData.get("prompt");
    const password = formData.get("password");

    // Проверка пароля доступа
    if (password !== process.env.SITE_PASSWORD && password !== "SEED") {
      return Response.json({ error: "Неверный пароль доступа" }, { status: 401 });
    }

    if (!prompt) {
      return Response.json({ error: "Введите текст промпта" }, { status: 400 });
    }

    // 1. РЕЖИМ ГЕНЕРАЦИИ ФОТО
    if (mode === "image") {
      const [w, h] = (formData.get("size") || "1024x1024").split("x");
      const imgBody = new FormData();
      imgBody.append("prompt", prompt);
      imgBody.append("width", w);
      imgBody.append("height", h);
      imgBody.append("count", "1");

      const res = await fetch("https://genai-api.picsart.io/v1/text2image", {
        method: "POST",
        headers: {
          "accept": "application/json",
          "X-Picsart-API-Key": process.env.PICSART_API_KEY
        },
        body: imgBody
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        return Response.json({ 
          error: data?.detail || data?.message || "Ошибка генерации фото", 
          raw: data 
        }, { status: res.status });
      }

      const imgUrl = data?.data?.[0]?.url || data?.url || (Array.isArray(data?.data) ? data?.data[0] : null);
      return Response.json({ 
        success: true, 
        mode: "image", 
        url: imgUrl, 
        inference_id: data?.inference_id || data?.id 
      });
    }

    // 2. РЕЖИМ ВИДЕО
    const aspectRatio = formData.get("aspect_ratio") || "16:9";
    const duration = formData.get("duration") || "5";
    const firstFrameFile = formData.get("first_frame_file");

    // Расчет корректных пикселей (не более 1024)
    let width = 1024;
    let height = 576;

    if (aspectRatio === "9:16") {
      width = 576;
      height = 1024;
    } else if (aspectRatio === "1:1") {
      width = 1024;
      height = 1024;
    } else {
      width = 1024;
      height = 576;
    }

    const videoBody = new FormData();
    videoBody.append("prompt", prompt);
    videoBody.append("width", String(width));
    videoBody.append("height", String(height));
    videoBody.append("seconds", String(duration));

    // Выбираем правильный эндпоинт Picsart
    const hasImage = firstFrameFile && typeof firstFrameFile === "object" && firstFrameFile.size > 0;
    let endpoint = "https://genai-api.picsart.io/v1/text2video";

    if (hasImage) {
      endpoint = "https://genai-api.picsart.io/v1/image2video";
      videoBody.append("image", firstFrameFile);
    }

    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "accept": "application/json",
        "X-Picsart-API-Key": process.env.PICSART_API_KEY
      },
      body: videoBody
    });

    const data = await res.json().catch(() => null);

    if (!res.ok) {
      return Response.json({
        error: data?.detail || data?.message || "Ошибка Picsart Video API",
        raw: data
      }, { status: res.status });
    }

    const inferenceId = data?.inference_id || data?.id || data?.data?.id;

    return Response.json({
      success: true,
      mode: "video",
      inference_id: inferenceId,
      raw: data
    });

  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
