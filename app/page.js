"use client";
import React, { useState } from "react";

export default function Home() {
  const [password, setPassword] = useState("");
  const [prompt, setPrompt] = useState("");
  const [model, setModel] = useState("seedance-2.5");
  const [duration, setDuration] = useState("5");
  const [aspectRatio, setAspectRatio] = useState("16:9");
  const [imageUrl, setImageUrl] = useState("");
  const [imageFile, setImageFile] = useState(null);
  
  const [statusText, setStatusText] = useState("");
  const [loading, setLoading] = useState(false);
  const [videoUrl, setVideoUrl] = useState("");
  const [error, setError] = useState("");

  const pollStatus = async (inferenceId) => {
    setStatusText("Нейросеть генерирует видео... (занимает около 1-2 мин)");
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/status?id=${inferenceId}`);
        const data = await res.json();

        if (data.status === "SUCCESS" || data.data?.status === "SUCCESS") {
          clearInterval(interval);
          const finalUrl = data.data?.url || data.output?.[0] || data.url;
          setVideoUrl(finalUrl);
          setStatusText("Готово!");
          setLoading(false);
        } else if (data.status === "FAILED" || data.data?.status === "FAILED") {
          clearInterval(interval);
          setError("Генерация завершилась ошибкой со стороны Picsart API.");
          setLoading(false);
        }
      } catch (e) {
        clearInterval(interval);
        setError("Ошибка связи при получении видео.");
        setLoading(false);
      }
    }, 4000);
  };

  const handleGenerate = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setVideoUrl("");
    setStatusText("Отправка запроса в Picsart...");

    const formData = new FormData();
    formData.append("password", password);
    formData.append("prompt", prompt);
    formData.append("model", model);
    formData.append("duration", duration);
    formData.append("aspect_ratio", aspectRatio);

    if (imageFile) {
      formData.append("image_file", imageFile);
    } else if (imageUrl) {
      formData.append("image_url", imageUrl);
    }

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        body: formData
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Ошибка инициализации генерации");

      const inferenceId = data.inference_id || data.id || data.data?.id;
      if (data.data?.url || data.url) {
        setVideoUrl(data.data?.url || data.url);
        setLoading(false);
      } else if (inferenceId) {
        pollStatus(inferenceId);
      } else {
        setVideoUrl(JSON.stringify(data));
        setLoading(false);
      }
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <main style={{ maxWidth: "700px", margin: "40px auto", padding: "24px", fontFamily: "sans-serif", background: "#121318", color: "#eee", borderRadius: "12px", boxShadow: "0 8px 30px rgba(0,0,0,0.5)" }}>
      <h2 style={{ marginTop: 0 }}>Генератор Видео (Seedance 2.5)</h2>
      
      <form onSubmit={handleGenerate} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
        <div>
          <label style={{ fontSize: "12px", color: "#aaa" }}>Код доступа (пароль к сайту):</label>
          <input
            type="password"
            placeholder="Введите ваш код доступа (например, SEED)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={{ width: "100%", padding: "10px", marginTop: "4px", background: "#1c1e24", color: "#fff", border: "1px solid #333", borderRadius: "6px", boxSizing: "border-box" }}
          />
        </div>

        <div>
          <label style={{ fontSize: "12px", color: "#aaa" }}>Промпт для генерации:</label>
          <textarea
            placeholder="Опишите сцену, действие, стиль..."
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            required
            rows={3}
            style={{ width: "100%", padding: "10px", marginTop: "4px", background: "#1c1e24", color: "#fff", border: "1px solid #333", borderRadius: "6px", boxSizing: "border-box" }}
          />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
          <div>
            <label style={{ fontSize: "12px", color: "#aaa" }}>Файл изображения (референс):</label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setImageFile(e.target.files[0])}
              style={{ width: "100%", marginTop: "6px", fontSize: "12px" }}
            />
          </div>
          <div>
            <label style={{ fontSize: "12px", color: "#aaa" }}>Или ссылка на картинку:</label>
            <input
              type="url"
              placeholder="https://.../img.jpg"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              style={{ width: "100%", padding: "8px", marginTop: "4px", background: "#1c1e24", color: "#fff", border: "1px solid #333", borderRadius: "6px", boxSizing: "border-box" }}
            />
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px" }}>
          <div>
            <label style={{ fontSize: "12px", color: "#aaa" }}>Модель:</label>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              style={{ width: "100%", padding: "8px", marginTop: "4px", background: "#1c1e24", color: "#fff", border: "1px solid #333", borderRadius: "6px", boxSizing: "border-box" }}
            >
              <option value="seedance-2.5">Seedance 2.5</option>
              <option value="seedance-2.0">Seedance 2.0</option>
              <option value="kling_v3">Kling v3.0</option>
              <option value="wan_v2.7">Wan 2.7</option>
            </select>
          </div>

          <div>
            <label style={{ fontSize: "12px", color: "#aaa" }}>Длительность:</label>
            <select
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              style={{ width: "100%", padding: "8px", marginTop: "4px", background: "#1c1e24", color: "#fff", border: "1px solid #333", borderRadius: "6px", boxSizing: "border-box" }}
            >
              <option value="5">5 сек</option>
              <option value="10">10 сек</option>
              <option value="20">20 сек</option>
            </select>
          </div>

          <div>
            <label style={{ fontSize: "12px", color: "#aaa" }}>Формат:</label>
            <select
              value={aspectRatio}
              onChange={(e) => setAspectRatio(e.target.value)}
              style={{ width: "100%", padding: "8px", marginTop: "4px", background: "#1c1e24", color: "#fff", border: "1px solid #333", borderRadius: "6px", boxSizing: "border-box" }}
            >
              <option value="16:9">16:9 (Горизонтально)</option>
              <option value="9:16">9:16 (Вертикально)</option>
              <option value="1:1">1:1 (Квадрат)</option>
            </select>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          style={{ marginTop: "8px", padding: "12px", background: loading ? "#444" : "#4f46e5", color: "#fff", border: "none", borderRadius: "6px", fontWeight: "bold", cursor: loading ? "not-allowed" : "pointer" }}
        >
          {loading ? statusText : "Создать видео"}
        </button>
      </form>

      {error && <p style={{ color: "#f87171", marginTop: "15px", background: "#2b1517", padding: "10px", borderRadius: "6px" }}>{error}</p>}

      {videoUrl && (
        <div style={{ marginTop: "20px" }}>
          <h3>Результат:</h3>
          {videoUrl.startsWith("http") ? (
            <div>
              <video src={videoUrl} controls autoPlay style={{ width: "100%", borderRadius: "8px", marginTop: "8px" }} />
              <a href={videoUrl} target="_blank" download style={{ display: "inline-block", marginTop: "8px", color: "#818cf8", textDecoration: "none" }}>⬇ Скачать видео (.mp4)</a>
            </div>
          ) : (
            <pre style={{ background: "#1c1e24", padding: "10px", borderRadius: "6px", overflowX: "auto" }}>{videoUrl}</pre>
          )}
        </div>
      )}
    </main>
  );
}
