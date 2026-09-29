import prettier from '@electron-toolkit/eslint-config-prettier'
import tseslint from '@electron-toolkit/eslint-config-ts'

export default [{ ignores: ['dist/**', 'drizzle/**'] }, ...tseslint.configs.recommended, prettier]
