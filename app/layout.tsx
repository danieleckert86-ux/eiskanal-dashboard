import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Eiskanal Augsburg · Live Dashboard",
  description: "Abfluss, Wassertemperatur, Webcam und 7-Tage-Wetter für den Augsburger Eiskanal.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="de">
      <body className="antialiased">{children}</body>
    </html>
  );
}
