"use client";

import { useState } from "react";
import { ActionForm } from "@/components/forms";
import { ROLE_LABELS } from "@/lib/roles";
import { updateMember } from "@/server/actions/admin";

type Member = {
  userId: string;
  name: string;
  email: string;
  role: string;
  allShops: boolean;
  active: boolean;
  shops: string[];
};

export function MemberRow({
  member,
  shops,
}: {
  member: Member;
  shops: { id: string; code: string; name: string }[];
}) {
  const [allShops, setAllShops] = useState(member.allShops);
  return (
    <ActionForm
      action={updateMember}
      submitLabel="Opslaan"
      submitClassName="btn btn-secondary"
      className="grid gap-4 p-4 md:grid-cols-[1.2fr_1fr_1.4fr] md:items-start"
    >
      <input type="hidden" name="userId" value={member.userId} />
      <div>
        <div className="font-medium">{member.name}</div>
        <div className="break-all text-[13px] text-muted">{member.email}</div>
        <label className="mt-2 flex items-center gap-2 text-[13.5px]">
          <input
            type="checkbox"
            name="active"
            defaultChecked={member.active}
            className="h-4 w-4 accent-[var(--primary)]"
          />
          Actief
        </label>
      </div>
      <label className="block">
        <span className="sr-only">Rol</span>
        <select className="field" name="role" defaultValue={member.role}>
          {Object.entries(ROLE_LABELS).map(([value, r]) => (
            <option key={value} value={value}>
              {r.label}
            </option>
          ))}
        </select>
      </label>
      <div>
        <label className="flex items-center gap-2 text-[13.5px]">
          <input
            type="checkbox"
            name="allShops"
            checked={allShops}
            onChange={(e) => setAllShops(e.target.checked)}
            className="h-4 w-4 accent-[var(--primary)]"
          />
          Toegang tot alle shops
        </label>
        {!allShops && (
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5">
            {shops.map((shop) => (
              <label key={shop.id} className="flex items-center gap-1.5 text-[13.5px]">
                <input
                  type="checkbox"
                  name="shops"
                  value={shop.id}
                  defaultChecked={member.shops.includes(shop.code)}
                  className="h-4 w-4 accent-[var(--primary)]"
                />
                {shop.name}
              </label>
            ))}
          </div>
        )}
      </div>
    </ActionForm>
  );
}
