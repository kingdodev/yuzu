"use client";

import { ActionForm, Field } from "@/components/forms";
import { saveShop } from "@/server/actions/admin";

type Shop = {
  id: string;
  code: string;
  name: string;
  domain: string;
  language: string;
  locale: string;
  senderName: string;
  senderEmail: string;
  signature: string;
  magentoStoreId: number | null;
  orderNumberPrefix: string | null;
  openingHours: string;
  toneOfVoice: string;
  active: boolean;
};

export function ShopForm({ shop }: { shop: Shop | null }) {
  return (
    <ActionForm action={saveShop} className="space-y-8">
      <input type="hidden" name="id" value={shop?.id ?? ""} />

      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="mb-3 text-[15px] font-semibold">Algemeen</legend>
        <Field label="Naam">
          <input className="field" name="name" defaultValue={shop?.name} required />
        </Field>
        <Field label="Code" hint="Korte code voor de inbox, bijv. nl of be.">
          <input
            className="field"
            name="code"
            defaultValue={shop?.code}
            required
            maxLength={5}
          />
        </Field>
        <Field label="Domein">
          <input
            className="field"
            name="domain"
            defaultValue={shop?.domain}
            placeholder="voorbeeldshop.nl"
            required
          />
        </Field>
        <Field label="Taal van de klanten">
          <select className="field" name="language" defaultValue={shop?.language ?? "nl"}>
            <option value="nl">Nederlands</option>
            <option value="fr">Frans</option>
            <option value="es">Spaans</option>
            <option value="de">Duits</option>
            <option value="en">Engels</option>
          </select>
        </Field>
        <Field
          label="Regio-instelling"
          hint="Bepaalt datum- en getalnotatie, bijv. nl-BE."
        >
          <input
            className="field"
            name="locale"
            defaultValue={shop?.locale ?? "nl-NL"}
            required
          />
        </Field>
        <Field
          label="Openingstijden"
          hint="Komt in de automatische ontvangstbevestiging."
        >
          <input
            className="field"
            name="openingHours"
            defaultValue={shop?.openingHours ?? "ma–vr 9:00–17:00"}
          />
        </Field>
        <label className="flex items-center gap-2 text-[14px] sm:col-span-2">
          <input
            type="checkbox"
            name="active"
            defaultChecked={shop?.active ?? true}
            className="h-4 w-4 accent-[var(--pine)]"
          />
          Shop is actief. Uitgeschakelde shops ontvangen geen nieuwe tickets.
        </label>
      </fieldset>

      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="mb-3 text-[15px] font-semibold">E-mail</legend>
        <Field label="Afzendernaam">
          <input
            className="field"
            name="senderName"
            defaultValue={shop?.senderName}
            required
          />
        </Field>
        <Field
          label="Afzenderadres"
          hint="Klanten mailen hiernaartoe en krijgen hiervandaan antwoord."
        >
          <input
            className="field"
            name="senderEmail"
            type="email"
            defaultValue={shop?.senderEmail}
            required
          />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Handtekening">
            <textarea
              className="field min-h-[90px]"
              name="signature"
              defaultValue={shop?.signature}
            />
          </Field>
        </div>
      </fieldset>

      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="mb-3 text-[15px] font-semibold">Magento</legend>
        <Field
          label="Store-ID"
          hint="Alle shops draaien in één Magento-installatie; hiermee hoort een order bij deze shop."
        >
          <input
            className="field tabular"
            name="magentoStoreId"
            inputMode="numeric"
            defaultValue={shop?.magentoStoreId ?? ""}
          />
        </Field>
        <Field
          label="Prefix van ordernummers"
          hint="Alleen invullen als ordernummers van deze shop een eigen prefix hebben."
        >
          <input
            className="field"
            name="orderNumberPrefix"
            defaultValue={shop?.orderNumberPrefix ?? ""}
          />
        </Field>
      </fieldset>

      <fieldset>
        <legend className="mb-3 text-[15px] font-semibold">Toon voor de AI</legend>
        <Field
          label="Schrijfstijl"
          hint="Hoe Yuzu klinkt in antwoorden van deze shop. Kort en concreet werkt het best."
        >
          <textarea
            className="field min-h-[90px]"
            name="toneOfVoice"
            defaultValue={shop?.toneOfVoice}
          />
        </Field>
      </fieldset>
    </ActionForm>
  );
}
