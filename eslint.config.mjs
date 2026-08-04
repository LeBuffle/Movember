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
