import type { Metadata } from "next";
import { ThemeProvider } from "@/components/theme-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: "ClassAgent",
  description: "Live course transcription and summary",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="bg-zinc-50 text-zinc-950 antialiased dark:bg-zinc-950 dark:text-white">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
