import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { AuthContextProvider } from './context/AuthContext';
import { DataProvider } from './context/DataContext';

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "CRM Dashboard",
  description: "Task and Lead Management System",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" dir="rtl">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <AuthContextProvider>
          <DataProvider>
            {children}
            <Toaster />
          </DataProvider>
        </AuthContextProvider>
      </body>
    </html>
  );
}
