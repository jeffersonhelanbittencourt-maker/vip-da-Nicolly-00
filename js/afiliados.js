// =====================================================================
// VIP DA NICOLLY - js/afiliados.js (Sistema de Afiliados e Indicações)
// =====================================================================
import { supabase } from './config.js';

export const SupabaseAfiliados = {
    // Captura o código de indicação da URL (ex: se o link for ?ref=NICOLLYVIP)
    verificarIndicaçãoURL() {
        const urlParams = new URLSearchParams(window.location.search);
        const ref = urlParams.get('ref');
        if (ref) {
            localStorage.setItem('vip_afiliado_ref', ref.trim().toUpperCase());
        }
    },

    // Gera o link de indicação personalizado para o afiliado logado
    async obterLinkAfiliado(emailAfiliado) {
        if (!emailAfiliado) return;

        try {
            // Verifica se o afiliado já está cadastrado na tabela
            let { data: afiliado } = await supabase
                .from('afiliados_vip')
                .select('*')
                .eq('email', emailAfiliado.toLowerCase())
                .maybeSingle();

            if (!afiliado) {
                // Se não existir, cria um código de afiliado automático baseado no e-mail
                const codigoGerado = emailAfiliado.split('@')[0].toUpperCase() + Math.floor(Math.random() * 1000);
                const { data: novoAfiliado, error } = await supabase
                    .from('afiliados_vip')
                    .insert([{ email: emailAfiliado.toLowerCase(), codigo_afiliado: codigoGerado, comissao_percentual: 20 }])
                    .select()
                    .single();

                if (error) throw error;
                afiliado = novoAfiliado;
            }

            const linkPersonalizado = `${window.location.origin}${window.location.pathname}?ref=${afiliado.codigo_afiliado}`;
            return {
                codigo: afiliado.codigo_afiliado,
                link: linkPersonalizado,
                ganhos: afiliado.ganhos_totais || 0
            };
        } catch (err) {
            console.error("Erro ao gerar link de afiliado:", err);
            return null;
        }
    }
};
