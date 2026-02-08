import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Riigikogu Radar",
  description: "Intelligence and prediction system for the Estonian Parliament",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
