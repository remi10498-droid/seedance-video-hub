// Надежная конвертация любого формата (включая JFIF) в валидный JPEG
  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const img = new Image();
    const reader = new FileReader();

    reader.onload = (event) => {
      img.onload = () => {
        // Создаем виртуальный холст для сжатия и конвертации в чистый image/jpeg
        const canvas = document.createElement("canvas");
        const maxDim = 1280;
        let w = img.width;
        let h = img.height;

        if (w > maxDim || h > maxDim) {
          if (w > h) {
            h = Math.round((h * maxDim) / w);
            w = maxDim;
          } else {
            w = Math.round((w * maxDim) / h);
            h = maxDim;
          }
        }

        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, w, h);

        // Гарантированно получаем валидный Data URL JPEG для Picsart API
        const cleanDataUrl = canvas.toDataURL("image/jpeg", 0.9);
        setPreviewRefUrl(cleanDataUrl);
        setReferenceUrl(cleanDataUrl);
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  };
