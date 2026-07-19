import type { Metadata } from "next";
import { Nunito } from "next/font/google";

import "./globals.css";

const nunito = Nunito({
  subsets: ["latin"],
  weight: ["400", "600", "700", "800"],
  display: "swap",
  variable: "--font-nunito",
});

export const metadata: Metadata = {
  title: "Square Menu Explorer",
  description: "A mobile-friendly Square catalog browser for Per Diem.",
};

// Applies the saved (or system) theme before hydration so there is no flash of
// the wrong theme. No user input is interpolated, so there is no injection risk.
const themeInitScript = `(function(){try{var t=localStorage.getItem("menu-explorer-theme");if(!t){t=window.matchMedia&&window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";}if(t==="dark"){document.documentElement.setAttribute("data-theme","dark");}}catch(e){}})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html className={nunito.variable} lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
