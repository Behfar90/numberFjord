const config = {
  extends: ["@commitlint/config-conventional"],
  rules: {
    // Scope is optional (e.g. `ci: ...`), but if present it must be one of these.
    "scope-enum": [
      2,
      "always",
      ["ssb", "agent", "ui", "charts", "db", "rag", "evals", "cache"],
    ],
  },
};

export default config;
