import { put } from "@vercel/blob";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!file) {
      return NextResponse.json({ error: "Файл не передан" }, { status: 400 });
    }

    const uniqueFilename = `media/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
    
    const blob = await put(uniqueFilename, file, {
      access: "public",
    });

    return NextResponse.json({ url: blob.url });
  } catch (error) {
    return NextResponse.json({ error: error.message || "Ошибка загрузки файла" }, { status: 500 });
  }
}
