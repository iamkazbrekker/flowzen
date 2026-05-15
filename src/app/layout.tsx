import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FlowZen — Supply Chain Intelligence Dashboard",
  description:
    "Real-time supply chain disruption monitoring, AI-powered rerouting, and autonomous re-booking powered by FlowZen.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&family=Playfair+Display:ital,wght@0,400..900;1,400..900&display=swap" rel="stylesheet" />
      </head>
      <body style={{ margin: 0, padding: 0, overflow: "hidden", height: "100vh" }}>
        {children}
      </body>
    </html>
  );
}
