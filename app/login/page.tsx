import { redirect } from "next/navigation";
import { AccountLogin } from "@/components/account-login";
import { accountStatus } from "@/lib/account-server";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const status = await accountStatus();
  if (status.authenticated) redirect("/");
  if (status.guest) redirect("/showcase");
  return <AccountLogin status={status} />;
}
