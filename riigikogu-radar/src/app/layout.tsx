import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Riigikogu Radar",
  description: "AI-powered parliamentary decision prediction for the Estonian Riigikogu",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
