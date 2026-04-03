import js from '@eslint/js';

export default [
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'script',
      globals: {
        // Browser globals
        window: 'readonly',
        document: 'readonly',
        location: 'readonly',
        history: 'readonly',
        fetch: 'readonly',
        URL: 'readonly',
        Blob: 'readonly',
        Image: 'readonly',
        MutationObserver: 'readonly',
        IntersectionObserver: 'readonly',
        DOMParser: 'readonly',
        XMLSerializer: 'readonly',
        AbortController: 'readonly',
        TextDecoder: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        CSS: 'readonly',
        atob: 'readonly',
        sessionStorage: 'readonly',
        console: 'readonly',
        navigator: 'readonly',
        requestAnimationFrame: 'readonly',
        MouseEvent: 'readonly',
        prompt: 'readonly',
        module: 'readonly',
        // Chrome extension API
        chrome: 'readonly',
        // Extension globals (set by other content scripts)
        dagre: 'readonly',
      },
    },
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' }],
    },
  },
  {
    files: ['test/**/*.js', 'vitest.config.js'],
    languageOptions: {
      sourceType: 'module',
    },
  },
  {
    files: ['scripts/**/*.js'],
    languageOptions: {
      sourceType: 'module',
      globals: {
        process: 'readonly',
        console: 'readonly',
      },
    },
  },
  {
    ignores: ['lib/**', 'dist/**', 'node_modules/**'],
  },
];
