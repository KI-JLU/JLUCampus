import { defineConfig } from 'eslint/config'
import tseslint from '@electron-toolkit/eslint-config-ts'
import eslintConfigPrettier from '@electron-toolkit/eslint-config-prettier'
import eslintPluginReact from 'eslint-plugin-react'
import eslintPluginReactHooks from 'eslint-plugin-react-hooks'
import eslintPluginReactRefresh from 'eslint-plugin-react-refresh'
import designSystem from '@ki4jlu/design-system/eslint-plugin'

export default defineConfig(
  { ignores: ['**/node_modules', '**/dist', '**/dev-dist'] },
  tseslint.configs.recommended,
  eslintPluginReact.configs.flat.recommended,
  eslintPluginReact.configs.flat['jsx-runtime'],
  {
    settings: {
      react: {
        version: 'detect'
      }
    }
  },
  {
    files: ['**/*.{ts,tsx}'],
    plugins: {
      'react-hooks': eslintPluginReactHooks,
      'react-refresh': eslintPluginReactRefresh
    },
    rules: {
      ...eslintPluginReactHooks.configs.recommended.rules,
      ...eslintPluginReactRefresh.configs.vite.rules
    }
  },
  {
    files: ['**/*.{js,mjs}'],
    rules: {
      '@typescript-eslint/explicit-function-return-type': 'off'
    }
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    plugins: { 'design-system': designSystem },
    rules: {
      'design-system/no-hardcoded-colors': 'error',
      'design-system/no-raw-ui-elements': 'warn',
      'design-system/layout-only-classname': 'warn'
    }
  },
  eslintConfigPrettier
)
