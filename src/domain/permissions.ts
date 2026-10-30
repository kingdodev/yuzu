/**
 * Wat elke rol mag (zie ook src/lib/roles.ts voor de uitleg in het beheer).
 *
 * - Eigenaar: alles, en als enige koppelingen en privacy (data-export,
 *   anonimiseren).
 * - Beheerder: beheer van shops, gebruikers, sjablonen, kennisbank en AI.
 * - Teamleider: tickets aan anderen toewijzen en rapportages zien.
 * - Agent: tickets behandelen; alleen aan zichzelf of niemand toewijzen.
 * - Meelezer: tickets lezen en notities plaatsen, verder niets.
 *
 * Welke shops iemand ziet, regelt de database (drizzle/0007).
 */

export type Role = "owner" | "admin" | "teamlead" | "agent" | "viewer";

export class PermissionError extends Error {
  constructor(message = "Dat mag je met jouw rol niet.") {
    super(message);
    this.name = "PermissionError";
  }
}

/** Antwoorden, status, prioriteit, labels, archiveren, nieuwe mail, bijlagen. */
export function canWorkTickets(role: Role): boolean {
  return role !== "viewer";
}

/** Notities mag iedereen plaatsen, ook een meelezer. */
export function canAddNotes(role: Role): boolean {
  return ["owner", "admin", "teamlead", "agent", "viewer"].includes(role);
}

/** Toewijzen: aan anderen alleen vanaf teamleider; een agent alleen aan zichzelf of niemand. */
export function canAssign(
  role: Role,
  actorId: string,
  assigneeId: string | null,
): boolean {
  if (role === "viewer") return false;
  if (role === "agent") return assigneeId === null || assigneeId === actorId;
  return true;
}

/** Mag aan iemand anders dan zichzelf toewijzen. */
export function canAssignOthers(role: Role): boolean {
  return role === "owner" || role === "admin" || role === "teamlead";
}

export function canSeeReports(role: Role): boolean {
  return role === "owner" || role === "admin" || role === "teamlead";
}

export function canManage(role: Role): boolean {
  return role === "owner" || role === "admin";
}

/** Koppelingen en privacy (data-export, anonimiseren). */
export function isOwner(role: Role): boolean {
  return role === "owner";
}

export function requirePermission(allowed: boolean, message?: string): void {
  if (!allowed) throw new PermissionError(message);
}

/**
 * Mag deze beheerder een wachtwoordlink maken voor deze collega? Met zo'n
 * link neem je het account over, dus:
 * - iemand die ook bij een andere organisatie hoort: nooit (dan zou je daar
 *   toegang krijgen); die wijzigt zelf zijn wachtwoord;
 * - de eigenaar mag verder alles;
 * - een beheerder alleen een uitnodiging voor iemand die nog géén wachtwoord
 *   heeft, en niet voor een eigenaar. Een nieuw wachtwoord voor een bestaand
 *   account regelt alleen de eigenaar (anders kan een beheerder iemand eerst
 *   degraderen en daarna zijn account overnemen).
 */
export function passwordLinkProblem(input: {
  actorRole: Role;
  targetRole: Role;
  targetHasPassword: boolean;
  targetInOtherOrganization: boolean;
}): string | null {
  if (!canManage(input.actorRole)) return "Alleen beheerders kunnen links maken.";
  if (input.targetInOtherOrganization) {
    return "Deze gebruiker hoort ook bij een andere organisatie. Die kan zelf zijn wachtwoord wijzigen via Mijn account.";
  }
  if (input.actorRole === "owner") return null;
  if (input.targetRole === "owner")
    return "Alleen een eigenaar kan een link maken voor een eigenaar.";
  if (input.targetHasPassword) {
    return "Alleen de eigenaar kan een nieuw wachtwoord regelen voor iemand die al een account heeft.";
  }
  return null;
}
