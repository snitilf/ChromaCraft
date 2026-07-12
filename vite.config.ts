import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // only the frontend build lives here. secrets never go in client env: the AI
  // provider key stays server-side in the api/ function, read from XAI_API_KEY.
});
