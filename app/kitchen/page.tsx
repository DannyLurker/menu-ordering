// Kitchen home (spec 0004). The live board with verify and ETA opens here
// in Slice 1; this slice owns the gate that keeps desk staff out (AC-2).
import { redirect } from "next/navigation";
import { getStaffUser } from "@/features/staff";
import { CardEmpty } from "@/components/ui/card";
import { StaffShell } from "@/components/ui/staff-shell";

// Staff identity lives in request headers, so this route renders per
// request instead of prerendering (Next 16 cache components).
export const instant = false;

export default async function KitchenPage() {
  const user = await getStaffUser();
  if (!user) redirect("/sign-in");
  if (user.mustChangePassword) redirect("/change-password");
  if (user.role !== "KITCHEN" && user.role !== "ADMIN") {
    redirect(user.role === "FRONT_DESK" ? "/stays" : "/sign-in");
  }
  return (
    <StaffShell
      name={user.name}
      role={user.role}
      title="Kitchen · Dapur"
      description="New orders appear here live in Slice 1. Verify sets PREPARING with an ETA."
    >
      <CardEmpty
        title="Live board arrives in Slice 1"
        hint="Kitchen verifies PENDING orders into PREPARING with estimated minutes here. · Dapur memverifikasi pesanan di sini."
      />
    </StaffShell>
  );
}
