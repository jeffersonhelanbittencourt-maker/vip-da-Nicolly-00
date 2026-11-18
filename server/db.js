const { createClient } = require('@supabase/supabase-js');
const CONFIG = require('./config');

if (!CONFIG.SUPABASE_URL || !CONFIG.SUPABASE_SERVICE_ROLE_KEY) {
  console.warn('[AVISO] Credenciais de Service Role do Supabase ausentes no backend.');
}

const supabaseAdmin = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
});

module.exports = { supabaseAdmin };
