"use client";

import React, { useState, useEffect, useRef } from "react";

// Спецификация поддерживаемых параметров под каждую модель
const MODEL_SPECS = {
  "seedance-2.5": {
    durations: ["4", "5", "6", "7", "8", "10", "15", "20", "30"],
    resolutions: [
      { id: "480p", label: "480p" },
      { id: "720p", label: "720p (HD)" },
      { id: "1080p", label: "1080p (FHD)" },
    ],
    ratios: ["16:9", "9:16", "1:1", "4:3", "3:4", "21:9", "adaptive"],
    hasAudio: true,
  },
  "seedance-2.0": {
    durations: ["4", "5", "6", "7", "8", "10", "12", "15"],
    resolutions: [
      { id: "480p", label: "480p" },
      { id: "720p", label: "720p (HD)" },
      { id: "1080p", label: "1080p (FHD)" },
      { id: "4k", label: "4K (Ultra HD)" },
    ],
    ratios: ["16:9", "9:16", "1:1", "4:3", "3:4", "21:9", "adaptive"],
    hasAudio: true,
  },
  "flux-3-video": {
    durations: ["auto", "5", "10", "15", "20"],
    resolutions: [
      { id: "720p", label: "HD (720p)" },
      { id: "1080p", label: "FHD (1080p)" },
    ],
    ratios: ["auto", "16:9", "9:16", "1:1", "4:3", "3:4", "2:1", "21:9"],
    hasAudio: true,
  },
  "sora-2-pro": {
    durations: ["4", "8", "12", "16", "20"],
    resolutions: [
      { id: "720p", label: "720p (HD)" },
      { id: "1080p", label: "1080p (FHD)" },
    ],
    ratios: ["16:9", "9:16"],
    hasAudio: false,
  },
  "sora-2": {
    durations: ["4", "8", "12", "16", "20"],
    resolutions: [{ id: "720p", label: "720p (HD)" }],
    ratios: ["16:9", "9:16"],
    hasAudio: false,
  },
  "hailuo-03": {
    durations: ["5", "10", "15"],
    resolutions: [{ id: "1080p", label: "1080p / 2K" }],
    ratios: ["adaptive", "16:9", "9:16", "1:1", "4:3", "3:4", "21:9"],
    hasAudio: false,
  },
  "wan-3.0-video": {
    durations: ["5", "10", "15", "30"],
    resolutions: [
      { id: "480p", label: "480P" },
      { id: "720p", label: "720P (HD)" },
      { id: "1080p", label: "1080P (FHD)" },
    ],
    ratios: ["16:9", "9:16", "1:1", "4:3", "3:4", "adaptive"],
    hasAudio: true,
    hasThinking: true,
  },
  "luma-ray-3.2": {
    durations: ["5", "10"],
    resolutions: [
      { id: "540p", label: "540p" },
      { id: "720p", label: "720p (HD)" },
      { id: "1080p", label: "1080p (FHD)" },
    ],
    ratios: ["16:9", "9:16", "1:1", "4:3", "3:4", "21:9"],
    hasAudio: false,
    hasHdrLoop: true,
  },
  "grok-imagine-video-1.5": {
    durations: ["3", "5", "6", "8", "10", "12", "15"],
    resolutions: [
      { id: "480p", label: "480p" },
      { id: "720p", label: "720p (HD)" },
      { id: "1080p", label: "1080p (FHD)" },
    ],
    ratios: ["16:9", "9:16", "1:1", "4:3", "3:4", "3:2", "2:3"],
    hasAudio: true,
    requiresImage: true,
  },
  "seedance-2.5-video-extend": {
    durations: ["4", "5", "6", "7", "8", "10", "15", "20", "30"],
    resolutions: [
      { id: "480p", label: "480p" },
      { id: "720p", label: "720p (HD)" },
      { id: "1080p", label: "1080p (FHD)" },
    ],
    ratios: ["adaptive"],
    hasAudio: true,
    requiresVideo: true,
  },
  "seedance-2.0-video-extend": {
    durations: ["4", "5", "6", "7", "8", "10", "12", "15"],
    resolutions: [
      { id: "480p", label: "480p" },
      { id: "720p", label: "720p (HD)" },
      { id: "1080p", label: "1080p (FHD)" },
      { id: "4k", label: "4K (Ultra)" },
    ],
    ratios: ["adaptive"],
    hasAudio: true,
    requiresVideo: true,
  },
  "topaz-upscale-video": {
    durations: [],
    resolutions: [],
    ratios: [],
    requiresVideo: true,
    isTopaz: true,
  },
  "ltx-2.3-a2v": {
    durations: [],
    resolutions: [],
    ratios: [],
    requiresAudio: true,
  },
  "kling-motion-control": {
    durations: [],
    resolutions: [
      { id: "720p", label: "720p (HD)" },
      { id: "1080p", label: "1080p (FHD)" },
    ],
    ratios: [],
    requiresMotionCombo: true,
  },
  "flux-2-pro": {
    durations: [],
    resolutions: [
      { id: "1k", label: "1K Standard" },
      { id: "2k", label: "2K Ultra HD" },
    ],
    ratios: ["1:1", "16:9", "9:16", "4:3", "3:4", "3:2", "2:3", "2:1", "1:2"],
    isImage: true,
  },
  "grok-imagine-image-2.0": {
    durations: [],
    resolutions: [
      { id: "1k", label: "1K Standard" },
      { id: "2k", label: "2K Ultra HD" },
    ],
    ratios: ["1:1", "16:9", "9:16", "4:3", "3:4", "3:2", "2:3", "2:1", "1:2"],
    isImage: true,
  },
  "seedream-5.0-pro": {
    durations: [],
    resolutions: [
      { id: "1k", label: "1K Standard" },
      { id: "2k", label: "2K Ultra HD" },
    ],
    ratios: ["1:1", "16:9", "9:16", "4:3", "3:4"],
    isImage: true,
  },
};

export default function MediaStudio() {
  const [accessCode, setAccessCode] = useState("SEED480");
  const [prompt, setPrompt] = useState("");
  const [model, setModel] = useState("seedance-2.5");
  const [duration, setDuration] = useState("5");
  const [resolution, setResolution] = useState("720p");
  const [aspectRatio, setAspectRatio] = useState("16:9");
  const [generateAudio, setGenerateAudio] = useState(true);
  const [enableThinking, setEnableThinking] = useState(false);
  const [hdr, setHdr] = useState(false);
  const [loop, setLoop] = useState(false);
  const [topazModel, setTopazModel] = useState("Proteus");

  // Файлы
  const [startFrameUrl, setStartFrameUrl] = useState("");
  const [endFrameUrl, setEndFrameUrl] = useState("");
  const [videoInputUrl, setVideoInputUrl] = useState("");
  const [audioInputUrl, setAudioInputUrl] = useState("");

  const [uploadingStart, setUploadingStart] = useState(false);
  const [uploadingEnd, setUploadingEnd] = useState(false);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [uploadingAudio, setUploadingAudio] = useState(false);

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

  // 1. Автозагрузка пароля и истории из памяти браузера (localStorage)
  useEffect(() => {
    const savedPassword = localStorage.getItem("ai_studio_access_pass");
    if (savedPassword) {
      setAccessCode(savedPassword);
    }

    const savedHistory = localStorage.getItem("ai_hub_history_specs_v9");
    if (savedHistory) {
      try {
        setHistory(JSON.parse(savedHistory));
      } catch {}
    }
  }, []);

  // Сохранение пароля при любом изменении
  const handlePasswordChange = (e) => {
    const val = e.target.value;
    setAccessCode(val);
    localStorage.setItem("ai_studio_access_pass", val);
  };

  const saveHistory = (items) => {
    setHistory(items);
    localStorage.setItem("ai_hub_history_specs_v9", JSON.stringify(items));
  };

  const currentSpec = MODEL_SPECS[model] || MODEL_SPECS["seedance-2.5"];

  // Автоматическая корректировка выбранных значений при смене модели
  useEffect(() => {
    const spec = MODEL_SPECS[model];
    if (!spec) return;

    if (spec.durations.length > 0 && !spec.durations.includes(duration)) {
      setDuration(spec.durations[0]);
    }

    if (spec.resolutions.length > 0 && !spec.resolutions.some((r) => r.id === resolution)) {
      setResolution(spec.resolutions[0].id);
    }

    if (spec.ratios.length > 0 && !spec.ratios.includes(aspectRatio)) {
      setAspectRatio(spec.ratios[0]);
    }
  }, [model]);

  // Расчет стоимости
  useEffect(() => {
    if (currentSpec.isImage) {
      setCost(model === "grok-imagine-image-2.0" ? 1 : 2);
    } else if (model === "topaz-upscale-video") {
      setCost(15);
    } else if (model === "kling-motion-control") {
      setCost(25);
    } else if (model === "ltx-2.3-a2v") {
      setCost(12);
    } else {
      const sec = Number(duration) || 5;
      let rate = 7;
      if (model === "seedance-2.0" || model === "seedance-2.0-video-extend") rate = 6;
      else if (model === "seedance-2.5" || model === "seedance-2.5-video-extend") rate = 7;
      else if (model === "flux-3-video") rate = 8;
      else if (model === "wan-3.0-video") rate = 8;
      else if (model === "sora-2") rate = 10;
      else if (model === "sora-2-pro") rate = 15;
      else if (model === "hailuo-03") rate = 8;
      else if (model === "luma-ray-3.2") rate = 9;
      else if (model === "grok-imagine-video-1.5") rate = 6;

      let total = sec * rate;
      if (generateAudio && currentSpec.hasAudio) {
        total = Math.round(total * 1.33);
      }
      setCost(total);
    }
  }, [model, duration, resolution, generateAudio, currentSpec]);

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

  const uploadToBlob = async (file) => {
    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch("/api/upload", {
      method: "POST",
      body: formData,
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Ошибка сохранения в Vercel Blob");
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
      setError(`Ошибка загрузки: ${err.message}`);
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
      setError(`Ошибка загрузки: ${err.message}`);
    } finally {
      setUploadingEnd(false);
    }
  };

  const handleVideoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingVideo(true);
    setError("");
    try {
      const url = await uploadToBlob(file);
      setVideoInputUrl(url);
    } catch (err) {
      setError(`Ошибка загрузки видео: ${err.message}`);
    } finally {
      setUploadingVideo(false);
    }
  };

  const handleAudioUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingAudio(true);
    setError("");
    try {
      const url = await uploadToBlob(file);
      setAudioInputUrl(url);
    } catch (err) {
      setError(`Ошибка загрузки аудио: ${err.message}`);
    } finally {
      setUploadingAudio(false);
    }
  };

  const pollStatus = (taskId, itemMeta) => {
    setStatusText("Нейросеть рендерит медиа... (~1-2 мин)");
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

  const handleGenerate = async (e) => {
    e.preventDefault();

    if (currentSpec.requiresImage && !startFrameUrl) {
      setError(`⚠️ Для модели ${model} обязательно загрузите фото`);
      return;
    }
    if (currentSpec.requiresVideo && !videoInputUrl) {
      setError("⚠️ Для этой задачи обязательно загрузите видеофайл");
      return;
    }
    if (currentSpec.requiresAudio && !audioInputUrl) {
      setError("⚠️ Для LTX Audio-to-Video обязательно загрузите аудиофайл");
      return;
    }
    if (currentSpec.requiresMotionCombo && (!startFrameUrl || !videoInputUrl)) {
      setError("⚠️ Для Kling Motion Control нужны и фото человека, и видео с движениями");
      return;
    }
    if (!prompt.trim() && !currentSpec.isTopaz && !currentSpec.requiresAudio) {
      setError("Пожалуйста, заполните поле промпта");
      return;
    }

    setGenerating(true);
    setError("");
    setStatusText("Отправка запроса в Picsart API...");

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: accessCode || "SEED480",
          password: accessCode || "SEED480",
          prompt,
          model,
          duration: duration,
          resolution,
          aspectRatio,
          generateAudio,
          enableThinking,
          hdr,
          loop,
          topazModel,
          startFrame: startFrameUrl || null,
          endFrame: endFrameUrl || null,
          videoUrl: videoInputUrl || null,
          audioUrl: audioInputUrl || null,
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || "Ошибка запуска задачи");
      }

      const directUrl = data.url || data.results?.[0]?.url || data.response?.result?.url;
      if (directUrl && currentSpec.isImage) {
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

      const taskId = data.id || data.inference_id || data.response?.id;
      if (taskId) {
        pollStatus(taskId, { prompt: prompt || "AI Media Task", model, duration: Number(duration) || 5, cost, isImage: false });
      } else if (directUrl) {
        const newItem = {
          id: Date.now().toString(),
          url: directUrl,
          prompt: prompt || "Video Result",
          model,
          duration: Number(duration) || 5,
          cost,
          isImage: false,
          date: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        };
        saveHistory([newItem, ...history]);
        setGenerating(false);
        fetchBalance();
      } else {
        throw new Error("Picsart API не вернул ID задачи.");
      }
    } catch (err) {
      setError(err.message);
      setGenerating(false);
    }
  };

  const handleExtendGeneratedVideo = (videoUrl, e) => {
    e.stopPropagation();
    setModel("seedance-2.5-video-extend");
    setVideoInputUrl(videoUrl);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const deleteItem = (id, e) => {
    e.stopPropagation();
    const updated = history.filter((item) => item.id !== id);
    saveHistory(updated);
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
          <div style={{ background: "#1c1e24", padding: "6px 12px", borderRadius: "20px", border: "1px solid #333", fontSize: "13px", color: "#818cf8", fontWeight: "bold" }}>
            ⚡ Баланс: {balance}
          </div>
        </div>
      </div>

      <form onSubmit={handleGenerate} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
        <div>
          <label style={{ fontSize: "12px", color: "#aaa" }}>Код доступа к сайту (сохраняется автоматически):</label>
          <input
            type="password"
            placeholder="SEED480"
            value={accessCode}
            onChange={handlePasswordChange}
            style={{ width: "100%", padding: "10px", marginTop: "4px", background: "#1c1e24", color: "#fff", border: "1px solid #333", borderRadius: "6px", boxSizing: "border-box" }}
          />
        </div>

        {!currentSpec.isTopaz && (
          <div>
            <label style={{ fontSize: "12px", color: "#aaa" }}>Текстовый промпт:</label>
            <textarea
              placeholder="Опишите сцену детально..."
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={3}
              required={!currentSpec.requiresAudio}
              style={{ width: "100%", padding: "10px", marginTop: "4px", background: "#1c1e24", color: "#fff", border: "1px solid #333", borderRadius: "6px", boxSizing: "border-box" }}
            />
          </div>
        )}

        {/* Слот Аудио */}
        {currentSpec.requiresAudio && (
          <div style={{ background: "#181a20", padding: "14px", borderRadius: "8px", border: "1px solid #818cf8" }}>
            <label style={{ fontSize: "12px", color: "#818cf8", display: "block", marginBottom: "6px", fontWeight: "bold" }}>
              🎵 Входной аудиофайл (MP3 / WAV) [ОБЯЗАТЕЛЬНО]: {uploadingAudio && "⏳ Загрузка..."}
            </label>
            <input type="file" accept="audio/*" onChange={handleAudioUpload} style={{ fontSize: "12px", color: "#ccc" }} />
            {audioInputUrl && (
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "8px" }}>
                <audio src={audioInputUrl} controls style={{ height: "30px" }} />
                <span style={{ fontSize: "11px", color: "#10b981" }}>✓ Загружено</span>
                <button type="button" onClick={() => setAudioInputUrl("")} style={{ background: "transparent", border: "none", color: "#f87171", cursor: "pointer", fontSize: "11px" }}>Удалить</button>
              </div>
            )}
          </div>
        )}

        {/* Слот Видео */}
        {(currentSpec.requiresVideo || currentSpec.requiresMotionCombo) && (
          <div style={{ background: "#181a20", padding: "14px", borderRadius: "8px", border: "1px solid #818cf8" }}>
            <label style={{ fontSize: "12px", color: "#818cf8", display: "block", marginBottom: "6px", fontWeight: "bold" }}>
              🎬 Исходное видео (MP4 / MOV) [ОБЯЗАТЕЛЬНО]: {uploadingVideo && "⏳ Загрузка..."}
            </label>
            <input type="file" accept="video/*" onChange={handleVideoUpload} style={{ fontSize: "12px", color: "#ccc" }} />
            {videoInputUrl && (
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginTop: "8px" }}>
                <video src={videoInputUrl} style={{ width: "60px", height: "40px", objectFit: "cover", borderRadius: "4px" }} muted />
                <span style={{ fontSize: "11px", color: "#10b981" }}>✓ Видео прикреплено</span>
                <button type="button" onClick={() => setVideoInputUrl("")} style={{ background: "transparent", border: "none", color: "#f87171", cursor: "pointer", fontSize: "11px" }}>Удалить</button>
              </div>
            )}
          </div>
        )}

        {/* Слот Кадров / Фото */}
        {(!currentSpec.requiresAudio && !currentSpec.requiresVideo) || currentSpec.requiresMotionCombo ? (
          <div style={{ background: "#181a20", padding: "14px", borderRadius: "8px", border: currentSpec.requiresImage ? "1px solid #f59e0b" : "1px solid #282c37" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
              <p style={{ margin: 0, fontSize: "13px", fontWeight: "bold", color: currentSpec.requiresImage ? "#fbbf24" : "#ddd" }}>
                {currentSpec.requiresImage ? "⚠️ Эта модель работает строго по входному фото (Image → Video)" : "Референсы / Кадры"}
              </p>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: currentSpec.requiresImage || currentSpec.isImage ? "1fr" : "1fr 1fr", gap: "14px" }}>
              <div>
                <label style={{ fontSize: "12px", color: currentSpec.requiresImage ? "#fbbf24" : "#aaa", display: "block", marginBottom: "4px" }}>
                  {currentSpec.requiresImage ? "1. Входное фото (Обязательно):" : "1. Начальный кадр / Референс:"} {uploadingStart && "⏳ Загрузка..."}
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

              {!currentSpec.requiresImage && !currentSpec.isImage && !currentSpec.requiresMotionCombo && (
                <div>
                  <label style={{ fontSize: "12px", color: "#aaa", display: "block", marginBottom: "4px" }}>
                    2. Финальный кадр (Морфинг): {uploadingEnd && "⏳ Загрузка..."}
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
              )}
            </div>
          </div>
        ) : null}

        {/* Динамический блок параметров */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "8px" }}>
          <div>
            <label style={{ fontSize: "12px", color: "#aaa" }}>Модель:</label>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              style={{ width: "100%", padding: "8px", marginTop: "4px", background: "#1c1e24", color: "#fff", border: "1px solid #333", borderRadius: "6px" }}
            >
              <optgroup label="🎬 Видео (Генерация)">
                <option value="seedance-2.5">✨ Seedance 2.5 (Флагман)</option>
                <option value="seedance-2.0">✨ Seedance 2.0 (до 4K)</option>
                <option value="flux-3-video">🔥 Flux 3 Video</option>
                <option value="sora-2-pro">🌟 Sora 2 Pro (OpenAI)</option>
                <option value="sora-2">🎥 Sora 2 (OpenAI)</option>
                <option value="hailuo-03">🎬 Hailuo 03 (MiniMax 2K)</option>
                <option value="wan-3.0-video">⚡ Wan 3.0 Video</option>
                <option value="luma-ray-3.2">🎥 Luma Ray 3.2 (HDR)</option>
                <option value="grok-imagine-video-1.5">🧠 Grok Video 1.5 (Img2Vid)</option>
              </optgroup>
              <optgroup label="✨ Специальные видео пайплайны">
                <option value="ltx-2.3-a2v">🎵 LTX 2.3 Audio-to-Video</option>
                <option value="kling-motion-control">🕺 Kling Motion Control 2.6</option>
                <option value="seedance-2.5-video-extend">🔄 Seedance 2.5 Extend</option>
                <option value="seedance-2.0-video-extend">🔄 Seedance 2.0 Extend</option>
                <option value="topaz-upscale-video">🔍 Topaz Video Upscale</option>
              </optgroup>
              <optgroup label="🎨 Изображения">
                <option value="flux-2-pro">⚡ FLUX.2 Pro (2 кр.)</option>
                <option value="grok-imagine-image-2.0">🧠 Grok Imagine 2.0 (1 кр.)</option>
                <option value="seedream-5.0-pro">🌊 Seedream 5.0 Pro (2 кр.)</option>
              </optgroup>
            </select>
          </div>

          {/* Длительность */}
          {currentSpec.durations.length > 0 && (
            <div>
              <label style={{ fontSize: "12px", color: "#aaa" }}>Длина:</label>
              <select
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                style={{ width: "100%", padding: "8px", marginTop: "4px", background: "#1c1e24", color: "#fff", border: "1px solid #333", borderRadius: "6px" }}
              >
                {currentSpec.durations.map((d) => (
                  <option key={d} value={d}>
                    {d === "auto" ? "Auto" : `${d} сек`}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Движок Topaz */}
          {currentSpec.isTopaz && (
            <div>
              <label style={{ fontSize: "12px", color: "#aaa" }}>Движок Topaz:</label>
              <select
                value={topazModel}
                onChange={(e) => setTopazModel(e.target.value)}
                style={{ width: "100%", padding: "8px", marginTop: "4px", background: "#1c1e24", color: "#fff", border: "1px solid #333", borderRadius: "6px" }}
              >
                <option value="Proteus">Proteus</option>
                <option value="Artemis HQ">Artemis HQ</option>
                <option value="Nyx">Nyx</option>
                <option value="Gaia HQ">Gaia HQ</option>
              </select>
            </div>
          )}

          {/* Разрешение */}
          {currentSpec.resolutions.length > 0 && (
            <div>
              <label style={{ fontSize: "12px", color: "#aaa" }}>Качество:</label>
              <select
                value={resolution}
                onChange={(e) => setResolution(e.target.value)}
                style={{ width: "100%", padding: "8px", marginTop: "4px", background: "#1c1e24", color: "#fff", border: "1px solid #333", borderRadius: "6px" }}
              >
                {currentSpec.resolutions.map((res) => (
                  <option key={res.id} value={res.id}>
                    {res.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Формат */}
          {currentSpec.ratios.length > 0 && (
            <div>
              <label style={{ fontSize: "12px", color: "#aaa" }}>Формат:</label>
              <select
                value={aspectRatio}
                onChange={(e) => setAspectRatio(e.target.value)}
                style={{ width: "100%", padding: "8px", marginTop: "4px", background: "#1c1e24", color: "#fff", border: "1px solid #333", borderRadius: "6px" }}
              >
                {currentSpec.ratios.map((r) => (
                  <option key={r} value={r}>
                    {r === "16:9" ? "16:9 (Горизонт)" : r === "9:16" ? "9:16 (Вертикаль)" : r === "1:1" ? "1:1 (Квадрат)" : r}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Чекбоксы возможностей */}
        <div style={{ display: "flex", gap: "20px", alignItems: "center", flexWrap: "wrap" }}>
          {currentSpec.hasAudio && (
            <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", cursor: "pointer" }}>
              <input type="checkbox" checked={generateAudio} onChange={(e) => setGenerateAudio(e.target.checked)} />
              Включить аудио (+33% к стоимости)
            </label>
          )}

          {currentSpec.hasThinking && (
            <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", cursor: "pointer", color: "#818cf8" }}>
              <input type="checkbox" checked={enableThinking} onChange={(e) => setEnableThinking(e.target.checked)} />
              Deep Thinking (Физика и логика)
            </label>
          )}

          {currentSpec.hasHdrLoop && (
            <>
              <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", cursor: "pointer" }}>
                <input type="checkbox" checked={hdr} onChange={(e) => setHdr(e.target.checked)} />
                HDR
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", cursor: "pointer" }}>
                <input type="checkbox" checked={loop} onChange={(e) => setLoop(e.target.checked)} />
                Loop (Зациклить)
              </label>
            </>
          )}
        </div>

        <button
          type="submit"
          disabled={generating || uploadingStart || uploadingEnd || uploadingVideo || uploadingAudio}
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

      {/* Галерея генераций */}
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
                    <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                      {!item.isImage && (
                        <button
                          type="button"
                          onClick={(e) => handleExtendGeneratedVideo(item.url, e)}
                          title="Продолжить это видео"
                          style={{ background: "#312e81", color: "#a5b4fc", border: "none", padding: "2px 6px", borderRadius: "4px", fontSize: "11px", cursor: "pointer" }}
                        >
                          🔄 Продолжить
                        </button>
                      )}
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

      {/* Модальное окно просмотра */}
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
              <div style={{ display: "flex", gap: "10px" }}>
                <a href={activeMedia.url} target="_blank" rel="noreferrer" download style={{ background: "#4f46e5", color: "#fff", textDecoration: "none", padding: "8px 14px", borderRadius: "6px", fontSize: "13px" }}>
                  ⬇ Скачать файл
                </a>
                {!activeMedia.isImage && (
                  <button
                    onClick={(e) => {
                      handleExtendGeneratedVideo(activeMedia.url, e);
                      setActiveMedia(null);
                    }}
                    style={{ background: "#312e81", color: "#c7d2fe", border: "none", padding: "8px 14px", borderRadius: "6px", fontSize: "13px", cursor: "pointer" }}
                  >
                    🔄 Продлить это видео
                  </button>
                )}
              </div>
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
