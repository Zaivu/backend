module.exports = {
    env: {
      browser: true,
      node: true,
      es2021: true,
    },
    extends: 'eslint:recommended', // You can replace this with the style guide you chose
    parserOptions: {
      ecmaVersion: 12,
      sourceType: 'module',
    },
    rules: {
      // Add your custom rules here
      'no-unused-vars': 'error',
    },
  };