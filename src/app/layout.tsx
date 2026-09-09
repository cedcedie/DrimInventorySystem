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
  applicationName: "DRIM Inventory System",
  icons: {
    icon: "/images/drim-d-transparent.png",
    apple: "/images/drim-d-transparent.png",
  },
  openGraph: {
    title: "DRIM Inventory System",
    description: "Role-based warehouse inventory system",
    siteName: "DRIM Inventory System",
    type: "website",
    images: ["/images/drim-d-transparent.png"],
  },
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
