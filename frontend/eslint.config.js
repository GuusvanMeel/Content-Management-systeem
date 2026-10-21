import js from '@eslint/js'
import pluginVue from 'eslint-plugin-vue'
import globals from 'globals'

export default [
  { ignores: ['dist/', 'node_modules/', 'coverage/'] },
  js.configs.recommended,
  ...pluginVue.configs['flat/essential'],
  {
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: { ...globals.browser },
    },
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', ignoreRestSiblings: true }],
      // The prototype uses single-word component names (Icon, Modal, Inspector).
      'vue/multi-word-component-names': 'off',
    },
  },
  {
    // The course editor is still the browser-only prototype and edits nodes in place.
    files: ['src/editor/**'],
    rules: { 'vue/no-mutating-props': 'off' },
  },
  {
    files: ['tests/**', 'vite.config.js', 'eslint.config.js'],
    languageOptions: { globals: { ...globals.node } },
  },
]
