module.exports = [
  {
    files: ["**/*.js"],
    ignores: ["**/node_modules/**", "**/__pycache__/**"],
    languageOptions: {
      ecmaVersion: 2021,
      sourceType: "module",
      globals: {
        require: "readonly",
        module: "readonly",
        process: "readonly"
      }
    },
    plugins: {},
    rules: {
      "no-unused-vars": "warn",
      "no-console": "off"
    }
  }
];