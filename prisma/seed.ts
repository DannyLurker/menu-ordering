// Seed for local verify (spec 0002, task 3).
// Two categories, five items with whole rupiah prices, one demo ACTIVE stay.
// Real PIN hashing lands in the auth slice; here scrypt with a dev salt.
import "dotenv/config";
import { prisma } from "../lib/db";
import { hashPin } from "../lib/pin";

async function main(): Promise<void> {
  const mains = await prisma.menuCategory.upsert({
    where: { id: "seed-cat-mains" },
    update: {},
    create: {
      id: "seed-cat-mains",
      nameEn: "Mains",
      nameId: "Hidangan Utama",
      sortOrder: 1,
      isActive: true,
    },
  });
  const drinks = await prisma.menuCategory.upsert({
    where: { id: "seed-cat-drinks" },
    update: {},
    create: {
      id: "seed-cat-drinks",
      nameEn: "Drinks",
      nameId: "Minuman",
      sortOrder: 2,
      isActive: true,
    },
  });

  const items = [
    { id: "seed-item-nasgor", categoryId: mains.id, nameEn: "Nasi Goreng", nameId: "Nasi Goreng", price: 75000, sortOrder: 1 },
    { id: "seed-item-ayam", categoryId: mains.id, nameEn: "Ayam Bakar", nameId: "Ayam Bakar", price: 85000, sortOrder: 2 },
    { id: "seed-item-mie", categoryId: mains.id, nameEn: "Mie Goreng", nameId: "Mie Goreng", price: 65000, sortOrder: 3 },
    { id: "seed-item-teh", categoryId: drinks.id, nameEn: "Sweet Iced Tea", nameId: "Es Teh Manis", price: 25000, sortOrder: 1 },
    { id: "seed-item-kopi", categoryId: drinks.id, nameEn: "Batam Coffee", nameId: "Kopi Batam", price: 30000, sortOrder: 2 },
  ];
  for (const item of items) {
    await prisma.menuItem.upsert({
      where: { id: item.id },
      update: { ...item, isAvailable: true },
      create: { ...item, isAvailable: true },
    });
  }

  const today = new Date();
  const checkout = new Date(today);
  checkout.setDate(checkout.getDate() + 2);
  await prisma.stay.upsert({
    where: { id: "seed-stay-demo" },
    update: {},
    create: {
      id: "seed-stay-demo",
      roomNumber: "101",
      guestName: "Demo Guest",
      checkIn: today,
      checkOut: checkout,
      status: "ACTIVE",
      pinHash: hashPin("123456"),
      pinSetAt: today,
    },
  });

  console.log("Seed ok: 2 categories, 5 items, demo stay room 101 (demo PIN kept out of logs).");
}

main()
  .catch((err: unknown) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
