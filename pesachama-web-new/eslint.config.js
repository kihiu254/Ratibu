import js from '@eslint/js'
import jsxA11y from 'eslint-plugin-jsx-a11y'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      jsxA11y.flatConfigs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      'jsx-a11y/alt-text': 'error',
      'jsx-a11y/control-has-associated-label': ['error', {
        ignoreElements: ['audio', 'canvas', 'embed', 'input', 'td', 'textarea', 'tr', 'video'],
        ignoreRoles: ['presentation', 'none'],
        includeRoles: ['button', 'link', 'menuitem', 'option', 'radio', 'searchbox', 'switch', 'textbox'],
      }],
      'jsx-a11y/label-has-associated-control': ['error', {
        assert: 'either',
        depth: 3,
      }],
      'no-restricted-syntax': [
        'error',
        {
          selector: "JSXAttribute[name.name='style']",
          message: 'Inline styles are not allowed. Move styles to CSS, Tailwind classes, SVG attributes, or component variants.',
        },
      ],
    },
  },
])
