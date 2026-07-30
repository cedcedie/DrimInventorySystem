import { FlatCompat } from "@eslint/eslintrc";

const compat = new FlatCompat({
  baseDirectory: import.meta.dirname,
});

const eslintConfig = [
  {
    // Without this, ESLint walks dependencies and build output and reports
    // thousands of problems in code this project doesn't own.
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
      "src/generated/**",
      // The original design prototype, kept as reference. Not application
      // code and not maintained against this project's lint rules.
      "design_handoff_drim_inventory/**",
    ],
  },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
];

export default eslintConfig;
