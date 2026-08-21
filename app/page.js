"use client";
import React, { useState, useEffect, useRef } from "react";

export default function Home() {
  const [mode, setMode] = useState("video");
  const [password, setPassword] = useState("");
  const [prompt, setPrompt] = useState("");

  // Модели и параметры
  const [videoModel, setVideoModel] = useState("klingv3");
  const [imageModel, setImageModel] = useState("seedream50pro");
  const [duration, setDuration] = useState("5");
  const [aspectRatio, setAspectRatio] = useState("16:9");
  const [quality, setQuality] = useState("720p");
  const [withAudio, setWithAudio] = useState(false);

  // Референс
  const [previewRefUrl, setPreviewRefUrl] = useState(null);
  const [referenceUrl, setReferenceUrl] = useState("");

  // Статусы и баланс
  const [balance, setBalance] = useState("...");
  const [cost, setCost] = useState(15);
  const [statusText, setStatusText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // История генераций
  const [history, setHistory] = useState([]);
  const [activeItem, setActiveItem] = useState(null);

  const pollTimerRef = useRef(null);
  const isFinishedRef = useRef(false); // Защита от дублирования карточек

  useEffect(() => {
    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, []);

  // Загрузка истории
  useEffect(() => {
    const saved = localStorage.getItem("ai_studio_history");
    if (saved) {
      try {
        setHistory(JSON.parse(saved));
      } catch (e) {}
    }
  }, []);

  const saveToHistory = (newItem) => {
    setHistory((prev) => {
      // Исключаем повторы по inference_id или url
      if (prev.some(item => (item.id === newItem.id || item.url === newItem.url))) {
        return prev;
      }
      const updated = [newItem, ...prev];
      localStorage.setItem("ai_studio_history", JSON.stringify(updated));
      return updated;
    });
  };

  const deleteFromHistory = (id, e) => {
    e.stopPropagation();
    setHistory((prev) => {
      const updated = prev.filter((item) => item.id !== id);
      localStorage.setItem("ai_studio_history", JSON.stringify(updated));
      return updated;
    });
    if (activeItem?.id === id) {
      setActiveItem(null);
    }
  };

  // Очистить историю полностью
  const clearAllHistory = () => {
    if (confirm("Удалить все сохраненные карточки?")) {
      setHistory([]);
      localStorage.removeItem("ai_studio_history");
    }
  };

  // Калькулятор стоимости
  useEffect(() => {
    if (mode === "image") {
      setCost(imageModel === "seedream50pro" ? 2 : 1);
    } else {
      const sec = Number(duration);
      let rate = 3; // Базовая ставка
      if (videoModel === "seedance25") rate = quality === "480p" ? 4 : 7;
      else if (videoModel === "klingv3turbo") rate = 6;
      else if (videoModel === "grokimaginevideo") rate = 3;
      else if (videoModel === "klingv3") rate = 3;

      let total = sec * rate;
      if (withAudio) total = Math.round(total * 1.33);
      setCost(total);
    }
  }, [mode, videoModel, imageModel, duration, quality, withAudio]);

  const fetchBalance = async () => {
    try {
      const res = await fetch("/api/balance");
      const data = await res.json();
      if (data.balance) setBalance(data.balance);
    } catch {
      setBalance("—");
    }
  };

  useEffect(() => {
    fetchBalance();
  }, []);

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewRefUrl(reader.result);
        setReferenceUrl(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const getModelLabel = (modelKey) => {
    if (modelKey === "klingv3") return "Kling V3";
    if (modelKey === "klingv3turbo") return "Kling V3 Turbo";
    if (modelKey === "grokimaginevideo") return "Grok Video";
    if (modelKey === "seedance25") return "Seedance 2.5";
    return modelKey;
  };

  const pollStatus = (inferenceId, itemMeta, startBalance) => {
    setStatusText("Нейросеть рендерит видео... (~1-3 мин)");
    let attempts = 0;
    isFinishedRef.current = false;

    if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    pollTimerRef.current = setInterval(async () => {
      attempts++;
      if (attempts > 150) {
        clearInterval(pollTimerRef.current);
        setError("Таймаут: время генерации истекло.");
        setLoading(false);
        return;
      }
      try {
        const res = await fetch(`/api/status?id=${inferenceId}&t=${Date.now()}`);
        if (!res.ok) {
          setStatusText(`Рендеринг видео... (${Math.round(attempts * 2.5)}с)`);
          return;
        }
        const data = await res.json();
        const st = String(data.status || data.data?.status || "").toUpperCase();
        
        if ((st === "DONE" || st === "SUCCESS" || st === "COMPLETED") && !isFinishedRef.current) {
          isFinishedRef.current = true;
          clearInterval(pollTimerRef.current);

          const finalUrl = data.url || data.data?.[0]?.url || data.data?.url || data.output?.[0];
          if (finalUrl) {
            // Расчёт фактически списанных кредитов
            let actualSpent = itemMeta.expectedCost;
            try {
              const bRes = await fetch("/api/balance");
              const bData = await bRes.json();
              if (bData.balance && startBalance && !isNaN(Number(startBalance)) && !isNaN(Number(bData.balance))) {
                const diff = Number(startBalance) - Number(bData.balance);
                if (diff > 0) actualSpent = diff;
              }
            } catch (e) {}

            const newItem = {
              id: inferenceId || Date.now().toString(),
              type: "video",
              url: finalUrl,
              prompt: itemMeta.prompt,
              model: getModelLabel(itemMeta.model),
              credits: actualSpent,
              duration: itemMeta.duration,
              date: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
            };

            saveToHistory(newItem);
            setStatusText("Готово!");
          } else {
            setError("Видео готово, но ссылка не найдена.");
          }
          setLoading(false);
          fetchBalance();
        } else if (st === "FAILED" || st === "ERROR") {
          clearInterval(pollTimerRef.current);
          setError(data.error || "Генерация отклонена сервером.");
          setLoading(false);
        } else {
          setStatusText(`Рендеринг видео... (${Math.round(attempts * 2.5)}с)`);
        }
      } catch {
        setStatusText(`Рендеринг видео... (${Math.round(attempts * 2.5)}с)`);
      }
    }, 2500);
  };

  const handleGenerate = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setStatusText("Отправка запроса...");

    const isVideo = mode === "video";
    const currentMode = isVideo 
      ? (referenceUrl ? "i2v" : "t2v") 
      : (referenceUrl ? "i2i" : "t2i");

    const payload = {
      key: password || "SEED",
      mode: currentMode,
      prompt: prompt,
      model: isVideo ? videoModel : imageModel,
      ratio: aspectRatio,
      quality: quality,
      seconds: Number(duration),
      audio: withAudio,
      referenceUrl: referenceUrl || null
    };

    const currentBalBefore = balance;

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (!res.ok || data.ok === false) {
        throw new Error(data.error || data.reason || "Ошибка генерации");
      }

      if (!isVideo && data.url) {
        const newItem = {
          id: Date.now().toString(),
          type: "image",
          url: data.url,
          prompt: prompt,
          model: imageModel === "seedream50pro" ? "Seedream 5.0" : "Grok Image",
          credits: cost,
          date: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
        };
        saveToHistory(newItem);
        setLoading(false);
        fetchBalance();
        return;
      }

      const inferenceId = data.inference_id || data.id || data.data?.id;
      if (inferenceId) {
        pollStatus(inferenceId, { prompt, model: videoModel, duration: Number(duration), expectedCost: cost }, currentBalBefore);
      } else {
        throw new Error("Не получен ID задачи.");
      }
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <main style={{ maxWidth: "860px", margin: "30px auto", padding: "24px", fontFamily: "sans-serif", background: "#111", color: "#fff", borderRadius: "12px" }}>
      {/* Шапка */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <h2 style={{ margin: 0, fontSize: "20px" }}>AI Media Studio (GenAI Hub)</h2>
        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          <div style={{ background: "#1c1e24", padding: "6px 12px", borderRadius: "20px", border: "1px solid #333", fontSize: "13px" }}>
            Расход: ~{cost} кр.
          </div>
          <div style={{ background: "#1c1e24", padding: "6px 12px", borderRadius: "20px", border: "1px solid #333", fontSize: "13px" }}>
            ⚡ Баланс: {balance}
          </div>
        </div>
      </div>

      {/* Переключатель режимов */}
      <div style={{ display: "flex", gap: "8px", marginBottom: "16px" }}>
        <button
          type="button"
          onClick={() => setMode("video")}
          style={{ padding: "8px 16px", borderRadius: "6px", border: "none", background: mode === "video" ? "#4f46e5" : "#222", color: "#fff", cursor: "pointer" }}
        >
          🎬 Видео
        </button>
        <button
          type="button"
          onClick={() => setMode("image")}
          style={{ padding: "8px 16px", borderRadius: "6px", border: "none", background: mode === "image" ? "#4f46e5" : "#222", color: "#fff", cursor: "pointer" }}
        >
          🖼 Картинка
        </button>
      </div>

      <form onSubmit={handleGenerate} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
        <div>
          <label style={{ fontSize: "12px", color: "#aaa" }}>Код доступа (пароль к сайту):</label>
          <input
            type="password"
            placeholder="SEED"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{ width: "100%", padding: "10px", marginTop: "4px", background: "#1c1e24", color: "#fff", border: "1px solid #333", borderRadius: "6px", boxSizing: "border-box" }}
          />
        </div>

        <div>
          <label style={{ fontSize: "12px", color: "#aaa" }}>Промпт:</label>
          <textarea
            placeholder="Опишите сцену..."
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            required
            rows={3}
            style={{ width: "100%", padding: "10px", marginTop: "4px", background: "#1c1e24", color: "#fff", border: "1px solid #333", borderRadius: "6px", boxSizing: "border-box" }}
          />
        </div>

        {/* Блок референса */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            {previewRefUrl && (
              <div style={{ width: "54px", height: "54px", borderRadius: "8px", overflow: "hidden", border: "1px solid #4f46e5", position: "relative", flexShrink: 0 }}>
                <img src={previewRefUrl} alt="ref" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              </div>
            )}
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: "12px", color: "#aaa" }}>Референс с ПК:</label>
              <input
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                style={{ width: "100%", marginTop: "4px", fontSize: "12px", color: "#ccc" }}
              />
            </div>
          </div>

          <div>
            <label style={{ fontSize: "12px", color: "#aaa" }}>Или ссылка на фото:</label>
            <input
              type="url"
              placeholder="https://.../photo.jpg"
              value={referenceUrl.startsWith("http") ? referenceUrl : ""}
              onChange={(e) => {
                setReferenceUrl(e.target.value);
                setPreviewRefUrl(e.target.value);
              }}
              style={{ width: "100%", padding: "8px", marginTop: "4px", background: "#1c1e24", color: "#fff", border: "1px solid #333", borderRadius: "6px", boxSizing: "border-box" }}
            />
          </div>
        </div>

        {/* Параметры */}
        <div style={{ display: "grid", gridTemplateColumns: mode === "video" ? "1.3fr 1fr 1fr 1fr" : "1.5fr 1fr", gap: "8px" }}>
          <div>
            <label style={{ fontSize: "12px", color: "#aaa" }}>Модель:</label>
            {mode === "video" ? (
              <select
                value={videoModel}
                onChange={(e) => setVideoModel(e.target.value)}
                style={{ width: "100%", padding: "8px", marginTop: "4px", background: "#1c1e24", color: "#fff", border: "1px solid #333", borderRadius: "6px" }}
              >
                <option value="klingv3">🎥 Kling V3</option>
                <option value="klingv3turbo">⚡ Kling V3 Turbo</option>
                <option value="grokimaginevideo">🧠 Grok Video</option>
                <option value="seedance25">✨ Seedance 2.5</option>
              </select>
            ) : (
              <select
                value={imageModel}
                onChange={(e) => setImageModel(e.target.value)}
                style={{ width: "100%", padding: "8px", marginTop: "4px", background: "#1c1e24", color: "#fff", border: "1px solid #333", borderRadius: "6px" }}
              >
                <option value="seedream50pro">✨ Seedream 5.0 Pro (2 кр.)</option>
                <option value="grokimagineimage">🧠 Grok Imagine (1 кр.)</option>
                <option value="klingv3">🎥 Kling V3 Image (1 кр.)</option>
              </select>
            )}
          </div>

          {mode === "video" && (
            <>
              <div>
                <label style={{ fontSize: "12px", color: "#aaa" }}>Длина:</label>
                <select
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                  style={{ width: "100%", padding: "8px", marginTop: "4px", background: "#1c1e24", color: "#fff", border: "1px solid #333", borderRadius: "6px" }}
                >
                  <option value="5">5 сек</option>
                  <option value="10">10 сек</option>
                  <option value="15">15 сек</option>
                  <option value="20">20 сек</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: "12px", color: "#aaa" }}>Качество:</label>
                <select
                  value={quality}
                  onChange={(e) => setQuality(e.target.value)}
                  style={{ width: "100%", padding: "8px", marginTop: "4px", background: "#1c1e24", color: "#fff", border: "1px solid #333", borderRadius: "6px" }}
                >
                  <option value="480p">480p</option>
                  <option value="720p">720p (HD)</option>
                  <option value="1080p">1080p (FHD)</option>
                </select>
              </div>
            </>
          )}

          <div>
            <label style={{ fontSize: "12px", color: "#aaa" }}>Формат:</label>
            <select
              value={aspectRatio}
              onChange={(e) => setAspectRatio(e.target.value)}
              style={{ width: "100%", padding: "8px", marginTop: "4px", background: "#1c1e24", color: "#fff", border: "1px solid #333", borderRadius: "6px" }}
            >
              <option value="16:9">16:9 (Горизонт)</option>
              <option value="9:16">9:16 (Вертикаль)</option>
              <option value="1:1">1:1 (Квадрат)</option>
              <option value="4:3">4:3</option>
              <option value="3:4">3:4</option>
              <option value="21:9">21:9 (Cinema)</option>
            </select>
          </div>
        </div>

        {mode === "video" && (
          <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={withAudio}
              onChange={(e) => setWithAudio(e.target.checked)}
            />
            Включить аудио (+33% к стоимости)
          </label>
        )}

        <button
          type="submit"
          disabled={loading}
          style={{ marginTop: "8px", padding: "12px", background: loading ? "#444" : "#4f46e5", color: "#fff", border: "none", borderRadius: "6px", fontWeight: "bold", cursor: loading ? "not-allowed" : "pointer" }}
        >
          {loading ? statusText : `Сгенерировать (~${cost} кр.)`}
        </button>
      </form>

      {error && <p style={{ color: "#f87171", marginTop: "15px", background: "#2b1517", padding: "10px", borderRadius: "6px" }}>{error}</p>}

      {/* Галерея генераций */}
      <div style={{ marginTop: "30px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #222", paddingBottom: "10px", marginBottom: "16px" }}>
          <h3 style={{ margin: 0, fontSize: "16px" }}>
            История генераций ({history.length})
          </h3>
          {history.length > 0 && (
            <button
              onClick={clearAllHistory}
              style={{ background: "transparent", border: "none", color: "#888", fontSize: "12px", cursor: "pointer", textDecoration: "underline" }}
            >
              Очистить историю
            </button>
          )}
        </div>

        {history.length === 0 ? (
          <p style={{ color: "#666", fontSize: "13px" }}>Пока нет созданных файлов.</p>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: "16px" }}>
            {history.map((item) => (
              <div
                key={item.id}
                onClick={() => setActiveItem(item)}
                style={{ background: "#1c1e24", borderRadius: "10px", overflow: "hidden", border: "1px solid #333", cursor: "pointer", display: "flex", flexDirection: "column" }}
              >
                {/* Превью */}
                <div style={{ width: "100%", height: "140px", background: "#000", position: "relative" }}>
                  {item.type === "video" ? (
                    <>
                      <video src={item.url} style={{ width: "100%", height: "100%", objectFit: "cover" }} muted />
                      <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.3)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "24px" }}>
                        ▶
                      </div>
                      <span style={{ position: "absolute", bottom: "6px", right: "6px", background: "rgba(0,0,0,0.8)", fontSize: "10px", padding: "2px 6px", borderRadius: "4px" }}>
                        {item.duration || 5}с
                      </span>
                    </>
                  ) : (
                    <img src={item.url} alt="pic" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  )}
                </div>

                {/* Метаданные */}
                <div style={{ padding: "10px 12px", flex: 1, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                  <p style={{ margin: "0 0 6px 0", fontSize: "12px", color: "#ddd", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {item.prompt}
                  </p>

                  <div style={{ background: "#16181f", padding: "4px 8px", borderRadius: "4px", marginBottom: "8px", border: "1px solid #282c37", fontSize: "11px", display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "#818cf8", fontWeight: "bold" }}>{item.model}</span>
                    <span style={{ color: "#10b981" }}>💎 {item.credits} кр.</span>
                  </div>

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: "10px", color: "#777" }}>{item.date}</span>
                    <div style={{ display: "flex", gap: "8px" }}>
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noreferrer"
                        download
                        onClick={(e) => e.stopPropagation()}
                        style={{ color: "#818cf8", fontSize: "12px", textDecoration: "none" }}
                      >
                        ⬇
                      </a>
                      <button
                        type="button"
                        onClick={(e) => deleteFromHistory(item.id, e)}
                        style={{ background: "transparent", border: "none", color: "#f87171", cursor: "pointer", fontSize: "12px" }}
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Модальное окно */}
      {activeItem && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: "20px" }}>
          <div style={{ background: "#16181f", borderRadius: "12px", border: "1px solid #282c37", maxWidth: "800px", width: "100%", overflow: "hidden" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", borderBottom: "1px solid #282c37" }}>
              <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                <span style={{ fontSize: "14px", fontWeight: "bold" }}>
                  {activeItem.type === "video" ? "Просмотр видео" : "Просмотр изображения"}
                </span>
                <span style={{ background: "#222631", padding: "2px 8px", borderRadius: "10px", fontSize: "11px", color: "#818cf8" }}>
                  {activeItem.model}
                </span>
                <span style={{ background: "#222631", padding: "2px 8px", borderRadius: "10px", fontSize: "11px", color: "#10b981" }}>
                  {activeItem.credits} кр.
                </span>
              </div>
              <button onClick={() => setActiveItem(null)} style={{ background: "transparent", border: "none", color: "#fff", fontSize: "16px", cursor: "pointer" }}>
                ✕
              </button>
            </div>

            <div style={{ background: "#000", textAlign: "center" }}>
              {activeItem.type === "video" ? (
                <video key={activeItem.url} src={activeItem.url} controls autoPlay loop playsInline style={{ width: "100%", maxHeight: "70vh", display: "block" }} />
              ) : (
                <img src={activeItem.url} alt="Full view" style={{ maxWidth: "100%", maxHeight: "70vh", objectFit: "contain" }} />
              )}
            </div>

            <div style={{ padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <a href={activeItem.url} target="_blank" rel="noreferrer" download style={{ background: "#4f46e5", color: "#fff", textDecoration: "none", padding: "8px 14px", borderRadius: "6px", fontSize: "13px" }}>
                ⬇ Скачать файл
              </a>
              <button onClick={() => setActiveItem(null)} style={{ background: "#222", color: "#ccc", border: "none", padding: "8px 14px", borderRadius: "6px", cursor: "pointer", fontSize: "13px" }}>
                Закрыть
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
