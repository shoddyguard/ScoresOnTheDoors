import { prisma } from "@/lib/db/prisma";
import { redirect } from "next/navigation";
import SetupForm from "@/components/SetupForm";

export const dynamic = "force-dynamic";

// First-boot setup: only reachable when no administrator exists yet.
export default async function SetupPage() {
  const adminCount = await prisma.user.count({ where: { role: "Admin" } });
  if (adminCount > 0) redirect("/login");
  return <SetupForm />;
}
