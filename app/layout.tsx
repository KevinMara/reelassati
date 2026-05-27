import type { Metadata } from "next";
import { Inter, Fraunces } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const fraunces = Fraunces({ subsets: ["latin"], variable: "--font-fraunces", style: ['italic', 'normal'] });

export const metadata: Metadata = {
  title: "Reelassati - Relax, we'll make the reels.",
  description: "Reelassati is the first AI agency that creates, edits, and publishes your vertical videos.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} ${fraunces.variable} font-sans antialiased`}>
        <div id="root">{children}</div>
      </body>
    </html>
  );
}
