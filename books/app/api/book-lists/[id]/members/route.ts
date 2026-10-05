import { copy } from "../../../../../lib/copy";
import { addMember, listMembers } from "../../../../../lib/members";

async function readName(request: Request): Promise<unknown> {
  try {
    const body: unknown = await request.json();
    if (!body || typeof body !== "object" || !("name" in body)) return "";
    return body.name;
  } catch {
    return "";
  }
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const members = await listMembers(id);
  if (members.length === 0) {
    const { getBookList } = await import("../../../../../lib/book-lists");
    if (!(await getBookList(id))) {
      return Response.json({ error: copy.notFoundTitle }, { status: 404 });
    }
  }
  return Response.json({ members });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await addMember(id, await readName(request));
  if (!result.ok) {
    const status = result.error === copy.notFoundTitle ? 404 : 400;
    return Response.json({ error: result.error }, { status });
  }
  return Response.json({ member: result.value }, { status: 201 });
}
