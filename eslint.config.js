import js from '@eslint/js';
import ts from 'typescript-eslint';
import stylistic from '@stylistic/eslint-plugin';
import importPlugin from 'eslint-plugin-import';
import importNewlinesPlugin from 'eslint-plugin-import-newlines';
import reactPlugin from 'eslint-plugin-react';
import reactHooksPlugin from 'eslint-plugin-react-hooks';
import globals from 'globals';

const tsconfigPaths = [
    './tsconfig.json',
    './tsconfig.base.json',
    './core/tsconfig.json',
    './client/tsconfig.json',
    './api/tsconfig.json',
    './dal/tsconfig.json'
];

const typescriptRuleConfig = {
    files: ['**/*.ts', '**/*.tsx'],
    plugins: {
        stylistic,
        'import-newlines': importNewlinesPlugin
    },
    extends: [
        js.configs.recommended,
        ...ts.configs.strictTypeChecked,
        ...ts.configs.stylisticTypeChecked,
        importPlugin.flatConfigs.recommended,
        stylistic.configs.customize({
            quotes: 'single',
            semi: true,
            indent: 4,
            jsx: true
        })
    ],
    languageOptions: {
        parserOptions: {
            project: tsconfigPaths,
            tsconfigRootDir: import.meta.dirname
        },
        globals: {
            ...globals.browser,
            ...globals.node,
            ...globals.es2021
        }
    },
    settings: {
        'import/resolver': {
            typescript: {
                project: tsconfigPaths,
                alwaysTryTypes: true,
                noWarnOnMultipleProjects: true
            },
            node: {
                extensions: ['.js', '.jsx', '.ts', '.tsx', '.json']
            }
        },
        'import/parsers': {
            '@typescript-eslint/parser': ['.ts', '.tsx']
        },
        'import/external-module-folders': ['node_modules', 'node_modules/@types']
    },
    rules: {
        eqeqeq: 'error',
        'import/order': ['error', {
            alphabetize: {
                order: 'asc',
                orderImportKind: 'asc',
                caseInsensitive: false
            },
            named: {
                enabled: true,
                types: 'types-last'
            },
            pathGroups: [
                {
                    pattern: '@netminder/**',
                    group: 'internal',
                    position: 'before'
                },
                {
                    pattern: '#*/**',
                    group: 'internal',
                    position: 'before'
                },
                {
                    pattern: '**/*.html',
                    group: 'unknown'
                }
            ],
            pathGroupsExcludedImportTypes: ['builtin'],
            groups: [
                ['builtin', 'external'],
                'internal',
                'parent',
                'sibling',
                'index',
                'unknown'
            ],
            'newlines-between': 'always'
        }],
        'import-newlines/enforce': ['error', {
            items: 1,
            semi: true
        }],
        '@typescript-eslint/no-unused-vars': ['error', { args: 'none' }],
        '@typescript-eslint/no-empty-function': ['error', { allow: ['private-constructors'] }],
        '@typescript-eslint/array-type': 'error',
        '@typescript-eslint/consistent-type-imports': 'error',
        '@typescript-eslint/no-inferrable-types': ['error', { ignoreProperties: true }],
        '@typescript-eslint/restrict-template-expressions': 'off',
        '@stylistic/indent': ['error', 4, {
            ImportDeclaration: 1
        }],
        '@stylistic/key-spacing': 'off',
        '@stylistic/comma-dangle': ['error', 'never'],
        '@stylistic/no-multi-spaces': 'off',
        '@stylistic/brace-style': ['error', '1tbs', { allowSingleLine: true }],
        '@stylistic/max-statements-per-line': ['error', { max: 2 }],
        '@stylistic/operator-linebreak': ['error', 'before'],
        '@stylistic/padding-line-between-statements': 'error',
        '@stylistic/implicit-arrow-linebreak': ['error', 'beside'],
        '@stylistic/no-extra-semi': 'error',
        '@stylistic/nonblock-statement-body-position': ['error', 'below'],
        '@stylistic/object-curly-newline': ['error', { multiline: true }],
        '@stylistic/switch-colon-spacing': 'error',
        '@stylistic/eol-last': ['error', 'never'],
        '@stylistic/jsx-quotes': ['error', 'prefer-single'],
        '@stylistic/multiline-ternary': 'off',
        'import/no-unresolved': ['error'],
        'import/no-named-as-default': 'off',
        'import/no-named-as-default-member': 'off',
        'import/default': 'off'
    }
};

const reactRuleConfig = {
    files: ['**/*.tsx', '**/*.jsx'],
    plugins: {
        react: reactPlugin,
        'react-hooks': reactHooksPlugin
    },
    settings: {
        ...{
            'import/resolver': {
                typescript: {
                    project: tsconfigPaths,
                    alwaysTryTypes: true,
                    noWarnOnMultipleProjects: true
                },
                node: {
                    extensions: ['.js', '.jsx', '.ts', '.tsx', '.json']
                }
            },
            'import/parsers': {
                '@typescript-eslint/parser': ['.ts', '.tsx']
            },
            'import/external-module-folders': ['node_modules', 'node_modules/@types']
        },
        react: {
            version: 'detect'
        }
    },
    rules: {
        'react/jsx-uses-react': 'error',
        'react/jsx-uses-vars': 'error',
        'react/prop-types': 'off',
        'react/react-in-jsx-scope': 'off',
        'react-hooks/rules-of-hooks': 'error',
        'react-hooks/exhaustive-deps': 'warn'
    }
};

const ignores = {
    ignores: [
        '**/node_modules/',
        '**/*.js',
        'bun.lockb'
    ]
};

export default ts.config(
    typescriptRuleConfig,
    reactRuleConfig,
    ignores
);
