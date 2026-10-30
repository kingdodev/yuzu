import { redirect } from "next/navigation";
import { Suspense } from "react";
import { FirstOwnerForm, LoginForm } from "@/components/auth-forms";
import { AuthShell } from "@/components/auth-shell";
import { Skeleton } from "@/components/ui";
import { getDb } from "@/db/client";
import { usesDemoSession } from "@/db/connection";
import { anyPasswordSet } from "@/db/repositories/auth";
import { safeNextPath } from "@/domain/auth";
import { getOptionalSession } from "@/server/session";

export const metadata = { title: "Inloggen" };

export default function LoginPage({ searchParams }: PageProps<"/inloggen">) {
  return (
    <Suspense
      fallback={
        <AuthShell title="Inloggen">
          <Skeleton lines={4} />
        </AuthShell>
      }
    >
      <Login searchParams={searchParams} />
    </Suspense>
  );
}

async function Login({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const next = safeNextPath(typeof params.volgende === "string" ? params.volgende : null);
  // In de lokale demo en als je al bent ingelogd, hoef je hier niet te zijn.
  if (usesDemoSession() || (await getOptionalSession())) redirect(next);

  if (!(await anyPasswordSet(await getDb()))) {
    const gated = Boolean(process.env.DEMO_PASSWORD?.trim());
    return (
      <AuthShell
        title="Eerste keer inloggen"
        description={
          gated
            ? "Er heeft nog niemand een wachtwoord. Stel als eigenaar je eigen wachtwoord in; daarna nodig je collega's uit via Beheer → Gebruikers."
            : "Er heeft nog niemand een wachtwoord. Zet eerst het demowachtwoord (DEMO_PASSWORD) aan in Vercel; dan kan de eigenaar hier zijn wachtwoord instellen."
        }
      >
        {gated && <FirstOwnerForm />}
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Inloggen">
      <LoginForm next={next} />
      <p className="mt-5 text-[13px] leading-relaxed text-muted">
        Wachtwoord vergeten of nog geen account? Vraag een beheerder om een link waarmee
        je een (nieuw) wachtwoord instelt.
      </p>
    </AuthShell>
  );
}
