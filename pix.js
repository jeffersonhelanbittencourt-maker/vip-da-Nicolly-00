/* =============================================================================
 * VIP DA NICOLLY - pix.js (Módulo do Mercado Pago Separado)
 * ========================================================================== */
const express = require('express');
const router = express.Router();
const { MercadoPagoConfig, Payment } = require('mercadopago');

// Credencial oficial do Mercado Pago do projeto
const MERCADO_PAGO_TOKEN = 'APP_USR-4480456642803254-111801-be3d1e41d0eb72ba4a94bcd81ee19496-16180848';
const client = new MercadoPagoConfig({ accessToken: MERCADO_PAGO_TOKEN });

const PRECOS = { semanal: 25, mensal: 50, vitalicio: 200 };

// Rota para criar o pagamento Pix
router.post('/criar-pagamento', async (req, res) => {
  try {
    const { plano } = req.body;
    const valor = PRECOS[plano] || 25;
    const descricao = `Plano ${plano} - VIP da Nicolly`;

    const payment = new Payment(client);
    const body = {
      transaction_amount: Number(valor),
      description: descricao,
      payment_method_id: 'pix',
      payer: {
        email: 'cliente@vipnicolly.com'
      }
    };

    const response = await payment.create({ body });
    
    const pointOfInteraction = response.point_of_interaction;
    const qrCode = pointOfInteraction?.transaction_data?.qr_code;
    const qrCodeBase64 = pointOfInteraction?.transaction_data?.qr_code_base64;

    if (!qrCode) {
      return res.status(500).json({ success: false, message: 'Não foi possível gerar o QR Code do Pix.' });
    }

    res.json({
      success: true,
      data: {
        id: response.id,
        qr_code: qrCode,
        qr_code_base64: qrCodeBase64,
        status: response.status
      }
    });
  } catch (err) {
    console.error('[PIX] Erro ao criar pagamento no Mercado Pago:', err);
    res.status(500).json({ success: false, message: 'Erro ao gerar Pix no Mercado Pago.' });
  }
});

module.exports = router;
