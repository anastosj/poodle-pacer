import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { AppProvider } from "@/components/AppContext";
import BottomNav from "@/components/BottomNav";
import NavBar from "@/components/NavBar";
import "./globals.css";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: "Poodle Pacer 🐩 Half Marathon Trainer",
  description:
    "A fun white-poodle-themed sidekick for half marathon training — Hal Higdon programs, Strava sync, and progress tracking.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Poodle Pacer",
    statusBarStyle: "default",
  },
  icons: {
    apple: "/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#2f6fed",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <AppProvider>
          <NavBar />
          <div className="pb-20 sm:pb-0">{children}</div>
          <BottomNav />
        </AppProvider>
      </body>
    </html>
  );
}
