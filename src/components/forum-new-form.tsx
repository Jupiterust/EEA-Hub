"use client";

import { useEffect, useRef, useState } from "react";
import { createPostAction } from "@/lib/actions";
import { DivisionTeamSelect } from "@/components/division-team-select";
import { MarkdownEditor } from "@/components/markdown-editor";
import { SubmitButton } from "@/components/submit-button";
import { Field, inputClass } from "@/components/ui";

const DRAFT_KEY = "draft_forum_new";
const PENDING_KEY = "draft_forum_new_pending";

interface Draft {
  title: string;
  tags: string;
  content: string;
  isAnonymous: boolean;
  savedAt: string;
}

interface InitialState {
  title: string;
  tags: string;
  content: string;
  isAnonymous: boolean;
  draftTime: string | null;
}

const EMPTY: InitialState = { title: "", tags: "", content: "", isAnonymous: false, draftTime: null };

function initFromStorage(hasError: boolean): InitialState {
  if (typeof window === "undefined") return EMPTY;

  const pending = localStorage.getItem(PENDING_KEY);
  if (pending) {
    localStorage.removeItem(PENDING_KEY);
    if (!hasError) {
      localStorage.removeItem(DRAFT_KEY);
      return EMPTY;
    }
  }

  const saved = localStorage.getItem(DRAFT_KEY);
  if (!saved) return EMPTY;
  try {
    const draft: Draft = JSON.parse(saved);
    return {
      title: draft.title ?? "",
      tags: draft.tags ?? "",
      content: draft.content ?? "",
      isAnonymous: draft.isAnonymous ?? false,
      draftTime: draft.savedAt ?? null,
    };
  } catch {
    return EMPTY;
  }
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function ForumNewForm({ hasError }: { hasError: boolean }) {
  const [initial] = useState(() => initFromStorage(hasError));
  const [title, setTitle] = useState(initial.title);
  const [tags, setTags] = useState(initial.tags);
  const [content, setContent] = useState(initial.content);
  const [isAnonymous, setIsAnonymous] = useState(initial.isAnonymous);
  const [draftTime, setDraftTime] = useState(initial.draftTime);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-save: only writes to localStorage, no setState calls
  useEffect(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      if (!title && !tags && !content) {
        localStorage.removeItem(DRAFT_KEY);
        return;
      }
      const draft: Draft = { title, tags, content, isAnonymous, savedAt: new Date().toISOString() };
      localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    }, 2000);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [title, tags, content, isAnonymous]);

  function clearDraft() {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    localStorage.removeItem(DRAFT_KEY);
    setTitle("");
    setTags("");
    setContent("");
    setIsAnonymous(false);
    setDraftTime(null);
  }

  function handleSubmit() {
    localStorage.setItem(PENDING_KEY, "1");
  }

  return (
    <>
      {draftTime && (
        <div className="mt-4 flex items-center justify-between rounded-md border border-primary/30 bg-primary/10 px-3 py-2 text-sm text-primary">
          <span>已恢复上次草稿（保存于 {formatTime(draftTime)}）</span>
          <button
            type="button"
            onClick={clearDraft}
            className="ml-4 rounded px-2 py-0.5 text-xs font-medium text-danger transition hover:bg-danger/10"
          >
            清除草稿
          </button>
        </div>
      )}
      <form action={createPostAction} onSubmit={handleSubmit} className="mt-6 grid gap-4">
        <Field label="标题">
          <input
            name="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className={inputClass}
            required
          />
        </Field>
        <DivisionTeamSelect />
        <Field label="标签">
          <input
            name="tags"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            className={inputClass}
            placeholder="STM32 FPGA 视觉 控制算法"
          />
        </Field>
        <MarkdownEditor name="content" label="正文" value={content} onChange={setContent} rows={12} />
        <Field label="配图（选填，最多 9 张 jpg/png/webp）">
          <input
            name="images"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            className={inputClass}
          />
        </Field>
        <label className="flex items-center gap-2 text-sm font-semibold text-text-primary">
          <input
            name="isAnonymous"
            type="checkbox"
            className="size-4"
            checked={isAnonymous}
            onChange={(e) => setIsAnonymous(e.target.checked)}
          />
          匿名发布
        </label>
        <SubmitButton pendingText="发布中...">发布</SubmitButton>
      </form>
    </>
  );
}
