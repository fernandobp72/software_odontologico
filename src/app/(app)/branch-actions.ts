"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { allowedBranches, requireUser } from "@/lib/dal";

export async function switchBranch(branchId: string): Promise<void> {
  const user = await requireUser();
  const branches = await allowedBranches(user);
  if (!branches.some((b) => b.id === branchId)) return;
  (await cookies()).set("branch", branchId, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 365 });
  revalidatePath("/", "layout");
}
