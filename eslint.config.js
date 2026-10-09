// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
    expoConfig,
    {
        // The React Compiler ruleset is stricter than this codebase needs (no
        // compiler in use yet) — keep the signals visible without failing lint.
        rules: {
            'react-hooks/immutability': 'warn',
            'react-hooks/set-state-in-effect': 'warn',
        },
    },
    {
        files: ['supabase/**/*.js'],
        languageOptions: {
            globals: {
                __dirname: 'readonly',
                require: 'readonly',
                module: 'readonly',
                process: 'readonly',
            },
        },
    },
    {
        ignores: ['dist/*'],
    },
]);
