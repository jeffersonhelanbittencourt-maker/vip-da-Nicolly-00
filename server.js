const express = require('express');
const path = require('path');
const { MercadoPagoConfig } = require('mercadopago');

// Importa o módulo de administração separado
const admRouter = require('./adm');

const app = express();
app.use(express.json());

// Configura o Express para servir todos os arquivos estáticos da raiz do projeto
app.use(express.static(path.join(__dirname)));

// Credenciais oficiais
const MERCADO_PAGO_TOKEN = 'APP_USR-4480456642803254-111801-be3d1e41d0eb72ba4a94bcd81ee19496-16180848';

console.log("Iniciando servidor principal para o VIP da Nicolly...");

// Inicialização do Mercado Pago
const client = new MercadoPagoConfig({ accessToken: MERCADO_PAGO_TOKEN });

const PORT = process.env.PORT || 10000;

// Rota de status/healthcheck do servidor
app.get('/health', (req, res) => {
  res.json({ status: 'online', app: 'VIP da Nicolly' });
});

// Conecta as rotas do adm.js conversando com o server.js sob o prefixo /api
app.use('/api', admRouter);

// Rota de verificação de status original
app.get('/verificar-status', async (req, res) => {
  const email = req.query.email;
  res.json({ success: true, data: { email: email, status: 'pendente', plano: '' } });
});

// Qualquer outra rota exibe o seu arquivo index.html principal do site
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Servidor rodando perfeitamente na porta ${PORT}`);
});
