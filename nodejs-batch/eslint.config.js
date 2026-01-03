const { FlatCompat } = require('@eslint/eslintrc');
const eslintConfigPrettier = require("eslint-config-prettier/flat");
const neostandard = require('neostandard');

const pluginPromise = require('eslint-plugin-promise');
const pluginSecurity = require('eslint-plugin-security');
const importPlugin = require('eslint-plugin-import');
const js = require('@eslint/js');

const compat = new FlatCompat();
module.exports = [
  ...neostandard(),
  pluginPromise.configs['flat/recommended'],
  js.configs.recommended,
  pluginSecurity.configs.recommended,
  importPlugin.flatConfigs.recommended,
  eslintConfigPrettier,
  {
    files: ['**/*.{js,mjs,cjs}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'commonjs',
    },
    rules: {
      semi: ['error', 'always'], // セミコロンを常につける
      'require-await': 'warn', // await 抜けチェック
      'no-constant-condition': [
        'warn',
        {
          checkLoops: false,
        },
      ],
    },
  },
];
