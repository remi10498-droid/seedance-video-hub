export async function POST(req) {
  try {
    const formData = await req.formData();
    const password = formData.get("password");
    const prompt = formData.get("prompt");
    const model = formData.get("model") || "seedance-2.5";
    const duration = formData.get("duration") || "5";
    const aspectRatio = formData.get("aspect_ratio") || "16:9";
    const quality = formData.get("quality") || "720p";
    const imageUrl = formData.get("image_url");
    const imageFile = formData.get("image_file");

    if (password !== process.env.ACCESS_CODE) {
      return new Response(JSON.stringify({ error: "Неверный код доступа!" }), { status: 401 });
    }

    if (!process.env.PICSART_API_KEY) {
      return new Response(JSON.stringify({ error: "Ключ PICSART_API_KEY не задан в Vercel!" }), { status: 500 });
    }

    const picsartForm = new FormData();
    picsartForm.append("prompt", prompt);
    picsartForm.append("model", model);
    picsartForm.append("duration", duration);
    picsartForm.append("aspect_ratio", aspectRatio);
    picsartForm.append("quality", quality);

    if (imageFile && typeof imageFile !== "string") {
      picsartForm.append("image", imageFile);
    } else if (imageUrl) {
      picsartForm.append("image_url", imageUrl);
    }

    const endpoint = (imageFile || imageUrl)
      ? "https://genai-api.picsart.io/v1/image2video"
      : "https://genai-api.picsart.io/v1/text2video";

    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "accept": "application/json",
        "X-Picsart-API-Key": process.env.PICSART_API_KEY
      },
      body: picsartForm
    });

    const data = await res.json();
    if (!res.ok) {
      return new Response(JSON.stringify({ error: data.message || JSON.stringify(data) }), { status: res.status });
    }

    return new Response(JSON.stringify(data), { status: 200 });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}
