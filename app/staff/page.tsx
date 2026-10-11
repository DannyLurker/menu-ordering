// Admin home (spec 0004). Admins manage staff accounts and roles here;
// menu management joins in Slice 2.
import { redirect } from "next/navigation";
import { getStaffUser } from "@/features/staff";
import { StaffShell } from "@/components/ui/staff-shell";
import { StaffAdmin } from "./staff-admin";

// Staff identity lives in request headers, so this route renders per
// request instead of prerendering (Next 16 cache components).
export const instant = false;

export default async function StaffPage() {
  const user = await getStaffUser();
  if (!user) redirect("/sign-in");
  if (user.mustChangePassword) redirect("/change-password");
  if (user.role !== "ADMIN") {
    redirect(user.role === "KITCHEN" ? "/kitchen" : "/stays");
  }
  return (
    <StaffShell
      name={user.name}
      role={user.role}
      title="Staff · Kelola Staf"
      description="Create accounts with roles. Temporary passwords must change at first sign in."
    >
      <StaffAdmin />
    </StaffShell>
  );
}
