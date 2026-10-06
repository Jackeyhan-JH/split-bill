"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { copy } from "../../../lib/copy";
import { errorMessageFromBody, readResponseJson } from "../../../lib/http-json";
import { copyTextToClipboard } from "../../../lib/clipboard";
import {
  readStoredMemberId,
  resolveMemberId,
  writeStoredMemberId,
} from "../../../lib/identity-storage";
import { shareListLink } from "../../../lib/share-link";
import {
  MUST_READ_MAX,
  scoreLabel,
  type BookRow,
  type BookScore,
} from "../../../lib/book-scores";
import {
  booksRatedByMember,
  collectiveTierLines,
  mustReadCountForMember,
  ratingForMember,
  sortCollectiveBooks,
  sortPersonalGroup,
} from "../../../lib/shelf";

export type Member = { id: number; name: string };

type MemberSheet = "add" | "rename" | "switch" | "rate" | "delete" | null;
type ActiveShelf = "collective" | number;

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
  const [books, setBooks] = useState<BookRow[]>([]);
  const [activeShelf, setActiveShelf] = useState<ActiveShelf>("collective");
  const [bookTitleInput, setBookTitleInput] = useState("");
  const [addScore, setAddScore] = useState<BookScore | null>(null);
  const [activeBookId, setActiveBookId] = useState<number | null>(null);
  const [toast, setToast] = useState("");
  const submitting = useRef(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const identityMember = members.find((member) => member.id === identityId) ?? null;
  const mustReadCount = books.filter((book) => book.myScore === 3).length;
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

  useEffect(() => {
    if (!hydrated) return;
    let active = true;
    const query = identityId !== null ? `?memberId=${identityId}` : "";
    void fetch(`/api/book-lists/${listId}/books${query}`)
      .then((response) => (response.ok ? response.json() : null))
      .then((data: unknown) => {
        if (!active || !data || typeof data !== "object" || !("books" in data) || !Array.isArray(data.books)) {
          return;
        }
        setBooks(data.books as BookRow[]);
      });
    return () => {
      active = false;
    };
  }, [hydrated, identityId, listId]);

  const activeBook = books.find((book) => book.id === activeBookId) ?? null;

  function canEditBookOnShelf(): boolean {
    if (identityId === null) return false;
    if (activeShelf === "collective") return true;
    return activeShelf === identityId;
  }

  function openRateBook(book: BookRow) {
    if (!canEditBookOnShelf()) return;
    setMemberSheet("rate");
    setActiveBookId(book.id);
    setFieldError("");
  }

  function openDeleteBook(book: BookRow) {
    if (identityId === null || activeShelf !== "collective") return;
    setMemberSheet("delete");
    setActiveBookId(book.id);
    setFieldError("");
  }

  const collectiveBooks = sortCollectiveBooks(books);
  const shelfMember =
    typeof activeShelf === "number"
      ? (members.find((member) => member.id === activeShelf) ?? null)
      : null;
  const personalRated =
    shelfMember !== null ? booksRatedByMember(books, shelfMember.id) : [];
  const shelfTitle =
    activeShelf === "collective"
      ? copy.collectiveShelf
      : shelfMember
        ? copy.personalShelf(shelfMember.name)
        : copy.collectiveShelf;

  async function submitAddBook() {
    if (submitting.current || identityId === null) return;
    submitting.current = true;
    setFieldError("");
    try {
      const response = await fetch(`/api/book-lists/${listId}/books`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: bookTitleInput,
          memberId: identityId,
          ...(addScore !== null ? { score: addScore } : {}),
        }),
      });
      const { data, parseError } = await readResponseJson(response);
      if (!response.ok) {
        setFieldError(errorMessageFromBody(data, parseError, copy.bookTitleRequired));
        return;
      }
      if (parseError) {
        setFieldError(copy.requestFailed);
        return;
      }
      const book =
        data && typeof data === "object" && "book" in data && data.book && typeof data.book === "object"
          ? (data.book as BookRow)
          : null;
      if (!book) return;
      setBooks((prev) => {
        const existing = prev.find((entry) => entry.id === book.id);
        if (existing) {
          return prev.map((entry) => (entry.id === book.id ? book : entry));
        }
        return [...prev, book];
      });
      setBookTitleInput("");
      setAddScore(null);
      showToast(copy.saved);
    } finally {
      submitting.current = false;
    }
  }

  async function submitRating(score: BookScore) {
    if (submitting.current || identityId === null || activeBookId === null) return;
    submitting.current = true;
    setFieldError("");
    const previousBooks = books;
    setBooks((prev) =>
      prev.map((entry) => (entry.id === activeBookId ? { ...entry, myScore: score } : entry)),
    );
    try {
      const response = await fetch(`/api/book-lists/${listId}/books/${activeBookId}/ratings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId: identityId, score }),
      });
      const { data, parseError } = await readResponseJson(response);
      if (!response.ok) {
        setBooks(previousBooks);
        setFieldError(errorMessageFromBody(data, parseError, copy.requestFailed));
        return;
      }
      if (parseError) {
        setBooks(previousBooks);
        setFieldError(copy.requestFailed);
        return;
      }
      const book =
        data && typeof data === "object" && "book" in data && data.book && typeof data.book === "object"
          ? (data.book as BookRow)
          : null;
      if (!book) {
        setBooks(previousBooks);
        return;
      }
      setBooks((prev) => prev.map((entry) => (entry.id === book.id ? book : entry)));
      closeSheet();
      showToast(copy.saved);
    } catch {
      setBooks(previousBooks);
      setFieldError(copy.requestFailed);
    } finally {
      submitting.current = false;
    }
  }

  async function submitDeleteBook() {
    if (submitting.current || identityId === null || activeBookId === null) return;
    submitting.current = true;
    setFieldError("");
    const deletedId = activeBookId;
    try {
      const response = await fetch(
        `/api/book-lists/${listId}/books/${deletedId}?memberId=${identityId}`,
        { method: "DELETE" },
      );
      const data: unknown = await response.json();
      if (!response.ok) {
        const message =
          data && typeof data === "object" && "error" in data && typeof data.error === "string"
            ? data.error
            : copy.notFoundTitle;
        setFieldError(message);
        return;
      }
      setBooks((prev) => prev.filter((entry) => entry.id !== deletedId));
      closeSheet();
      showToast(copy.saved);
    } catch {
      setFieldError(copy.notFoundTitle);
    } finally {
      submitting.current = false;
    }
  }

  async function submitRevokeRating() {
    if (submitting.current || identityId === null || activeBookId === null) return;
    submitting.current = true;
    setFieldError("");
    const previousBooks = books;
    setBooks((prev) =>
      prev.map((entry) => (entry.id === activeBookId ? { ...entry, myScore: null } : entry)),
    );
    try {
      const response = await fetch(
        `/api/book-lists/${listId}/books/${activeBookId}/ratings?memberId=${identityId}`,
        { method: "DELETE" },
      );
      const { data, parseError } = await readResponseJson(response);
      if (!response.ok) {
        setBooks(previousBooks);
        setFieldError(errorMessageFromBody(data, parseError, copy.requestFailed));
        return;
      }
      if (parseError) {
        setBooks(previousBooks);
        setFieldError(copy.requestFailed);
        return;
      }
      const book =
        data && typeof data === "object" && "book" in data && data.book && typeof data.book === "object"
          ? (data.book as BookRow)
          : null;
      if (!book) {
        setBooks(previousBooks);
        return;
      }
      setBooks((prev) => prev.map((entry) => (entry.id === book.id ? book : entry)));
      closeSheet();
      showToast(copy.saved);
    } catch {
      setBooks(previousBooks);
      setFieldError(copy.requestFailed);
    } finally {
      submitting.current = false;
    }
  }

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
    setActiveBookId(null);
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
            <p className="must-read-badge" aria-live="polite">
              {copy.myMustRead(mustReadCount, MUST_READ_MAX)}
            </p>
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

        <nav className="shelf-tabs" aria-label={copy.shelfTabsLabel} role="tablist">
          <div className="shelf-tabs-scroll">
            <button
              type="button"
              role="tab"
              className={`shelf-tab${activeShelf === "collective" ? " is-active" : ""}`}
              aria-selected={activeShelf === "collective"}
              onClick={() => setActiveShelf("collective")}
            >
              {copy.collectiveTab}
            </button>
            {members.map((member) => (
              <button
                key={member.id}
                type="button"
                role="tab"
                className={`shelf-tab${activeShelf === member.id ? " is-active" : ""}`}
                aria-selected={activeShelf === member.id}
                onClick={() => setActiveShelf(member.id)}
              >
                {member.name}
                {member.id === identityId ? copy.tabMeSuffix : ""}
              </button>
            ))}
          </div>
        </nav>

        <section aria-labelledby="books-heading">
          <h2 id="books-heading">{shelfTitle}</h2>

          {activeShelf === "collective" ? (
            <>
              <label htmlFor="book-title">{copy.bookTitleLabel}</label>
              <input
                id="book-title"
                value={bookTitleInput}
                onChange={(event) => setBookTitleInput(event.target.value)}
                placeholder={copy.bookTitlePlaceholder}
                autoComplete="off"
                disabled={identityId === null}
              />
              <div className="score-picker" role="group" aria-label={copy.rateBook}>
                {([3, 2, 1] as const).map((score) => (
                  <button
                    key={score}
                    type="button"
                    className={`score-chip${addScore === score ? " is-selected" : ""}`}
                    aria-pressed={addScore === score}
                    disabled={identityId === null}
                    onClick={() => setAddScore((prev) => (prev === score ? null : score))}
                  >
                    {score} · {scoreLabel(score)}
                  </button>
                ))}
              </div>
              {fieldError && memberSheet === null && !showGate ? (
                <p className="alert" role="alert">
                  {fieldError}
                </p>
              ) : null}
              <button
                type="button"
                className="primary"
                disabled={identityId === null}
                onClick={() => void submitAddBook()}
              >
                {copy.addBook}
              </button>

              {books.length === 0 ? (
                <p className="empty books-empty">{copy.noBooks}</p>
              ) : (
                <ul className="book-list">
                  {collectiveBooks.map((book) => {
                    const tierLines = collectiveTierLines(book, members);
                    const editable = canEditBookOnShelf();
                    return (
                      <li key={book.id} className="book-list-row">
                        <button
                          type="button"
                          className="book-row"
                          onClick={() => openRateBook(book)}
                          disabled={!editable}
                        >
                          <span className="book-title">{book.title}</span>
                          {tierLines.map((line) => (
                            <span key={line} className="book-tier">
                              {line}
                            </span>
                          ))}
                          <span className="book-score">
                            {book.myScore !== null
                              ? copy.myScore(scoreLabel(book.myScore))
                              : copy.noScore}
                          </span>
                        </button>
                        {identityId !== null ? (
                          <button
                            type="button"
                            className="ghost book-delete-btn"
                            aria-label={`${copy.deleteBook}：${book.title}`}
                            onClick={() => openDeleteBook(book)}
                          >
                            {copy.deleteBook}
                          </button>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              )}
            </>
          ) : shelfMember ? (
            personalRated.length === 0 ? (
              <p className="empty books-empty">{copy.memberNoRatings(shelfMember.name)}</p>
            ) : (
              <div className="personal-shelf">
                {([3, 2, 1] as const).map((score) => {
                  const groupBooks = sortPersonalGroup(books, shelfMember.id, score);
                  const groupTitle =
                    score === 3 && shelfMember.id === identityId
                      ? copy.mustReadGroup(
                          mustReadCountForMember(books, shelfMember.id),
                          MUST_READ_MAX,
                        )
                      : scoreLabel(score);
                  return (
                    <section
                      key={score}
                      id={`group-${score}`}
                      className="shelf-group"
                      aria-labelledby={`group-${score}-title`}
                    >
                      <h3 id={`group-${score}-title`}>{groupTitle}</h3>
                      {groupBooks.length === 0 ? (
                        <p className="empty">{copy.shelfGroupEmpty}</p>
                      ) : (
                        <ul className="book-list">
                          {groupBooks.map((book) => {
                            const rating = ratingForMember(book, shelfMember.id);
                            const editable = canEditBookOnShelf();
                            const scoreText =
                              rating !== null ? scoreLabel(rating.score) : copy.noScore;
                            const rowBody = (
                              <>
                                <span className="book-title">{book.title}</span>
                                <span className="book-score">{scoreText}</span>
                              </>
                            );
                            return (
                              <li key={book.id}>
                                {editable ? (
                                  <button
                                    type="button"
                                    className="book-row"
                                    onClick={() => openRateBook(book)}
                                  >
                                    {rowBody}
                                  </button>
                                ) : (
                                  <div className="book-row is-readonly">{rowBody}</div>
                                )}
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </section>
                  );
                })}
              </div>
            )
          ) : null}
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

      {memberSheet === "rate" && activeBook ? (
        <div className="sheet-root" role="dialog" aria-modal="true" aria-labelledby="rate-book-title">
          <div className="sheet">
            <h2 id="rate-book-title">{copy.rateBook}</h2>
            <p className="detail book-rate-name">{activeBook.title}</p>
            <div className="score-picker" role="group" aria-label={copy.rateBook}>
              {([3, 2, 1] as const).map((score) => (
                <button
                  key={score}
                  type="button"
                  className={`score-chip${activeBook.myScore === score ? " is-selected" : ""}`}
                  onClick={() => void submitRating(score)}
                >
                  {score} · {scoreLabel(score)}
                </button>
              ))}
            </div>
            {fieldError ? (
              <p className="alert" role="alert">
                {fieldError}
              </p>
            ) : null}
            {activeBook.myScore !== null ? (
              <button type="button" className="ghost sheet-cancel" onClick={() => void submitRevokeRating()}>
                {copy.revokeScore}
              </button>
            ) : null}
            <button type="button" className="ghost sheet-cancel" onClick={closeSheet}>
              {copy.cancel}
            </button>
          </div>
        </div>
      ) : null}

      {memberSheet === "delete" && activeBook ? (
        <div className="sheet-root" role="dialog" aria-modal="true" aria-labelledby="delete-book-title">
          <div className="sheet">
            <h2 id="delete-book-title">{copy.deleteBookDialogTitle}</h2>
            <p className="detail">{copy.deleteBookConfirm(activeBook.title, activeBook.ratings.length)}</p>
            {fieldError ? (
              <p className="alert" role="alert">
                {fieldError}
              </p>
            ) : null}
            <button type="button" className="primary danger" onClick={() => void submitDeleteBook()}>
              {copy.confirmDelete}
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
