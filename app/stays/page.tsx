// Front desk home (spec 0004). Desk staff check guests in here in Slice 1;
// this slice owns the gate plus the PIN unlock action (AC-7 restore path).
import { redirect } from "next/navigation";
import { getStaffUser } from "@/lib/staff-auth";
import { CardEmpty } from "@/components/ui/card";
import { StaffShell } from "@/components/ui/staff-shell";
import { UnlockForm } from "./unlock-form";

// Staff identity lives in request headers, so this route renders per
// request instead of prerendering (Next 16 cache components).
export const instant = false;

export default async function StaysPage() {
  const user = await getStaffUser();
  if (!user) redirect("/sign-in");
  if (user.mustChangePassword) redirect("/change-password");
  if (user.role !== "FRONT_DESK" && user.role !== "ADMIN") {
    redirect(user.role === "KITCHEN" ? "/kitchen" : "/sign-in");
  }
  return (
    <StaffShell
      name={user.name}
      role={user.role}
      title="Stays · Daftar Menginap"
      description="Guest check in and stay management open here in Slice 1. PIN unlock is ready below."
    >
      <div className="flex flex-col gap-6">
        <CardEmpty
          title="Check in arrives in Slice 1"
          hint="Front desk will create stays and hand PINs to guests here. · Resepsionis akan mendaftarkan tamu di sini."
        />
        <UnlockForm />
      </div>
    </StaffShell>
  );
}
