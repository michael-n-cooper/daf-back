import globals from "globals";
import {eslint, pluginJs} from "@eslint/js";
import tseslint from 'typescript-eslint';

export default tseslint.config({
  extends: [
    eslint.configs.recommended,
    ...tseslint.configs.recommended,
  ],
  languageOptions: {
    globals: globals.browser
  },
  plugins: pluginJs.configs.recommended,
  rules: {
    "typescript-eslint/no-floating-promises": "warn",

  }
});

