import "./globals.css";

export const metadata = {
  title: "Weather App",
  description: "Check the weather by city or your location.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gradient-to-b from-sky-500 to-gray-900 text-white">
        {children}
      </body>
    </html>
  );
}