// Staff sign in screen (spec 0004, AC-1). Wrong passwords fail with a
// generic message that names neither the account nor the field. On success
// the staffer lands on their role home, or on password change when their
// account still carries a temporary password.
"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { authClient } from "@/features/staff/auth-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Container, Stack } from "@/components/ui/primitives";
import { Input } from "@/components/ui/input";

type RoleHome = "FRONT_DESK" | "KITCHEN" | "ADMIN";

const ROLE_HOME: Record<RoleHome, string> = {
  FRONT_DESK: "/stays",
  KITCHEN: "/kitchen",
  ADMIN: "/staff",
};

function isRoleHome(value: unknown): value is RoleHome {
  return value === "FRONT_DESK" || value === "KITCHEN" || value === "ADMIN";
}

export default function SignInPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const result = await authClient.signIn.email({ email: email.trim(), password });
      if (result.error) {
        setError("Invalid email or password. / Email atau kata sandi salah.");
        return;
      }
      const me = await fetch("/api/staff/me");
      if (!me.ok) {
        setError("Invalid email or password. / Email atau kata sandi salah.");
        return;
      }
      const profile: unknown = await me.json();
      const role = (profile as { role?: unknown })?.role;
      const mustChange = (profile as { mustChangePassword?: unknown })?.mustChangePassword === true;
      if (mustChange) {
        router.push("/change-password");
        router.refresh();
        return;
      }
      router.push(isRoleHome(role) ? ROLE_HOME[role] : "/sign-in");
      router.refresh();
    } catch {
      setError("Could not sign in. Check your connection and try again. / Tidak dapat masuk. Periksa koneksi Anda.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-full flex-1 flex-col bg-background">
      <div className="border-b-4 border-brand bg-background">
        <Container className="py-4">
          <p className="text-sm font-semibold text-brand-ink">Biz Hotel Batam</p>
          <p className="text-sm text-muted-foreground">Staff sign in · Masuk staf</p>
        </Container>
      </div>
      <Container className="flex flex-1 items-center py-10">
        <Stack className="w-full">
          <Card className="w-full">
            <CardHeader>
              <CardTitle>Welcome back · Selamat datang kembali</CardTitle>
              <CardDescription>
                Sign in with your staff email and password to reach your work area. Kitchen and front desk accounts
                each open only their own screens.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate={false}>
                <Input
                  label="Staff email · Email staf"
                  type="email"
                  autoComplete="username"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  hint="The email your admin registered for you."
                  error={error && !email ? "Enter your staff email. / Masukkan email staf Anda." : undefined}
                />
                <Input
                  label="Password · Kata sandi"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                {error ? (
                  <p role="alert" className="rounded-md border border-input bg-muted px-3 py-2 text-sm text-brand-ink">
                    {error}
                  </p>
                ) : null}
                <Button type="submit" disabled={busy || !email || !password}>
                  {busy ? "Signing in… · Memproses…" : "Sign in · Masuk"}
                </Button>
              </form>
            </CardContent>
          </Card>
          <p className="text-center text-sm text-muted-foreground">
            Locked out after too many tries? Wait a few minutes or ask your admin. · Terkunci? Tunggu beberapa menit
            atau hubungi admin.
          </p>
        </Stack>
      </Container>
      <footer className="border-t border-border">
        <Container className="py-4">
          <p className="text-center text-sm text-muted-foreground">Biz Hotel Batam · Menu ordering for checked in guests</p>
        </Container>
      </footer>
    </div>
  );
}
