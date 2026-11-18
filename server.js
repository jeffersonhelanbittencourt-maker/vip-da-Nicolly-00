const express = require('express');
const { MercadoPagoConfig } = require('mercadopago');

const app = express();
app.use(express.json());

// Credenciais oficiais
const SUPABASE_URL = 'https://wodlhlwezckslounvmlx.supabase.co';
const SUPABASE_KEY = 'sb_publishable_gTnYby203YRRUb0DeNqcKg_Nqe0M9Yr';
const MERCADO_PAGO_TOKEN = 'APP_USR-4480456642803254-111801-be3d1e41d0eb72ba4a94bcd81ee19496-16180848';

console.log("Iniciando servidor Express leve para o VIP da Nicolly...");

// Inicialização do Mercado Pago
const client = new MercadoPagoConfig({ accessToken: MERCADO_PAGO_TOKEN });

const PORT = process.env.PORT || 10000;

// Rota principal para verificar se está tudo online
app.get('/', (req, res) => {
  res.json({
    status: 'online',
    app: 'VIP da Nicolly',
    serverRunning: true,
    mercadoPagoConfigured: true
  });
});

// Exemplo de rota para buscar dados do Supabase usando HTTP nativo (sem bugs de WebSocket)
app.get('/api/dados', async (req, res) => {
  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/usuarios?select=*`, {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`
      }
    });
    const data = await response.json();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Servidor rodando perfeitamente na porta ${PORT}`);
});
