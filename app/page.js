"use client";
import React, { useState, useEffect, useRef } from "react";

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

  const pollTimerRef = useRef(null);

  useEffect(() => {
    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, []);

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
      setBalance(data.balance ?? "1005");
    } catch (e) {
      setBalance("1005");
    }
  };

  useEffect(() => {
    fetchBalance();
  }, []);

  const pollStatus = (inferenceId) => {
    setStatusText("Нейросеть рендерит видео... (~30-60 сек)");
    let attempts = 0;
    const maxAttempts = 60; // 60 * 2.5с = 2.5 мин максимум

    if (pollTimerRef.current) clearInterval(pollTimerRef.current);

    pollTimerRef.current = setInterval(async () => {
      attempts++;

      if (attempts > maxAttempts) {
        clearInterval(pollTimerRef.current);
        setError("Таймаут генерации: сервер рендерит дольше обычного.");
        setLoading(false);
        return;
      }

      try {
        const res = await fetch(`/api/status?id=${inferenceId}`);
        const data = await res.json();

        const st = String(data.status || data.data?.status || "").toUpperCase();

        if (st === "DONE" || st === "SUCCESS" || st === "COMPLETED" || st === "FINISHED") {
          clearInterval(pollTimerRef.current);
          const finalUrl = data.url || data.data?.[0]?.url || data.data?.url || data.output?.[0];
          
          if (finalUrl) {
            setVideoUrl(finalUrl);
            setStatusText("Готово!");
          } else {
            setError("Видео готово, но ссылка отсутствует в ответе.");
          }
          setLoading(false);
          fetchBalance();
        } else if (st === "FAILED" || st === "ERROR" || st === "REJECTED") {
          clearInterval(pollTimerRef.current);
          setError(data.error || "Генерация завершилась ошибкой на сервере.");
          setLoading(false);
        } else {
          setStatusText(`Рендеринг видео... (${Math.round(attempts * 2.5)}с)`);
        }
      } catch (e) {
        clearInterval(pollTimerRef.current);
        setError("Ошибка связи при проверке статуса.");
        setLoading(false);
      }
    }, 2500);
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
      const directUrl = data.url || data.data?.url || (Array.isArray(data.data) ? data.data[0]?.url : null);

      if (directUrl && String(data.status).toUpperCase() === "DONE") {
        setVideoUrl(directUrl);
        setLoading(false);
        fetchBalance();
      } else if (inferenceId) {
        pollStatus(inferenceId);
      } else {
        throw new Error("Не получен идентификатор задачи от API.");
      }
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <main style={{ maxWidth: "740px", margin: "30px auto", padding: "24px", fontFamily: "sans-serif", background: "#121318", color: "#eee", borderRadius: "12px", boxShadow: "0 8px 30px rgba(0,0,0,0.5)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px", flexWrap: "wrap", gap: "10px" }}>
        <h2 style={{ margin: 0, fontSize: "20px" }}>AI Video Hub (Picsart GenAI)</h2>
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
            placeholder="Введите ваш код"
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
          <video key={videoUrl} src={videoUrl} controls autoPlay playsInline style={{ width: "100%", borderRadius: "8px", marginTop: "8px", background: "#000" }} />
          <a href={videoUrl} target="_blank" rel="noreferrer" download style={{ display: "inline-block", marginTop: "8px", color: "#818cf8", textDecoration: "none" }}>⬇ Скачать видео (.mp4)</a>
        </div>
      )}
    </main>
  );
}
