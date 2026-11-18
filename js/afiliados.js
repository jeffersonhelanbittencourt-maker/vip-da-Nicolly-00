// =====================================================================
// VIP DA NICOLLY - js/afiliados.js (Sistema de Afiliados Completo)
// =====================================================================
import { supabase } from './config.js';

export const SupabaseAfiliados = {
    // 1. Captura o código de indicação da URL (?ref=CODIGO) ao carregar a página
    verificarIndicaçãoURL() {
        const urlParams = new URLSearchParams(window.location.search);
        const ref = urlParams.get('ref');
        if (ref) {
            localStorage.setItem('vip_afiliado_ref', ref.trim().toUpperCase());
        }
    },

    // 2. Renderiza o painel de indicação e link exclusivo na Área do Cliente
    async renderizarPainelAfiliado(emailUsuario, containerId) {
        const container = document.getElementById(containerId);
        if (!container || !emailUsuario) return;

        try {
            let { data: afiliado } = await supabase
                .from('afiliados_vip')
                .select('*')
                .eq('email', emailUsuario.toLowerCase())
                .maybeSingle();

            if (!afiliado) {
                const codigoGerado = emailUsuario.split('@')[0].toUpperCase() + Math.floor(Math.random() * 1000);
                const { data: novoAfiliado, error } = await supabase
                    .from('afiliados_vip')
                    .insert([{ email: emailUsuario.toLowerCase(), codigo_afiliado: codigoGerado, comissao_percentual: 20 }])
                    .select()
                    .single();

                if (error) throw error;
                afiliado = novoAfiliado;
            }

            const linkPersonalizado = `${window.location.origin}${window.location.pathname}?ref=${afiliado.codigo_afiliado}`;

            container.innerHTML = `
                <div style="background: #111827; border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; padding: 20px; margin-top: 20px;">
                    <h3 style="color: #ec4899; font-size: 1.1rem; margin-bottom: 8px;">🤝 Programa de Afiliados VIP</h3>
                    <p style="color: #9ca3af; font-size: 0.85rem; margin-bottom: 15px;">Compartilhe seu link exclusivo e indique novos membros para o VIP da Nicolly!</p>
                    
                    <div style="display: flex; gap: 8px; margin-bottom: 12px;">
                        <input type="text" readonly value="${linkPersonalizado}" id="input-link-afiliado" style="background: #1f2937; border: 1px solid rgba(255,255,255,0.2); color: #fff; padding: 10px; border-radius: 6px; font-size: 0.85rem; flex: 1;">
                        <button type="button" id="btn-copiar-link" style="background: #ec4899; color: #fff; border: none; padding: 10px 16px; border-radius: 6px; cursor: pointer; font-weight: 600; font-size: 0.85rem;">Copiar Link</button>
                    </div>
                    
                    <div style="display: flex; justify-content: space-between; font-size: 0.85rem; color: #d1d5db; background: #1f2937; padding: 10px 14px; border-radius: 6px;">
                        <span>Seu Código: <strong style="color: #fff;">${afiliado.codigo_afiliado}</strong></span>
                        <span>Comissões Acumuladas: <strong style="color: #10b981;">R$ ${Number(afiliado.ganhos_totais || 0).toFixed(2)}</strong></span>
                    </div>
                </div>
            `;

            // Ação de copiar o link para a área de transferência
            const btnCopiar = document.getElementById("btn-copiar-link");
            if (btnCopiar) {
                btnCopiar.addEventListener("click", () => {
                    const input = document.getElementById("input-link-afiliado");
                    input.select();
                    navigator.clipboard.writeText(input.value);
                    alert("✅ Link de afiliado copiado com sucesso!");
                });
            }

        } catch (err) {
            console.error("Erro ao carregar painel de afiliado:", err);
        }
    }
};
