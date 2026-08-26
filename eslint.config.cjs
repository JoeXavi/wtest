module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint'],
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended', 'prettier'],
  env: { node: true, es2022: true, jest: true },
  ignorePatterns: ['dist', 'coverage', 'node_modules'],
  overrides: [
    {
      files: ['apps/api/src/domain/**/*.ts'],
      rules: {
        'no-restricted-imports': [
          'error',
          {
            patterns: [
              {
                group: ['@nestjs/*', '@aws-sdk/*', '../infrastructure/*', '../../infrastructure/*'],
                message: 'Domain must not import Nest, AWS, or infrastructure',
              },
            ],
          },
        ],
      },
    },
    {
      files: ['apps/api/src/application/**/*.ts'],
      rules: {
        'no-restricted-imports': [
          'error',
          {
            patterns: [
              {
                group: ['@aws-sdk/*', '../infrastructure/*', '../../infrastructure/*'],
                message: 'Application must not import infrastructure adapters',
              },
            ],
          },
        ],
      },
    },
  ],
};
