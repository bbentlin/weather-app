import "./globals.css";
import "leaflet/dist/leaflet.css";

export const metadata = {
  title: "Weather",
  description: "Weather and radar",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased bg-white text-slate-900 dark:bg-gray-950 dark:text-slate-200 transition-colors duration-300">
        {children}
      </body>
    </html>
  );
}