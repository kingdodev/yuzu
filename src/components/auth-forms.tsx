"use client";

import { useState } from "react";
import { ActionForm, Field } from "./forms";
import {
  changePassword,
  login,
  setFirstOwnerPassword,
  setPasswordWithLink,
} from "@/server/actions/auth";
import { MIN_PASSWORD_LENGTH } from "@/domain/auth";

const full = "btn btn-primary w-full justify-center";

export function LoginForm({ next }: { next: string }) {
  // Vast in state, zodat het adres blijft staan na een fout wachtwoord
  // (React maakt het formulier na elke poging leeg).
  const [email, setEmail] = useState("");
  return (
    <ActionForm
      action={login}
      submitLabel="Inloggen"
      submitClassName={full}
      className="space-y-4"
    >
      <input type="hidden" name="next" value={next} />
      <Field label="E-mailadres">
        <input
          className="field"
          name="email"
          type="email"
          autoComplete="username"
          required
          autoFocus
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </Field>
      <Field label="Wachtwoord">
        <input
          className="field"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
      </Field>
    </ActionForm>
  );
}

function NewPasswordFields() {
  return (
    <>
      <Field label="Nieuw wachtwoord" hint={`Minstens ${MIN_PASSWORD_LENGTH} tekens.`}>
        <input
          className="field"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={MIN_PASSWORD_LENGTH}
          required
        />
      </Field>
      <Field label="Nog een keer">
        <input
          className="field"
          name="password2"
          type="password"
          autoComplete="new-password"
          minLength={MIN_PASSWORD_LENGTH}
          required
        />
      </Field>
    </>
  );
}

export function FirstOwnerForm() {
  return (
    <ActionForm
      action={setFirstOwnerPassword}
      submitLabel="Wachtwoord instellen en inloggen"
      submitClassName={full}
      className="space-y-4"
    >
      <Field label="Je e-mailadres (eigenaar)">
        <input
          className="field"
          name="email"
          type="email"
          autoComplete="username"
          required
        />
      </Field>
      <NewPasswordFields />
    </ActionForm>
  );
}

export function SetPasswordForm({ token, email }: { token: string; email: string }) {
  return (
    <ActionForm
      action={setPasswordWithLink}
      submitLabel="Wachtwoord instellen en inloggen"
      submitClassName={full}
      className="space-y-4"
    >
      <input type="hidden" name="token" value={token} />
      {/* Voor wachtwoordbeheerders: bij welk account hoort dit wachtwoord. */}
      <input type="hidden" name="username" value={email} autoComplete="username" />
      <NewPasswordFields />
    </ActionForm>
  );
}

export function ChangePasswordForm({ email }: { email: string }) {
  return (
    <ActionForm
      action={changePassword}
      submitLabel="Wachtwoord wijzigen"
      className="space-y-4"
    >
      <input type="hidden" name="username" value={email} autoComplete="username" />
      <Field label="Huidig wachtwoord">
        <input
          className="field"
          name="current"
          type="password"
          autoComplete="current-password"
          required
        />
      </Field>
      <NewPasswordFields />
    </ActionForm>
  );
}
