// =====================================================================
// VIP DA NICOLLY - js/config.js (Conexão Oficial com o Supabase)
// =====================================================================

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

// Credenciais oficiais do seu projeto no Supabase
const SUPABASE_URL = 'https://wodlhlwezckslounvmlx.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_gTnYby203YRRUb0DeNqcKg_Nqe0M9Yr';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// E-mail do Administrador Master (Jefferson)
export const ADMIN_EMAIL_MASTER = 'jeffersonhelanbittencourt@gmail.com';
