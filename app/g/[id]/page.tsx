import { notFound } from "next/navigation";
import { GatheringView } from "./GatheringView";
import { listExpenses } from "@/lib/expenses";
import { listParticipants } from "@/lib/participants";
import { getGathering } from "@/lib/gatherings";

export const dynamic = "force-dynamic";

export default async function GatheringPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const gathering = getGathering(id);
  if (!gathering) notFound();

  const participants = listParticipants(id);
  const expenses = listExpenses(id);

  return (
    <GatheringView
      gatheringId={gathering.id}
      gatheringName={gathering.name}
      initialParticipants={participants}
      initialExpenses={expenses}
    />
  );
}
