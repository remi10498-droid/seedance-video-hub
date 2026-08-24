"use client";

import React, { useState, useEffect, useRef } from "react";

// СТРОГАЯ МАТРИЦА МОДЕЛЕЙ (ТОЛЬКО ВИДЕО)
const MODEL_SPECS = {
  "seedance-2.5": {
    name: "Seedance 2.5",
    durations: ["4", "5", "6", "7", "8", "10", "15", "20", "30"],
    resolutions: [{ id: "480p", label: "480p" }, { id: "720p", label: "720p (HD)" }, { id: "1080p", label: "1080p (FHD)" }],
    ratios: ["16:9", "9:16", "1:1", "4:3", "3:4", "21:9", "adaptive"],
    hasAudio: true,
    supportsAudioRef: true,
    supportsVideoRef: true,
    supportsTwoFrames: true,
  },
  "seedance-2.0": {
    name: "Seedance 2.0",
    durations: ["4", "5", "6", "7", "8", "10", "12", "15"],
    resolutions: [{ id: "480p", label: "480p" }, { id: "720p", label: "720p (HD)" }, { id: "1080p", label: "1080p (FHD)" }, { id: "4k", label: "4K (Ultra)" }],
    ratios: ["16:9", "9:16", "1:1", "4:3", "3:4", "21:9", "adaptive"],
    hasAudio: true,
    supportsAudioRef: true,
    supportsVideoRef: true,
    supportsTwoFrames: true,
  },
  "flux-3-video": {
    name: "Flux 3 Video",
    durations: ["auto", "5", "10", "15", "20"],
    resolutions: [{ id: "720p", label: "HD (720p)" }, { id: "1080p", label: "FHD (1080p)" }],
    ratios: ["auto", "16:9", "9:16", "1:1", "4:3", "3:4", "2:1", "21:9"],
    hasAudio: true,
    supportsImageRef: true,
    supportsVideoRef: true,
  },
  "sora-2-pro": {
    name: "Sora 2 Pro",
    durations: ["4", "8", "12", "16", "20"],
    resolutions: [{ id: "720p", label: "720p (HD)" }, { id: "1080p", label: "1080p (FHD)" }],
    ratios: ["16:9", "9:16"],
    hasAudio: false,
    supportsImageRef: true,
  },
  "sora-2": {
    name: "Sora 2",
    durations: ["4", "8", "12", "16", "20"],
    resolutions: [{ id: "720p", label: "720p (HD)" }],
    ratios: ["16:9", "9:16"],
    hasAudio: false,
    supportsImageRef: true,
  },
  "wan-3.0-video": {
    name: "Wan 3.0 Video",
    durations: ["5", "10", "15", "30"],
    resolutions: [{ id: "480p", label: "480P" }, { id: "720p", label: "720P (HD)" }, { id: "1080p", label: "1080P (FHD)" }],
    ratios: ["16:9", "9:16", "1:1", "4:3", "3:4", "adaptive"],
    hasAudio: true,
    hasThinking: true,
  },
  "hailuo-03": {
    name: "Hailuo 03",
    durations: ["5", "10", "15"],
    resolutions: [{ id: "1080p", label: "1080p / 2K" }],
    ratios: ["adaptive", "16:9", "9:16", "1:1", "4:3", "3:4", "21:9"],
    hasAudio: false,
    supportsTwoFrames: true,
    supportsVideoRef: true,
    supportsAudioRef: true,
  },
  "grok-imagine-video-1.5": {
    name: "Grok Video 1.5",
    durations: ["3", "5", "6", "8", "10", "12", "15"],
    resolutions: [{ id: "480p", label: "480p" }, { id: "720p", label: "720p (HD)" }, { id: "1080p", label: "1080p (FHD)" }],
    ratios: ["16:9", "9:16", "1:1", "4:3", "3:4", "3:2", "2:3"],
    hasAudio: true,
    requiresImage: true,
  },
  "luma-ray-3.2": {
    name: "Luma Ray 3.2",
    durations: ["5", "10"],
    resolutions: [{ id: "540p", label: "540p" }, { id: "720p", label: "720p (HD)" }, { id: "1080p", label: "1080p (FHD)" }],
    ratios: ["16:9", "9:16", "1:1", "4:3", "3:4", "21:9"],
    hasAudio: false,
    hasHdrLoop: true,
    supportsTwoFrames: true,
  },
  "seedance-2.5-video-extend": {
    name: "Seedance 2.5 Extend",
    durations: ["4", "5", "6", "7", "8", "10", "15", "20", "30"],
    resolutions: [{ id: "480p", label: "480p" }, { id: "720p", label: "720p (HD)" }, { id: "1080p", label: "1080p (FHD)" }],
    ratios: ["adaptive"],
    hasAudio: true,
    requiresVideo: true,
  },
  "seedance-2.0-video-extend": {
    name: "Seedance 2.0 Extend",
    durations: ["4", "5", "6", "7", "8", "10", "12", "15"],
    resolutions: [{ id: "480p", label: "480p" }, { id: "720p", label: "720p (HD)" }, { id: "1080p", label: "1080p (FHD)" }, { id: "4k", label: "4K (Ultra)" }],
    ratios: ["adaptive"],
    hasAudio: true,
    requiresVideo: true,
  },
  "topaz-upscale-video": {
    name: "Topaz Upscale",
    durations: [], resolutions: [], ratios: [],
    requiresVideo: true,
    isTopaz: true,
    hidePrompt: true, // Скрываем промпт для апскейла
  },
  "ltx-2.3-a2v": {
    name: "LTX Audio-to-Video",
    durations: [], resolutions: [], ratios: [],
    requiresAudio: true,
    supportsImageRef: true,
    promptOptional: true,
  },
  "kling-motion-control-v3": {
    name: "Kling Motion V3",
    durations: [],
    resolutions: [{ id: "720p", label: "720p (HD)" }, { id: "1080p", label: "1080p (FHD)" }],
    ratios: [],
    requiresImage: true, // Обязательно фото человека
    requiresVideo: true, // Обязательно видео с движениями
    promptOptional: true, // Промпт необязателен для переноса движений
  }
};

// Единый постоянный ключ
const MASTER_STORAGE_KEY = "picsart_permanent_genai_video_only_v3";

export default function MediaStudio() {
  const [accessCode, setAccessCode] = useState("SEED480");
  const [prompt, setPrompt] = useState("");
  const [model, setModel] = useState("seedance-2.5");
  const [duration, setDuration] = useState("10");
  const [resolution, setResolution] = useState("720p");
  const [aspectRatio, setAspectRatio] = useState("16:9");
  
  const [generateAudio, setGenerateAudio] = useState(false);
  const [enableThinking, setEnableThinking] = useState(false);
  const [hdr, setHdr] = useState(false);
  const [loop, setLoop] = useState(false);
  const [topazModel, setTopazModel] = useState("Proteus");

  const [startFrameUrl, setStartFrameUrl] = useState("");
  const [endFrameUrl, setEndFrameUrl] = useState("");
  const [videoInputUrl, setVideoInputUrl] = useState("");
  const [audioInputUrl, setAudioInputUrl] = useState("");

  const [uploadingStart, setUploadingStart] = useState(false);
  const [uploadingEnd, setUploadingEnd] = useState(false);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [uploadingAudio, setUploadingAudio] = useState(false);

  const [balance, setBalance] = useState("...");
  const [cost, setCost] = useState(35);
  const [statusText, setStatusText] = useState("");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [history, setHistory] = useState([]);
  const [activeMedia, setActiveMedia] = useState(null);

  const pollTimerRef = useRef(null);

  const getSortValue = (item) => {
    if (item.timestamp) return item.timestamp;
    const numId = Number(item.id);
    if (!isNaN(numId)) return numId;
    return 0;
  };

  useEffect(() => {
    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, []);

  // Восстановление истории с сохранением оригинального порядка старых элементов
  useEffect(() => {
    try {
      const savedPassword = localStorage.getItem("ai_access_password");
      if (savedPassword) setAccessCode(savedPassword);

      let aggregated = [];
      let fakeTime = Date.now() - 1000000; // Искусственная метка времени для старых записей

      // Сначала загружаем из текущего ключа (если он есть)
      const primary = localStorage.getItem(MASTER_STORAGE_KEY);
      if (primary) {
        try {
          const parsed = JSON.parse(primary);
          if (Array.isArray(parsed)) {
            parsed.forEach((item) => {
              if (!item.timestamp) item.timestamp = fakeTime--;
              aggregated.push(item);
            });
          }
        } catch {}
      }

      // Затем прочесываем старые ключи
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (
          key && key !== MASTER_STORAGE_KEY &&
          (key.includes("history") ||
            key.includes("ai_hub") ||
            key.includes("picsart_permanent") ||
            key.includes("ai_studio") ||
            key.startsWith("ai_"))
        ) {
          try {
            const data = JSON.parse(localStorage.getItem(key));
            if (Array.isArray(data)) {
              data.forEach((item) => {
                if (item && item.url && !aggregated.some((x) => x.url === item.url)) {
                  // Присваиваем искусственное время старым генерациям в порядке их извлечения
                  if (!item.timestamp) item.timestamp = fakeTime--;
                  aggregated.push(item);
                }
              });
            }
          } catch {}
        }
      }

      if (aggregated.length > 0) {
        const sorted = aggregated.sort((a, b) => getSortValue(b) - getSortValue(a));
        setHistory(sorted);
        localStorage.setItem(MASTER_STORAGE_KEY, JSON.stringify(sorted));
      }
    } catch {}
  }, []);

  const handlePasswordChange = (e) => {
    const val = e.target.value;
    setAccessCode(val);
    localStorage.setItem("ai_access_password", val);
  };

  const saveHistory = (newItem) => {
    setHistory((prev) => {
      if (prev.some((item) => item.id === newItem.id || item.url === newItem.url)) {
        return prev;
      }
      const updated = [newItem, ...prev].sort((a, b) => getSortValue(b) - getSortValue(a));
      localStorage.setItem(MASTER_STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
  };

  const currentSpec = MODEL_SPECS[model] || MODEL_SPECS["seedance-2.5"];

  useEffect(() => {
    const spec = MODEL_SPECS[model];
    if (!spec) return;

    if (spec.durations.length > 0 && !spec.durations.includes(duration)) setDuration(spec.durations[0]);
    if (spec.resolutions.length > 0 && !spec.resolutions.some((r) => r.id === resolution)) setResolution(spec.resolutions[0].id);
    if (spec.ratios.length > 0 && !spec.ratios.includes(aspectRatio)) setAspectRatio(spec.ratios[0]);
    
    // Очистка неактуальных медиа
    if (!spec.requiresAudio && !spec.supportsAudioRef) setAudioInputUrl("");
    if (!spec.requiresVideo && !spec.supportsVideoRef && !spec.isTopaz && !spec.requiresImage) setVideoInputUrl("");
    if (!spec.supportsTwoFrames && !spec.requiresImage && !spec.supportsImageRef) {
      setStartFrameUrl("");
      setEndFrameUrl("");
    }
  }, [model]);

  // Расчет стоимости
  useEffect(() => {
    if (model === "topaz-upscale-video") setCost(15);
    else if (model === "kling-motion-control-v3") {
      setCost(resolution === "1080p" ? 35 : 25);
    } else if (model === "ltx-2.3-a2v") setCost(12);
    else {
      const sec = Number(duration) || 5;
      let rate = 7;
      if (model.includes("seedance-2.0")) rate = 6;
      else if (model.includes("luma")) rate = 9;
      else if (model.includes("sora-2-pro")) rate = 15;
      else if (model.includes("sora-2")) rate = 10;
      else if (model.includes("wan")) rate = 8;
      else if (model.includes("hailuo")) rate = 8;
      else if (model.includes("grok")) rate = 5;

      let qMult = 1.0;
      if (resolution === "480p" || resolution === "540p") qMult = 0.7;
      if (resolution === "720p") qMult = 1.0;
      if (resolution === "1080p") qMult = 1.4;
      if (resolution === "4k") qMult = 2.0;

      let total = Math.round(sec * rate * qMult);
      if (generateAudio && currentSpec.hasAudio) total = Math.round(total * 1.33);
      setCost(total);
    }
  }, [model, duration, resolution, generateAudio, currentSpec]);

  const fetchBalanceNum = async () => {
    try {
      const res = await fetch("/api/balance?t=" + Date.now());
      const data = await res.json();
      const num = Number(data.credits ?? parseInt(data.balance, 10));
      if (!isNaN(num)) return num;
    } catch {}
    return null;
  };

  const fetchBalance = async () => {
    try {
      const res = await fetch("/api/balance?t=" + Date.now());
      const data = await res.json();
      if (data.balance || data.credits !== undefined) setBalance(data.balance || `${data.credits} кр.`);
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
    const res = await fetch("/api/upload", { method: "POST", body: formData });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Ошибка загрузки");
    return data.url;
  };

  const handleStartUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingStart(true);
    setError("");
    try {
      setStartFrameUrl(await uploadToBlob(file));
    } catch (err) {
      setError(err.message);
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
      setEndFrameUrl(await uploadToBlob(file));
    } catch (err) {
      setError(err.message);
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
      setVideoInputUrl(await uploadToBlob(file));
    } catch (err) {
      setError(err.message);
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
      setAudioInputUrl(await uploadToBlob(file));
    } catch (err) {
      setError(err.message);
    } finally {
      setUploadingAudio(false);
    }
  };

  const pollStatus = (taskId, itemMeta, startBal) => {
    setStatusText("Нейросеть рендерит видео... (~1-2 мин)");
    let attempts = 0;
    if (pollTimerRef.current) clearInterval(pollTimerRef.current);

    pollTimerRef.current = setInterval(async () => {
      attempts++;
      if (attempts > 140) {
        clearInterval(pollTimerRef.current);
        setError("Таймаут: генерация длится слишком долго.");
        setGenerating(false);
        return;
      }
      try {
        const res = await fetch(`/api/status?id=${taskId}&model_name=${encodeURIComponent(itemMeta.modelName)}&t=${Date.now()}`);
        const data = await res.json();
        
        if (data.status === "DONE" && data.url) {
          clearInterval(pollTimerRef.current);
          
          const endBal = await fetchBalanceNum();
          let realCost = data.real_credits;
          if (!realCost && startBal !== null && endBal !== null && startBal > endBal) {
            realCost = startBal - endBal;
          }
          if (!realCost) realCost = itemMeta.cost;

          const tempVideo = document.createElement("video");
          tempVideo.src = data.url;
          tempVideo.onloadedmetadata = () => {
            const actualSeconds = Math.round(tempVideo.duration) || itemMeta.duration || 5;
            const actualResolution = `${tempVideo.videoWidth}×${tempVideo.videoHeight}`;
            const finalModel = data.real_model || itemMeta.modelName;

            const newItem = {
              id: taskId || Date.now().toString(),
              timestamp: Date.now(),
              url: data.url,
              prompt: itemMeta.prompt,
              model: finalModel,
              duration: actualSeconds,
              resolution: actualResolution,
              cost: realCost,
              date: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            };
            
            saveHistory(newItem);
            setStatusText("Готово!");
            setGenerating(false);
            fetchBalance();
          };
          tempVideo.onerror = () => {
            const newItem = {
              id: taskId || Date.now().toString(),
              timestamp: Date.now(),
              url: data.url,
              prompt: itemMeta.prompt,
              model: data.real_model || itemMeta.modelName,
              duration: itemMeta.duration,
              resolution: itemMeta.resolution,
              cost: realCost,
              date: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            };
            
            saveHistory(newItem);
            setStatusText("Готово!");
            setGenerating(false);
            fetchBalance();
          };
        } else if (data.status === "FAILED") {
          clearInterval(pollTimerRef.current);
          setError(data.error || "Генерация отклонена сервисом Picsart.");
          setGenerating(false);
        } else {
          setStatusText(`Рендеринг... (${Math.round(attempts * 2.5)}с)`);
        }
      } catch {
        setStatusText(`Рендеринг... (${Math.round(attempts * 2.5)}с)`);
      }
    }, 2500);
  };

  const handleGenerate = async (e) => {
    e.preventDefault();
    if (!currentSpec.hidePrompt && !currentSpec.promptOptional && !prompt.trim()) {
      setError("Пожалуйста, заполните поле промпта");
      return;
    }
    if (currentSpec.requiresImage && !startFrameUrl) {
      setError("Эта модель требует загрузки входного фото.");
      return;
    }
    if (currentSpec.requiresVideo && !videoInputUrl) {
      setError("Эта модель требует загрузки исходного видео.");
      return;
    }
    if (currentSpec.requiresAudio && !audioInputUrl) {
      setError("Эта модель требует загрузки аудиофайла.");
      return;
    }

    setGenerating(true);
    setError("");
    setStatusText("Отправка запроса в Picsart API...");
    const startBal = await fetchBalanceNum();

    const formData = new FormData();
    formData.append("password", accessCode || "SEED480");
    formData.append("prompt", prompt);
    formData.append("model", model);
    formData.append("mode", "video");
    formData.append("duration", duration);
    formData.append("length", duration);
    formData.append("resolution", resolution);
    formData.append("aspectRatio", aspectRatio);
    formData.append("with_audio", String(generateAudio));
    formData.append("hdr", String(hdr));
    formData.append("loop", String(loop));
    formData.append("topaz_model", topazModel);
    
    if (startFrameUrl) formData.append("start_frame", startFrameUrl);
    if (endFrameUrl) formData.append("end_frame", endFrameUrl);
    if (videoInputUrl) formData.append("video_url", videoInputUrl);
    if (audioInputUrl) formData.append("audio_url", audioInputUrl);

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || "Ошибка запуска генерации");

      const taskId = data.inference_id || data.id || data.data?.id;
      if (taskId) {
        pollStatus(taskId, { prompt, modelName: currentSpec.name, duration: Number(duration), resolution, cost }, startBal);
      } else {
        throw new Error("Не получен ID задачи.");
      }
    } catch (err) {
      setError(err.message);
      setGenerating(false);
    }
  };

  const deleteItem = (id, e) => {
    e.stopPropagation();
    setHistory((prev) => {
      const updated = prev.filter((item) => item.id !== id);
      localStorage.setItem(MASTER_STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
  };

  const handleExtendVideo = (videoUrl, originalModel, e) => {
    e.stopPropagation();
    if (originalModel && originalModel.includes("2.0")) {
      setModel("seedance-2.0-video-extend");
    } else {
      setModel("seedance-2.5-video-extend");
    }
    setVideoInputUrl(videoUrl);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <main style={{ maxWidth: "860px", margin: "30px auto", padding: "24px", fontFamily: "sans-serif", background: "#111", color: "#fff", borderRadius: "12px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <h2 style={{ margin: 0, fontSize: "20px" }}>AI Media Studio (Video)</h2>
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
          <label style={{ fontSize: "12px", color: "#aaa" }}>Код доступа к сайту:</label>
          <input type="password" placeholder="SEED480" value={accessCode} onChange={handlePasswordChange} style={{ width: "100%", padding: "10px", marginTop: "4px", background: "#1c1e24", color: "#fff", border: "1px solid #333", borderRadius: "6px", boxSizing: "border-box" }} />
        </div>

        {!currentSpec.hidePrompt && (
          <div>
            <label style={{ fontSize: "12px", color: "#aaa" }}>Текстовый промпт {currentSpec.promptOptional ? "(Необязательно)" : ""}:</label>
            <textarea placeholder="Опишите сцену детально..." value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={3} style={{ width: "100%", padding: "10px", marginTop: "4px", background: "#1c1e24", color: "#fff", border: "1px solid #333", borderRadius: "6px", boxSizing: "border-box" }} />
          </div>
        )}

        {/* АУДИО */}
        {(currentSpec.requiresAudio || currentSpec.supportsAudioRef) && (
          <div style={{ background: "#181a20", padding: "14px", borderRadius: "8px", border: currentSpec.requiresAudio ? "1px solid #818cf8" : "1px solid #282c37" }}>
            <label style={{ fontSize: "12px", color: currentSpec.requiresAudio ? "#818cf8" : "#aaa", display: "block", marginBottom: "6px", fontWeight: "bold" }}>
              🎵 {currentSpec.requiresAudio ? "Входной аудиофайл (ОБЯЗАТЕЛЬНО):" : "Референс аудио (Необязательно):"} {uploadingAudio && "⏳"}
            </label>
            <input type="file" accept="audio/*" onChange={handleAudioUpload} style={{ fontSize: "12px", color: "#ccc" }} />
            {audioInputUrl && (
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "8px" }}>
                <audio src={audioInputUrl} controls style={{ height: "30px" }} />
                <button type="button" onClick={() => setAudioInputUrl("")} style={{ background: "transparent", border: "none", color: "#f87171", cursor: "pointer", fontSize: "11px" }}>Удалить</button>
              </div>
            )}
          </div>
        )}

        {/* ВИДЕО */}
        {(currentSpec.requiresVideo || currentSpec.supportsVideoRef) && (
          <div style={{ background: "#181a20", padding: "14px", borderRadius: "8px", border: currentSpec.requiresVideo ? "1px solid #818cf8" : "1px solid #282c37" }}>
            <label style={{ fontSize: "12px", color: currentSpec.requiresVideo ? "#818cf8" : "#aaa", display: "block", marginBottom: "6px", fontWeight: "bold" }}>
              🎬 {currentSpec.requiresVideo ? "Исходное видео (ОБЯЗАТЕЛЬНО):" : "Референс видео (Необязательно):"} {uploadingVideo && "⏳"}
            </label>
            <input type="file" accept="video/*" onChange={handleVideoUpload} style={{ fontSize: "12px", color: "#ccc" }} />
            {videoInputUrl && (
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginTop: "8px" }}>
                <video src={videoInputUrl} style={{ width: "60px", height: "40px", objectFit: "cover", borderRadius: "4px" }} muted />
                <span style={{ fontSize: "11px", color: "#10b981" }}>✓ Видео загружено</span>
                <button type="button" onClick={() => setVideoInputUrl("")} style={{ background: "transparent", border: "none", color: "#f87171", cursor: "pointer", fontSize: "11px" }}>Удалить</button>
              </div>
            )}
          </div>
        )}

        {/* КАРТИНКИ */}
        {(currentSpec.supportsTwoFrames || currentSpec.requiresImage || currentSpec.supportsImageRef) && (
          <div style={{ background: "#181a20", padding: "14px", borderRadius: "8px", border: currentSpec.requiresImage ? "1px solid #f59e0b" : "1px solid #282c37" }}>
            <div style={{ display: "grid", gridTemplateColumns: currentSpec.supportsTwoFrames ? "1fr 1fr" : "1fr", gap: "14px" }}>
              <div>
                <label style={{ fontSize: "12px", color: currentSpec.requiresImage ? "#fbbf24" : "#aaa", display: "block", marginBottom: "4px" }}>
                  {currentSpec.requiresImage ? "⚠️ Входное фото (Обязательно):" : "Начальный кадр / Фото:"} {uploadingStart && "⏳"}
                </label>
                <input type="file" accept="image/*" onChange={handleStartUpload} style={{ fontSize: "12px", color: "#ccc" }} />
                {startFrameUrl && (
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "6px" }}>
                    <img src={startFrameUrl} alt="start" style={{ width: "40px", height: "40px", objectFit: "cover", borderRadius: "4px" }} />
                    <button type="button" onClick={() => setStartFrameUrl("")} style={{ background: "transparent", border: "none", color: "#f87171", cursor: "pointer", fontSize: "11px" }}>Удалить</button>
                  </div>
                )}
              </div>
              {currentSpec.supportsTwoFrames && (
                <div>
                  <label style={{ fontSize: "12px", color: "#aaa", display: "block", marginBottom: "4px" }}>
                    Финальный кадр (Морфинг): {uploadingEnd && "⏳"}
                  </label>
                  <input type="file" accept="image/*" onChange={handleEndUpload} style={{ fontSize: "12px", color: "#ccc" }} />
                  {endFrameUrl && (
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "6px" }}>
                      <img src={endFrameUrl} alt="end" style={{ width: "40px", height: "40px", objectFit: "cover", borderRadius: "4px" }} />
                      <button type="button" onClick={() => setEndFrameUrl("")} style={{ background: "transparent", border: "none", color: "#f87171", cursor: "pointer", fontSize: "11px" }}>Удалить</button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "8px" }}>
          <div>
            <label style={{ fontSize: "12px", color: "#aaa" }}>Модель:</label>
            <select value={model} onChange={(e) => setModel(e.target.value)} style={{ width: "100%", padding: "8px", marginTop: "4px", background: "#1c1e24", color: "#fff", border: "1px solid #333", borderRadius: "6px" }}>
              <optgroup label="🎬 Видео (Генерация)">
                <option value="seedance-2.5">✨ Seedance 2.5</option>
                <option value="seedance-2.0">🎬 Seedance 2.0 (до 4K)</option>
                <option value="flux-3-video">🔥 Flux 3 Video</option>
                <option value="wan-3.0-video">⚡ Wan 3.0 Video</option>
                <option value="luma-ray-3.2">🎥 Luma Ray 3.2</option>
                <option value="sora-2-pro">🌟 Sora 2 Pro</option>
                <option value="sora-2">🎥 Sora 2</option>
                <option value="hailuo-03">🎬 Hailuo 03</option>
                <option value="grok-imagine-video-1.5">🧠 Grok Video 1.5</option>
              </optgroup>
              <optgroup label="✨ Спец. пайплайны">
                <option value="seedance-2.5-video-extend">🔄 Seedance 2.5 Extend</option>
                <option value="seedance-2.0-video-extend">🔄 Seedance 2.0 Extend</option>
                <option value="topaz-upscale-video">🔍 Topaz Upscale</option>
                <option value="kling-motion-control-v3">🕺 Kling Motion V3</option>
                <option value="ltx-2.3-a2v">🎵 LTX Audio-to-Video</option>
              </optgroup>
            </select>
          </div>

          {currentSpec.durations.length > 0 && (
            <div>
              <label style={{ fontSize: "12px", color: "#aaa" }}>Длина:</label>
              <select value={duration} onChange={(e) => setDuration(e.target.value)} style={{ width: "100%", padding: "8px", marginTop: "4px", background: "#1c1e24", color: "#fff", border: "1px solid #333", borderRadius: "6px" }}>
                {currentSpec.durations.map((d) => <option key={d} value={d}>{d === "auto" ? "Auto" : `${d} сек`}</option>)}
              </select>
            </div>
          )}

          {currentSpec.isTopaz && (
            <div>
              <label style={{ fontSize: "12px", color: "#aaa" }}>Движок Topaz:</label>
              <select value={topazModel} onChange={(e) => setTopazModel(e.target.value)} style={{ width: "100%", padding: "8px", marginTop: "4px", background: "#1c1e24", color: "#fff", border: "1px solid #333", borderRadius: "6px" }}>
                <option value="Proteus">Proteus</option>
                <option value="Artemis HQ">Artemis HQ</option>
                <option value="Nyx">Nyx</option>
                <option value="Gaia HQ">Gaia HQ</option>
              </select>
            </div>
          )}

          {currentSpec.resolutions.length > 0 && (
            <div>
              <label style={{ fontSize: "12px", color: "#aaa" }}>Качество:</label>
              <select value={resolution} onChange={(e) => setResolution(e.target.value)} style={{ width: "100%", padding: "8px", marginTop: "4px", background: "#1c1e24", color: "#fff", border: "1px solid #333", borderRadius: "6px" }}>
                {currentSpec.resolutions.map((res) => <option key={res.id} value={res.id}>{res.label}</option>)}
              </select>
            </div>
          )}

          {currentSpec.ratios.length > 0 && (
            <div>
              <label style={{ fontSize: "12px", color: "#aaa" }}>Формат:</label>
              <select value={aspectRatio} onChange={(e) => setAspectRatio(e.target.value)} style={{ width: "100%", padding: "8px", marginTop: "4px", background: "#1c1e24", color: "#fff", border: "1px solid #333", borderRadius: "6px" }}>
                {currentSpec.ratios.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
          )}
        </div>

        <div style={{ display: "flex", gap: "20px", alignItems: "center", flexWrap: "wrap" }}>
          {currentSpec.hasAudio && (
            <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", cursor: "pointer" }}>
              <input type="checkbox" checked={generateAudio} onChange={(e) => setGenerateAudio(e.target.checked)} /> Включить аудио (+33%)
            </label>
          )}
          {currentSpec.hasThinking && (
            <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", cursor: "pointer", color: "#818cf8" }}>
              <input type="checkbox" checked={enableThinking} onChange={(e) => setEnableThinking(e.target.checked)} /> Deep Thinking
            </label>
          )}
          {currentSpec.hasHdrLoop && (
            <>
              <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", cursor: "pointer" }}>
                <input type="checkbox" checked={hdr} onChange={(e) => setHdr(e.target.checked)} /> HDR
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", cursor: "pointer" }}>
                <input type="checkbox" checked={loop} onChange={(e) => setLoop(e.target.checked)} /> Loop
              </label>
            </>
          )}
        </div>

        <button type="submit" disabled={generating || uploadingStart || uploadingEnd || uploadingVideo || uploadingAudio} style={{ marginTop: "8px", padding: "12px", background: generating ? "#444" : "#4f46e5", color: "#fff", border: "none", borderRadius: "6px", fontWeight: "bold", cursor: generating ? "not-allowed" : "pointer" }}>
          {generating ? statusText : `Сгенерировать (~${cost} кр.)`}
        </button>
      </form>

      {error && <p style={{ color: "#f87171", marginTop: "15px", background: "#2b1517", padding: "10px", borderRadius: "6px", fontSize: "13px" }}>{error}</p>}

      <div style={{ marginTop: "30px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #222", paddingBottom: "10px", marginBottom: "16px" }}>
          <h3 style={{ margin: "0", fontSize: "16px" }}>История ({history.length})</h3>
          {history.length > 0 && <button onClick={() => { localStorage.removeItem(MASTER_STORAGE_KEY); setHistory([]); }} style={{ background: "transparent", border: "none", color: "#888", fontSize: "12px", cursor: "pointer", textDecoration: "underline" }}>Очистить историю</button>}
        </div>
        {history.length === 0 ? <p style={{ color: "#666", fontSize: "13px" }}>Пока нет созданных файлов.</p> : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: "16px" }}>
            {history.map((item) => (
              <div key={item.id || item.url} onClick={() => setActiveMedia(item)} style={{ background: "#1c1e24", borderRadius: "10px", overflow: "hidden", border: "1px solid #333", cursor: "pointer", display: "flex", flexDirection: "column" }}>
                <div style={{ width: "100%", height: "140px", background: "#000", position: "relative" }}>
                  <video 
                    src={`${item.url}#t=0.1`} 
                    preload="metadata" 
                    style={{ width: "100%", height: "100%", objectFit: "cover" }} 
                    muted 
                    playsInline 
                    onMouseEnter={(e) => e.target.play()} 
                    onMouseLeave={(e) => { e.target.pause(); e.target.currentTime = 0.1; }} 
                  />
                  <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.25)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "20px", pointerEvents: "none" }}>▶</div>
                  <span style={{ position: "absolute", top: "5px", left: "5px", background: "rgba(0,0,0,0.75)", color: "#a5b4fc", fontSize: "9px", padding: "1px 5px", borderRadius: "3px", border: "1px solid rgba(255,255,255,0.1)" }}>{item.model}</span>
                  {item.resolution && <span style={{ position: "absolute", top: "5px", right: "5px", background: "rgba(0,0,0,0.75)", color: "#9ca3af", fontSize: "9px", padding: "1px 5px", borderRadius: "3px" }}>{item.resolution}</span>}
                  <span style={{ position: "absolute", bottom: "5px", left: "5px", background: "rgba(0,0,0,0.85)", color: "#10b981", fontSize: "9px", padding: "1px 5px", borderRadius: "3px", fontWeight: "bold" }}>💎 {item.cost} кр.</span>
                  {item.duration && <span style={{ position: "absolute", bottom: "5px", right: "5px", background: "rgba(0,0,0,0.85)", color: "#fff", fontSize: "9px", padding: "1px 5px", borderRadius: "3px", fontWeight: "bold" }}>{item.duration}с</span>}
                </div>
                <div style={{ padding: "8px 10px", flex: 1, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                  <p style={{ margin: "0 0 6px 0", fontSize: "11px", color: "#ddd", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{item.prompt}</p>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: "9px", color: "#6b7280" }}>{item.date}</span>
                    <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                      <button type="button" onClick={(e) => handleExtendVideo(item.url, item.model, e)} title="Продолжить видео" style={{ background: "#312e81", color: "#a5b4fc", border: "none", padding: "2px 6px", borderRadius: "4px", fontSize: "11px", cursor: "pointer" }}>
                        🔄
                      </button>
                      <a href={item.url} target="_blank" rel="noreferrer" download onClick={(e) => e.stopPropagation()} style={{ color: "#818cf8", fontSize: "11px", textDecoration: "none" }}>⬇</a>
                      <button type="button" onClick={(e) => deleteItem(item.id, e)} style={{ background: "transparent", border: "none", color: "#f87171", cursor: "pointer", fontSize: "11px" }}>✕</button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {activeMedia && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: "20px" }}>
          <div style={{ background: "#16181f", borderRadius: "12px", border: "1px solid #282c37", maxWidth: "800px", width: "100%", overflow: "hidden" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", borderBottom: "1px solid #282c37" }}>
              <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                <span style={{ fontSize: "14px", fontWeight: "bold" }}>Просмотр видео</span>
                <span style={{ background: "#222631", padding: "2px 8px", borderRadius: "10px", fontSize: "11px", color: "#818cf8" }}>
                  {activeMedia.model}
                </span>
              </div>
              <button onClick={() => setActiveMedia(null)} style={{ background: "transparent", border: "none", color: "#fff", fontSize: "16px", cursor: "pointer" }}>
                ✕
              </button>
            </div>

            <div style={{ background: "#000", textAlign: "center" }}>
              <video key={activeMedia.url} src={activeMedia.url} controls autoPlay loop playsInline style={{ width: "100%", maxHeight: "70vh", display: "block" }} />
            </div>

            <div style={{ padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", gap: "10px" }}>
                <a href={activeMedia.url} target="_blank" rel="noreferrer" download style={{ background: "#4f46e5", color: "#fff", textDecoration: "none", padding: "8px 14px", borderRadius: "6px", fontSize: "12px", fontWeight: "bold" }}>
                  ⬇ Скачать
                </a>
                <button onClick={(e) => { handleExtendVideo(activeMedia.url, activeMedia.model, e); setActiveMedia(null); }} style={{ background: "#312e81", color: "#a5b4fc", border: "none", padding: "8px 14px", borderRadius: "6px", fontSize: "12px", cursor: "pointer" }}>
                  🔄 Продолжить
                </button>
              </div>
              <button onClick={() => setActiveMedia(null)} style={{ background: "#222", color: "#ccc", border: "none", padding: "8px 14px", borderRadius: "6px", cursor: "pointer", fontSize: "12px" }}>
                Закрыть
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
