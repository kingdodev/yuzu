import { YuzuMark } from "@/components/ui";

export default function NoTicketSelected() {
  return (
    <div className="flex h-full items-center justify-center p-8">
      <div className="max-w-xs text-center">
        <div className="mx-auto mb-4 w-fit opacity-80">
          <YuzuMark size={40} />
        </div>
        <p className="text-[15px] leading-relaxed text-muted">
          Kies links een ticket. Tickets met een geel label hebben al een concept-antwoord
          van Yuzu.
        </p>
      </div>
    </div>
  );
}
