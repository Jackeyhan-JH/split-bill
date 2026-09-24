import { notFound } from "next/navigation";
import { getGathering } from "@/lib/gatherings";

export const dynamic = "force-dynamic";

export default async function GatheringPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const gathering = getGathering(id);
  if (!gathering) notFound();

  return (
    <main>
      <h1>{gathering.name}</h1>
    </main>
  );
}
