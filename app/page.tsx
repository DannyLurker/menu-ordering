// Landing route (spec 0004). The edge gate in proxy.ts already routes
// signed in staff to their role home; this stays as the direct hit guard.
import { redirect } from "next/navigation";
import { getStaffUser } from "@/lib/staff-auth";
import { ROLE_HOME } from "@/lib/staff";

// Staff identity lives in request headers, so this route renders per
// request instead of prerendering (Next 16 cache components).
export const instant = false;

export default async function HomePage() {
  const user = await getStaffUser();
  if (!user) redirect("/sign-in");
  if (user.mustChangePassword) redirect("/change-password");
  redirect(ROLE_HOME[user.role] ?? "/sign-in");
}
