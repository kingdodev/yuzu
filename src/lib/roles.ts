export const ROLE_LABELS: Record<string, { label: string; text: string }> = {
  owner: { label: "Eigenaar", text: "Alles, inclusief koppelingen, AI en data-exports." },
  admin: {
    label: "Beheerder",
    text: "Shops, gebruikers, sjablonen, kennisbank en AI beheren.",
  },
  teamlead: {
    label: "Teamleider",
    text: "Tickets toewijzen en rapportages van het eigen team.",
  },
  agent: { label: "Agent", text: "Tickets behandelen in de eigen shops." },
  viewer: {
    label: "Meelezer",
    text: "Tickets lezen en notities plaatsen, geen klanten mailen.",
  },
};
