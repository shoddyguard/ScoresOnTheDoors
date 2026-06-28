import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";

export default async function ProfilePage() {
  const user = await requireUser();

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { fullName: true, displayName: true, email: true, username: true, role: true },
  });

  return (
    <div className="max-w-lg mx-auto px-4 py-8">
      <h1 className="mb-6">My Profile</h1>

      <div className="card p-6 space-y-4">
        <div>
          <p className="form-label">Full name</p>
          <p className="text-gray-900">{dbUser?.fullName ?? "-"}</p>
        </div>
        {dbUser?.displayName && (
          <div>
            <p className="form-label">Display name</p>
            <p className="text-gray-900">{dbUser.displayName}</p>
          </div>
        )}
        <div>
          <p className="form-label">Username</p>
          <p className="text-gray-900 font-mono">{dbUser?.username ?? "-"}</p>
        </div>
        <div>
          <p className="form-label">Email</p>
          <p className="text-gray-900">{dbUser?.email ?? "-"}</p>
        </div>
        <div>
          <p className="form-label">Role</p>
          <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
            {dbUser?.role ?? user.role}
          </span>
        </div>
      </div>

      <p className="text-xs text-gray-400 mt-4">
        To change your password, contact the administrator.
      </p>
    </div>
  );
}
