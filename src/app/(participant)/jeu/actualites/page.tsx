import Link from "next/link";

import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { publishedPosts } from "@/lib/news/posts";

export const metadata = {
  title: "Actualités — DEFI Movember",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * The feed.
 *
 * **The calm channel.** A notification interrupts; this waits to be read.
 * Nothing published here sends anything — the two are separate gestures on
 * purpose (story 7.8 AC 7), because linking them turns every small
 * announcement into an interruption, and that is how people end up switching
 * notifications off altogether.
 *
 * Pinned posts stay at the top whatever their date: the organisation pins the
 * thing everybody needs, and it has to be where people look.
 */
export default async function NewsPage() {
  const posts = await publishedPosts();

  return (
    <div className="space-y-6">
      <div>
        <p className="text-ink-muted text-sm">
          <Link href="/jeu" className="underline underline-offset-4">
            Le jeu
          </Link>
        </p>
        <h1 className="text-ink mt-1 text-3xl font-bold tracking-tight">
          Actualités
        </h1>
        <p className="text-ink-muted mt-2">
          Les messages de l’organisation pendant le mois.
        </p>
      </div>

      {posts.length === 0 ? (
        <Alert tone="info" title="Rien pour l’instant">
          Les messages de l’organisation apparaîtront ici pendant l’édition.
        </Alert>
      ) : (
        <ul className="space-y-6">
          {posts.map((post) => (
            <li
              key={post.id}
              className="border-line bg-surface overflow-hidden rounded-xl border"
            >
              {post.imagePath && (
                /* eslint-disable-next-line @next/next/no-img-element --
                   Served straight from storage, at a size the organisation
                   chose. The optimiser would be one more moving part between
                   a volunteer posting from a train and it appearing. */
                <img
                  src={post.imagePath}
                  alt=""
                  className="max-h-80 w-full object-cover"
                  loading="lazy"
                />
              )}

              <div className="space-y-2 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  {post.isPinned && <Badge tone="orange">Épinglé</Badge>}
                  {post.publishedAt && (
                    <time
                      dateTime={post.publishedAt}
                      className="text-ink-muted text-sm"
                    >
                      {formatDate(post.publishedAt)}
                    </time>
                  )}
                </div>

                <h2 className="text-ink text-xl font-bold">{post.title}</h2>

                {post.body && (
                  /* `whitespace-pre-line`, so a volunteer's line breaks
                     survive. Nothing is interpreted as markup: the text is
                     rendered as text, which is also why an apostrophe or a
                     `<` in a message cannot become anything else. */
                  <p className="text-ink-muted whitespace-pre-line">
                    {post.body}
                  </p>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "long",
    timeZone: "Europe/Paris",
  }).format(new Date(iso));
}
