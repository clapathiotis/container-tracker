import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string
const key = import.meta.env.VITE_SUPABASE_KEY as string

export const supabase = createClient(url, key, {
  auth: {
    // GitHub Pages uses the URL hash for client-side routes. PKCE puts the
    // recovery code in the query string instead, so the #/admin route survives.
    flowType: 'pkce',
    detectSessionInUrl: false,
  },
})
