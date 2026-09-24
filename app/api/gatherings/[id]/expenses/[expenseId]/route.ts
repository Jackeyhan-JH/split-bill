import { copy } from "@/lib/copy";
import { deleteExpense, updateExpense } from "@/lib/expenses";

export async function PATCH(request: Request, context: { params: Promise<{ id: string; expenseId: string }> }) {
  const { id, expenseId: expenseIdRaw } = await context.params;
  const expenseId = Number(expenseIdRaw);
  if (!Number.isInteger(expenseId) || expenseId <= 0) {
    return Response.json({ error: copy.notFoundTitle }, { status: 404 });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    body = null;
  }
  const result = await updateExpense(id, expenseId, body);
  if (!result.ok) {
    const status = result.error === copy.notFoundTitle ? 404 : 400;
    return Response.json({ error: result.error }, { status });
  }
  return Response.json(result.value);
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string; expenseId: string }> }) {
  const { id, expenseId: expenseIdRaw } = await context.params;
  const expenseId = Number(expenseIdRaw);
  if (!Number.isInteger(expenseId) || expenseId <= 0) {
    return Response.json({ error: copy.notFoundTitle }, { status: 404 });
  }
  const result = await deleteExpense(id, expenseId);
  if (!result.ok) {
    return Response.json({ error: result.error }, { status: 404 });
  }
  return Response.json(result.value);
}
