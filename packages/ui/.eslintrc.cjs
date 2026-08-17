module.exports = {
  extends: ['../config-eslint/base.js'],
  env: { browser: true },
  parserOptions: { ecmaFeatures: { jsx: true } },
  rules: {
    'no-console': 'off',
    '@typescript-eslint/no-explicit-any': 'off',
  },
};
