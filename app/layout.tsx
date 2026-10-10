import type { Metadata } from "next";
import "./globals.css";
import { IconProvider } from "@/components/ui/icons";

export const metadata: Metadata = {
  title: "Biz Hotel Batam Menu Ordering",
  description: "Order food from your room",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <IconProvider>{children}</IconProvider>
      </body>
    </html>
  );
}
