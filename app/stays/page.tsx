// Front desk home (spec 0008). Desk staff check guests in here, hand over
// the one time setup code, and reissue codes on loss. PIN unlock stays
// below as the lock recovery path.
import { redirect } from "next/navigation";
import { getStaffUser } from "@/features/staff";
import { prisma } from "@/lib/db";
import { StaffShell } from "@/components/ui/staff-shell";
import { LIST_PAGE, listRecentStays } from "@/features/stays";
import { CheckinForm } from "./checkin-form";
import { StayList } from "./stay-list";
import { UnlockForm } from "./unlock-form";

// Staff identity lives in request headers, so this route renders per
// request instead of prerendering (Next 16 cache components).
export const instant = false;

function toDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export default async function StaysPage() {
  const user = await getStaffUser();
  if (!user) redirect("/sign-in");
  if (user.mustChangePassword) redirect("/change-password");
  if (user.role !== "FRONT_DESK" && user.role !== "ADMIN") {
    redirect(user.role === "KITCHEN" ? "/kitchen" : "/sign-in");
  }
  const stays = await listRecentStays(prisma, LIST_PAGE);
  return (
    <StaffShell
      name={user.name}
      role={user.role}
      title="Stays · Daftar Menginap"
      description="Check guests in, share the setup code once, and reissue on loss. · Daftarkan tamu dan bagikan kode aktivasi."
    >
      <div className="flex flex-col gap-6">
        <CheckinForm />
        <StayList
          stays={stays.map((stay) => ({
            id: stay.id,
            roomNumber: stay.roomNumber,
            guestName: stay.guestName,
            checkIn: toDay(stay.checkIn),
            checkOut: toDay(stay.checkOut),
            status: stay.status,
            pinSet: stay.pinSetAt !== null,
          }))}
        />
        <UnlockForm />
      </div>
    </StaffShell>
  );
}
