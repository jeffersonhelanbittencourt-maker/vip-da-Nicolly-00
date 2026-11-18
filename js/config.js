// =====================================================================
// VIP DA NICOLLY - js/config.js (Configuração e Conexão Supabase)
// =====================================================================
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

export const SUPABASE_URL = 'https://wodlhlwezckslounvmlx.supabase.co';
export const SUPABASE_ANON_KEY = 'sb_publishable_gTnYby203YRRUb0DeNqcKg_Nqe0M9Yr';
export const ADMIN_EMAIL_MASTER = 'jeffersonhelanbittencourt@gmail.com';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
