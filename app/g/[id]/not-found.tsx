import Link from "next/link";
import { copy } from "@/lib/copy";

export default function GatheringNotFound() {
  return (
    <main className="not-found">
      <h1>{copy.notFoundTitle}</h1>
      <p className="detail">{copy.notFoundDetail}</p>
      <Link className="primary" href="/">
        {copy.backHome}
      </Link>
    </main>
  );
}
