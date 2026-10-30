"use client";

import { useTransition } from "react";
import { switchBranch } from "./branch-actions";

export default function BranchSwitcher({ branches, activeId }: { branches: { id: string; name: string }[]; activeId: string }) {
  const [pending, start] = useTransition();
  return (
    <label className="block text-xs font-semibold uppercase tracking-wide text-slate-700">
      Sede
      <select
        value={activeId}
        disabled={pending}
        onChange={(e) => start(() => switchBranch(e.target.value))}
        className="mt-1 block w-full rounded-lg border border-slate-500 bg-white px-2 py-2 text-sm font-semibold normal-case tracking-normal text-slate-900"
      >
        {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
      </select>
    </label>
  );
}
