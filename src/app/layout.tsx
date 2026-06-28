import type { Metadata } from "next";
import "./globals.css";
import "flag-icons/css/flag-icons.min.css";
import { auth } from "@/lib/auth/auth";
import NavBar from "@/components/NavBar";

export const metadata: Metadata = {
  title: "ScoresOnTheDoors",
  description: "FIFA World Cup family prediction tracker",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  return (
    <html lang="en">
      <body>
        {session?.user && <NavBar user={session.user} />}
        <main className="min-h-screen">
          {children}
        </main>
      </body>
    </html>
  );
}
