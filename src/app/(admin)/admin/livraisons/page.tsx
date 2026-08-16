import Link from "next/link";

import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import { getDeliveries } from "@/lib/shipping/deliveries";

export const metadata = {
  title: "Livraisons — back-office",
};

export const dynamic = "force-dynamic";

/**
 * Who is owed a parcel, and who has not said where.
 *
 * The second list is the useful one. An address that is missing in December,
 * when the medals are being packed, is a fortnight of chasing; the same gap
 * seen in October is a reminder e-mail.
 *
 * Addresses are shown here rather than only in the export, because the person
 * checking a doubtful entry should not have to download a file to do it. They
 * are not shown anywhere else in the back-office.
 */
export default async function DeliveriesPage() {
  const { rows, missing } = await getDeliveries();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-ink text-3xl font-bold tracking-tight">
            Livraisons
          </h1>
          <p className="text-ink-muted mt-2">
            Les participants dont le niveau comprend un envoi postal. Les colis
            partent à la fin du défi.
          </p>
        </div>

        {rows.length > 0 && (
          /* A plain anchor, and `<Link>` would be wrong here: this address
             returns a file, not a page. Next's router would try to navigate
             to it and the download would simply not happen. */
          <a
            href="/admin/livraisons/export"
            download
            className={buttonClasses({ className: "w-full sm:w-auto" })}
          >
            Télécharger la liste (CSV)
          </a>
        )}
      </div>

      {missing.length > 0 && (
        <Alert
          tone="warning"
          title={`${missing.length} adresse${missing.length > 1 ? "s" : ""} manquante${missing.length > 1 ? "s" : ""}`}
        >
          Ces participants ont payé un niveau avec envoi postal et n’ont pas
          encore indiqué où l’adresser. Ils sont relancés dans l’application, et
          rien ne les empêche de jouer.
          <ul className="mt-3 space-y-1">
            {missing.map((entry, index) => (
              <li key={`${entry.displayName}-${index}`} className="text-ink">
                {entry.displayName}{" "}
                <Badge tone="neutral">{entry.tierName}</Badge>
              </li>
            ))}
          </ul>
        </Alert>
      )}

      {rows.length === 0 && missing.length === 0 ? (
        <Alert tone="info" title="Rien à envoyer pour l’instant">
          Aucun participant n’a encore payé un niveau comprenant un envoi
          postal.
        </Alert>
      ) : (
        <section aria-labelledby="adresses" className="space-y-3">
          <h2 id="adresses" className="text-ink text-xl font-bold">
            {rows.length} adresse{rows.length > 1 ? "s" : ""} renseignée
            {rows.length > 1 ? "s" : ""}
          </h2>

          {/* Scrolls inside its own box: an address line is long, and a page
              that scrolls sideways is unusable on a phone. */}
          <div className="border-line overflow-x-auto rounded-xl border">
            <table className="w-full text-left text-sm">
              <thead className="bg-surface-sunken text-ink-muted">
                <tr>
                  <th scope="col" className="p-3 font-semibold">
                    Niveau
                  </th>
                  <th scope="col" className="p-3 font-semibold">
                    Participant
                  </th>
                  <th scope="col" className="p-3 font-semibold">
                    Destinataire
                  </th>
                  <th scope="col" className="p-3 font-semibold">
                    Adresse
                  </th>
                </tr>
              </thead>
              <tbody className="divide-line divide-y">
                {rows.map((row, index) => (
                  <tr key={`${row.recipientName}-${index}`}>
                    <td className="text-ink-muted p-3 whitespace-nowrap">
                      {row.tierName}
                    </td>
                    <td className="text-ink-muted p-3">{row.displayName}</td>
                    <td className="text-ink p-3 font-medium">
                      {row.recipientName}
                    </td>
                    <td className="text-ink p-3">
                      {row.line1}
                      {row.line2 && `, ${row.line2}`}
                      <br />
                      {row.postalCode} {row.city}
                      {row.country !== "FR" && ` — ${row.country}`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <Alert
        tone="info"
        title="Ces adresses sont la donnée la plus sensible du projet"
      >
        Elles ne servent qu’à l’envoi des contreparties, ne sont visibles que du
        participant et des administrateurs, et disparaissent avec le compte. Le
        fichier téléchargé sort de l’application : ne le laissez pas traîner.
      </Alert>

      <p className="text-ink-muted text-sm">
        <Link href="/admin" className="underline underline-offset-4">
          Retour à l’accueil du back-office
        </Link>
      </p>
    </div>
  );
}
