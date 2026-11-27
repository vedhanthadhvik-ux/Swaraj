import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Swaraj — News, with context",
  description: "A citizen-powered space for public-interest news, respectful debate, and transparent claim analysis."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
