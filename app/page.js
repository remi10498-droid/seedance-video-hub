"use client";

import React, { useState, useEffect, useRef } from "react";

export default function MediaStudio() {
  const [accessCode, setAccessCode] = useState("");
  const [prompt, setPrompt] = useState("");
  const [model, setModel] = useState("seedance-2.5");
  const [duration, setDuration] = useState("5");
  const [resolution, setResolution] = useState("720p");
  const [aspectRatio, setAspectRatio] = useState("16:9");
  const [generateAudio, setGenerateAudio] = useState(true);
  const [enableThinking, setEnableThinking] = useState(false);

  // Референсы (Start & End Frame)
  const [startFrameUrl, setStartFrameUrl] = useState("");
  const [endFrameUrl, setEndFrameUrl] = useState("");
  const [uploadingStart, setUploadingStart] = useState(false);
  const [uploadingEnd, setUploadingEnd] = useState(false);

  // Баланс, статус и генерация
  const [balance, setBalance] = useState("...");
  const [cost, setCost] = useState(35);
  const [statusText, setStatusText] = useState("");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");

  // История
  const [history, setHistory] = useState([]);
  const [activeMedia, setActiveMedia] = useState(null);

  const pollTimerRef = useRef(null);

  useEffect(() => {
    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, []);

  // Загрузка истории
  useEffect(() => {
    const saved = localStorage.getItem("ai_hub_history_v3");
    if (saved) {
      try {
        setHistory(JSON.parse(saved));
      } catch (e) {}
    }
  }, []);

  const saveHistory = (items) => {
    setHistory(items);
    localStorage.setItem("ai_hub_history_v3", JSON.stringify(items));
  };

  // Калькулятор расхода кредитов
  useEffect(() => {
    if (model.includes("flux") || model.includes("grok-imagine-image")) {
      setCost(model === "flux-2-pro" ? 2 : 1);
    } else {
      const sec = Number(duration);
      let rate = 7;
      if (model === "seedance-2.5" && resolution === "480p") rate = 4;
      else if (model === "wan-3.0-video") rate = 8;
      else if (model === "sora-2-pro") rate = 12;
      else if (model === "hailuo-03") rate = 8;

      let total = sec * rate;
      if (generateAudio) {
        total = Math.round(total * 1.33);
      }
      setCost(total);
    }
  }, [model, duration, resolution, generateAudio]);

  // Запрос реального баланса
  const fetchBalance = async () => {
    try {
      const res = await fetch("/api/balance?t=" + Date.now());
      const data = await res.json();
      if (data.balance || data.credits !== undefined) {
        setBalance(data.balance || `${data.credits} кр.`);
      }
    } catch {
      setBalance("—");
    }
  };

  useEffect(() => {
    fetchBalance();
  }, []);

  // Загрузка файлов в Vercel Blob
  const uploadToBlob = async (file) => {
    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch("/api/upload", {
      method: "POST",
      body: formData,
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Ошибка сохранения в хранилище");
    return data.url;
  };

  const handleStartUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingStart(true);
    setError("");
    try {
      const url = await uploadToBlob(file);
      setStartFrameUrl(url);
    } catch (err) {
      setError(`Ошибка начального кадра: ${err.message}`);
    } finally {
      setUploadingStart(false);
    }
  };

  const handleEndUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingEnd(true);
    setError("");
    try {
      const url = await uploadToBlob(file);
      setEndFrameUrl(url);
    } catch (err) {
      setError(`Ошибка финального кадра: ${err.message}`);
    } finally {
      setUploadingEnd(false);
    }
  };

  // Опрос статуса генерации
  const pollStatus = (taskId, itemMeta) => {
    setStatusText("Нейросеть рендерит видео... (~1-2 мин)");
    let attempts = 0;

    if (pollTimerRef.current) clearInterval(pollTimerRef.current);

    pollTimerRef.current = setInterval(async () => {
      attempts++;
      if (attempts > 120) {
        clearInterval(pollTimerRef.current);
        setError("Таймаут: генерация заняла больше 5 минут.");
        setGenerating(false);
        return;
      }

      try {
        const res = await fetch(`/api/status?id=${taskId}&t=${Date.now()}`);
        const data = await res.json();

        if (data.status === "DONE" && data.url) {
          clearInterval(pollTimerRef.current);
          const newItem = {
            id: taskId || Date.now().toString(),
            url: data.url,
            prompt: itemMeta.prompt,
            model: itemMeta.model,
            duration: itemMeta.duration,
            cost: itemMeta.cost,
            isImage: itemMeta.isImage,
            date: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          };
          saveHistory([newItem, ...history]);
          setStatusText("Готово!");
          setGenerating(false);
          fetchBalance();
        } else if (data.status === "FAILED") {
          clearInterval(pollTimerRef.current);
          setError(data.error || "Генерация отклонена сервисом Picsart.");
          setGenerating(false);
        } else {
          setStatusText(`Рендеринг в процессе... (${Math.round(attempts * 2.5)}с)`);
        }
      } catch {
        setStatusText(`Рендеринг в процессе... (${Math.round(attempts * 2.5)}с)`);
      }
    }, 2500);
  };

  // Запуск задачи
  const handleGenerate = async (e) => {
    e.preventDefault();
    if (!prompt.trim()) {
      setError("Пожалуйста, заполните поле промпта");
      return;
    }

    setGenerating(true);
    setError("");
    setStatusText("Отправка запроса в Picsart...");

    const isImage = model.includes("flux") || model.includes("grok-imagine-image");

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: accessCode || "SEED480",
          prompt,
          model,
          duration: Number(duration),
          resolution,
          aspectRatio,
          generateAudio,
          enableThinking,
          startFrame: startFrameUrl || null,
          endFrame: endFrameUrl || null,
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || "Ошибка запуска задачи");
      }

      // Синхронный ответ с готовым URL (картинки)
      const directUrl = data.url || data.results?.[0]?.url || data.response?.result?.url;
      if (directUrl && isImage) {
        const newItem = {
          id: Date.now().toString(),
          url: directUrl,
          prompt,
          model,
          cost,
          isImage: true,
          date: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        };
        saveHistory([newItem, ...history]);
        setGenerating(false);
        fetchBalance();
        return;
      }

      // Асинхронный ответ (видео)
      const taskId = data.id || data.inference_id || data.response?.id;
      if (taskId) {
        pollStatus(taskId, { prompt, model, duration: Number(duration), cost, isImage });
      } else if (directUrl) {
        const newItem = {
          id: Date.now().toString(),
          url: directUrl,
          prompt,
          model,
          duration: Number(duration),
          cost,
          isImage: false,
          date: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        };
        saveHistory([newItem, ...history]);
        setGenerating(false);
        fetchBalance();
      } else {
        throw new Error("Picsart не вернул ID задачи.");
      }
    } catch (err) {
      setError(err.message);
      setGenerating(false);
    }
  };

  const deleteItem = (id, e) => {
    e.stopPropagation();
    const updated = history.filter((item) => item.id !== id);
    saveHistory(updated);
  };

  const isImageModel = model.includes("flux") || model.includes("grok-imagine-image");

  return (
    <main style={{ maxWidth: "860px", margin: "30px auto", padding: "24px", fontFamily: "sans-serif", background: "#111", color: "#fff", borderRadius: "12px" }}>
      {/* Верхняя панель */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <h2 style={{ margin: 0, fontSize: "20px" }}>AI Media Studio (GenAI Hub)</h2>
        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          <div style={{ background: "#1c1e24", padding: "6px 12px", borderRadius: "20px", border: "1px solid #333", fontSize: "13px" }}>
            Расход: ~{cost} кр.
          </div>
          <div style={{ background: "#1c1e24", padding: "6px 12px", borderRadius: "20px", border: "1px solid #333", fontSize: "13px", color: "#818cf8", fontWeight: "bold" }}>
            ⚡ Баланс: {balance}
          </div>
        </div>
      </div>

      <form onSubmit={handleGenerate} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
        <div>
          <label style={{ fontSize: "12px", color: "#aaa" }}>Код доступа к студии:</label>
          <input
            type="password"
            placeholder="SEED480"
            value={accessCode}
            onChange={(e) => setAccessCode(e.target.value)}
            style={{ width: "100%", padding: "10px", marginTop: "4px", background: "#1c1e24", color: "#fff", border: "1px solid #333", borderRadius: "6px", boxSizing: "border-box" }}
          />
        </div>

        <div>
          <label style={{ fontSize: "12px", color: "#aaa" }}>Текстовый промпт:</label>
          <textarea
            placeholder="Опишите сцену детально..."
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={3}
            required
            style={{ width: "100%", padding: "10px", marginTop: "4px", background: "#1c1e24", color: "#fff", border: "1px solid #333", borderRadius: "6px", boxSizing: "border-box" }}
          />
        </div>

        {/* Загрузка двух кадров */}
        <div style={{ background: "#181a20", padding: "14px", borderRadius: "8px", border: "1px solid #282c37" }}>
          <p style={{ margin: "0 0 10px 0", fontSize: "13px", fontWeight: "bold", color: "#ddd" }}>
            Референсы / Переход между двумя кадрами (Start & End Frame)
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
            <div>
              <label style={{ fontSize: "12px", color: "#aaa", display: "block", marginBottom: "4px" }}>
                1. Начальный кадр: {uploadingStart && "⏳ Загрузка..."}
              </label>
              <input type="file" accept="image/*" onChange={handleStartUpload} style={{ fontSize: "12px", color: "#ccc" }} />
              {startFrameUrl && (
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "6px" }}>
                  <img src={startFrameUrl} alt="start" style={{ width: "40px", height: "40px", objectFit: "cover", borderRadius: "4px" }} />
                  <span style={{ fontSize: "11px", color: "#10b981" }}>✓ В облаке</span>
                  <button type="button" onClick={() => setStartFrameUrl("")} style={{ background: "transparent", border: "none", color: "#f87171", cursor: "pointer", fontSize: "11px" }}>Удалить</button>
                </div>
              )}
            </div>

            <div>
              <label style={{ fontSize: "12px", color: "#aaa", display: "block", marginBottom: "4px" }}>
                2. Финальный кадр: {uploadingEnd && "⏳ Загрузка..."}
              </label>
              <input type="file" accept="image/*" onChange={handleEndUpload} style={{ fontSize: "12px", color: "#ccc" }} />
              {endFrameUrl && (
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "6px" }}>
                  <img src={endFrameUrl} alt="end" style={{ width: "40px", height: "40px", objectFit: "cover", borderRadius: "4px" }} />
                  <span style={{ fontSize: "11px", color: "#10b981" }}>✓ В облаке</span>
                  <button type="button" onClick={() => setEndFrameUrl("")} style={{ background: "transparent", border: "none", color: "#f87171", cursor: "pointer", fontSize: "11px" }}>Удалить</button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Настройки генерации */}
        <div style={{ display: "grid", gridTemplateColumns: isImageModel ? "1.5fr 1fr 1fr" : "1.4fr 1fr 1fr 1fr", gap: "8px" }}>
          <div>
            <label style={{ fontSize: "12px", color: "#aaa" }}>Модель:</label>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              style={{ width: "100%", padding: "8px", marginTop: "4px", background: "#1c1e24", color: "#fff", border: "1px solid #333", borderRadius: "6px" }}
            >
              <optgroup label="Видео">
                <option value="seedance-2.5">✨ Seedance 2.5</option>
                <option value="sora-2-pro">🌟 Sora 2 Pro</option>
                <option value="hailuo-03">🎬 Hailuo 03</option>
                <option value="wan-3.0-video">⚡ Wan 3.0 Video</option>
              </optgroup>
              <optgroup label="Изображения">
                <option value="flux-2-pro">⚡ FLUX.2 Pro (2 кр.)</option>
                <option value="grok-imagine-image-2.0">🎨 Grok Imagine 2.0 (1 кр.)</option>
              </optgroup>
            </select>
          </div>

          {!isImageModel && (
            <div>
              <label style={{ fontSize: "12px", color: "#aaa" }}>Длина:</label>
              <select
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                style={{ width: "100%", padding: "8px", marginTop: "4px", background: "#1c1e24", color: "#fff", border: "1px solid #333", borderRadius: "6px" }}
              >
                <option value="4">4 сек</option>
                <option value="5">5 сек</option>
                <option value="8">8 сек</option>
                <option value="10">10 сек</option>
                <option value="15">15 сек</option>
                <option value="20">20 сек</option>
                <option value="30">30 сек</option>
              </select>
            </div>
          )}

          <div>
            <label style={{ fontSize: "12px", color: "#aaa" }}>Качество:</label>
            <select
              value={resolution}
              onChange={(e) => setResolution(e.target.value)}
              style={{ width: "100%", padding: "8px", marginTop: "4px", background: "#1c1e24", color: "#fff", border: "1px solid #333", borderRadius: "6px" }}
            >
              {isImageModel ? (
                <>
                  <option value="1k">1K Standard</option>
                  <option value="2k">2K Ultra HD</option>
                </>
              ) : (
                <>
                  <option value="480p">480p</option>
                  <option value="720p">720p (HD)</option>
                  <option value="1080p">1080p (FHD)</option>
                </>
              )}
            </select>
          </div>

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
              <option value="21:9">21:9 (Cinema)</option>
              <option value="adaptive">Adaptive</option>
            </select>
          </div>
        </div>

        {/* Чекбоксы */}
        {!isImageModel && (
          <div style={{ display: "flex", gap: "20px", alignItems: "center" }}>
            <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", cursor: "pointer" }}>
              <input type="checkbox" checked={generateAudio} onChange={(e) => setGenerateAudio(e.target.checked)} />
              Включить аудио (+33% к стоимости)
            </label>

            {model === "wan-3.0-video" && (
              <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", cursor: "pointer", color: "#818cf8" }}>
                <input type="checkbox" checked={enableThinking} onChange={(e) => setEnableThinking(e.target.checked)} />
                Deep Thinking (Физика и логика)
              </label>
            )}
          </div>
        )}

        <button
          type="submit"
          disabled={generating || uploadingStart || uploadingEnd}
          style={{ marginTop: "8px", padding: "12px", background: generating ? "#444" : "#4f46e5", color: "#fff", border: "none", borderRadius: "6px", fontWeight: "bold", cursor: generating ? "not-allowed" : "pointer" }}
        >
          {generating ? statusText : `Сгенерировать (~${cost} кр.)`}
        </button>
      </form>

      {error && (
        <p style={{ color: "#f87171", marginTop: "15px", background: "#2b1517", padding: "10px", borderRadius: "6px", fontSize: "13px" }}>
          {error}
        </p>
      )}

      {/* Галерея */}
      <div style={{ marginTop: "30px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #222", paddingBottom: "10px", marginBottom: "16px" }}>
          <h3 style={{ margin: 0, fontSize: "16px" }}>История генераций ({history.length})</h3>
          {history.length > 0 && (
            <button onClick={() => saveHistory([])} style={{ background: "transparent", border: "none", color: "#888", fontSize: "12px", cursor: "pointer", textDecoration: "underline" }}>
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
                onClick={() => setActiveMedia(item)}
                style={{ background: "#1c1e24", borderRadius: "10px", overflow: "hidden", border: "1px solid #333", cursor: "pointer", display: "flex", flexDirection: "column" }}
              >
                <div style={{ width: "100%", height: "140px", background: "#000", position: "relative" }}>
                  {item.isImage ? (
                    <img src={item.url} alt="gen" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  ) : (
                    <>
                      <video src={item.url} style={{ width: "100%", height: "100%", objectFit: "cover" }} muted />
                      <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.3)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "24px" }}>
                        ▶
                      </div>
                      <span style={{ position: "absolute", bottom: "6px", right: "6px", background: "rgba(0,0,0,0.8)", fontSize: "10px", padding: "2px 6px", borderRadius: "4px" }}>
                        {item.duration || 5}с
                      </span>
                    </>
                  )}
                </div>

                <div style={{ padding: "10px 12px", flex: 1, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                  <p style={{ margin: "0 0 6px 0", fontSize: "12px", color: "#ddd", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {item.prompt}
                  </p>

                  <div style={{ background: "#16181f", padding: "4px 8px", borderRadius: "4px", marginBottom: "8px", border: "1px solid #282c37", fontSize: "11px", display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "#818cf8", fontWeight: "bold" }}>{item.model}</span>
                    <span style={{ color: "#10b981" }}>💎 {item.cost} кр.</span>
                  </div>

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: "10px", color: "#777" }}>{item.date}</span>
                    <div style={{ display: "flex", gap: "8px" }}>
                      <a href={item.url} target="_blank" rel="noreferrer" download onClick={(e) => e.stopPropagation()} style={{ color: "#818cf8", fontSize: "12px", textDecoration: "none" }}>
                        ⬇
                      </a>
                      <button type="button" onClick={(e) => deleteItem(item.id, e)} style={{ background: "transparent", border: "none", color: "#f87171", cursor: "pointer", fontSize: "12px" }}>
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

      {/* Модальное окно плеера */}
      {activeMedia && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: "20px" }}>
          <div style={{ background: "#16181f", borderRadius: "12px", border: "1px solid #282c37", maxWidth: "800px", width: "100%", overflow: "hidden" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", borderBottom: "1px solid #282c37" }}>
              <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                <span style={{ fontSize: "14px", fontWeight: "bold" }}>
                  {activeMedia.isImage ? "Просмотр изображения" : "Просмотр видео"}
                </span>
                <span style={{ background: "#222631", padding: "2px 8px", borderRadius: "10px", fontSize: "11px", color: "#818cf8" }}>
                  {activeMedia.model}
                </span>
              </div>
              <button onClick={() => setActiveMedia(null)} style={{ background: "transparent", border: "none", color: "#fff", fontSize: "16px", cursor: "pointer" }}>
                ✕
              </button>
            </div>

            <div style={{ background: "#000", textAlign: "center" }}>
              {activeMedia.isImage ? (
                <img src={activeMedia.url} alt="Full view" style={{ maxWidth: "100%", maxHeight: "70vh", objectFit: "contain" }} />
              ) : (
                <video key={activeMedia.url} src={activeMedia.url} controls autoPlay loop playsInline style={{ width: "100%", maxHeight: "70vh", display: "block" }} />
              )}
            </div>

            <div style={{ padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <a href={activeMedia.url} target="_blank" rel="noreferrer" download style={{ background: "#4f46e5", color: "#fff", textDecoration: "none", padding: "8px 14px", borderRadius: "6px", fontSize: "13px" }}>
                ⬇ Скачать файл
              </a>
              <button onClick={() => setActiveMedia(null)} style={{ background: "#222", color: "#ccc", border: "none", padding: "8px 14px", borderRadius: "6px", cursor: "pointer", fontSize: "13px" }}>
                Закрыть
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
