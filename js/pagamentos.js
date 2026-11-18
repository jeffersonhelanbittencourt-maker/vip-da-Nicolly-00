// =====================================================================
// VIP DA NICOLLY - js/pagamentos.js (Integração Pix Mercado Pago)
// =====================================================================
import { supabase } from './config.js';

export const MercadoPagoVIP = {
    async gerenciarPagamentoPix(planoId, nomePlano, valor, emailUsuario) {
        try {
            alert(`Gerando Pix de R$ ${Number(valor).toFixed(2)} para o plano ${nomePlano}...`);

            // 1. Registra a intenção de pagamento no Supabase
            const { data: pagamento, error } = await supabase
                .from('pagamentos_vip')
                .insert([{
                    email: emailUsuario.toLowerCase(),
                    plano_id: planoId,
                    valor: valor,
                    status: 'pendente'
                }])
                .select()
                .single();

            if (error) throw error;

            // 2. Simulação / Integração de pagamento Pix via Mercado Pago
            // Aqui você pode integrar a API do Mercado Pago ou exibir o QR Code gerado
            const codigoPixCopiaECola = `00020126580014br.gov.bcb.pix0136${emailUsuario}5204000053039865802BR5925VIP DA NICOLLY6009CURITIBA62070503***63041D3A`;

            const containerPagamento = document.createElement('div');
            containerPagamento.style.cssText = "position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.8); display:flex; justify-content:center; align-items:center; z-index:2000; padding:20px;";
            containerPagamento.innerHTML = `
                <div style="background:#111827; border:1px solid rgba(255,255,255,0.15); border-radius:14px; padding:25px; width:100%; max-width:400px; text-align:center;">
                    <h3 style="color:#fff; margin-bottom:10px;">Pagamento Pix - ${nomePlano}</h3>
                    <p style="color:#9ca3af; font-size:0.85rem; margin-bottom:15px;">Escaneie o QR Code ou copie a chave Pix abaixo para liberar seu acesso VIP instantaneamente.</p>
                    <div style="background:#fff; padding:15px; border-radius:8px; display:inline-block; margin-bottom:15px;">
                        <img src="https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(codigoPixCopiaECola)}" alt="QR Code Pix" style="display:block;">
                    </div>
                    <textarea readonly style="width:100%; height:60px; background:#1f2937; border:1px solid rgba(255,255,255,0.2); color:#fff; font-size:0.75rem; padding:8px; border-radius:6px; resize:none; margin-bottom:15px;">${codigoPixCopiaECola}</textarea>
                    <button id="btn-fechar-pix" style="background:#ef4444; color:#fff; border:none; padding:10px 20px; border-radius:8px; cursor:pointer; width:100%; font-weight:600;">Fechar / Já Paguei</button>
                </div>
            `;
            document.body.appendChild(containerPagamento);

            document.getElementById("btn-fechar-pix").addEventListener("click", () => {
                containerPagamento.remove();
            });

        } catch (err) {
            console.error("Erro ao gerar pagamento Pix:", err);
            alert("Erro ao iniciar pagamento. Tente novamente.");
        }
    }
};
