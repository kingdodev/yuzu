import Link from "next/link";
import { Suspense } from "react";
import { SetPasswordForm } from "@/components/auth-forms";
import { AuthShell } from "@/components/auth-shell";
import { Skeleton } from "@/components/ui";
import { getDb } from "@/db/client";
import { peekAuthToken } from "@/db/repositories/auth";

export const metadata = {
  title: "Wachtwoord instellen",
  // Het token in de link mag niet via de Referer-header naar andere sites lekken.
  referrer: "no-referrer" as const,
};

export default function SetPasswordPage({
  searchParams,
}: PageProps<"/inloggen/wachtwoord">) {
  return (
    <Suspense
      fallback={
        <AuthShell title="Wachtwoord instellen">
          <Skeleton lines={4} />
        </AuthShell>
      }
    >
      <SetPassword searchParams={searchParams} />
    </Suspense>
  );
}

async function SetPassword({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { token } = await searchParams;
  const value = typeof token === "string" ? token : "";
  const target = value ? await peekAuthToken(await getDb(), value) : null;
  if (!target) {
    return (
      <AuthShell
        title="Link werkt niet meer"
        description="Deze link is verlopen of al gebruikt. Vraag een beheerder om een nieuwe."
      >
        <Link href="/inloggen" className="btn btn-secondary">
          Naar inloggen
        </Link>
      </AuthShell>
    );
  }
  return (
    <AuthShell
      title={target.purpose === "invite" ? `Welkom, ${target.name}` : "Nieuw wachtwoord"}
      description={
        <>
          Kies een wachtwoord voor <strong className="text-ink">{target.email}</strong>.
          Daarna ben je meteen ingelogd.
        </>
      }
    >
      <SetPasswordForm token={value} email={target.email} />
    </AuthShell>
  );
}
