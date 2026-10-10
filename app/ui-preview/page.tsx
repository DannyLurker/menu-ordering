"use client";

import { useState } from "react";
import { Check, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardEmpty,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Container, GlanceStatus, Section, Stack } from "@/components/ui/primitives";
import { Spinner } from "@/components/ui/spinner";

const swatches = [
  { name: "brand", swatch: "bg-brand", text: "text-primary-foreground", label: "Brand #E1251B" },
  { name: "deep", swatch: "bg-brand-deep", text: "text-primary-foreground", label: "Deep" },
  { name: "ink", swatch: "bg-foreground", text: "text-background", label: "Ink" },
  { name: "paper", swatch: "bg-background border border-border", text: "text-foreground", label: "Paper" },
  { name: "mist", swatch: "bg-muted", text: "text-foreground", label: "Mist" },
];

export default function UiPreviewPage() {
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <main>
      <Container>
        <Stack>
          <Section aria-labelledby="tokens-title">
            <h1 id="tokens-title" className="text-2xl font-semibold">
              UI preview
            </h1>
            <div className="flex flex-wrap gap-2">
              {swatches.map((s) => (
                <span key={s.name} className={`rounded-md px-3 py-2 text-sm font-medium ${s.swatch} ${s.text}`}>
                  {s.label}
                </span>
              ))}
            </div>
            <p className="text-sm text-brand-ink">Red text token sample (verified AA).</p>
          </Section>

          <Section aria-labelledby="buttons-title">
            <h2 id="buttons-title" className="text-xl font-semibold">
              Buttons
            </h2>
            <div className="flex flex-wrap gap-2">
              <Button>Order now</Button>
              <Button variant="quiet">View folio</Button>
              <Button variant="danger">Cancel order</Button>
              <Button size="kitchen">Verify</Button>
              <Button disabled>
                <Spinner />
                Sending
              </Button>
              <Button aria-label="Add item">
                <Plus aria-hidden="true" />
              </Button>
            </div>
          </Section>

          <Section aria-labelledby="inputs-title">
            <h2 id="inputs-title" className="text-xl font-semibold">
              Inputs
            </h2>
            <Input label="Room number" hint="Three digits on your key card" placeholder="101" />
            <Input label="Guest PIN" error="Wrong PIN, 4 tries left" placeholder="6 digits" />
            <Input label="Disabled" disabled placeholder="Unavailable" />
          </Section>

          <Section aria-labelledby="cards-title">
            <h2 id="cards-title" className="text-xl font-semibold">
              Cards and badges
            </h2>
            <Card>
              <CardHeader>
                <CardTitle>Nasi Goreng</CardTitle>
                <CardDescription>Rp75.000, serves one</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2">
                  <Badge tone="brand">Popular</Badge>
                  <Badge>Ready in 25 min</Badge>
                  <Badge tone="danger">Sold out</Badge>
                  <Badge tone="ok">Halal</Badge>
                </div>
              </CardContent>
              <CardFooter>
                <Button>Add to order</Button>
              </CardFooter>
            </Card>
            <Card>
              <CardEmpty title="No orders yet" hint="Your orders will show here once you place one." />
            </Card>
          </Section>

          <Section aria-labelledby="dialog-title">
            <h2 id="dialog-title" className="text-xl font-semibold">
              Dialog
            </h2>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button>Confirm payment</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogTitle>Pay now?</DialogTitle>
                <DialogDescription>
                  This records a payment of Rp175.000 with no money movement in V1.1.
                </DialogDescription>
                <div className="mt-4 flex gap-2">
                  <Button>
                    <Check aria-hidden="true" data-icon="inline-start" />
                    Yes, pay now
                  </Button>
                  <Button variant="quiet" onClick={() => setDialogOpen(false)}>
                    Keep room charge
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </Section>

          <Section aria-labelledby="glance-title">
            <h2 id="glance-title" className="text-xl font-semibold">
              Kitchen glance
            </h2>
            <GlanceStatus>PREPARING, 25 min</GlanceStatus>
          </Section>

          <Section aria-labelledby="locale-title">
            <h2 id="locale-title" className="text-xl font-semibold">
              Indonesian sample
            </h2>
            <p>Pesanan Anda sedang disiapkan dan akan segera diantar ke kamar Anda.</p>
          </Section>
        </Stack>
      </Container>
    </main>
  );
}
