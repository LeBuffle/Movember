import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

/* =========================================================================
 * Le fil d'actualité (story 7.8)
 *
 * Le canal calme. La notification interrompt ; le fil attend d'être lu. Lier
 * les deux transformerait chaque petite annonce en interruption — et c'est
 * ainsi qu'on fait couper les notifications.
 * ====================================================================== */

const root = path.resolve(import.meta.dirname, "../..");

function read(relative: string): string {
  return readFileSync(path.join(root, relative), "utf8");
}

/** Retire les commentaires : un commentaire n'est pas une garantie. */
function code(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "")
    .replace(/--.*$/gm, "");
}

const migration = code(
  read("supabase/migrations/20260806220000_news_posts.sql"),
);
const actions = code(read("src/lib/news/actions.ts"));
const posts = code(read("src/lib/news/posts.ts"));
const feed = code(read("src/app/(participant)/jeu/actualites/page.tsx"));
const admin = code(read("src/app/(admin)/admin/actualites/page.tsx"));
const form = code(read("src/components/admin/news-form.tsx"));
const sections = code(read("src/lib/admin/sections.ts"));

describe("publier n'envoie aucune notification", () => {
  it("aucune action de publication ne parle au répartiteur", () => {
    // AC 7. Les deux gestes sont distincts, exprès.
    expect(actions).not.toMatch(/notifications\/dispatch/);
    expect(actions).not.toMatch(/notify\(/);
  });

  it("et l'écran le dit, parce que quelqu'un supposera le contraire", () => {
    expect(form).toMatch(/publier n’envoie aucune notification/);
    expect(admin).toMatch(/n’envoie aucune notification/);
  });
});

describe("un brouillon est invisible", () => {
  it("la base le garantit, pas un filtre applicatif", () => {
    expect(migration).toMatch(
      /create policy "participants read published posts"[\s\S]*?published_at is not null/,
    );
  });

  it("et l'organisation voit tout", () => {
    expect(migration).toMatch(
      /create policy "admins read every post"[\s\S]*?is_admin/,
    );
  });

  it("seule l'organisation écrit", () => {
    expect(migration).toMatch(
      /create policy "only admins write the feed"[\s\S]*?is_admin/,
    );
  });

  it("le fil n'est pas public : ce n'est pas un blog", () => {
    // Une annonce sur un défi ne veut rien dire pour un visiteur, et serait
    // indexée par les moteurs de recherche.
    const policies = migration.slice(migration.indexOf("create policy"));

    expect(policies).not.toMatch(/to anon/);
  });

  it("la table active la sécurité au niveau des lignes", () => {
    expect(migration).toMatch(
      /alter table public\.news_posts enable row level security/,
    );
  });
});

describe("l'ordre du fil", () => {
  it("épinglé d'abord, puis le plus récent", () => {
    // AC 3. L'organisation épingle ce que tout le monde doit lire, et ça doit
    // rester là où les gens regardent.
    expect(posts).toMatch(/\.order\("is_pinned", \{ ascending: false \}\)/);
    expect(posts).toMatch(/\.order\("published_at", \{ ascending: false \}\)/);
  });

  it("et le back-office montre les brouillons en premier", () => {
    expect(posts).toMatch(/nullsFirst: true/);
  });
});

describe("le message", () => {
  it("accepte une image, par le même stockage que les cartes", () => {
    // AC 1. Un seul seau, un seul jeu de règles, une seule limite de taille.
    expect(actions).toMatch(/uploadImage/);
    expect(actions).toMatch(/from "@\/lib\/cards\/storage"/);
  });

  it("téléverse avant d'écrire, jamais après", () => {
    const region = actions.slice(
      actions.indexOf("export async function savePost"),
    );

    expect(region.indexOf("uploadImage")).toBeLessThan(
      region.indexOf('from("news_posts")'),
    );
  });

  it("se dépublie plutôt que de se supprimer", () => {
    // « Pourquoi ce message a disparu » est une question qui se pose.
    expect(actions).toMatch(/news\.unpublished/);
    expect(actions).not.toMatch(/\.delete\(\)/);
  });

  it("porte sa garde dans l'écriture", () => {
    const region = actions.slice(
      actions.indexOf("export async function setPostPublished"),
    );

    expect(region).toMatch(/\.is\("published_at", null\)/);
    expect(region).toMatch(/\.not\("published_at", "is", null\)/);
  });

  it("est journalisé à chaque fois", () => {
    // AC 5.
    for (const action of [
      "news.created",
      "news.updated",
      "news.published",
      "news.unpublished",
    ]) {
      expect(actions).toMatch(new RegExp(action.replace(".", "\\.")));
    }
  });

  it("vérifie le rôle avant d'écrire", () => {
    for (const name of ["savePost", "setPostPublished"]) {
      const region = actions.slice(
        actions.indexOf(`export async function ${name}`),
      );

      expect(region.indexOf("requireAdmin()")).toBeLessThan(
        region.indexOf("logAdminAction"),
      );
    }
  });
});

describe("le rendu du fil", () => {
  it("conserve les retours à la ligne sans interpréter de balisage", () => {
    // Le texte est rendu comme du texte : une apostrophe ou un « < » dans un
    // message ne peut devenir autre chose.
    expect(feed).toMatch(/whitespace-pre-line/);
    expect(feed).not.toMatch(/dangerouslySetInnerHTML/);
  });

  it("dit qu'il est vide plutôt que d'afficher une page blanche", () => {
    // AC 6.
    expect(feed).toMatch(/Rien pour l’instant/);
    expect(admin).toMatch(/Aucun message/);
  });

  it("et la section du back-office n'est plus annoncée comme à venir", () => {
    const region = sections.slice(sections.indexOf('slug: "actualites"'));

    expect(region.slice(0, 300)).toMatch(/status: "available"/);
  });
});
