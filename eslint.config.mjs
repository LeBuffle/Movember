import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";
import eslintConfigPrettier from "eslint-config-prettier";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  // Disables ESLint rules that conflict with Prettier. Must stay last.
  eslintConfigPrettier,
  {
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
