// =====================================================================
// VIP DA NICOLLY - js/cupons.js (Validação de Cupons de Desconto)
// =====================================================================
import { supabase } from './config.js';

export const SupabaseCupons = {
    async validarEAplicarCupom(codigoCupom, valorOriginal) {
        if (!codigoCupom) {
            alert("Digite um código de cupom válido.");
            return { valorFinal: valorOriginal, desconto: 0 };
        }

        try {
            const { data: cupom, error } = await supabase
                .from('cupons_vip')
                .select('*')
                .eq('codigo', codigoCupom.trim().toUpperCase())
                .eq('ativo', true)
                .maybeSingle();

            if (error || !cupom) {
                alert("❌ Cupom inválido ou expirado.");
                return { valorFinal: valorOriginal, desconto: 0 };
            }

            let valorFinal = valorOriginal;
            let desconto = 0;

            if (cupom.tipo === 'porcentagem') {
                desconto = (valorOriginal * Number(cupom.valor)) / 100;
                valorFinal = valorOriginal - desconto;
            } else if (cupom.tipo === 'fixo') {
                desconto = Number(cupom.valor);
                valorFinal = Math.max(0, valorOriginal - desconto);
            }

            alert(`✅ Cupom aplicado com sucesso! Desconto de R$ ${desconto.toFixed(2)}`);
            return { valorFinal, desconto };

        } catch (err) {
            console.error("Erro ao validar cupom:", err);
            alert("Erro ao aplicar cupom.");
            return { valorFinal: valorOriginal, desconto: 0 };
        }
    }
};
