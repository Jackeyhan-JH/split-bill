import { copy } from "../../../../../../../lib/copy";
import { revokeBookRating, setBookRating } from "../../../../../../../lib/books";

async function readBody(request: Request): Promise<Record<string, unknown>> {
  try {
    const body: unknown = await request.json();
    if (!body || typeof body !== "object") return {};
    return body as Record<string, unknown>;
  } catch {
    return {};
  }
}

function parseBookId(raw: string): number | null {
  const id = Number.parseInt(raw, 10);
  if (!Number.isFinite(id) || id <= 0) return null;
  return id;
}

function parseMemberId(raw: string | null): number | null {
  if (!raw) return null;
  const id = Number.parseInt(raw, 10);
  if (!Number.isFinite(id) || id <= 0) return null;
  return id;
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string; bookId: string }> }) {
  const { id, bookId: bookIdRaw } = await params;
  const bookId = parseBookId(bookIdRaw);
  if (bookId === null) {
    return Response.json({ error: copy.notFoundTitle }, { status: 404 });
  }
  const body = await readBody(request);
  const result = await setBookRating(id, bookId, body.memberId, body.score);
  if (!result.ok) {
    const status = result.error === copy.notFoundTitle ? 404 : 400;
    return Response.json({ error: result.error }, { status });
  }
  return Response.json({ book: result.value });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string; bookId: string }> }) {
  const { id, bookId: bookIdRaw } = await params;
  const bookId = parseBookId(bookIdRaw);
  if (bookId === null) {
    return Response.json({ error: copy.notFoundTitle }, { status: 404 });
  }
  const url = new URL(request.url);
  const memberId = parseMemberId(url.searchParams.get("memberId"));
  const result = await revokeBookRating(id, bookId, memberId);
  if (!result.ok) {
    const status = result.error === copy.notFoundTitle ? 404 : 400;
    return Response.json({ error: result.error }, { status });
  }
  return Response.json({ book: result.value });
}
