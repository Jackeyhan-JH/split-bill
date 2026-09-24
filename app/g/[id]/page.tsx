import { notFound } from "next/navigation";
import { copy } from "@/lib/copy";
import { getGathering } from "@/lib/gatherings";

export const dynamic = "force-dynamic";

export default async function GatheringPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const gathering = getGathering(id);
  if (!gathering) notFound();

  return (
    <>
      <main className="gathering">
        <div className="gathering-top">
          <h1>{gathering.name}</h1>
          <div className="gathering-actions">
            <button className="ghost" type="button">
              {copy.copyLink}
            </button>
            <button className="ghost" type="button">
              {copy.share}
            </button>
          </div>
        </div>
        <section>
          <h2 className="kicker">{copy.people}</h2>
          <button className="chip" type="button">
            {copy.addPerson}
          </button>
          <p className="empty">{copy.noPeople}</p>
        </section>
        <section>
          <h2>{copy.expenses}</h2>
          <p className="empty">{copy.noExpenses}</p>
        </section>
        <section>
          <h2>{copy.settlement}</h2>
          <p className="empty">{copy.noBills}</p>
        </section>
      </main>
      <div className="dock">
        <button className="primary" type="button">
          {copy.addExpense}
        </button>
      </div>
    </>
  );
}
