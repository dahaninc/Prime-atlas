"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { joinWaitlist, leaveWaitlist } from "./actions";
import { toast } from "@/components/ui/Toaster";

interface Props {
  isAuthed: boolean;
  initialJoined: boolean;
}

export function WaitlistCta({ isAuthed, initialJoined }: Props) {
  const [joined, setJoined] = useState(initialJoined);
  const [pending, startTransition] = useTransition();

  if (!isAuthed) {
    return (
      <Link
        href="/auth/signup?redirect=/underpriced"
        className="bg-primary text-white font-semibold text-sm px-6 py-2.5 rounded-lg hover:bg-primary/85 transition-colors inline-block"
      >
        Create a free account to join the waitlist
      </Link>
    );
  }

  if (joined) {
    return (
      <div className="flex items-center gap-3 flex-wrap justify-center">
        <span className="text-sm font-semibold text-emerald-400 flex items-center gap-2">
          <span className="status-dot-live" /> You&apos;re on the waitlist
        </span>
        <span className="text-xs text-muted-foreground">
          Alerts activate the moment you become a member.
        </span>
        <button
          onClick={() => startTransition(async () => {
            const res = await leaveWaitlist();
            if (res.ok) { setJoined(false); toast("Removed from the waitlist"); }
            else toast("Could not update the waitlist", "error");
          })}
          disabled={pending}
          className="text-xs text-zinc-500 hover:text-foreground underline disabled:opacity-60"
        >
          Leave
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => startTransition(async () => {
        const res = await joinWaitlist();
        if (res.ok) { setJoined(true); toast("On the list — alerts activate with membership"); }
        else toast("Could not join the waitlist", "error");
      })}
      disabled={pending}
      className="bg-primary text-white font-semibold text-sm px-6 py-2.5 rounded-lg hover:bg-primary/85 transition-colors disabled:opacity-60"
    >
      {pending ? "Joining…" : "Join the undervalued-property waitlist"}
    </button>
  );
}
