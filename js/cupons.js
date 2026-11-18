// =====================================================================
// VIP DA NICOLLY - js/cupons.js (Gerenciamento de Cupons de Desconto)
// =====================================================================
import { supabase } from './config.js';

export const SupabaseCupons = {
    async validarEAplicarCupom(codigoCupom, valorOriginal) {
        if (!codigoCupom || !codigoCupom.trim()) {
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
                alert("Cupom inválido ou expirado.");
                return { valorFinal: valorOriginal, desconto: 0 };
            }

            // Verifica se o cupom já atingiu o limite de usos (se houver)
            if (cupom.limite_usos && cupom.usos_atuais >= cupom.limite_usos) {
                alert("Este cupom já atingiu o limite máximo de utilizações.");
                return { valorFinal: valorOriginal, desconto: 0 };
            }

            let valorFinal = valorOriginal;
            let valorDesconto = 0;

            if (cupom.tipo === 'porcentagem') {
                valorDesconto = (valorOriginal * cupom.valor) / 100;
                valorFinal = valorOriginal - valorDesconto;
            } else if (cupom.tipo === 'fixo') {
                valorDesconto = Number(cupom.valor);
                valorFinal = Math.max(0, valorOriginal - valorDesconto);
            }

            alert(`✅ Cupom aplicado com sucesso! Desconto de R$ ${valorDesconto.toFixed(2)}`);
            return { valorFinal, desconto: valorDesconto, idCupom: cupom.id };

        } catch (err) {
            console.error("Erro ao validar cupom:", err);
            return { valorFinal: valorOriginal, desconto: 0 };
        }
    }
};
