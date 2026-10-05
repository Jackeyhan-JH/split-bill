import { copy } from "../../../../lib/copy";
import { getBookList } from "../../../../lib/book-lists";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const list = await getBookList(id);
  if (!list) {
    return Response.json({ error: copy.notFoundTitle }, { status: 404 });
  }
  return Response.json(list);
}
