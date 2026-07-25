"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/components/ui";

export type TeamData = {
  key: string;
  label: string;
  leaders: { id: string; realName: string }[];
  members: { id: string; realName: string }[];
};

export function TeamSection({ team }: { team: TeamData }) {
  const [open, setOpen] = useState(false);
  const total = team.leaders.length + team.members.length;

  return (
    <div className="overflow-hidden rounded-md border border-border">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-elevated"
      >
        {open ? (
          <ChevronDown className="size-3.5 shrink-0 text-text-secondary" />
        ) : (
          <ChevronRight className="size-3.5 shrink-0 text-text-secondary" />
        )}
        <span className="text-sm font-semibold text-text-primary">{team.label}</span>
        {team.leaders.map((l) => (
          <span
            key={l.id}
            className="rounded bg-gold/15 px-1.5 py-0.5 text-xs font-semibold text-gold ring-1 ring-gold/30"
          >
            {l.realName} · 负责人
          </span>
        ))}
        <span className={cn("ml-auto text-xs", total === 0 ? "text-text-secondary/50" : "text-text-secondary")}>
          {total} 人
        </span>
      </button>
      {open && (
        <div className="border-t border-border bg-elevated/40 px-4 py-3">
          {total === 0 ? (
            <p className="text-xs text-text-secondary">暂无成员</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {team.leaders.map((l) => (
                <span
                  key={l.id}
                  className="rounded-md bg-gold/10 px-2.5 py-1 text-xs font-semibold text-gold"
                >
                  {l.realName}
                </span>
              ))}
              {team.members.map((m) => (
                <span
                  key={m.id}
                  className="rounded-md bg-elevated px-2.5 py-1 text-xs text-text-primary"
                >
                  {m.realName}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
