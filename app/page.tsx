"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { copy } from "@/lib/copy";

export default function HomePage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const submitting = useRef(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    if (!name.trim()) {
      setError(copy.nameRequired);
      return;
    }

    submitting.current = true;
    setError("");
    try {
      const response = await fetch("/api/gatherings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data: unknown = await response.json();
      const id = data && typeof data === "object" && "id" in data && typeof data.id === "string" ? data.id : "";
      const message =
        data && typeof data === "object" && "error" in data && typeof data.error === "string"
          ? data.error
          : "";
      if (!response.ok || !id) {
        setError(message || copy.nameRequired);
        return;
      }
      router.push(`/g/${id}`);
    } catch {
      return;
    } finally {
      submitting.current = false;
    }
  }

  return (
    <main>
      <h1>{copy.appName}</h1>
      <p className="tagline">{copy.tagline}</p>
      <form onSubmit={onSubmit}>
        <label htmlFor="gathering-name">{copy.nameLabel}</label>
        <input
          id="gathering-name"
          name="name"
          value={name}
          placeholder={copy.namePlaceholder}
          autoComplete="off"
          onChange={(event) => setName(event.target.value)}
        />
        <button className="primary" type="submit">
          {copy.create}
        </button>
        {error ? (
          <p className="alert" role="alert">
            {error}
          </p>
        ) : null}
      </form>
    </main>
  );
}
