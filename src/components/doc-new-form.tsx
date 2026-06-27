"use client";

import { useEffect, useRef, useState } from "react";
import { createDocAction } from "@/lib/actions";
import { DivisionTeamSelect } from "@/components/division-team-select";
import { MarkdownEditor } from "@/components/markdown-editor";
import { SubmitButton } from "@/components/submit-button";
import { Tooltip } from "@/components/tooltip";
import { Field, inputClass } from "@/components/ui";

const DRAFT_KEY = "draft_doc_new";
const PENDING_KEY = "draft_doc_new_pending";

const SLUG_TIP =
  "文档的网址标识，出现在链接里，如 eea-hub.vercel.app/docs/你的slug。留空会根据标题自动生成，一般不用填。";
const PATH_TIP =
  "用 '>' 分隔层级，如「新人学习路径>STM32入门>GPIO配置」，文档会出现在左侧目录树的 '部门/小组/新人学习路径>STM32入门>GPIO配置' 下。留空则挂在所属小组下。";

interface Draft {
  title: string;
  path: string;
  excerpt: string;
  content: string;
  savedAt: string;
}

interface InitialState {
  title: string;
  path: string;
  excerpt: string;
  content: string;
  draftTime: string | null;
}

const EMPTY: InitialState = { title: "", path: "", excerpt: "", content: "", draftTime: null };

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
      path: draft.path ?? "",
      excerpt: draft.excerpt ?? "",
      content: draft.content ?? "",
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

export function DocNewForm({ hasError }: { hasError: boolean }) {
  const [initial] = useState(() => initFromStorage(hasError));
  const [title, setTitle] = useState(initial.title);
  const [path, setPath] = useState(initial.path);
  const [excerpt, setExcerpt] = useState(initial.excerpt);
  const [content, setContent] = useState(initial.content);
  const [draftTime, setDraftTime] = useState(initial.draftTime);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-save: only writes to localStorage, no setState calls
  useEffect(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      if (!title && !path && !excerpt && !content) {
        localStorage.removeItem(DRAFT_KEY);
        return;
      }
      const draft: Draft = { title, path, excerpt, content, savedAt: new Date().toISOString() };
      localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    }, 2000);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [title, path, excerpt, content]);

  function clearDraft() {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    localStorage.removeItem(DRAFT_KEY);
    setTitle("");
    setPath("");
    setExcerpt("");
    setContent("");
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
      <form action={createDocAction} onSubmit={handleSubmit} className="mt-6 grid gap-4">
        <Field label="标题">
          <input
            name="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className={inputClass}
            required
          />
        </Field>
        <Field
          label={
            <span className="inline-flex items-center gap-1">
              Slug <Tooltip text={SLUG_TIP} />
            </span>
          }
        >
          <input name="slug" className={inputClass} placeholder="选填，留空自动生成" />
        </Field>
        <Field
          label={
            <span className="inline-flex items-center gap-1">
              目录路径 <Tooltip text={PATH_TIP} />
            </span>
          }
        >
          <input
            name="path"
            value={path}
            onChange={(e) => setPath(e.target.value)}
            className={inputClass}
            placeholder="新人学习路径 > STM32入门 > GPIO配置"
          />
        </Field>
        <DivisionTeamSelect />
        <Field label="摘要">
          <textarea
            name="excerpt"
            value={excerpt}
            onChange={(e) => setExcerpt(e.target.value)}
            className={inputClass}
            rows={3}
          />
        </Field>
        <MarkdownEditor name="content" label="Markdown 正文" value={content} onChange={setContent} rows={18} />
        <SubmitButton pendingText="发布中...">发布文档</SubmitButton>
      </form>
    </>
  );
}
