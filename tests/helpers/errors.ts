import { expect } from "vitest";

/**
 * Drizzle verpakt databasefouten in "Failed query: ..."; de echte melding
 * van Postgres zit in `cause`. Deze helper controleert die melding.
 */
export async function expectDbError(promise: Promise<unknown>, pattern: RegExp) {
  let error: unknown;
  try {
    await promise;
  } catch (e) {
    error = e;
  }
  expect(error, "verwachtte een databasefout").toBeInstanceOf(Error);
  const messages: string[] = [];
  for (let e: unknown = error; e instanceof Error; e = e.cause) {
    messages.push(e.message);
  }
  expect(messages.join(" | ")).toMatch(pattern);
}
