import { Suspense } from "react";
import { prisma } from "@/lib/db/prisma";
import { redirect } from "next/navigation";
import LoginForm from "@/components/LoginForm";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  // First-boot: if there's no administrator yet, force the setup flow.
  const adminCount = await prisma.user.count({ where: { role: "Admin" } });
  if (adminCount === 0) redirect("/setup");

  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
