import path from 'node:path';
import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import type { StorybookConfig } from '@storybook/react-vite';

const storybookDir = path.dirname(fileURLToPath(import.meta.url));

const config: StorybookConfig = {
  stories: ['../src/**/*.stories.@(ts|tsx)'],
  addons: ['@storybook/addon-a11y'],
  framework: {
    name: '@storybook/react-vite',
    options: {}
  },
  async viteFinal(baseConfig) {
    baseConfig.plugins = [...(baseConfig.plugins ?? []), tailwindcss()];
    baseConfig.resolve = {
      ...(baseConfig.resolve ?? {}),
      alias: {
        ...(baseConfig.resolve?.alias ?? {}),
        '@': path.resolve(storybookDir, '../src'),
        '@wos/domain': path.resolve(storybookDir, '../../../packages/domain/src/index.ts')
      }
    };

    return baseConfig;
  }
};

export default config;
