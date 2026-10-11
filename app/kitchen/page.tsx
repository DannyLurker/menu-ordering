import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getStaffUser } from "@/features/staff";
import { StaffShell } from "@/components/ui/staff-shell";
import { KitchenLiveBoard, getActiveKitchenOrders } from "@/features/kitchen";

export const instant = false;

export default async function KitchenPage() {
  const user = await getStaffUser();
  if (!user) redirect("/sign-in");
  if (user.mustChangePassword) redirect("/change-password");
  if (
    user.role !== "KITCHEN" &&
    user.role !== "ADMIN" &&
    user.role !== "FRONT_DESK"
  ) {
    redirect("/sign-in");
  }

  const initialOrders = await getActiveKitchenOrders(prisma, true);

  return (
    <StaffShell
      name={user.name}
      role={user.role}
      title="Kitchen Live Board · Papan Dapur"
      description="Live order verification, preparation tracking, and countdown timers · Papan pemantauan pesanan, verifikasi, dan estimasi waktu langsung"
    >
      <KitchenLiveBoard
        userRole={user.role}
        userName={user.name}
        initialOrders={initialOrders}
      />
    </StaffShell>
  );
}
