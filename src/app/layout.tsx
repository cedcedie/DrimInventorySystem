import type { Metadata } from "next";
import "@fontsource/nunito/400.css";
import "@fontsource/nunito/500.css";
import "@fontsource/nunito/600.css";
import "@fontsource/nunito/700.css";
import "@fontsource/nunito/800.css";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";
import "./globals.css";
import { ThemeRegistry } from "@/theme/ThemeRegistry";
import { QueryProvider } from "@/components/QueryProvider";
import { ToastProvider } from "@/components/Toast";

export const metadata: Metadata = {
  title: "DRIM Inventory System",
  description: "Role-based warehouse inventory system",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <QueryProvider>
          <ThemeRegistry>
            <ToastProvider>{children}</ToastProvider>
          </ThemeRegistry>
        </QueryProvider>
      </body>
    </html>
  );
}
