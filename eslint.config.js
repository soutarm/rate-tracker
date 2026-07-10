const js = require("@eslint/js");

module.exports = [
  js.configs.recommended,
  {
    files: ["scripts/**/*.js"],
    languageOptions: {
      ecmaVersion: 2021,
      sourceType: "script",
      globals: {
        document: "readonly",
        console: "readonly",
        setInterval: "readonly",
        window: "readonly"
      }
    },
    rules: {
      "no-console": "off"
    }
  }
];
