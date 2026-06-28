import { requireAdmin } from "@/lib/auth/session";
import Link from "next/link";

const adminLinks = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/sync", label: "Sync" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/matches", label: "Matches" },
  { href: "/admin/locks", label: "Lock Overrides" },
  { href: "/admin/import", label: "CSV Import" },
  { href: "/admin/recompute", label: "Recompute" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin(); // Throws if not admin (middleware is first line of defense)

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-6 flex items-center gap-2 text-sm text-gray-500">
        <Link href="/" className="hover:text-gray-900">Home</Link>
        <span>/</span>
        <span className="text-gray-900 font-medium">Admin</span>
      </div>
      <div className="flex gap-2 flex-wrap mb-8">
        {adminLinks.map((l) => (
          <Link key={l.href} href={l.href} className="btn-secondary text-xs">
            {l.label}
          </Link>
        ))}
      </div>
      {children}
    </div>
  );
}
