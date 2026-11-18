// =====================================================================
// VIP DA NICOLLY - js/realtime.js (Sincronização em Tempo Real)
// =====================================================================
import { supabase } from './config.js';

export const SupabaseRealtime = {
    iniciar(callbackPlanos, callbackPagamentos) {
        supabase
            .channel('tabelas-publicas-vip-live')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'planos_vip' }, () => {
                if (typeof callbackPlanos === 'function') callbackPlanos();
            })
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'pagamentos_vip' }, (payload) => {
                if (typeof callbackPagamentos === 'function') callbackPagamentos(payload.new);
            })
            .subscribe();
    }
};
