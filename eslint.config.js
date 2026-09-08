import js from '@eslint/js';
import ts from 'typescript-eslint';
import hooks from 'eslint-plugin-react-hooks';
export default ts.config(
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'supabase/functions/**',
      'public/**',
      '*.cjs',
    ],
  },
  js.configs.recommended,
  ...ts.configs.recommended,
  {
    files: ['**/*.{js,ts,tsx}'],
    languageOptions: {
      globals: {
        queueMicrotask: 'readonly',
        matchMedia: 'readonly',
        Buffer: 'readonly',
        window: 'readonly',
        document: 'readonly',
        navigator: 'readonly',
        location: 'readonly',
        localStorage: 'readonly',
        console: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        Notification: 'readonly',
        crypto: 'readonly',
        fetch: 'readonly',
        atob: 'readonly',
        URL: 'readonly',
        Blob: 'readonly',
        FileReader: 'readonly',
        CustomEvent: 'readonly',
        AbortSignal: 'readonly',
        process: 'readonly',
        confirm: 'readonly',
        alert: 'readonly',
        __dirname: 'readonly',
      },
    },
    plugins: { 'react-hooks': hooks },
    rules: {
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-explicit-any': 'off',
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
);
