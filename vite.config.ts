import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/RealmWix/', // ← must match your GitHub repo name exactly
})
