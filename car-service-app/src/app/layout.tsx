import type { Metadata } from "next";
import { Overpass, Public_Sans } from "next/font/google";
import "./globals.css";

// Overpass is modelled on the Highway Gothic lettering used on US road signs;
// Public Sans is a plain, readable text face.
const display = Overpass({ subsets: ["latin"], variable: "--font-display", display: "swap" });
const body = Public_Sans({ subsets: ["latin"], variable: "--font-body", display: "swap" });

export const metadata: Metadata = {
  title: "Car Service Reminder",
  description: "Track your vehicle's maintenance schedule, safety record and nearby service centers.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`}>
      <body>{children}</body>
    </html>
  );
}
