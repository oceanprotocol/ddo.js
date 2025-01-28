module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint', 'import', 'prettier'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:import/errors',
    'plugin:import/warnings',
    'plugin:import/typescript',
    'plugin:prettier/recommended'
  ],
  rules: {
    semi: ['error', 'always'],
    'sort-imports': [
      'error',
      {
        ignoreDeclarationSort: true,
        ignoreCase: false
      }
    ],
    'import/order': [
      'error',
      {
        groups: [
          ['builtin', 'external'],
          'internal',
          ['parent', 'sibling', 'index']
        ],
        'newlines-between': 'always',
        alphabetize: { order: 'asc', caseInsensitive: true }
      }
    ],
    'prettier/prettier': 'error' // Prettier errors show in ESLint
  }
};
