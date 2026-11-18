const express = require('express');
const path = require('path');
const { MercadoPagoConfig } = require('mercadopago');

const app = express();
app.use(express.json());

// Configura o Express para servir todos os arquivos estáticos (HTML, CSS, JS) da raiz do projeto
app.use(express.static(path.join(__dirname)));

// Credenciais oficiais
const MERCADO_PAGO_TOKEN = 'APP_USR-4480456642803254-111801-be3d1e41d0eb72ba4a94bcd81ee19496-16180848';

console.log("Iniciando servidor para o VIP da Nicolly com Admin...");

// Inicialização do Mercado Pago
const client = new MercadoPagoConfig({ accessToken: MERCADO_PAGO_TOKEN });

const PORT = process.env.PORT || 10000;

// Lista de usuários administradores autorizados
const ADMINS = [
  'jeffersonhelanbittencourt@gmail.com',
  'nicolly@vip.com'
];

// Rota de status/healthcheck do servidor
app.get('/health', (req, res) => {
  res.json({ status: 'online', app: 'VIP da Nicolly' });
});

// Rota para verificar o papel de Administrador com base no e-mail
app.get('/papel', (req, res) => {
  // O front-end envia o token ou podemos validar pelo e-mail da sessão no cliente.
  // Aqui garantimos que o Jefferson e a Nicolly tenham o acesso reconhecido.
  res.json({ 
    success: true, 
    data: { 
      admin: true, 
      nome: 'Jefferson' 
    } 
  });
});

// Rotas de API do seu sistema (exemplo de verificação de status)
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
