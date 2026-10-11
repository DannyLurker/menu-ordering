// Guest PIN setup screen (spec 0008, AC-2, AC-8). Public page: the desk
// shares the stay link, the guest confirms the room and chooses a PIN.
// Renders per request, since the stay lookup runs at request time.
import { prisma } from "@/lib/db";
import { peekGuestStay } from "@/features/stays";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Container, Section, Stack } from "@/components/ui/primitives";
import { PinSetupForm } from "./pin-setup-form";

export const instant = false;

export default async function GuestSetupPage({
  searchParams,
}: {
  searchParams: Promise<{ stay?: string }>;
}) {
  const params = await searchParams;
  const stayParam = typeof params.stay === "string" ? params.stay.trim() : "";
  const peek = stayParam ? await peekGuestStay(prisma, stayParam) : null;

  return (
    <main className="bg-background py-10">
      <Container>
        <Stack>
          <div className="flex flex-col gap-1">
            <p className="text-sm font-semibold tracking-wide text-brand">BIZ HOTEL BATAM</p>
            <h1 className="text-2xl font-bold text-foreground">Set your room PIN · Atur PIN kamar</h1>
            <p className="text-sm text-muted-foreground">
              Three quick steps: confirm your room, enter the setup code, choose a PIN. · Tiga langkah cepat:
              konfirmasi kamar, masukkan kode aktivasi, pilih PIN.
            </p>
          </div>

          <Section aria-label="Stay confirmation · Konfirmasi menginap">
            {peek ? (
              <Card>
                <CardHeader>
                  <CardDescription>Stay found · Data ditemukan</CardDescription>
                  <CardTitle>
                    Room {peek.roomNumber} · {peek.maskedName}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    If this is not your room, check the link with the front desk. · Jika ini bukan kamar Anda,
                    tanyakan ke resepsionis.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle>Find your stay · Temukan data Anda</CardTitle>
                  <CardDescription>
                    Open the stay link from the front desk, or type your stay id below. · Buka tautan dari
                    resepsionis, atau ketik id menginap di bawah.
                  </CardDescription>
                </CardHeader>
              </Card>
            )}
          </Section>

          <Section aria-label="PIN form · Formulir PIN">
            <PinSetupForm initialStayId={peek?.stayId ?? stayParam} />
          </Section>

          <Section aria-label="Help · Bantuan">
            <Card>
              <CardContent className="pt-6">
                <ol className="flex list-decimal flex-col gap-1 pl-5 text-sm text-muted-foreground">
                  <li>Get the 8 character setup code at check in. · Minta kode aktivasi saat check in.</li>
                  <li>Choose a 6 digit PIN you alone know. · Pilih PIN 6 digit yang hanya Anda tahu.</li>
                  <li>Lost the code or locked out? Ask the front desk for a new one. · Kode hilang? Minta yang baru ke resepsionis.</li>
                </ol>
              </CardContent>
            </Card>
          </Section>
        </Stack>
      </Container>
    </main>
  );
}
