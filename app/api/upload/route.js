import { put } from '@vercel/blob';

export const dynamic = 'force-dynamic';

export async function POST(req) {
  try {
    const formData = await req.formData();
    const file = formData.get('file');

    if (!file) {
      return Response.json({ error: 'Файл не найден' }, { status: 400 });
    }

    const filename = `ref/${Date.now()}-${file.name || 'reference.jpg'}`;
    const blob = await put(filename, file, {
      access: 'public',
      contentType: 'image/jpeg'
    });

    return Response.json({ url: blob.url });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
