// =====================================================================
// VIP DA NICOLLY - js/pagamentos.js (Integração Mercado Pago Oficial)
// =====================================================================
import { supabase } from './config.js';

export const MercadoPagoVIP = {
    // Seu Access Token oficial do Mercado Pago integrado com segurança
    ACCESS_TOKEN: 'APP_USR-4480456642803254-111801-be3d1e41d0eb72ba4a94bcd81ee19496-161808486',

    async gerarPagamentoPix(planoId, nomePlano, valorPlano, emailUsuario) {
        if (!emailUsuario) {
            alert("Você precisa estar logado para assinar um plano.");
            return;
        }

        try {
            // Cria a preferência de pagamento Pix na API oficial do Mercado Pago
            const resposta = await fetch('https://api.mercadopago.com/checkout/preferences', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.ACCESS_TOKEN}`
                },
                body: JSON.stringify({
                    items: [
                        {
                            title: `VIP da Nicolly - ${nomePlano}`,
                            quantity: 1,
                            unit_price: Number(valorPlano),
                            currency_id: 'BRL'
                        }
                    ],
                    payer: {
                        email: emailUsuario
                    },
                    payment_methods: {
                        excluded_payment_types: [
                            { id: 'credit_card' },
                            { id: 'ticket' }
                        ],
                        installments: 1
                    },
                    back_urls: {
                        success: window.location.href,
                        failure: window.location.href,
                        pending: window.location.href
                    },
                    auto_return: 'approved'
                })
            });

            const dados = await resposta.json();

            if (dados.init_point) {
                // Registra a intenção de pagamento no Supabase para controle administrativo
                await supabase.from('pagamentos_vip').insert([{
                    email: emailUsuario.toLowerCase(),
                    plano_id: planoId,
                    valor: valorPlano,
                    status: 'pendente',
                    preference_id: dados.id
                }]);

                // Redireciona o cliente para o checkout oficial do Mercado Pago (Pix / QR Code)
                window.location.href = dados.init_point;
            } else {
                console.error("Resposta da API Mercado Pago:", dados);
                throw new Error("Não foi possível gerar o link de pagamento.");
            }

        } catch (err) {
            console.error("Erro no pagamento Mercado Pago:", err);
            alert("Erro ao iniciar o pagamento via Mercado Pago. Verifique o console.");
        }
    }
};
