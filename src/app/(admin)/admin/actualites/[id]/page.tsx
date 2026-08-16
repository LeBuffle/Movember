import Link from "next/link";
import { notFound } from "next/navigation";

import { NewsForm } from "@/components/admin/news-form";
import { savePost } from "@/lib/news/actions";
import { getPost } from "@/lib/news/posts";

export const metadata = {
  title: "Modifier un message — back-office",
};

export const dynamic = "force-dynamic";

export default async function EditPostPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const post = await getPost(id);

  if (!post) notFound();

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
          {post.title}
        </h1>
      </div>

      <NewsForm
        action={savePost}
        post={{
          id: post.id,
          title: post.title,
          body: post.body,
          imagePath: post.imagePath,
          isPinned: post.isPinned,
          published: post.publishedAt !== null,
        }}
      />
    </div>
  );
}
