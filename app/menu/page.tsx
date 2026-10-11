// Menu home (spec 0004). Staff menu management opens here in Slice 2;
// this slice owns the admin only gate (AC-2).
import { redirect } from "next/navigation";
import { getStaffUser } from "@/lib/staff-auth";
import { CardEmpty } from "@/components/ui/card";
import { StaffShell } from "@/components/ui/staff-shell";

// Staff identity lives in request headers, so this route renders per
// request instead of prerendering (Next 16 cache components).
export const instant = false;

export default async function MenuPage() {
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
      title="Menu · Kelola Menu"
      description="Categories, items, prices, and availability open here in Slice 2."
    >
      <CardEmpty
        title="Menu management arrives in Slice 2"
        hint="Staff adds, edits, and hides items here; hidden items cannot be ordered. · Kelola menu di sini."
      />
    </StaffShell>
  );
}
