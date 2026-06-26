"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronRight, FileText, Folder } from "lucide-react";
import { cn } from "@/components/ui";

export type DocInfo = {
  slug: string;
  title: string;
  division: string;
  team: string;
  path: string;
};

type FolderNode = { kind: "folder"; label: string; children: TreeNode[] };
type DocNode = { kind: "doc"; label: string; slug: string };
type TreeNode = FolderNode | DocNode;

function buildPathTree(docs: DocInfo[]): TreeNode[] {
  const nodes: TreeNode[] = [];
  for (const doc of docs) {
    const parts = doc.path
      ? doc.path
          .split(/\s*[>\/]\s*/)
          .map((s) => s.trim())
          .filter(Boolean)
      : [];
    let level = nodes;
    for (const part of parts) {
      let node = level.find(
        (n): n is FolderNode => n.kind === "folder" && n.label === part,
      );
      if (!node) {
        node = { kind: "folder", label: part, children: [] };
        level.push(node);
      }
      level = node.children;
    }
    level.push({ kind: "doc", label: doc.title, slug: doc.slug });
  }
  return nodes;
}

const divisionConfig: {
  division: string;
  label: string;
  teams: { team: string; label: string | null }[];
}[] = [
  {
    division: "GENERAL",
    label: "通用/新人指南",
    teams: [{ team: "GENERAL", label: null }],
  },
  {
    division: "SOFTWARE",
    label: "软件部",
    teams: [
      { team: "CONTROL", label: "控制组" },
      { team: "VISION", label: "视觉组" },
    ],
  },
  {
    division: "ANALOG",
    label: "模电部",
    teams: [
      { team: "FPGA", label: "FPGA组" },
      { team: "HARDWARE", label: "硬件组" },
    ],
  },
];

function TreeNodeItem({
  node,
  currentSlug,
  depth = 0,
}: {
  node: TreeNode;
  currentSlug?: string;
  depth?: number;
}) {
  const [open, setOpen] = useState(true);
  const indent = { paddingLeft: `${depth * 12 + 8}px` };

  if (node.kind === "doc") {
    const isActive = node.slug === currentSlug;
    return (
      <li>
        <Link
          href={`/docs/${node.slug}`}
          style={indent}
          className={cn(
            "flex items-center gap-1.5 rounded-md py-1 pr-2 text-sm transition-colors",
            isActive
              ? "bg-primary/15 font-semibold text-primary"
              : "text-text-secondary hover:bg-elevated hover:text-text-primary",
          )}
        >
          <FileText className="size-3.5 shrink-0 opacity-50" />
          <span className="truncate">{node.label}</span>
        </Link>
      </li>
    );
  }

  return (
    <li>
      <button
        onClick={() => setOpen((o) => !o)}
        style={indent}
        className="flex w-full items-center gap-1.5 rounded-md py-1 pr-2 text-sm font-medium text-text-primary transition-colors hover:bg-elevated"
      >
        <ChevronRight
          className={cn(
            "size-3.5 shrink-0 text-text-secondary transition-transform",
            open && "rotate-90",
          )}
        />
        <Folder className="size-3.5 shrink-0 text-gold/60" />
        <span className="truncate">{node.label}</span>
      </button>
      {open && node.children.length > 0 && (
        <ul>
          {node.children.map((child, i) => (
            <TreeNodeItem
              key={i}
              node={child}
              currentSlug={currentSlug}
              depth={depth + 1}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

function TeamSection({
  label,
  docs,
  currentSlug,
}: {
  label: string | null;
  docs: DocInfo[];
  currentSlug?: string;
}) {
  const [open, setOpen] = useState(true);
  const tree = buildPathTree(docs);
  if (tree.length === 0) return null;

  if (!label) {
    return (
      <ul className="mt-1">
        {tree.map((node, i) => (
          <TreeNodeItem key={i} node={node} currentSlug={currentSlug} />
        ))}
      </ul>
    );
  }

  return (
    <div className="mt-0.5">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold uppercase tracking-wider text-text-secondary transition-colors hover:bg-elevated hover:text-text-primary"
      >
        <ChevronRight
          className={cn(
            "size-3 shrink-0 transition-transform",
            open && "rotate-90",
          )}
        />
        {label}
      </button>
      {open && (
        <ul className="mt-0.5">
          {tree.map((node, i) => (
            <TreeNodeItem key={i} node={node} currentSlug={currentSlug} depth={1} />
          ))}
        </ul>
      )}
    </div>
  );
}

export function DocTree({
  allDocs,
  currentSlug,
}: {
  allDocs: DocInfo[];
  currentSlug?: string;
}) {
  return (
    <nav aria-label="文档目录" className="select-none">
      {divisionConfig.map(({ division, label, teams }) => {
        const divisionDocs = allDocs.filter((d) => d.division === division);
        if (divisionDocs.length === 0) return null;

        return (
          <div key={division} className="mb-4">
            <p className="mb-1 px-2 text-xs font-bold uppercase tracking-wider text-text-secondary/70">
              {label}
            </p>
            {teams.map(({ team, label: teamLabel }) => {
              const teamDocs = divisionDocs.filter((d) => d.team === team);
              return (
                <TeamSection
                  key={team}
                  label={teamLabel}
                  docs={teamDocs}
                  currentSlug={currentSlug}
                />
              );
            })}
          </div>
        );
      })}
    </nav>
  );
}
