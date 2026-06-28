import { prisma } from "@/lib/prisma";

export interface MentionUser {
  id: string;
  realName: string;
}

/** Extract unique @username tokens from text, skipping code blocks/spans */
export function extractMentionUsernames(text: string): string[] {
  // Split out fenced code blocks and inline code first to avoid matching inside them
  const segments = text.split(/(```[\s\S]*?```|`[^`\n]+`)/g);
  const usernames = new Set<string>();
  segments.forEach((seg, i) => {
    if (i % 2 === 1) return; // code segment — skip
    for (const match of seg.matchAll(/@([一-龥a-zA-Z0-9_]+)/g)) {
      usernames.add(match[1]);
    }
  });
  return [...usernames];
}

/** Fetch mention users from DB and return a username → {id, realName} map */
export async function buildMentionMap(usernames: string[]): Promise<Map<string, MentionUser>> {
  if (usernames.length === 0) return new Map();
  const users = await prisma.user.findMany({
    where: { username: { in: usernames }, status: "ACTIVE" },
    select: { id: true, username: true, realName: true },
  });
  return new Map(users.map((u) => [u.username, { id: u.id, realName: u.realName }]));
}

/**
 * Replace @username in text with markdown links for MarkdownView rendering.
 * Returns a new string — the original is never mutated.
 */
export function injectMentionLinks(
  text: string,
  mentionMap: Map<string, MentionUser>,
): string {
  if (mentionMap.size === 0) return text;
  const segments = text.split(/(```[\s\S]*?```|`[^`\n]+`)/g);
  return segments
    .map((seg, i) => {
      if (i % 2 === 1) return seg;
      return seg.replace(/@([一-龥a-zA-Z0-9_]+)/g, (match, username) => {
        const user = mentionMap.get(username);
        return user ? `[@${user.realName}](/profile/${user.id} "mention")` : match;
      });
    })
    .join("");
}
