// Guest dining menu page (spec 0009, AC-1).
// Allows checked in guests to browse the menu, add items to a cart,
// and place orders verified by their room PIN.
import { prisma } from "@/lib/db";
import { readStayToken, resolveStaySession } from "@/features/stay-session";
import { GuestMenuView, getGuestMenu, getStayOrders } from "@/features/orders";

export const instant = false;

export default async function GuestMenuPage() {
  const token = await readStayToken();
  const stayId = token ? await resolveStaySession(prisma, token) : null;

  let stayInfo: { stayId: string; roomNumber: string; guestName: string } | null = null;
  let initialOrders: Awaited<ReturnType<typeof getStayOrders>> = [];

  if (stayId) {
    const stayRow = await prisma.stay.findUnique({
      where: { id: stayId },
      select: { roomNumber: true, guestName: true },
    });
    if (stayRow) {
      stayInfo = {
        stayId,
        roomNumber: stayRow.roomNumber,
        guestName: stayRow.guestName,
      };
    }
    initialOrders = await getStayOrders(prisma, stayId);
  }

  const rawCategories = await getGuestMenu(prisma);

  const categories = rawCategories.map((cat) => ({
    id: cat.id,
    nameEn: cat.nameEn,
    nameId: cat.nameId,
    sortOrder: cat.sortOrder,
    items: cat.items.map((item) => ({
      id: item.id,
      nameEn: item.nameEn,
      nameId: item.nameId,
      price: item.price,
      isAvailable: item.isAvailable,
      sortOrder: item.sortOrder,
    })),
  }));

  return (
    <GuestMenuView
      categories={categories}
      initialOrders={initialOrders}
      stayInfo={stayInfo}
    />
  );
}

