"use client";
import React, { useState, useEffect } from "react";

export default function Home() {
  const [password, setPassword] = useState("");
  const [prompt, setPrompt] = useState("");
  const [model, setModel] = useState("seedance-2.5");
  const [duration, setDuration] = useState("5");
  const [aspectRatio, setAspectRatio] = useState("16:9");
  const [quality, setQuality] = useState("720p");
  const [imageUrl, setImageUrl] = useState("");
  const [imageFile, setImageFile] = useState(null);
  
  const [balance, setBalance] = useState("...");
  const [cost, setCost] = useState(20);
  const [statusText, setStatusText] = useState("");
  const [loading, setLoading] = useState(false);
  const [videoUrl, setVideoUrl] = useState("");
  const [error, setError] = useState("");

  // Калькулятор стоимости в зависимости от параметров
  useEffect(() => {
    let baseRate = 20;
    if (model.includes("sora")) baseRate = 50;
    else if (model.includes("grok")) baseRate = 35;
    else if (model.includes("seedance-2.5") || model.includes("kling")) baseRate = 25;

    let durationMultiplier = 1;
    if (duration === "10") durationMultiplier = 1.8;
    if (duration === "20") durationMultiplier = 3.2;

    let qualityMultiplier = 1;
    if (quality === "480p") qualityMultiplier = 0.8;
    if (quality === "1080p") qualityMultiplier = 1.6;

    const totalCost = Math.round(baseRate * durationMultiplier * qualityMultiplier);
    setCost(totalCost);
  }, [model, duration, quality]);

  const fetchBalance = async () => {
    try {
      const res = await fetch("/api/balance");
      const data = await res.json();
      setBalance(data.balance);
    } catch (e) {
      setBalance("—");
    }
  };

  useEffect(() => {
    fetchBalance();
  }, []);

  const pollStatus = async (inferenceId) => {
    setStatusText("Нейросеть генерирует видео... (1-2 мин)");
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
          fetchBalance();
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
    formData.append("quality", quality);

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
        fetchBalance();
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
    <main style={{ maxWidth: "740px", margin: "30px auto", padding: "24px", fontFamily: "sans-serif", background: "#121318", color: "#eee", borderRadius: "12px", boxShadow: "0 8px 30px rgba(0,0,0,0.5)" }}>
      {/* Шапка со счетчиком кредитов и расчетом стоимости */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px", flexWrap: "wrap", gap: "10px" }}>
        <h2 style={{ margin: 0, fontSize: "20px" }}>AI Video Hub (Seedance / Sora / Grok)</h2>
        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          <div style={{ background: "#1c1e24", padding: "6px 12px", borderRadius: "20px", border: "1px solid #333", fontSize: "13px", color: "#fbbf24" }}>
            🪙 Стоимость: ~{cost} кр.
          </div>
          <div style={{ background: "#1c1e24", padding: "6px 12px", borderRadius: "20px", border: "1px solid #333", fontSize: "13px", fontWeight: "bold", color: "#818cf8" }}>
            ⚡ Баланс: {balance}
          </div>
        </div>
      </div>
      
      <form onSubmit={handleGenerate} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
        <div>
          <label style={{ fontSize: "12px", color: "#aaa" }}>Код доступа (пароль к сайту):</label>
          <input
            type="password"
            placeholder="Введите ваш код (например, SEED)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={{ width: "100%", padding: "10px", marginTop: "4px", background: "#1c1e24", color: "#fff", border: "1px solid #333", borderRadius: "6px", boxSizing: "border-box" }}
          />
        </div>

        <div>
          <label style={{ fontSize: "12px", color: "#aaa" }}>Промпт для генерации:</label>
          <textarea
            placeholder="Опишите сцену, динамику, стиль..."
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

        <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 1fr 1fr", gap: "8px" }}>
          <div>
            <label style={{ fontSize: "12px", color: "#aaa" }}>Модель:</label>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              style={{ width: "100%", padding: "8px", marginTop: "4px", background: "#1c1e24", color: "#fff", border: "1px solid #333", borderRadius: "6px", boxSizing: "border-box" }}
            >
              <option value="seedance-2.5">✨ Seedance 2.5</option>
              <option value="seedance-2.0">✨ Seedance 2.0</option>
              <option value="sora-2.0">🌟 OpenAI Sora 2.0</option>
              <option value="grok-imagine-video">⚡ Grok Imagine Video</option>
              <option value="kling_v3">🎬 Kling v3.0</option>
              <option value="wan_v2.7">🎥 Wan 2.7</option>
            </select>
          </div>

          <div>
            <label style={{ fontSize: "12px", color: "#aaa" }}>Качество:</label>
            <select
              value={quality}
              onChange={(e) => setQuality(e.target.value)}
              style={{ width: "100%", padding: "8px", marginTop: "4px", background: "#1c1e24", color: "#fff", border: "1px solid #333", borderRadius: "6px", boxSizing: "border-box" }}
            >
              <option value="480p">480p (Эконом)</option>
              <option value="720p">720p (HD)</option>
              <option value="1080p">1080p (FHD)</option>
            </select>
          </div>

          <div>
            <label style={{ fontSize: "12px", color: "#aaa" }}>Длина:</label>
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
              <option value="16:9">16:9 (Гориз.)</option>
              <option value="9:16">9:16 (Вертик.)</option>
              <option value="1:1">1:1 (Квадрат)</option>
            </select>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          style={{ marginTop: "10px", padding: "12px", background: loading ? "#444" : "#4f46e5", color: "#fff", border: "none", borderRadius: "6px", fontWeight: "bold", cursor: loading ? "not-allowed" : "pointer" }}
        >
          {loading ? statusText : `Создать видео (~${cost} кр.)`}
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
