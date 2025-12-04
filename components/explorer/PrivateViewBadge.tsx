"use client";

type PrivateViewBadgeProps = {
  active: boolean;
};

export function PrivateViewBadge({ active }: PrivateViewBadgeProps) {
  if (active) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/60 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-medium text-emerald-200">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
        Private view active
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-zinc-700 bg-zinc-950 px-2.5 py-1 text-[11px] font-medium text-zinc-400">
      <span className="h-1.5 w-1.5 rounded-full bg-zinc-500" />
      Private view inactive
    </span>
  );
}
