import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import eslintConfigPrettier from "eslint-config-prettier";

/**
 * Depuis Next 16, `eslint-config-next` est publié directement au format plat :
 * il s'importe, il ne se traduit plus. Le pont `FlatCompat` qui servait à le
 * charger échouait dès la montée de version — et son échec ressemblait à un
 * bug d'ESLint plutôt qu'à une configuration à mettre à jour.
 *
 * `core-web-vitals` embarque déjà `next/typescript` : le lister une seconde
 * fois chargerait les mêmes règles deux fois.
 */

/**
 * En format plat, une règle n'est reconnue que dans un objet qui déclare le
 * greffon qui la porte. On réutilise l'instance déjà chargée par la
 * configuration de Next plutôt que d'ajouter une dépendance de plus : deux
 * copies de `@typescript-eslint` à des versions différentes se comporteraient
 * différemment sur le même fichier.
 */
const typescriptPlugins = nextCoreWebVitals.find(
  (entry) => entry.name === "next/typescript",
)?.plugins;

const eslintConfig = [
  ...nextCoreWebVitals,
  // Disables ESLint rules that conflict with Prettier. Must stay last.
  eslintConfigPrettier,
  {
    name: "defi-movember/typescript",
    files: ["**/*.ts", "**/*.tsx"],
    plugins: typescriptPlugins,
    rules: {
      /*
       * An underscore says "I know, and it is on purpose".
       *
       * React's `useActionState` imposes a `(previousState, formData)`
       * signature; an action that needs neither still has to declare both.
       * Renaming them to `_previous` and `_formData` is the convention, and
       * without this the linter reports a shape it does not get to choose.
       */
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "coverage/**",
      "next-env.d.ts",
      // Compilé par Serwist au build, à partir de src/app/sw.ts.
      "public/sw.js",
      "public/swe-worker-*.js",
      ".bmad-core/**",
      ".claude/**",
    ],
  },
];

export default eslintConfig;
