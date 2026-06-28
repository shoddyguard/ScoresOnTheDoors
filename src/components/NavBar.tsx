"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";

interface NavBarProps {
  user: {
    id: string;
    name?: string | null;
    role: string;
  };
}

export default function NavBar({ user }: NavBarProps) {
  const pathname = usePathname();

  const navLink = (href: string, label: string) => (
    <Link
      href={href}
      className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
        pathname === href || pathname.startsWith(href + "/")
          ? "bg-blue-700 text-white"
          : "text-blue-100 hover:bg-blue-700 hover:text-white"
      }`}
    >
      {label}
    </Link>
  );

  return (
    <nav className="bg-blue-900 shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14">
          <div className="flex items-center gap-1">
            <Link href="/" className="flex items-center gap-2 mr-4">
              <span className="text-2xl">⚽</span>
              <span className="text-white font-bold text-lg hidden sm:block">ScoresOnTheDoors</span>
            </Link>
            {navLink("/predict", "Predictions")}
            {navLink("/leaderboard", "Leaderboard")}
            {user.role === "Admin" && navLink("/admin", "Admin")}
          </div>
          <div className="flex items-center gap-3">
            <span className="text-blue-200 text-sm hidden sm:block">
              {user.name ?? "Player"}
            </span>
            <Link href="/me" className="text-blue-200 hover:text-white text-sm">
              Profile
            </Link>
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="text-blue-200 hover:text-white text-sm"
            >
              Sign out
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}
