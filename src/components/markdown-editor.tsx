"use client";

import { useState, useEffect, useRef } from "react";
import { MarkdownView } from "@/components/markdown-view";
import { Tooltip } from "@/components/tooltip";
import { Avatar } from "@/components/avatar";
import { cn, inputClass } from "@/components/ui";

const MARKDOWN_TIP =
  '支持 Markdown 语法，例如：**粗体**、# 标题、`代码`、```代码块```。切换到"预览"查看渲染效果。输入 @ 可以提及用户。';

interface MentionCandidate {
  id: string;
  username: string;
  realName: string;
  avatarUrl: string | null;
}

interface Props {
  name: string;
  label?: string;
  defaultValue?: string;
  /** Controlled mode: pass value + onChange together */
  value?: string;
  onChange?: (value: string) => void;
  rows?: number;
  placeholder?: string;
}

export function MarkdownEditor({
  name,
  label = "正文",
  defaultValue = "",
  value: controlledValue,
  onChange,
  rows = 12,
  placeholder,
}: Props) {
  const isControlled = controlledValue !== undefined;
  const [tab, setTab] = useState<"write" | "preview">("write");
  const [internalValue, setInternalValue] = useState(defaultValue);
  const value = isControlled ? controlledValue : internalValue;

  // @mention state
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionResults, setMentionResults] = useState<MentionCandidate[]>([]);
  const [mentionIndex, setMentionIndex] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  function handleChange(next: string) {
    if (!isControlled) setInternalValue(next);
    onChange?.(next);
  }

  function detectMention(text: string, cursor: number) {
    const before = text.slice(0, cursor);
    const match = before.match(/@([一-龥a-zA-Z0-9_]*)$/);
    if (match) {
      setMentionQuery(match[1]);
      setMentionIndex(0);
    } else {
      setMentionQuery(null);
      setMentionResults([]); // safe: called from event handler, not an effect
    }
  }

  function handleTextareaChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const next = e.target.value;
    handleChange(next);
    detectMention(next, e.target.selectionStart ?? next.length);
  }

  function insertMention(username: string) {
    const ta = textareaRef.current;
    if (!ta) return;
    const cursor = ta.selectionStart ?? value.length;
    const before = value.slice(0, cursor);
    const after = value.slice(cursor);
    const match = before.match(/@([一-龥a-zA-Z0-9_]*)$/);
    if (!match) return;
    const startPos = cursor - match[0].length;
    const inserted = `@${username} `;
    const next = value.slice(0, startPos) + inserted + after;
    handleChange(next);
    setMentionQuery(null);
    setMentionResults([]); // safe: called from event handler
    // Restore cursor after the inserted text
    requestAnimationFrame(() => {
      const pos = startPos + inserted.length;
      ta.setSelectionRange(pos, pos);
      ta.focus();
    });
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (mentionQuery === null || mentionResults.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setMentionIndex((i) => Math.min(i + 1, mentionResults.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setMentionIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" || e.key === "Tab") {
      const candidate = mentionResults[mentionIndex];
      if (candidate) {
        e.preventDefault();
        insertMention(candidate.username);
      }
    } else if (e.key === "Escape") {
      setMentionQuery(null);
      setMentionResults([]); // safe: called from event handler
    }
  }

  // Fetch mention candidates from API when mentionQuery changes.
  // We never call setState synchronously in the effect — all updates happen
  // inside the async IIFE (which runs after the current render cycle).
  useEffect(() => {
    if (mentionQuery === null || mentionQuery === "") return;
    const ctrl = new AbortController();
    (async () => {
      try {
        const res = await fetch(`/api/users/search?q=${encodeURIComponent(mentionQuery)}`, { signal: ctrl.signal });
        if (res.ok) setMentionResults(await res.json());
      } catch {
        // ignore abort / network errors
      }
    })();
    return () => ctrl.abort();
  }, [mentionQuery]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        if (textareaRef.current && !textareaRef.current.contains(e.target as Node)) {
          setMentionQuery(null);
        }
      }
    }
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, []);

  return (
    <div className="grid gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-base font-semibold text-gold flex items-center gap-1">
          {label}
          <Tooltip text={MARKDOWN_TIP} />
        </span>
        <div className="flex items-center rounded-md border border-border overflow-hidden text-sm">
          <button
            type="button"
            onClick={() => setTab("write")}
            className={cn(
              "px-3 py-1 font-medium transition",
              tab === "write"
                ? "bg-primary text-bg"
                : "text-text-secondary hover:text-text-primary",
            )}
          >
            编写
          </button>
          <button
            type="button"
            onClick={() => setTab("preview")}
            className={cn(
              "px-3 py-1 font-medium transition border-l border-border",
              tab === "preview"
                ? "bg-primary text-bg"
                : "text-text-secondary hover:text-text-primary",
            )}
          >
            预览
          </button>
        </div>
      </div>

      {/* Hidden input ensures the value is always submitted with the form */}
      <input type="hidden" name={name} value={value} />

      <div className="relative">
        <textarea
          ref={textareaRef}
          aria-label={label}
          value={value}
          onChange={handleTextareaChange}
          onKeyDown={handleKeyDown}
          rows={rows}
          placeholder={placeholder}
          className={cn(inputClass, "font-mono", tab === "preview" && "hidden")}
        />

        {/* @mention dropdown */}
        {mentionQuery !== null && mentionResults.length > 0 && tab === "write" && (
          <div
            ref={dropdownRef}
            className="absolute left-0 top-full z-50 mt-1 w-72 overflow-hidden rounded-lg border border-border bg-surface shadow-2xl"
          >
            {mentionResults.map((u, i) => (
              <button
                key={u.id}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault(); // prevent textarea blur before insertion
                  insertMention(u.username);
                }}
                className={cn(
                  "flex w-full items-center gap-3 px-3 py-2.5 text-left transition",
                  i === mentionIndex
                    ? "bg-primary/15 text-primary"
                    : "text-text-primary hover:bg-elevated",
                )}
              >
                <Avatar url={u.avatarUrl} size="xs" alt={u.realName} />
                <div className="min-w-0">
                  <span className="block truncate text-sm font-semibold">{u.realName}</span>
                  <span className="text-xs text-text-secondary">@{u.username}</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {tab === "preview" && (
        <div className="min-h-40 rounded-md border border-border bg-surface px-4 py-3">
          {value.trim() ? (
            <MarkdownView content={value} />
          ) : (
            <p className="text-sm text-text-secondary/60">暂无内容</p>
          )}
        </div>
      )}
    </div>
  );
}
