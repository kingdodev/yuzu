import { Suspense } from "react";
import { TemplateEditor } from "@/components/admin/template-editor";
import { PageHeader, Skeleton } from "@/components/ui";
import { listTemplates } from "@/server/admin";

export const metadata = { title: "Sjablonen" };

export default function TemplatesPage() {
  return (
    <>
      <PageHeader
        title="Sjablonen"
        description="Vaste antwoorden die je met één klik in een ticket zet. In een ticket zie je alleen de sjablonen in de taal van die klant."
      />
      <Suspense fallback={<Skeleton />}>
        <Templates />
      </Suspense>
    </>
  );
}

async function Templates() {
  const { templates, shops } = await listTemplates();
  return (
    <TemplateEditor
      templates={templates.map(({ template, shopCode }) => ({
        id: template.id,
        name: template.name,
        language: template.language,
        shopId: template.shopId,
        shopCode,
        body: template.body,
      }))}
      shops={shops}
    />
  );
}
