const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares globais para ler JSON
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// LIBERAR AS PASTAS: Diz ao Render onde estão o CSS, os JS e os arquivos estáticos
app.use(express.static(path.join(__dirname)));

// Rota principal: Quando alguém abrir o site, entrega o index.html da raiz
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Conectar com as rotas do servidor se existirem na pasta server/routes.js
try {
  const routes = require('./server/routes.js');
  app.use('/api', routes);
} catch (e) {
  console.log('Servidor rodando com arquivos estáticos e estruturados.');
}

// Iniciar o servidor na porta do Render
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
