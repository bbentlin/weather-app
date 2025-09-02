import "./globals.css";
import "leaflet/dist/leaflet.css";
import { Inter } from "next/font/google";

export const metadata = {
  title: "Weather",
  description: "Weather and radar",
};

const inter = Inter({ subsets: ["latin"] });

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.className} antialiased bg-white text-slate-900 dark:bg-gray-950 dark:text-slate-200 transition-colors duration-300`}>
        {children}
      </body>
    </html>
  );
}