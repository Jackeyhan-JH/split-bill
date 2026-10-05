import { copy } from "../../../../../lib/copy";
import { addBook, listBooks } from "../../../../../lib/books";
import { getBookList } from "../../../../../lib/book-lists";

function parseMemberId(raw: string | null): number | null {
  if (!raw) return null;
  const id = Number.parseInt(raw, 10);
  if (!Number.isFinite(id) || id <= 0) return null;
  return id;
}

async function readBody(request: Request): Promise<Record<string, unknown>> {
  try {
    const body: unknown = await request.json();
    if (!body || typeof body !== "object") return {};
    return body as Record<string, unknown>;
  } catch {
    return {};
  }
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!(await getBookList(id))) {
    return Response.json({ error: copy.notFoundTitle }, { status: 404 });
  }
  const url = new URL(request.url);
  const memberId = parseMemberId(url.searchParams.get("memberId"));
  const books = await listBooks(id, memberId);
  return Response.json({ books });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await readBody(request);
  const result = await addBook(id, body.memberId, body.title, body.score);
  if (!result.ok) {
    const status =
      result.error === copy.notFoundTitle
        ? 404
        : result.error === copy.bookTitleRequired ||
            result.error === copy.memberRequired ||
            result.error === copy.invalidScore
          ? 400
          : 400;
    return Response.json({ error: result.error }, { status });
  }
  return Response.json({ book: result.value }, { status: 201 });
}
