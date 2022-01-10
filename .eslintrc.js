const defaultConfig = {
  env: {
    commonjs: true,
    es2021: true,
    node: true,
  },
  extends: ['airbnb-base'],
  parserOptions: {
    ecmaVersion: 13,
    sourceType: 'module',
  },
  rules: {},
};

const tsOverrides = {
  files: ['**/*.ts'],
  extends: [...(defaultConfig.extends || []), 'airbnb-typescript/base'],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ...(defaultConfig || {}),
    project: './tsconfig.json',
  },
  plugins: [...(defaultConfig.plugins || []), '@typescript-eslint'],
  rules: defaultConfig.rules || {},
};

module.exports = {
  ...defaultConfig,
  overrides: [tsOverrides],
};
