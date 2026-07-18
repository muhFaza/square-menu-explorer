import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "Square Menu Explorer",
  description: "A mobile-friendly Square catalog browser for Per Diem.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
