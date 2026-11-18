// =====================================================================
// VIP DA NICOLLY - js/config.js (Configuração 100% Supabase)
// =====================================================================

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

// Suas credenciais oficiais do Supabase fornecidas
const SUPABASE_URL = 'https://wodlhlwezckslounvmlx.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_gTnYby203YRRUb0DeNqcKg_Nqe0M9Yr'; // ou a anon key padrão do seu projeto

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
export const ADMIN_EMAIL_MASTER = 'jeffersonhelanbittencourt@gmail.com';
