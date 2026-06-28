import { prisma } from "@/lib/db/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import CreateUserForm from "@/components/admin/CreateUserForm";
import UserRoleForm from "@/components/admin/UserRoleForm";
import StartingScoreForm from "@/components/admin/StartingScoreForm";

export default async function UsersPage() {
  const tournament = await prisma.tournament.findFirst({ where: { isActive: true }, select: { id: true } });
  const tournamentId = tournament?.id;

  const [users, me] = await Promise.all([
    prisma.user.findMany({
      orderBy: { fullName: "asc" },
      include: tournamentId
        ? { participations: { where: { tournamentId }, select: { startingScore: true } } }
        : { participations: false },
    }),
    getCurrentUser(),
  ]);

  return (
    <div className="space-y-8">
      <h1>Users</h1>

      <CreateUserForm />

      <div className="card overflow-hidden">
        <table className="table-auto w-full">
          <thead>
            <tr>
              <th>Name</th>
              <th>Username</th>
              <th>Email</th>
              <th>Role</th>
              <th>Starting score</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>{u.fullName}</td>
                <td className="font-mono text-sm">{u.username}</td>
                <td className="text-sm text-gray-500">{u.email ?? "-"}</td>
                <td>
                  <span className={`text-xs px-2 py-0.5 rounded font-medium ${
                    u.role === "Admin" ? "bg-red-100 text-red-800" : "bg-blue-100 text-blue-800"
                  }`}>
                    {u.role}
                  </span>
                </td>
                <td>
                  {tournamentId ? (
                    <StartingScoreForm
                      userId={u.id}
                      currentScore={(u.participations as { startingScore: number }[])[0]?.startingScore ?? 0}
                    />
                  ) : (
                    <span className="text-xs text-gray-400">-</span>
                  )}
                </td>
                <td>
                  <UserRoleForm userId={u.id} currentRole={u.role} isSelf={u.id === me?.id} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="space-y-1">
        <p className="text-xs text-gray-400">Role changes take effect on the user&apos;s next login.</p>
        {tournamentId && (
          <p className="text-xs text-gray-400">
            Starting score: baseline points carried over from pen-and-paper scoring before this app was set up. Added to computed prediction points on the leaderboard.
          </p>
        )}
        {!tournamentId && (
          <p className="text-xs text-amber-600">No active tournament - starting scores are not available until one is created.</p>
        )}
      </div>
    </div>
  );
}
