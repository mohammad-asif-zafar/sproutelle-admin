import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  // During production build in CI environment, ensure required secrets are present
  if (command === 'build' && mode === 'production') {
    const supabaseUrl = env.VITE_SUPABASE_URL || process.env.VITE_SUPABASE_URL
    const supabaseKey = env.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY

    if (process.env.CI && (!supabaseUrl || !supabaseKey)) {
      throw new Error(
        '[Build Error] Required GitHub secrets (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY) are missing in repository settings.\n' +
        'Please configure these secrets in GitHub Settings -> Secrets and variables -> Actions before deploying.'
      )
    }
  }

  const basePath = env.VITE_BASE_PATH || process.env.VITE_BASE_PATH || (mode === 'production' ? '/sproutelle-admin/' : '/')

  return {
    plugins: [react()],
    base: basePath,
  }
})
