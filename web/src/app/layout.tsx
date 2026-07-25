import type { Metadata } from "next";
import { Geist, Space_Mono } from "next/font/google";
import "./globals.css";
import { META } from "@/lib/content";

const geist = Geist({ variable: "--font-geist", subsets: ["latin"] });

const spaceMono = Space_Mono({
  variable: "--font-space-mono",
  weight: ["400", "700"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: `${META.name} — ${META.tagline}`,
  description: META.description,
  openGraph: {
    title: `${META.name} — ${META.tagline}`,
    description: META.description,
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: `${META.name} — ${META.tagline}`,
    description: META.description,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geist.variable} ${spaceMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
