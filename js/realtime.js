// =====================================================================
// VIP DA NICOLLY - js/realtime.js (Supabase Realtime & Presence 100% Free)
// =====================================================================

import { supabase } from './config.js';

export const SupabaseRealtime = {
    iniciar(aoAtualizarPlanos, aoReceberNovoPagamento) {
        // 1. Canal de Presença (Contador de visitantes online)
        const salaOnline = supabase.channel('sala-vip-online', {
            config: { presence: { key: 'visitante-' + Math.random().toString(36).substring(2, 7) } }
        });

        salaOnline
            .on('presence', { event: 'sync' }, () => {
                const estado = salaOnline.presenceState();
                const totalOnline = Object.keys(estado).length;
                const contadorEl = document.getElementById('contador-online-admin');
                if (contadorEl) {
                    contadorEl.textContent = `${totalOnline} pessoa(s) online no site agora`;
                }
            })
            .subscribe(async (status) => {
                if (status === 'SUBSCRIBED') {
                    await salaOnline.track({ online_em: new Date().toISOString() });
                }
            });

        // 2. Escuta alterações nos Planos em tempo real
        supabase
            .channel('mudancas-planos')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'planos_vip' }, () => {
                if (typeof aoAtualizarPlanos === 'function') aoAtualizarPlanos();
            })
            .subscribe();

        // 3. Escuta novos pagamentos aprovados ao vivo (Notifica o Admin na hora)
        supabase
            .channel('novos-pagamentos')
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'pagamentos_vip' }, (payload) => {
                if (payload.new && payload.new.status === 'aprovado') {
                    if (typeof aoReceberNovoPagamento === 'function') {
                        aoReceberNovoPagamento(payload.new);
                    }
                }
            })
            .subscribe();
    },

    async carregarConteudosExclusivos() {
        const { data, error } = await supabase
            .from('conteudos_vip')
            .select('*')
            .eq('ativo', true)
            .order('criado_em', { ascending: false });

        if (error) return [];
        return data || [];
    }
};
