const express = require('express');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const { MercadoPagoConfig } = require('mercadopago');

const app = express();
app.use(express.json());

// Configura o Express para servir todos os arquivos estáticos (HTML, CSS, JS) da raiz do projeto
app.use(express.static(path.join(__dirname)));

// Credenciais oficiais
const SUPABASE_URL = 'https://wodlhlwezckslounvmlx.supabase.co';
const SUPABASE_KEY = 'sb_publishable_gTnYby203YRRUb0DeNqcKg_Nqe0M9Yr';
const MERCADO_PAGO_TOKEN = 'APP_USR-4480456642803254-111801-be3d1e41d0eb72ba4a94bcd81ee19496-16180848';

console.log("Iniciando servidor para o VIP da Nicolly...");

// Inicialização do Mercado Pago
const client = new MercadoPagoConfig({ accessToken: MERCADO_PAGO_TOKEN });

const PORT = process.env.PORT || 10000;

// Rota de status/healthcheck do servidor
app.get('/health', (req, res) => {
  res.json({ status: 'online', app: 'VIP da Nicolly' });
});

// Rotas de API do seu sistema (exemplo de verificação de status)
app.get('/verificar-status', async (req, res) => {
  const email = req.query.email;
  // Aqui você pode consultar o Supabase via fetch nativo se precisar
  res.json({ success: true, data: { email: email, status: 'pendente', plano: '' } });
});

// Qualquer outra rota exibe o seu arquivo index.html principal do site
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Servidor rodando perfeitamente na porta ${PORT}`);
});
