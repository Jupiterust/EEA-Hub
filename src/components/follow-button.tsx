"use client";

import { useOptimistic, useTransition } from "react";
import { toggleFollowAction } from "@/lib/actions";

interface Props {
  followingId: string;
  initialIsFollowing: boolean;
}

export function FollowButton({ followingId, initialIsFollowing }: Props) {
  const [isPending, startTransition] = useTransition();
  const [isFollowing, setOptimisticFollowing] = useOptimistic(initialIsFollowing);

  function handleClick() {
    startTransition(async () => {
      setOptimisticFollowing(!isFollowing);
      await toggleFollowAction(followingId);
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      className={
        isFollowing
          ? "rounded-md border border-border px-4 py-1.5 text-sm font-semibold text-text-secondary transition hover:border-danger hover:text-danger disabled:opacity-50"
          : "rounded-md bg-primary px-4 py-1.5 text-sm font-semibold text-[#212733] transition hover:bg-primary/90 disabled:opacity-50"
      }
    >
      {isFollowing ? "已关注" : "关注"}
    </button>
  );
}
