// Recent stay list for the desk (spec 0008, AC-8). Server rendered rows
// with per row reissue actions; empty state when no stays exist yet.
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { maskGuestName } from "@/features/stays";
import { ReissueButton } from "./reissue-button";

export interface StayListItem {
  id: string;
  roomNumber: string;
  guestName: string;
  checkIn: string;
  checkOut: string;
  status: string;
  pinSet: boolean;
}

function statusTone(status: string): "brand" | "neutral" | "danger" {
  if (status === "ACTIVE") return "brand";
  if (status === "CHECKED_OUT") return "neutral";
  return "danger";
}

export function StayList({ stays }: { stays: StayListItem[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent stays · Data menginap</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {stays.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No stays yet. Check in the first guest above. / Belum ada data. Daftarkan tamu pertama di atas.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {stays.map((stay) => (
              <li
                key={stay.id}
                className="flex flex-col gap-2 rounded-lg border border-border p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex flex-col gap-1">
                  <p className="font-medium text-foreground">
                    Room {stay.roomNumber} · {maskGuestName(stay.guestName)}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {stay.checkIn} to {stay.checkOut} · {stay.pinSet ? "PIN set · PIN diatur" : "PIN pending · PIN belum diatur"}
                  </p>
                  <div>
                    <Badge tone={statusTone(stay.status)}>{stay.status}</Badge>
                  </div>
                </div>
                <ReissueButton stayId={stay.id} />
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
