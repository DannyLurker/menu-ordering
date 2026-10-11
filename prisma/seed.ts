// Seed for local verify (specs 0002, 0004, 0006).
// Two categories, five items with whole rupiah prices, one demo ACTIVE stay,
// plus the first admin from SEED_ADMIN_EMAIL plus SEED_ADMIN_PASSWORD.
// The admin goes through the BetterAuth seams like every other account.
import "dotenv/config";
import { auth } from "../features/staff";
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
    {
      id: "seed-item-nasgor",
      categoryId: mains.id,
      nameEn: "Nasi Goreng",
      nameId: "Nasi Goreng",
      price: 75000,
      sortOrder: 1,
    },
    {
      id: "seed-item-ayam",
      categoryId: mains.id,
      nameEn: "Ayam Bakar",
      nameId: "Ayam Bakar",
      price: 85000,
      sortOrder: 2,
    },
    {
      id: "seed-item-mie",
      categoryId: mains.id,
      nameEn: "Mie Goreng",
      nameId: "Mie Goreng",
      price: 65000,
      sortOrder: 3,
    },
    {
      id: "seed-item-teh",
      categoryId: drinks.id,
      nameEn: "Sweet Iced Tea",
      nameId: "Es Teh Manis",
      price: 25000,
      sortOrder: 1,
    },
    {
      id: "seed-item-kopi",
      categoryId: drinks.id,
      nameEn: "Batam Coffee",
      nameId: "Kopi Batam",
      price: 30000,
      sortOrder: 2,
    },
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
      pinHash: await hashPin("123456"),
      pinSetAt: today,
    },
  });

  console.log(
    "Seed ok: 2 categories, 5 items, demo stay room 101 (demo PIN kept out of logs).",
  );

  // First admin (spec 0004): skipped when the account already exists.
  // mustChangePassword stays true so the temp secret rotates at first sign in.
  const adminEmail = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
  const adminPassword = process.env.SEED_ADMIN_PASSWORD;
  if (!adminEmail || !adminPassword) {
    throw new Error(
      "SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD are not set. Copy .env.example to .env and set them.",
    );
  }
  const ctx = await auth.$context;
  const existingAdmin = await prisma.user.findUnique({
    where: { email: adminEmail },
    include: { accounts: true },
  });
  if (existingAdmin) {
    // Dev drift guard: when the env secret changed after the first seed,
    // the stored hash no longer matches and sign in bricks with no recourse
    // but a manual delete. Rotate through the seam, loudly, instead.
    const cred = existingAdmin.accounts.find(
      (a) => a.providerId === "credential",
    );
    const matches =
      cred?.password != null &&
      (await ctx.password.verify({
        hash: cred.password,
        password: adminPassword,
      }));
    if (!matches) {
      await ctx.internalAdapter.updatePassword(
        existingAdmin.id,
        await ctx.password.hash(adminPassword),
      );
      await prisma.user.update({
        where: { id: existingAdmin.id },
        data: {
          mustChangePassword: true,
          failedSignInAttempts: 0,
          lockedUntil: null,
        },
      });
      console.log(
        "Seed ok: admin secret rotated to match env (first secret kept out of logs).",
      );
      return;
    }
    console.log("Seed ok: admin already exists, skipped.");
    return;
  }
  const created = await ctx.internalAdapter.createUser(
    {
      name: "Hotel Admin",
      email: adminEmail,
      emailVerified: false,
      role: "ADMIN",
      mustChangePassword: true,
    },
    { method: "email-password" },
  );
  await ctx.internalAdapter.linkAccount({
    userId: created.id,
    providerId: "credential",
    accountId: created.id,
    password: await ctx.password.hash(adminPassword),
  });
  console.log("Seed ok: first admin created (first secret kept out of logs).");
}

main()
  .catch((err: unknown) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
