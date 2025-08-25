import "./globals.css";

export const metadata = {
  title: "BentlinDevelopment Weather",
  description: "Check the weather by city or your location.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gradient-to-br from-sky-500 via-indigo-600 to-gray-900 text-white">
        {children}
      </body>
    </html>
  );
}