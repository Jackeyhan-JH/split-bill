import { copy } from "@/lib/copy";
import { getGathering } from "@/lib/gatherings";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const gathering = await getGathering(id);
  if (!gathering) {
    return Response.json({ error: copy.notFoundTitle }, { status: 404 });
  }
  return Response.json(gathering);
}
