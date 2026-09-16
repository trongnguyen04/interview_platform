import type { Metadata } from "next";
import { Mona_Sans } from "next/font/google";
import { Toaster } from "sonner"
import "./globals.css";

const monatSans = Mona_Sans({
  variable: "--font-mona-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Interview Platform",
  description: "An AI-powered platform for preparing for mock interview",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" >
      <body className={`${monatSans.className} antialiased pattern`}>

        {children}

        <Toaster />

      </body>
    </html >
  );
}
