import { copy } from "@/lib/copy";
import { seedExpense } from "@/lib/expenses";

/** E2E-only helper to attach a minimal expense row (see README / PR for AC8). */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  if (process.env.E2E_TEST_HELPERS !== "1") {
    return Response.json({ error: "not found" }, { status: 404 });
  }

  const { id } = await context.params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    body = null;
  }
  if (!body || typeof body !== "object") {
    return Response.json({ error: "invalid body" }, { status: 400 });
  }

  const payerParticipantId =
    "payerParticipantId" in body ? Number((body as { payerParticipantId: unknown }).payerParticipantId) : NaN;
  const splitterParticipantIds =
    "splitterParticipantIds" in body && Array.isArray((body as { splitterParticipantIds: unknown }).splitterParticipantIds)
      ? (body as { splitterParticipantIds: unknown[] }).splitterParticipantIds.map(Number)
      : [];

  const expenseId = seedExpense(id, { payerParticipantId, splitterParticipantIds });
  if (expenseId === null) {
    return Response.json({ error: copy.notFoundTitle }, { status: 404 });
  }
  return Response.json({ id: expenseId }, { status: 201 });
}
