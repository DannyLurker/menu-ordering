// Staff admin screen (spec 0004, AC-8). Admins create staff accounts with
// roles, reissue temporary passwords, and manage locks. The temp secret
// shows once and is never stored client side beyond the moment.
"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface StaffRow {
  id: string;
  name: string;
  email: string;
  role: "FRONT_DESK" | "KITCHEN" | "ADMIN";
  mustChangePassword: boolean;
  isDisabled: boolean;
}

const ROLE_OPTIONS: StaffRow["role"][] = ["FRONT_DESK", "KITCHEN", "ADMIN"];

export function StaffAdmin() {
  const [items, setItems] = useState<StaffRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<StaffRow["role"]>("FRONT_DESK");
  const [formError, setFormError] = useState<string | null>(null);
  const [tempSecret, setTempSecret] = useState<{
    email: string;
    secret: string;
  } | null>(null);
  const [busy, setBusy] = useState(false);

  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let alive = true;
    fetch("/api/staff?take=100")
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as { items?: StaffRow[] };
        return Array.isArray(data.items) ? data.items : [];
      })
      .then(
        (rows) => {
          if (!alive) return;
          setItems(rows);
          setLoadError(null);
          setLoading(false);
        },
        () => {
          if (!alive) return;
          setLoadError(
            "Could not load staff accounts. / Tidak dapat memuat akun staf.",
          );
          setLoading(false);
        },
      );
    return () => {
      alive = false;
    };
  }, [refreshKey]);

  function reload(): void {
    setLoading(true);
    setRefreshKey((k) => k + 1);
  }

  async function onCreate(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setFormError(null);
    setTempSecret(null);
    try {
      const res = await fetch("/api/staff", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: name.trim(), email: email.trim(), role }),
      });
      const data = (await res.json().catch(() => null)) as {
        tempPassword?: string;
      } | null;
      if (res.status === 409) {
        setFormError(
          "That email is already registered. / Email tersebut sudah terdaftar.",
        );
        return;
      }
      if (!res.ok || !data?.tempPassword) {
        setFormError(
          "Could not create the account. Check the inputs. / Tidak dapat membuat akun.",
        );
        return;
      }
      setTempSecret({ email: email.trim(), secret: data.tempPassword });
      setName("");
      setEmail("");
      reload();
    } catch {
      setFormError(
        "Could not create the account. Check your connection. / Periksa koneksi Anda.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function onReissue(id: string, rowEmail: string): Promise<void> {
    setFormError(null);
    setTempSecret(null);
    try {
      const res = await fetch("/api/staff/reissue", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ userId: id }),
      });
      const data = (await res.json().catch(() => null)) as {
        tempPassword?: string;
      } | null;
      if (!res.ok || !data?.tempPassword) {
        setFormError(
          "Could not reissue the password. / Tidak dapat menerbitkan ulang kata sandi.",
        );
        return;
      }
      setTempSecret({ email: rowEmail, secret: data.tempPassword });
      reload();
    } catch {
      setFormError("Could not reissue the password. / Periksa koneksi Anda.");
    }
  }

  async function onToggleDisable(row: StaffRow): Promise<void> {
    setFormError(null);
    try {
      const res = await fetch(`/api/staff/${encodeURIComponent(row.id)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ isDisabled: !row.isDisabled }),
      });
      if (res.status === 403) {
        setFormError(
          "An admin cannot disable their own account. / Admin tidak dapat menonaktifkan akun sendiri.",
        );
        return;
      }
      if (!res.ok) {
        setFormError(
          "Could not update the account. / Tidak dapat memperbarui akun.",
        );
        return;
      }
      reload();
    } catch {
      setFormError("Could not update the account. / Periksa koneksi Anda.");
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <form
        onSubmit={onCreate}
        className="flex flex-col gap-3 border-b border-border pb-6"
      >
        <h2 className="text-base font-semibold text-foreground">
          Create staff account · Buat akun staf
        </h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <Input
            label="Full name · Nama"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Input
            label="Staff email · Email staf"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="staff-role"
              className="text-sm font-medium text-foreground"
            >
              Role · Peran
            </label>
            <select
              id="staff-role"
              value={role}
              onChange={(e) => setRole(e.target.value as StaffRow["role"])}
              className="min-h-11 rounded-md border border-input bg-background px-3 text-base text-foreground"
            >
              {ROLE_OPTIONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
        </div>
        {formError ? (
          <p role="alert" className="text-sm text-brand-ink">
            {formError}
          </p>
        ) : null}
        {tempSecret ? (
          <p
            role="status"
            className="rounded-md border border-input bg-muted px-3 py-2 text-sm text-foreground"
          >
            Temporary password for {tempSecret.email}:{" "}
            <strong>{tempSecret.secret}</strong> — share it once, it will not
            show again. · Bagikan sekali, tidak akan tampil lagi.
          </p>
        ) : null}
        <div>
          <Button
            type="submit"
            disabled={busy || !name.trim() || !email.trim()}
          >
            {busy ? "Creating…" : "Create account · Buat akun"}
          </Button>
        </div>
      </form>

      <div className="flex flex-col gap-3">
        <h2 className="text-base font-semibold text-foreground">
          Accounts · Akun
        </h2>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading… · Memuat…</p>
        ) : loadError ? (
          <p role="alert" className="text-sm text-brand-ink">
            {loadError}
          </p>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No staff accounts yet. · Belum ada akun staf.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {items.map((row) => (
              <li
                key={row.id}
                className="flex flex-wrap items-center gap-2 rounded-md border border-border px-3 py-2"
              >
                <span className="font-medium text-foreground">{row.name}</span>
                <span className="text-sm text-muted-foreground">
                  {row.email}
                </span>
                <Badge tone={row.role === "ADMIN" ? "brand" : "neutral"}>
                  {row.role}
                </Badge>
                {row.mustChangePassword ? (
                  <Badge tone="ok">temp password</Badge>
                ) : null}
                {row.isDisabled ? <Badge tone="danger">disabled</Badge> : null}
                <span className="ms-auto flex gap-2">
                  <Button
                    type="button"
                    variant="quiet"
                    onClick={() => void onReissue(row.id, row.email)}
                  >
                    Reissue · Terbitkan ulang
                  </Button>
                  <Button
                    type="button"
                    variant="quiet"
                    onClick={() => void onToggleDisable(row)}
                  >
                    {row.isDisabled ? "Enable" : "Disable"}
                  </Button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
