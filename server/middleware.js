// server/middleware.js - Camada de Segurança e Rate Limiting para a API

const tentativasIP = new Map();

// Limite de requisições por IP (Proteção contra Brute Force em rotas sensíveis)
function rateLimit(limiteMs = 60000, maxTentativas = 30) {
  return function (req, res, next) {
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'ip_desconhecido';
    const agora = Date.now();
    
    if (!tentativasIP.has(ip)) {
      tentativasIP.set(ip, { contador: 1, inicio: agora });
      return next();
    }

    const dados = tentativasIP.get(ip);
    if (agora - dados.inicio > limiteMs) {
      dados.contador = 1;
      dados.inicio = agora;
      return next();
    }

    dados.contador += 1;
    if (dados.contador > maxTentativas) {
      return res.status(429).json({
        success: false,
        code: 'MUITAS_REQUISICOES',
        message: 'Muitas requisições originadas deste endereço. Aguarde um momento.'
      });
    }

    next();
  };
}

// Headers de segurança HTTP recomendados para produção no Render
function headersSeguranca(req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  next();
}

module.exports = { rateLimit, headersSeguranca };
