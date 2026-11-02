import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Restore Health Services | Admin",
  description: "Live Restore Health Services administration console.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
