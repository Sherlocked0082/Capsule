import type { ReactNode } from "react";
import "./globals.css";

export const metadata = {
  title: "Relay",
  description: "Portable context bridge for AI tools"
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
