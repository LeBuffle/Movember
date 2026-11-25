import Link from "next/link";
import { notFound } from "next/navigation";

import { Alert } from "@/components/ui/alert";
import { ADMIN_SECTIONS, findAdminSection } from "@/lib/admin/sections";

/**
 * Placeholder for a back-office section whose screen has not been built.
 *
 * One file for all eight, driven by `ADMIN_SECTIONS`. Writing eight nearly
 * identical pages would have been eight files to delete later, and eight
 * chances for one of them to say something slightly different.
 *
 * When an epic builds the real screen it adds `admin/<slug>/page.tsx`. A
 * static segment wins over this dynamic one in Next's routing, so nothing
 * here needs removing — only the section's `status` changes.
 */
export function generateStaticParams() {
  // A section that has its screen is excluded: its own static route wins the
  // routing anyway, and prerendering a placeholder for it would be a page
  // that can never be reached and would confuse the next person reading this.
  return ADMIN_SECTIONS.filter(
    (section) => section.status === "comingSoon",
  ).map((section) => ({ section: section.slug }));
}

export default async function AdminSectionPage({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section: slug } = await params;
  const section = findAdminSection(slug);

  // An unknown slug is a 404, not an empty page. `/admin/nimportequoi` must
  // not render a shell that looks like a section under construction.
  if (!section) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-ink text-3xl font-bold tracking-tight">
          {section.label}
        </h1>
        <p className="text-ink-muted mt-2">{section.description}</p>
      </div>

      <Alert tone="info" title={`Écran prévu avec le lot « ${section.epic} »`}>
        Cet emplacement existe déjà, avec sa protection d’accès et sa
        navigation. L’écran viendra s’y brancher — rien ne sera à refaire.
      </Alert>

      <p className="text-ink-muted text-sm">
        <Link href="/admin" className="underline underline-offset-4">
          Retour à l’accueil du back-office
        </Link>
      </p>
    </div>
  );
}
