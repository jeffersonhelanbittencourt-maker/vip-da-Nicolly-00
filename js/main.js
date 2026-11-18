// Função para validar o cupom de desconto direto no banco Supabase
async function aplicarCupomDesconto(codigoCupom, valorOriginal, elementoPrecoId) {
    if (!codigoCupom) return alert("Digite um código de cupom.");

    try {
        // Chama a função RPC 'validar_cupom_vip' armazenada no Supabase
        const { data, error } = await supabase.rpc('validar_cupom_vip', {
            p_codigo: codigoCupom,
            p_valor_original: valorOriginal
        });

        if (error) throw error;

        if (data && data.valido) {
            alert(`✅ Cupom aplicado com sucesso! Desconto de ${data.desconto_percentual}%.`);
            
            // Atualiza o preço exibido na tela para o cliente
            const elementoPreco = document.getElementById(elementoPrecoId);
            if (elementoPreco) {
                elementoPreco.innerHTML = `
                    <span style="text-decoration: line-through; color: #9ca3af; font-size: 1rem;">R$ ${valorOriginal.toFixed(2)}</span>
                    <span style="color: #10b981; margin-left: 8px;">R$ ${data.valor_final.toFixed(2)}</span>
                `;
            }
            return data.valor_final;
        } else {
            alert(`❌ ${data.mensagem || 'Cupom inválido ou expirado.'}`);
            return valorOriginal;
        }
    } catch (err) {
        console.error("Erro ao validar cupom:", err);
        alert("Erro ao validar o cupom no servidor.");
        return valorOriginal;
    }
}
