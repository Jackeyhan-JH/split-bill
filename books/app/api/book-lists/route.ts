import { createBookList } from "../../../lib/book-lists";

async function readName(request: Request): Promise<unknown> {
  try {
    const body: unknown = await request.json();
    if (!body || typeof body !== "object" || !("name" in body)) return "";
    return body.name;
  } catch {
    return "";
  }
}

export async function POST(request: Request) {
  const result = await createBookList(await readName(request));
  if (!result.ok) {
    return Response.json({ error: result.error }, { status: 400 });
  }
  return Response.json(result.list, { status: 201 });
}
