import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
    resolve: {
        alias: {
            // lib/exportData only needs Share — avoid pulling the RN runtime into node tests
            'react-native': path.resolve(process.cwd(), 'test/mocks/react-native.ts'),
        },
    },
    test: {
        environment: 'node',
        include: ['lib/**/*.test.ts'],
    },
});
