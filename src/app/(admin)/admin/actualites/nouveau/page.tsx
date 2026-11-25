import Link from "next/link";

import { NewsForm } from "@/components/admin/news-form";
import { savePost } from "@/lib/news/actions";

export const metadata = {
  title: "Nouveau message — back-office",
};

export default function NewPostPage() {
  return (
    <div className="space-y-6">
      <div>
        <p className="text-ink-muted text-sm">
          <Link
            href="/admin/actualites"
            className="underline underline-offset-4"
          >
            Fil d’actualité
          </Link>
        </p>
        <h1 className="text-ink mt-1 text-3xl font-bold tracking-tight">
          Écrire un message
        </h1>
        <p className="text-ink-muted mt-2">
          Il reste un brouillon jusqu’à ce que vous le publiiez, et publier
          n’envoie aucune notification.
        </p>
      </div>

      <NewsForm action={savePost} />
    </div>
  );
}
