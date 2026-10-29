"use client";

import { Check } from "lucide-react";
import { useTransition } from "react";
import { toggleTeamMember } from "@/server/actions/admin";

export function TeamMemberToggle({
  teamId,
  userId,
  name,
  member,
}: {
  teamId: string;
  userId: string;
  name: string;
  member: boolean;
}) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      aria-pressed={member}
      disabled={pending}
      onClick={() => start(() => toggleTeamMember(teamId, userId))}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[13.5px] ${
        member
          ? "border-pine/40 bg-pine-tint font-medium text-ink"
          : "border-line text-muted hover:text-ink"
      }`}
    >
      {member && <Check className="h-3.5 w-3.5 text-pine" aria-hidden />}
      {name}
    </button>
  );
}
