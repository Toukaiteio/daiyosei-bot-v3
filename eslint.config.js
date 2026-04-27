import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['dist/**', 'dist-web/**', 'node_modules/**', 'reference/**'],
  },
  ...tseslint.configs.recommended,
);
