"use server";

import { cookies } from "next/headers";
import { signOut } from "@/lib/auth/config";
import { IMPERSONATE_COOKIE } from "@/lib/auth/session";

export async function signOutAction() {
  (await cookies()).delete(IMPERSONATE_COOKIE);
  await signOut({ redirectTo: "/login" });
}
