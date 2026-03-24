import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Crushable — AI Landing Page Builder",
  description: "Build stunning landing pages with AI. Export pure HTML + Tailwind CSS. Zero lock-in.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Space+Grotesk:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
