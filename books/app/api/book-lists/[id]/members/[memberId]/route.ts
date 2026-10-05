import { copy } from "../../../../../../lib/copy";
import { renameMember } from "../../../../../../lib/members";

async function readName(request: Request): Promise<unknown> {
  try {
    const body: unknown = await request.json();
    if (!body || typeof body !== "object" || !("name" in body)) return "";
    return body.name;
  } catch {
    return "";
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; memberId: string }> },
) {
  const { id, memberId: rawMemberId } = await params;
  const memberId = Number.parseInt(rawMemberId, 10);
  if (!Number.isFinite(memberId)) {
    return Response.json({ error: copy.notFoundTitle }, { status: 404 });
  }
  const result = await renameMember(id, memberId, await readName(request));
  if (!result.ok) {
    const status = result.error === copy.notFoundTitle ? 404 : 400;
    return Response.json({ error: result.error }, { status });
  }
  return Response.json({ member: result.value });
}
