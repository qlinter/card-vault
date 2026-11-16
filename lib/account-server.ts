import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ACCOUNT_COOKIE, createAccountStore } from "./account-store";

export async function accountStatus() {
  const cookieStore = await cookies();
  return createAccountStore().status(cookieStore.get(ACCOUNT_COOKIE)?.value);
}

export async function requireAccount() {
  const status = await accountStatus();
  if (!status.authenticated) redirect("/login");
  return status;
}
