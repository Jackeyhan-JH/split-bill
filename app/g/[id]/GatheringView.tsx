"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { formatHkd } from "@/lib/amount";
import { copy } from "@/lib/copy";
import type { ExpenseView } from "@/lib/expenses";
import {
  computeSettlement,
  formatSignedNet,
  formatTransferLine,
} from "@/lib/settlement";

export type Participant = { id: number; name: string };

type PersonSheet = "add" | "manage" | null;
type ExpenseSheet = "create" | "edit" | null;

type Props = {
  gatheringId: string;
  gatheringName: string;
  initialParticipants: Participant[];
  initialExpenses: ExpenseView[];
};

export function GatheringView({
  gatheringId,
  gatheringName,
  initialParticipants,
  initialExpenses,
}: Props) {
  const [participants, setParticipants] = useState(initialParticipants);
  const [expenses, setExpenses] = useState(initialExpenses);
  const [personSheet, setPersonSheet] = useState<PersonSheet>(null);
  const [expenseSheet, setExpenseSheet] = useState<ExpenseSheet>(null);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [editingExpenseId, setEditingExpenseId] = useState<number | null>(null);
  const [nameInput, setNameInput] = useState("");
  const [descriptionInput, setDescriptionInput] = useState("");
  const [amountInput, setAmountInput] = useState("");
  const [payerId, setPayerId] = useState<number | null>(null);
  const [shareeIds, setShareeIds] = useState<number[]>([]);
  const [fieldError, setFieldError] = useState("");
  const [toast, setToast] = useState("");
  const [confirmDeletePerson, setConfirmDeletePerson] = useState(false);
  const [confirmDeleteExpense, setConfirmDeleteExpense] = useState(false);
  const [blockedDelete, setBlockedDelete] = useState("");
  const submitting = useRef(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hasExpenses = expenses.length > 0;
  const activeParticipant = participants.find((person) => person.id === activeId) ?? null;
  const settlement = useMemo(
    () =>
      computeSettlement(
        participants,
        expenses.map((entry) => ({
          amountCents: entry.amountCents,
          payerParticipantId: entry.payerParticipantId,
          shares: entry.shares,
        })),
      ),
    [participants, expenses],
  );

  const showToast = useCallback((message: string) => {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 2400);
  }, []);

  const dismissToast = useCallback(() => {
    setToast("");
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = null;
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, []);

  function openAdd() {
    dismissToast();
    setPersonSheet("add");
    setExpenseSheet(null);
    setActiveId(null);
    setNameInput("");
    setFieldError("");
    setConfirmDeletePerson(false);
    setBlockedDelete("");
  }

  function openManage(participant: Participant) {
    dismissToast();
    setPersonSheet("manage");
    setExpenseSheet(null);
    setActiveId(participant.id);
    setNameInput(participant.name);
    setFieldError("");
    setConfirmDeletePerson(false);
    setBlockedDelete("");
  }

  function closePersonSheet() {
    setPersonSheet(null);
    setActiveId(null);
    setNameInput("");
    setFieldError("");
    setConfirmDeletePerson(false);
    setBlockedDelete("");
  }

  function resetExpenseForm() {
    setDescriptionInput("");
    setAmountInput("");
    setPayerId(null);
    setShareeIds([]);
    setFieldError("");
    setConfirmDeleteExpense(false);
    setEditingExpenseId(null);
  }

  function openExpenseCreate() {
    if (participants.length === 0) {
      showToast(copy.needPeopleFirst);
      return;
    }
    dismissToast();
    setPersonSheet(null);
    setExpenseSheet("create");
    resetExpenseForm();
    setShareeIds(participants.map((person) => person.id));
  }

  function openExpenseEdit(expense: ExpenseView) {
    dismissToast();
    setPersonSheet(null);
    setExpenseSheet("edit");
    setEditingExpenseId(expense.id);
    setDescriptionInput(expense.description);
    setAmountInput((expense.amountCents / 100).toFixed(2));
    setPayerId(expense.payerParticipantId);
    setShareeIds([...expense.shareeParticipantIds]);
    setFieldError("");
    setConfirmDeleteExpense(false);
  }

  function closeExpenseSheet() {
    setExpenseSheet(null);
    resetExpenseForm();
  }

  function toggleSharee(participantId: number) {
    setShareeIds((current) =>
      current.includes(participantId)
        ? current.filter((id) => id !== participantId)
        : [...current, participantId],
    );
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
      closePersonSheet();
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
      setExpenses((current) =>
        current.map((expense) => ({
          ...expense,
          payerName: expense.payerParticipantId === person.id ? person.name : expense.payerName,
          shares: expense.shares.map((share) =>
            share.participantId === person.id ? { ...share, name: person.name } : share,
          ),
        })),
      );
      closePersonSheet();
      showToast(copy.saved);
    } finally {
      submitting.current = false;
    }
  }

  function requestDeletePerson() {
    if (!activeParticipant) return;
    setConfirmDeletePerson(true);
    setBlockedDelete("");
  }

  async function confirmDeletePersonAction() {
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
          setConfirmDeletePerson(false);
          setBlockedDelete(message);
          return;
        }
        return;
      }
      setParticipants((current) => current.filter((entry) => entry.id !== activeId));
      closePersonSheet();
      showToast(copy.saved);
    } finally {
      submitting.current = false;
    }
  }

  async function submitExpense() {
    if (submitting.current || !expenseSheet) return;
    if (!descriptionInput.trim()) {
      setFieldError(copy.descriptionRequired);
      return;
    }
    if (!payerId) {
      setFieldError(copy.payerRequired);
      return;
    }
    if (shareeIds.length === 0) {
      setFieldError(copy.shareesRequired);
      return;
    }
    submitting.current = true;
    setFieldError("");
    try {
      const payload = {
        description: descriptionInput,
        amount: amountInput,
        payerParticipantId: payerId,
        shareeParticipantIds: shareeIds,
      };
      const url =
        expenseSheet === "edit" && editingExpenseId !== null
          ? `/api/gatherings/${gatheringId}/expenses/${editingExpenseId}`
          : `/api/gatherings/${gatheringId}/expenses`;
      const response = await fetch(url, {
        method: expenseSheet === "edit" ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data: unknown = await response.json();
      if (!response.ok) {
        const message =
          data && typeof data === "object" && "error" in data && typeof data.error === "string"
            ? data.error
            : copy.descriptionRequired;
        setFieldError(message);
        return;
      }
      const expense = parseExpense(data);
      if (!expense) return;
      if (expenseSheet === "edit") {
        setExpenses((current) => current.map((entry) => (entry.id === expense.id ? expense : entry)));
      } else {
        setExpenses((current) => [...current, expense]);
      }
      closeExpenseSheet();
      showToast(copy.saved);
    } finally {
      submitting.current = false;
    }
  }

  async function confirmDeleteExpenseAction() {
    if (submitting.current || editingExpenseId === null) return;
    submitting.current = true;
    try {
      const response = await fetch(
        `/api/gatherings/${gatheringId}/expenses/${editingExpenseId}`,
        { method: "DELETE" },
      );
      if (!response.ok) return;
      setExpenses((current) => current.filter((entry) => entry.id !== editingExpenseId));
      closeExpenseSheet();
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
    <section aria-label={copy.expenses}>
      <h2>{copy.expenses}</h2>
      {hasExpenses ? (
        <ul className="expense-list">
          {expenses.map((expense) => (
            <li key={expense.id}>
              <button
                type="button"
                className="expense-row"
                onClick={() => openExpenseEdit(expense)}
              >
                <div className="expense-row-head">
                  <span className="expense-desc">{expense.description}</span>
                  <span className="money">{formatHkd(expense.amountCents)}</span>
                </div>
                <p className="expense-meta">
                  付款人 {expense.payerName}
                </p>
                <ul className="expense-shares">
                  {expense.shares.map((share) => (
                    <li key={share.participantId}>
                      <span>{share.name}</span>
                      <span className="money">{formatHkd(share.amountCents)}</span>
                    </li>
                  ))}
                </ul>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="empty">{copy.noExpenses}</p>
      )}
    </section>
  );

  const settlementSection = (
    <section aria-label={copy.settlement} className="settlement">
      <h2>{copy.settlement}</h2>
      {hasExpenses ? (
        <>
          <table className="settlement-table">
            <thead>
              <tr>
                <th scope="col">人</th>
                <th scope="col" className="money-col">
                  已付
                </th>
                <th scope="col" className="money-col">
                  应付
                </th>
                <th scope="col" className="money-col">
                  净额
                </th>
              </tr>
            </thead>
            <tbody>
              {settlement.summaries.map((row) => (
                <tr key={row.participantId}>
                  <th scope="row">{row.name}</th>
                  <td className="money">{formatHkd(row.paidCents)}</td>
                  <td className="money">{formatHkd(row.owedCents)}</td>
                  <td className={`money net ${row.netCents > 0 ? "positive" : row.netCents < 0 ? "negative" : ""}`}>
                    {formatSignedNet(row.netCents)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="settlement-outcome" data-testid="settlement-outcome">
            {settlement.allSettled ? (
              <p className="settled">{copy.allSettled}</p>
            ) : (
              <ul className="transfer-list">
                {settlement.transfers.map((transfer, index) => (
                  <li key={`${transfer.fromParticipantId}-${transfer.toParticipantId}-${index}`}>
                    {formatTransferLine(transfer.fromName, transfer.amountCents, transfer.toName)}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      ) : (
        <p className="empty" data-testid="settlement-outcome">
          {copy.noBills}
        </p>
      )}
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
        <button
          className={`primary${participants.length === 0 ? " is-disabled" : ""}`}
          type="button"
          aria-disabled={participants.length === 0}
          onClick={openExpenseCreate}
        >
          {copy.addExpense}
        </button>
      </div>

      {personSheet ? (
        <div className="sheet-root" role="presentation" onClick={closePersonSheet}>
          <div
            className="sheet"
            role="dialog"
            aria-modal="true"
            aria-labelledby="person-sheet-title"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 id="person-sheet-title">
              {personSheet === "add" ? copy.addPersonTitle : copy.managePerson}
            </h2>
            <label htmlFor="person-name">{copy.personNameLabel}</label>
            <input
              id="person-name"
              value={nameInput}
              autoComplete="off"
              onChange={(event) => setNameInput(event.target.value)}
            />
            {fieldError && !expenseSheet ? (
              <p className="alert" role="alert">
                {fieldError}
              </p>
            ) : null}
            {blockedDelete ? (
              <p className="alert" role="alert">
                {blockedDelete}
              </p>
            ) : null}
            {confirmDeletePerson && activeParticipant ? (
              <div className="confirm-box">
                <p>{copy.deletePersonConfirm(activeParticipant.name)}</p>
                <div className="confirm-actions">
                  <button
                    className="ghost"
                    type="button"
                    onClick={() => setConfirmDeletePerson(false)}
                  >
                    {copy.cancel}
                  </button>
                  <button className="primary inline" type="button" onClick={confirmDeletePersonAction}>
                    {copy.confirm}
                  </button>
                </div>
              </div>
            ) : (
              <>
                <button
                  className="primary"
                  type="button"
                  onClick={personSheet === "add" ? submitAdd : submitRename}
                >
                  {personSheet === "add" ? copy.confirm : copy.save}
                </button>
                {personSheet === "manage" ? (
                  <button className="ghost danger" type="button" onClick={requestDeletePerson}>
                    {copy.deletePerson}
                  </button>
                ) : null}
                <button className="ghost sheet-cancel" type="button" onClick={closePersonSheet}>
                  {copy.cancel}
                </button>
              </>
            )}
          </div>
        </div>
      ) : null}

      {expenseSheet ? (
        <div className="sheet-root" role="presentation" onClick={closeExpenseSheet}>
          <div
            className="sheet"
            role="dialog"
            aria-modal="true"
            aria-labelledby="expense-sheet-title"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 id="expense-sheet-title">
              {expenseSheet === "edit" ? copy.editExpense : copy.addExpense}
            </h2>
            <label htmlFor="expense-description">{copy.expenseDescriptionLabel}</label>
            <input
              id="expense-description"
              value={descriptionInput}
              autoComplete="off"
              onChange={(event) => setDescriptionInput(event.target.value)}
            />
            <label htmlFor="expense-amount">{copy.expenseAmountLabel}</label>
            <div className="amount-field">
              <span className="amount-prefix">HK$</span>
              <input
                id="expense-amount"
                inputMode="decimal"
                value={amountInput}
                autoComplete="off"
                onChange={(event) => setAmountInput(event.target.value)}
              />
            </div>
            <p className="field-label">{copy.expensePayerLabel}</p>
            <ul className="choice-list">
              {participants.map((person) => (
                <li key={person.id}>
                  <label className="choice-row">
                    <input
                      type="radio"
                      name="expense-payer"
                      checked={payerId === person.id}
                      onChange={() => setPayerId(person.id)}
                    />
                    <span>{person.name}</span>
                  </label>
                </li>
              ))}
            </ul>
            <p className="field-label">{copy.expenseShareesLabel}</p>
            <ul className="choice-list">
              {participants.map((person) => (
                <li key={person.id}>
                  <label className="choice-row">
                    <input
                      type="checkbox"
                      checked={shareeIds.includes(person.id)}
                      onChange={() => toggleSharee(person.id)}
                    />
                    <span>{person.name}</span>
                  </label>
                </li>
              ))}
            </ul>
            {fieldError && expenseSheet ? (
              <p className="alert" role="alert">
                {fieldError}
              </p>
            ) : null}
            {confirmDeleteExpense ? (
              <div className="confirm-box">
                <p>{copy.deleteExpenseConfirm}</p>
                <div className="confirm-actions">
                  <button
                    className="ghost"
                    type="button"
                    onClick={() => setConfirmDeleteExpense(false)}
                  >
                    {copy.cancel}
                  </button>
                  <button className="primary inline" type="button" onClick={confirmDeleteExpenseAction}>
                    {copy.confirm}
                  </button>
                </div>
              </div>
            ) : (
              <>
                <button className="primary" type="button" onClick={submitExpense}>
                  {copy.save}
                </button>
                {expenseSheet === "edit" ? (
                  <button
                    className="ghost danger"
                    type="button"
                    onClick={() => setConfirmDeleteExpense(true)}
                  >
                    {copy.deleteExpense}
                  </button>
                ) : null}
                <button className="ghost sheet-cancel" type="button" onClick={closeExpenseSheet}>
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

function parseExpense(data: unknown): ExpenseView | null {
  if (!data || typeof data !== "object") return null;
  const record = data as Record<string, unknown>;
  if (
    typeof record.id !== "number" ||
    typeof record.description !== "string" ||
    typeof record.amountCents !== "number" ||
    typeof record.payerParticipantId !== "number" ||
    typeof record.payerName !== "string" ||
    !Array.isArray(record.shareeParticipantIds) ||
    !Array.isArray(record.shares)
  ) {
    return null;
  }
  const shares = record.shares
    .map((entry) => {
      if (!entry || typeof entry !== "object") return null;
      const share = entry as Record<string, unknown>;
      if (
        typeof share.participantId !== "number" ||
        typeof share.name !== "string" ||
        typeof share.amountCents !== "number"
      ) {
        return null;
      }
      return {
        participantId: share.participantId,
        name: share.name,
        amountCents: share.amountCents,
      };
    })
    .filter((entry): entry is ExpenseView["shares"][number] => entry !== null);
  if (shares.length !== record.shares.length) return null;
  return {
    id: record.id,
    description: record.description,
    amountCents: record.amountCents,
    payerParticipantId: record.payerParticipantId,
    payerName: record.payerName,
    shareeParticipantIds: record.shareeParticipantIds.filter((id): id is number => typeof id === "number"),
    shares,
  };
}
