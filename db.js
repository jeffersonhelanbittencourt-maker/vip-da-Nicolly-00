/* =============================================================================
 * VIP DA NICOLLY - db.js (Módulo de Banco de Dados / Supabase)
 * ========================================================================== */
const { createClient } = require('@supabase/supabase-js');

// Credenciais oficiais do Supabase
const SUPABASE_URL = 'https://wodlhlwezckslounvmlx.supabase.co';
const SUPABASE_KEY = 'sb_publishable_gTnYby203YRRUb0DeNqcKg_Nqe0M9Yr';

// Inicialização segura do cliente Supabase para o servidor
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
});

console.log("Banco de dados (Supabase) conectado com sucesso pelo db.js.");

module.exports = { supabase };
