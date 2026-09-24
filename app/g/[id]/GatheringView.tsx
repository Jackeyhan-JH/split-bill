"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { copy } from "@/lib/copy";

export type Participant = { id: number; name: string };

type SheetMode = "add" | "manage" | null;

type Props = {
  gatheringId: string;
  gatheringName: string;
  initialParticipants: Participant[];
  hasExpenses: boolean;
};

export function GatheringView({
  gatheringId,
  gatheringName,
  initialParticipants,
  hasExpenses,
}: Props) {
  const [participants, setParticipants] = useState(initialParticipants);
  const [sheet, setSheet] = useState<SheetMode>(null);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [nameInput, setNameInput] = useState("");
  const [fieldError, setFieldError] = useState("");
  const [toast, setToast] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [blockedDelete, setBlockedDelete] = useState("");
  const submitting = useRef(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const activeParticipant = participants.find((person) => person.id === activeId) ?? null;

  const showToast = useCallback((message: string) => {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 2400);
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, []);

  function openAdd() {
    setSheet("add");
    setActiveId(null);
    setNameInput("");
    setFieldError("");
    setConfirmDelete(false);
    setBlockedDelete("");
  }

  function openManage(participant: Participant) {
    setSheet("manage");
    setActiveId(participant.id);
    setNameInput(participant.name);
    setFieldError("");
    setConfirmDelete(false);
    setBlockedDelete("");
  }

  function closeSheet() {
    setSheet(null);
    setActiveId(null);
    setNameInput("");
    setFieldError("");
    setConfirmDelete(false);
    setBlockedDelete("");
  }

  async function submitAdd() {
    if (submitting.current) return;
    if (!nameInput.trim()) {
      setFieldError(copy.personNameRequired);
      return;
    }
    submitting.current = true;
    setFieldError("");
    try {
      const response = await fetch(`/api/gatherings/${gatheringId}/participants`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: nameInput }),
      });
      const data: unknown = await response.json();
      if (!response.ok) {
        const message =
          data && typeof data === "object" && "error" in data && typeof data.error === "string"
            ? data.error
            : copy.personNameRequired;
        setFieldError(message);
        return;
      }
      const person = parseParticipant(data);
      if (!person) return;
      setParticipants((current) => [...current, person]);
      closeSheet();
      showToast(copy.saved);
    } finally {
      submitting.current = false;
    }
  }

  async function submitRename() {
    if (submitting.current || activeId === null) return;
    if (!nameInput.trim()) {
      setFieldError(copy.personNameRequired);
      return;
    }
    submitting.current = true;
    setFieldError("");
    try {
      const response = await fetch(`/api/gatherings/${gatheringId}/participants/${activeId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: nameInput }),
      });
      const data: unknown = await response.json();
      if (!response.ok) {
        const message =
          data && typeof data === "object" && "error" in data && typeof data.error === "string"
            ? data.error
            : copy.personNameRequired;
        setFieldError(message);
        return;
      }
      const person = parseParticipant(data);
      if (!person) return;
      setParticipants((current) =>
        current.map((entry) => (entry.id === person.id ? person : entry)),
      );
      closeSheet();
      showToast(copy.saved);
    } finally {
      submitting.current = false;
    }
  }

  function requestDelete() {
    if (!activeParticipant) return;
    setConfirmDelete(true);
    setBlockedDelete("");
  }

  async function confirmDeletePerson() {
    if (submitting.current || activeId === null) return;
    submitting.current = true;
    setBlockedDelete("");
    try {
      const response = await fetch(`/api/gatherings/${gatheringId}/participants/${activeId}`, {
        method: "DELETE",
      });
      const data: unknown = await response.json();
      if (!response.ok) {
        const message =
          data && typeof data === "object" && "error" in data && typeof data.error === "string"
            ? data.error
            : "";
        if (message === copy.personOnExpense) {
          setConfirmDelete(false);
          setBlockedDelete(message);
          return;
        }
        return;
      }
      setParticipants((current) => current.filter((entry) => entry.id !== activeId));
      closeSheet();
      showToast(copy.saved);
    } finally {
      submitting.current = false;
    }
  }

  const peopleSection = (
    <section aria-label={copy.people}>
      <h2 className="kicker">{copy.people}</h2>
      <div className="people-row">
        {participants.map((person) => (
          <button
            key={person.id}
            className="person-tag"
            type="button"
            onClick={() => openManage(person)}
          >
            {person.name}
          </button>
        ))}
        <button className="chip add-person" type="button" onClick={openAdd}>
          {copy.addPerson}
        </button>
      </div>
      {participants.length === 0 ? <p className="empty">{copy.noPeople}</p> : null}
    </section>
  );

  const expensesSection = (
    <section>
      <h2>{copy.expenses}</h2>
      {!hasExpenses ? <p className="empty">{copy.noExpenses}</p> : null}
    </section>
  );

  const settlementSection = (
    <section>
      <h2>{copy.settlement}</h2>
      <p className="empty">{copy.noBills}</p>
    </section>
  );

  return (
    <>
      <main className="gathering">
        <div className="gathering-top">
          <h1>{gatheringName}</h1>
          <div className="gathering-actions">
            <button className="ghost" type="button">
              {copy.copyLink}
            </button>
            <button className="ghost" type="button">
              {copy.share}
            </button>
          </div>
        </div>
        {hasExpenses ? (
          <>
            {settlementSection}
            {peopleSection}
            {expensesSection}
          </>
        ) : (
          <>
            {peopleSection}
            {expensesSection}
            {settlementSection}
          </>
        )}
      </main>
      <div className="dock">
        <button className="primary" type="button">
          {copy.addExpense}
        </button>
      </div>

      {sheet ? (
        <div className="sheet-root" role="presentation" onClick={closeSheet}>
          <div
            className="sheet"
            role="dialog"
            aria-modal="true"
            aria-labelledby="person-sheet-title"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 id="person-sheet-title">{sheet === "add" ? copy.addPersonTitle : copy.managePerson}</h2>
            <label htmlFor="person-name">{copy.personNameLabel}</label>
            <input
              id="person-name"
              value={nameInput}
              autoComplete="off"
              onChange={(event) => setNameInput(event.target.value)}
            />
            {fieldError ? (
              <p className="alert" role="alert">
                {fieldError}
              </p>
            ) : null}
            {blockedDelete ? (
              <p className="alert" role="alert">
                {blockedDelete}
              </p>
            ) : null}
            {confirmDelete && activeParticipant ? (
              <div className="confirm-box">
                <p>{copy.deletePersonConfirm(activeParticipant.name)}</p>
                <div className="confirm-actions">
                  <button className="ghost" type="button" onClick={() => setConfirmDelete(false)}>
                    {copy.cancel}
                  </button>
                  <button className="primary inline" type="button" onClick={confirmDeletePerson}>
                    {copy.confirm}
                  </button>
                </div>
              </div>
            ) : (
              <>
                <button
                  className="primary"
                  type="button"
                  onClick={sheet === "add" ? submitAdd : submitRename}
                >
                  {sheet === "add" ? copy.confirm : copy.save}
                </button>
                {sheet === "manage" ? (
                  <button className="ghost danger" type="button" onClick={requestDelete}>
                    {copy.deletePerson}
                  </button>
                ) : null}
                <button className="ghost sheet-cancel" type="button" onClick={closeSheet}>
                  {copy.cancel}
                </button>
              </>
            )}
          </div>
        </div>
      ) : null}

      {toast ? (
        <p className="toast" role="status">
          {toast}
        </p>
      ) : null}
    </>
  );
}

function parseParticipant(data: unknown): Participant | null {
  if (!data || typeof data !== "object") return null;
  if (!("id" in data) || !("name" in data)) return null;
  const id = data.id;
  const name = data.name;
  if (typeof id !== "number" || typeof name !== "string") return null;
  return { id, name };
}
