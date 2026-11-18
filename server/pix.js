const { MercadoPagoConfig, Payment } = require('mercadopago');
const CONFIG = require('./config');

const client = new MercadoPagoConfig({ accessToken: CONFIG.MP_ACCESS_TOKEN });
const payment = new Payment(client);

async function criarCobrancaPix(dados) {
  try {
    const body = {
      transaction_amount: Number(dados.valor),
      description: `Assinatura ${dados.plano} - VIP da Nicolly`,
      payment_method_id: 'pix',
      payer: {
        email: dados.email,
        first_name: dados.nome || 'Assinante',
        last_name: 'VIP'
      }
    };

    const resposta = await payment.create({ body });
    const p = resposta.point_of_interaction;
    const qrCodeBase64 = p?.transaction_data?.qr_code_base64 || '';
    const qrCode = p?.transaction_data?.qr_code || '';

    return {
      payment_id: String(resposta.id),
      qr_code: qrCode,
      qr_code_base64: qrCodeBase64,
      status: resposta.status
    };
  } catch (err) {
    console.error('[ERRO MP PIX]:', err?.message || err);
    throw new Error('Falha ao comunicar com a API de pagamentos Pix.');
  }
}

async function consultarStatusPix(paymentId) {
  try {
    const resposta = await payment.get({ id: paymentId });
    return {
      status: resposta.status, // approved, pending, rejected, etc.
      payment_id: String(resposta.id)
    };
  } catch (err) {
    console.error('[ERRO CONSULTA PIX]:', err?.message || err);
    return null;
  }
}

module.exports = { criarCobrancaPix, consultarStatusPix };
