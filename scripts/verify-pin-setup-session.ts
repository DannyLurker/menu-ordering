// Verify that PIN setup HTTP endpoint now returns a session cookie
import "dotenv/config";
import { prisma } from "../lib/db";
import { createStay, setupStayPin } from "../features/stays";

async function main() {
  const today = new Date().toISOString().slice(0, 10);
  const checkout = new Date();
  checkout.setUTCDate(checkout.getUTCDate() + 2);
  const checkoutDay = checkout.toISOString().slice(0, 10);

  // Create a stay directly in DB to get the setup code
  const created = await createStay(prisma, {
    roomNumber: "997",
    guestName: "HTTP Test",
    checkIn: today,
    checkOut: checkoutDay,
  });
  console.log("Created stay:", created.stayId);
  console.log("Setup code:", created.setupCode);

  // Check no session exists before PIN setup
  const sessionsBefore = await prisma.staySession.count({ where: { stayId: created.stayId } });
  console.log("Sessions before PIN setup:", sessionsBefore);

  // Call the HTTP endpoint like the browser would
  const res = await fetch("http://localhost:3000/api/stays/pin-setup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      stayId: created.stayId,
      setupCode: created.setupCode,
      newPin: "839201",
      confirmPin: "839201",
    }),
  });
  const body = await res.json();
  console.log("HTTP status:", res.status);
  console.log("Response body:", JSON.stringify(body));

  // Check for session cookie
  const setCookie = res.headers.get("set-cookie");
  console.log("Set-Cookie header:", setCookie ? "present" : "MISSING");

  // Check session in DB
  const sessionsAfter = await prisma.staySession.count({ where: { stayId: created.stayId } });
  console.log("Sessions after PIN setup:", sessionsAfter);

  if (setCookie && sessionsAfter > 0 && res.ok) {
    console.log("PASS: Session cookie set and session in DB");
  } else {
    console.log("FAIL: Session not created properly");
  }

  // Cleanup
  await prisma.staySession.deleteMany({ where: { stayId: created.stayId } });
  await prisma.guest.deleteMany({ where: { stayId: created.stayId } });
  await prisma.stay.delete({ where: { id: created.stayId } });
  console.log("Cleaned up test stay");

  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
