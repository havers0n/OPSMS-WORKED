import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const tsFiles = ['apps/web/src/**/*.{ts,tsx}'];

function restrictedPatterns(groups) {
  return [
    'error',
    {
      patterns: groups.map((group) => ({
        group: Array.isArray(group) ? group : [group],
        message: 'Import violates the frontend layer boundary.'
      }))
    }
  ];
}

export default tseslint.config(
  {
    ignores: ['**/dist/**', '**/node_modules/**', '**/coverage/**', '**/test-results/**', '**/.turbo/**', 'prototypes/**']
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: tsFiles,
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node
      }
    }
  },
  {
    files: ['apps/web/src/shared/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': restrictedPatterns(['@/app/*', '@/pages/*', '@/widgets/*', '@/features/*', '@/entities/*'])
    }
  },
  {
    files: ['apps/web/src/entities/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': restrictedPatterns(['@/app/*', '@/pages/*', '@/widgets/*', '@/features/*', '@/entities/*'])
    }
  },
  {
    files: ['apps/web/src/features/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': restrictedPatterns(['@/app/*', '@/pages/*', '@/widgets/*', '@/features/*'])
    }
  },
  {
    files: ['apps/web/src/widgets/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': restrictedPatterns(['@/app/*', '@/pages/*', '@/widgets/*'])
    }
  },
  {
    files: ['apps/web/src/pages/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': restrictedPatterns(['@/app/*', '@/pages/*'])
    }
  },
  {
    files: ['apps/web/src/**/*.{ts,tsx}'],
    ignores: ['apps/web/src/shared/api/**/*.{ts,tsx}', 'apps/web/src/app/providers/auth-provider.tsx', 'apps/web/src/**/api/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/shared/api/supabase/client', '@/shared/api/supabase/auth'],
              message: 'Direct Supabase auth/client access is restricted to shared api infrastructure and auth bootstrap.'
            },
            {
              group: ['@/shared/api/supabase/types'],
              message: 'Generated Supabase types must stay inside api boundaries.'
            }
          ]
        }
      ]
    }
  },
  {
    files: ['apps/web/src/**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }]
    }
  },
);
