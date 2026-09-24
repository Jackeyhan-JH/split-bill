import { copy } from "@/lib/copy";
import { removeParticipant, renameParticipant } from "@/lib/participants";

function parseParticipantId(raw: string): number | null {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) return null;
  return id;
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string; participantId: string }> },
) {
  const { id, participantId: rawParticipantId } = await context.params;
  const participantId = parseParticipantId(rawParticipantId);
  if (participantId === null) {
    return Response.json({ error: copy.notFoundTitle }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    body = null;
  }
  const name =
    body && typeof body === "object" && "name" in body ? (body as { name: unknown }).name : undefined;
  const result = renameParticipant(id, participantId, name);
  if (!result.ok) {
    const status =
      result.error === copy.notFoundTitle ? 404 : result.error === copy.personOnExpense ? 409 : 400;
    return Response.json({ error: result.error }, { status });
  }
  return Response.json(result.value);
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string; participantId: string }> },
) {
  const { id, participantId: rawParticipantId } = await context.params;
  const participantId = parseParticipantId(rawParticipantId);
  if (participantId === null) {
    return Response.json({ error: copy.notFoundTitle }, { status: 404 });
  }

  const result = removeParticipant(id, participantId);
  if (!result.ok) {
    const status =
      result.error === copy.notFoundTitle ? 404 : result.error === copy.personOnExpense ? 409 : 400;
    return Response.json({ error: result.error }, { status });
  }
  return Response.json(result.value);
}
