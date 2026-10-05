import { notFound } from "next/navigation";
import { BookListView } from "./BookListView";
import { listMembers } from "@/lib/members";
import { getBookList } from "@/lib/book-lists";

export const dynamic = "force-dynamic";

export default async function BookListPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const list = await getBookList(id);
  if (!list) notFound();

  const members = await listMembers(id);

  return (
    <BookListView listId={list.id} listName={list.name} initialMembers={members} />
  );
}
