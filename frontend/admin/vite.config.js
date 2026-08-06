import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';
var __filename = fileURLToPath(import.meta.url);
var __dirname = path.dirname(__filename);
// https://vite.dev/config/
export default defineConfig({
    plugins: [react()],
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
            'react-is': path.resolve(__dirname, './node_modules/react-is')
        }
    }
});
