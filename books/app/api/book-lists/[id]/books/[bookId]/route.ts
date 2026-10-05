import { copy } from "../../../../../../lib/copy";
import { deleteBook } from "../../../../../../lib/books";

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

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; bookId: string }> },
) {
  const { id, bookId: bookIdRaw } = await params;
  const bookId = parseBookId(bookIdRaw);
  if (bookId === null) {
    return Response.json({ error: copy.notFoundTitle }, { status: 404 });
  }
  const url = new URL(request.url);
  const memberId = parseMemberId(url.searchParams.get("memberId"));
  const result = await deleteBook(id, bookId, memberId);
  if (!result.ok) {
    const status = result.error === copy.notFoundTitle ? 404 : 400;
    return Response.json({ error: result.error }, { status });
  }
  return Response.json({ ok: true });
}
