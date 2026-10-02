import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Car Service Reminder",
  description: "Track your vehicle's maintenance schedule and find nearby service centers.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
