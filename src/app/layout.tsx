// import type { Metadata } from "next";
import { AuthProvider } from '../contexts/AuthContext'
import { Geist, Geist_Mono } from "next/font/google";
import BottomNav from '../components/BottomNav'
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "Word Quiz App",
  description: "Test your vocabulary with our word quiz app",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <AuthProvider>
          <div className="pb-16"> {/* Add padding to prevent content from being hidden behind the nav bar */}
            {children}
          </div>
          <BottomNav />
        </AuthProvider>
      </body>
    </html>
  );
}
