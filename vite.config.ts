import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Replace 'repository-name' with the name of your repo on GitHub
  base: 'RealmWix', 
});
