import Link from "next/link";

import { CardPublishToggle } from "@/components/admin/card-actions";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import { setPostPublished } from "@/lib/news/actions";
import { allPosts } from "@/lib/news/posts";

export const metadata = {
  title: "Fil d’actualité — back-office",
};

export const dynamic = "force-dynamic";

/**
 * The feed, as the organisation manages it.
 *
 * Drafts first: they are the ones waiting for something to be done. Publishing
 * happens from the list rather than from inside each message — the routine is
 * "I wrote three of these on the train, let me put them up".
 *
 * **Publishing never notifies.** The sentence is on the screen rather than
 * implied, because the two live one menu apart and somebody will assume.
 */
export default async function AdminNewsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [params, posts] = await Promise.all([searchParams, allPosts()]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-ink text-3xl font-bold tracking-tight">
            Fil d’actualité
          </h1>
          <p className="text-ink-muted mt-2">
            Les messages que les participants lisent dans l’application. Un
            message publié ici n’envoie aucune notification.
          </p>
        </div>

        <Link href="/admin/actualites/nouveau" className={buttonClasses()}>
          Écrire un message
        </Link>
      </div>

      {params.enregistre && (
        <Alert tone="success" title="Message enregistré">
          Il reste un brouillon tant que vous ne l’avez pas publié.
        </Alert>
      )}

      {posts.length === 0 ? (
        <Alert tone="info" title="Aucun message">
          Écrivez le premier — il restera en brouillon jusqu’à ce que vous le
          publiiez.
        </Alert>
      ) : (
        <ul className="space-y-3">
          {posts.map((post) => (
            <li
              key={post.id}
              className="border-line bg-surface flex flex-wrap items-start justify-between gap-3 rounded-xl border p-4"
            >
              <div className="min-w-0 flex-1">
                <Link
                  href={`/admin/actualites/${post.id}`}
                  className="text-ink font-semibold underline-offset-4 hover:underline"
                >
                  {post.title}
                </Link>

                <div className="mt-2 flex flex-wrap gap-2">
                  {post.publishedAt ? (
                    <Badge tone="success">Publié</Badge>
                  ) : (
                    <Badge tone="neutral">Brouillon</Badge>
                  )}
                  {post.isPinned && <Badge tone="orange">Épinglé</Badge>}
                  {post.imagePath && <Badge tone="blue">Avec image</Badge>}
                </div>
              </div>

              <CardPublishToggle
                action={setPostPublished}
                id={post.id}
                published={post.publishedAt !== null}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
