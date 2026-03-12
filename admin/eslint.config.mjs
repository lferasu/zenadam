import js from '@eslint/js';

export default [
  {
    ignores: ['.next/**', 'node_modules/**']
  },
  js.configs.recommended,
  {
    files: ['**/*.{js,jsx,mjs}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      parserOptions: {
        ecmaFeatures: {
          jsx: true
        }
      },
      globals: {
        AbortSignal: 'readonly',
        URL: 'readonly',
        document: 'readonly',
        fetch: 'readonly',
        process: 'readonly',
        window: 'readonly'
      }
    },
    rules: {
      'no-unused-vars': 'off'
    }
  }
];
