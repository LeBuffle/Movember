import { Input } from "@/components/ui/input";

/**
 * Finding a player by pseudonym (story 13.5).
 *
 * **A plain form, submitted to the server**, rather than a field that filters
 * what is already on screen. That is not a simplification — it is the whole
 * point of the story: filtering the fifty visible rows answers "aucun résultat"
 * for somebody ranked 342nd, who exists.
 *
 * The query lives in the address bar with the category, so a search can be sent
 * to a teammate as a link and the back button works — the same reasoning as the
 * category tabs of story 7.4.
 */
export function LeaderboardSearch({
  category,
  query,
}: {
  category: string;
  query: string;
}) {
  return (
    <form
      action="/jeu/classement"
      method="get"
      className="flex items-end gap-2"
    >
      <input type="hidden" name="categorie" value={category} />

      <div className="flex-1">
        <Input
          name="q"
          type="search"
          label="Chercher un participant"
          hint="Au moins deux lettres. La recherche porte sur tout le classement, pas seulement sur les places affichées."
          defaultValue={query}
          autoComplete="off"
          maxLength={30}
        />
      </div>

      <button
        type="submit"
        className="border-line text-ink min-h-11 shrink-0 rounded-lg border px-4 font-medium"
      >
        Chercher
      </button>
    </form>
  );
}
