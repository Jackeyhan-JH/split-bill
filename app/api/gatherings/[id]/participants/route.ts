import { copy } from "@/lib/copy";
import { addParticipant, listParticipants } from "@/lib/participants";
import { getGathering } from "@/lib/gatherings";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!(await getGathering(id))) {
    return Response.json({ error: copy.notFoundTitle }, { status: 404 });
  }
  return Response.json({ participants: await listParticipants(id) });
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    body = null;
  }
  const name =
    body && typeof body === "object" && "name" in body ? (body as { name: unknown }).name : undefined;
  const result = await addParticipant(id, name);
  if (!result.ok) {
    const status = result.error === copy.notFoundTitle ? 404 : 400;
    return Response.json({ error: result.error }, { status });
  }
  return Response.json(result.value, { status: 201 });
}
