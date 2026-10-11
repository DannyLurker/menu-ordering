// Forced password change screen (spec 0004, AC-8). Staffers created with
// a temporary password must set a real one (min 10 chars) before reaching
// any screen.
"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Container, Stack } from "@/components/ui/primitives";
import { Input } from "@/components/ui/input";

export default function ChangePasswordPage() {
  const router = useRouter();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (busy) return;
    if (next.length < 10) {
      setError("The new password must be at least 10 characters. / Kata sandi baru minimal 10 karakter.");
      return;
    }
    if (next !== confirm) {
      setError("The new passwords do not match. / Konfirmasi kata sandi tidak cocok.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/staff/me/password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ current, next }),
      });
      if (res.status === 401) {
        setError("The current password is wrong. / Kata sandi saat ini salah.");
        return;
      }
      if (!res.ok) {
        setError("Could not change the password. Try again. / Tidak dapat mengganti kata sandi. Coba lagi.");
        return;
      }
      const me = await fetch("/api/staff/me");
      const profile: unknown = me.ok ? await me.json() : null;
      const role = (profile as { role?: unknown } | null)?.role;
      router.push(role === "KITCHEN" ? "/kitchen" : role === "ADMIN" ? "/staff" : "/stays");
      router.refresh();
    } catch {
      setError("Could not change the password. Check your connection. / Periksa koneksi Anda.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-full flex-1 flex-col bg-background">
      <div className="border-b-4 border-brand bg-background">
        <Container className="py-4">
          <p className="text-sm font-semibold text-brand-ink">Biz Hotel Batam</p>
          <p className="text-sm text-muted-foreground">Set a new password · Buat kata sandi baru</p>
        </Container>
      </div>
      <Container className="flex flex-1 items-center py-10">
        <Card className="w-full">
          <CardHeader>
            <CardTitle>First sign in? Set your password · Masuk pertama? Atur kata sandi</CardTitle>
            <CardDescription>
              Your admin gave you a temporary password. Set a real one of at least 10 characters to unlock your work
              area.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={onSubmit} className="flex flex-col gap-4">
              <Input
                label="Temporary password · Kata sandi sementara"
                type="password"
                autoComplete="current-password"
                required
                value={current}
                onChange={(e) => setCurrent(e.target.value)}
              />
              <Input
                label="New password · Kata sandi baru"
                type="password"
                autoComplete="new-password"
                required
                value={next}
                onChange={(e) => setNext(e.target.value)}
                hint="At least 10 characters. / Minimal 10 karakter."
              />
              <Input
                label="Repeat the new password · Ulangi kata sandi baru"
                type="password"
                autoComplete="new-password"
                required
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
              {error ? (
                <p role="alert" className="rounded-md border border-input bg-muted px-3 py-2 text-sm text-brand-ink">
                  {error}
                </p>
              ) : null}
              <Button type="submit" disabled={busy || !current || !next || !confirm}>
                {busy ? "Saving… · Menyimpan…" : "Set password · Atur kata sandi"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </Container>
    </div>
  );
}
