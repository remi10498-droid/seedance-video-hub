import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Параметр id обязателен" }, { status: 400 });
    }

    const apiKey = process.env.PICSART_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "PICSART_API_KEY не настроен в Vercel" }, { status: 500 });
    }

    const response = await fetch(`https://api.picsart.com/genai/v1/status/${id}`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: "application/json",
      },
      cache: "no-store",
    });

    // Если Picsart только формирует задачу и отвечает 404/202, не роняем сайт, а продолжаем опрос
    if (response.status === 404 || response.status === 202) {
      return NextResponse.json({ status: "IN_PROGRESS" }, { status: 200 });
    }

    const data = await response.json().catch(() => null);

    if (!response.ok || !data) {
      return NextResponse.json({ status: "IN_PROGRESS" }, { status: 200 });
    }

    // Извлечение прямой ссылки на готовый файл
    let finalUrl =
      data.url ||
      data.results?.[0]?.url ||
      data.response?.result?.url ||
      data.response?.results?.[0]?.url ||
      data.data?.url ||
      data.data?.[0]?.url ||
      null;

    const rawStatus = String(data.status || data.response?.status || data.state || "").toUpperCase();
    const isCompleted =
      rawStatus === "COMPLETED" ||
      rawStatus === "DONE" ||
      rawStatus === "SUCCESS" ||
      Boolean(finalUrl);

    if (rawStatus === "FAILED" || rawStatus === "ERROR") {
      return NextResponse.json({
        status: "FAILED",
        error: data.message || data.detail || "Генерация отклонена сервисом Picsart",
      });
    }

    if (isCompleted && finalUrl) {
      return NextResponse.json({
        status: "DONE",
        url: finalUrl,
        credits: data.usage?.credits ?? data.response?.usage?.credits ?? null,
      });
    }

    return NextResponse.json({ status: "IN_PROGRESS" });
  } catch (error) {
    return NextResponse.json({ status: "IN_PROGRESS" }, { status: 200 });
  }
}
