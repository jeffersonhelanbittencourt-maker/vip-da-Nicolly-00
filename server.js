const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

// Libera todas as pastas da raiz (css, js, etc.) para o navegador ler
app.use(express.static(path.join(__dirname)));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
