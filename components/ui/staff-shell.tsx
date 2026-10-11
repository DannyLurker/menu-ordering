// Section shell for staff role homes (spec 0004). The full screens for
// each role land in their own slices; this shell owns the shared header,
// role badge, and sign out so every role home reads as one product.
import type { ReactNode } from "react";
import type { StaffRole } from "@/lib/staff";
import { Badge } from "./badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./card";
import { Container, Stack } from "./primitives";
import { SignOutButton } from "./sign-out-button";

const ROLE_LABEL: Record<StaffRole, string> = {
  FRONT_DESK: "Front desk",
  KITCHEN: "Kitchen",
  ADMIN: "Admin",
};

export function StaffShell({
  name,
  role,
  title,
  description,
  children,
}: {
  name: string;
  role: StaffRole;
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <Container className="py-8">
      <Stack>
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-col gap-1">
            <p className="text-sm text-muted-foreground">Biz Hotel Batam · Staff</p>
            <h1 className="text-2xl font-semibold text-foreground">{title}</h1>
          </div>
          <div className="flex items-center gap-2">
            <Badge>{ROLE_LABEL[role]}</Badge>
            <span className="text-sm text-muted-foreground">{name}</span>
            <SignOutButton />
          </div>
        </header>
        <Card>
          <CardHeader>
            <CardTitle>{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </CardHeader>
          {children ? <CardContent>{children}</CardContent> : null}
        </Card>
      </Stack>
    </Container>
  );
}
