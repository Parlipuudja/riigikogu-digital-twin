import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Riigikogu Radar",
  description: "Making the Estonian Parliament readable",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
