const express = require('express');
const cors = require('cors');
const path = require('path');
const CONFIG = require('./server/config');
const apiRoutes = require('./server/routes');

const app = express();

app.use(cors());
app.use(express.json());

// Servir arquivos estáticos do front-end nas pastas organizadas
app.use(express.static(path.join(__dirname)));
app.use('/css', express.static(path.join(__dirname, 'css')));
app.use('/js', express.static(path.join(__dirname, 'js')));

// Montar rotas da API sob o prefixo /api ou diretamente conforme o front chama
app.use('/api', apiRoutes);
// Caso seu front chame as rotas diretamente sem o prefixo /api:
app.use('/', apiRoutes);

// Rota coringa para SPA (Single Page Application)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(CONFIG.PORT, () => {
  console.log(`[VIP] Servidor rodando na porta ${CONFIG.PORT} com arquitetura modular.`);
});
