"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { copy } from "../../../lib/copy";
import { copyTextToClipboard } from "../../../lib/clipboard";
import {
  readStoredMemberId,
  resolveMemberId,
  writeStoredMemberId,
} from "../../../lib/identity-storage";
import { shareListLink } from "../../../lib/share-link";

export type Member = { id: number; name: string };

type MemberSheet = "add" | "rename" | "switch" | null;

type Props = {
  listId: string;
  listName: string;
  initialMembers: Member[];
};

export function BookListView({ listId, listName, initialMembers }: Props) {
  const [members, setMembers] = useState(initialMembers);
  const [sessionIdentity, setSessionIdentity] = useState<number | null>(null);
  const [gatePickId, setGatePickId] = useState<number | null>(null);
  const hydrated = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const persistedId =
    hydrated && typeof localStorage !== "undefined"
      ? readStoredMemberId(localStorage, listId)
      : null;
  const persistedResolved = resolveMemberId(members, persistedId);
  const identityId = sessionIdentity ?? persistedResolved;
  const [memberSheet, setMemberSheet] = useState<MemberSheet>(null);
  const [activeMemberId, setActiveMemberId] = useState<number | null>(null);
  const [nameInput, setNameInput] = useState("");
  const [fieldError, setFieldError] = useState("");
  const [toast, setToast] = useState("");
  const submitting = useRef(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const identityMember = members.find((member) => member.id === identityId) ?? null;
  const showGate = hydrated && identityId === null;

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

  if (!hydrated) {
    return (
      <main className="list">
        <div className="list-top">
          <h1>{listName}</h1>
        </div>
        <p className="kicker">{copy.loading}</p>
      </main>
    );
  }

  async function copyLink() {
    const url = typeof window !== "undefined" ? window.location.href : "";
    const copied = await copyTextToClipboard(url);
    if (copied) showToast(copy.linkCopied);
  }

  async function onShare() {
    const url = typeof window !== "undefined" ? window.location.href : "";
    const result = await shareListLink(url, listName);
    if (result === "copied") showToast(copy.linkCopied);
  }

  function openAddMember(onGate = false) {
    setMemberSheet("add");
    setActiveMemberId(null);
    setNameInput("");
    setFieldError("");
    if (onGate) return;
  }

  function openRename(member: Member) {
    if (identityId === null) return;
    setMemberSheet("rename");
    setActiveMemberId(member.id);
    setNameInput(member.name);
    setFieldError("");
  }

  function openSwitchIdentity() {
    setMemberSheet("switch");
    setGatePickId(identityId);
    setFieldError("");
  }

  function closeSheet() {
    setMemberSheet(null);
    setActiveMemberId(null);
    setNameInput("");
    setFieldError("");
  }

  function confirmIdentity(memberId: number) {
    setSessionIdentity(memberId);
    writeStoredMemberId(typeof localStorage !== "undefined" ? localStorage : null, listId, memberId);
    setGatePickId(memberId);
  }

  function onGateEnter() {
    if (members.length === 0) {
      setFieldError(copy.noMembers);
      return;
    }
    if (gatePickId === null) {
      setFieldError(copy.identityRequired);
      return;
    }
    confirmIdentity(gatePickId);
    setFieldError("");
  }

  function onSwitchConfirm() {
    if (gatePickId === null) {
      setFieldError(copy.identityRequired);
      return;
    }
    confirmIdentity(gatePickId);
    closeSheet();
  }

  async function submitAddMember() {
    if (submitting.current) return;
    submitting.current = true;
    setFieldError("");
    try {
      const response = await fetch(`/api/book-lists/${listId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: nameInput }),
      });
      const data: unknown = await response.json();
      if (!response.ok) {
        const message =
          data && typeof data === "object" && "error" in data && typeof data.error === "string"
            ? data.error
            : copy.memberNameRequired;
        setFieldError(message);
        return;
      }
      const member =
        data && typeof data === "object" && "member" in data && data.member && typeof data.member === "object"
          ? (data.member as Member)
          : null;
      if (!member) return;
      setMembers((prev) => [...prev, member]);
      if (showGate && gatePickId === null) setGatePickId(member.id);
      closeSheet();
      showToast(copy.saved);
    } finally {
      submitting.current = false;
    }
  }

  async function submitRename() {
    if (submitting.current || activeMemberId === null) return;
    submitting.current = true;
    setFieldError("");
    try {
      const response = await fetch(`/api/book-lists/${listId}/members/${activeMemberId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: nameInput }),
      });
      const data: unknown = await response.json();
      if (!response.ok) {
        const message =
          data && typeof data === "object" && "error" in data && typeof data.error === "string"
            ? data.error
            : copy.memberNameRequired;
        setFieldError(message);
        return;
      }
      const member =
        data && typeof data === "object" && "member" in data && data.member && typeof data.member === "object"
          ? (data.member as Member)
          : null;
      if (!member) return;
      setMembers((prev) => prev.map((entry) => (entry.id === member.id ? member : entry)));
      closeSheet();
      showToast(copy.saved);
    } finally {
      submitting.current = false;
    }
  }

  return (
    <>
      <main className={`list${showGate ? " is-gated" : ""}`} aria-hidden={showGate}>
        <div className="list-top">
          <h1>{listName}</h1>
          <div className="list-actions">
            <button type="button" className="ghost" onClick={() => void copyLink()}>
              {copy.copyLink}
            </button>
            <button type="button" className="ghost" onClick={() => void onShare()}>
              {copy.share}
            </button>
          </div>
        </div>

        {identityMember ? (
          <div className="identity-bar">
            <p className="kicker">{copy.currentIdentity(identityMember.name)}</p>
            <button type="button" className="chip" onClick={openSwitchIdentity}>
              {copy.switchIdentity}
            </button>
          </div>
        ) : null}

        <section aria-labelledby="members-heading">
          <h2 id="members-heading">{copy.members}</h2>
          {members.length === 0 ? (
            <p className="empty">{copy.noMembers}</p>
          ) : (
            <div className="people-row">
              {members.map((member) => (
                <button
                  key={member.id}
                  type="button"
                  className={`person-tag${member.id === identityId ? " is-me" : ""}`}
                  onClick={() => openRename(member)}
                  disabled={identityId === null}
                >
                  {member.name}
                </button>
              ))}
            </div>
          )}
          <button
            type="button"
            className="chip add-person"
            onClick={() => openAddMember()}
            disabled={identityId === null}
          >
            {copy.addMember}
          </button>
        </section>

        <section>
          <p className="empty">{copy.listPlaceholder}</p>
        </section>
      </main>

      {showGate ? (
        <div className="gate-root" role="dialog" aria-modal="true" aria-labelledby="gate-title">
          <div className="gate">
            <h2 id="gate-title">{copy.pickIdentity}</h2>
            <p className="detail">
              {members.length === 0 ? copy.noMembers : copy.whoAmI}
            </p>

            {members.length === 0 ? (
              <>
                <label htmlFor="gate-member-name">{copy.memberNameLabel}</label>
                <input
                  id="gate-member-name"
                  value={nameInput}
                  onChange={(event) => setNameInput(event.target.value)}
                  autoComplete="off"
                />
                <button type="button" className="primary" onClick={() => void submitAddMember()}>
                  {copy.addMemberTitle}
                </button>
              </>
            ) : (
              <>
                <ul className="choice-list">
                  {members.map((member) => (
                    <li key={member.id}>
                      <label className="choice-row">
                        <input
                          type="radio"
                          name="gate-identity"
                          checked={gatePickId === member.id}
                          onChange={() => {
                            setGatePickId(member.id);
                            setFieldError("");
                          }}
                        />
                        {member.name}
                      </label>
                    </li>
                  ))}
                </ul>
                <button type="button" className="chip" onClick={() => openAddMember(true)}>
                  {copy.addMember}
                </button>
                <button type="button" className="primary" onClick={onGateEnter}>
                  {copy.enterList}
                </button>
              </>
            )}

            {fieldError ? (
              <p className="alert" role="alert">
                {fieldError}
              </p>
            ) : null}
          </div>
        </div>
      ) : null}

      {memberSheet === "add" ? (
        <div className="sheet-root" role="dialog" aria-modal="true" aria-labelledby="add-member-title">
          <div className="sheet">
            <h2 id="add-member-title">{copy.addMemberTitle}</h2>
            <label htmlFor="member-name">{copy.memberNameLabel}</label>
            <input
              id="member-name"
              value={nameInput}
              onChange={(event) => setNameInput(event.target.value)}
              autoComplete="off"
            />
            {fieldError ? (
              <p className="alert" role="alert">
                {fieldError}
              </p>
            ) : null}
            <button type="button" className="primary" onClick={() => void submitAddMember()}>
              {copy.confirm}
            </button>
            <button type="button" className="ghost sheet-cancel" onClick={closeSheet}>
              {copy.cancel}
            </button>
          </div>
        </div>
      ) : null}

      {memberSheet === "rename" ? (
        <div className="sheet-root" role="dialog" aria-modal="true" aria-labelledby="rename-member-title">
          <div className="sheet">
            <h2 id="rename-member-title">{copy.manageMember}</h2>
            <label htmlFor="rename-member-name">{copy.memberNameLabel}</label>
            <input
              id="rename-member-name"
              value={nameInput}
              onChange={(event) => setNameInput(event.target.value)}
              autoComplete="off"
            />
            {fieldError ? (
              <p className="alert" role="alert">
                {fieldError}
              </p>
            ) : null}
            <button type="button" className="primary" onClick={() => void submitRename()}>
              {copy.save}
            </button>
            <button type="button" className="ghost sheet-cancel" onClick={closeSheet}>
              {copy.cancel}
            </button>
          </div>
        </div>
      ) : null}

      {memberSheet === "switch" ? (
        <div className="sheet-root" role="dialog" aria-modal="true" aria-labelledby="switch-identity-title">
          <div className="sheet">
            <h2 id="switch-identity-title">{copy.switchIdentity}</h2>
            <ul className="choice-list">
              {members.map((member) => (
                <li key={member.id}>
                  <label className="choice-row">
                    <input
                      type="radio"
                      name="switch-identity"
                      checked={gatePickId === member.id}
                      onChange={() => {
                        setGatePickId(member.id);
                        setFieldError("");
                      }}
                    />
                    {member.name}
                  </label>
                </li>
              ))}
            </ul>
            {fieldError ? (
              <p className="alert" role="alert">
                {fieldError}
              </p>
            ) : null}
            <button type="button" className="primary" onClick={onSwitchConfirm}>
              {copy.confirm}
            </button>
            <button type="button" className="ghost sheet-cancel" onClick={closeSheet}>
              {copy.cancel}
            </button>
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
