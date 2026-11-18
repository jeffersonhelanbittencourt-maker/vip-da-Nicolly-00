# VIP da Nicolly | Plataforma Exclusiva de Assinaturas

Plataforma corporativa de alto desempenho para gestão de membros VIP, integração automatizada de pagamentos via Pix (Mercado Pago), autenticação segura (Supabase) e painel administrativo em tempo real.

---

## 🏗️ Arquitetura Modular do Projeto

O repositório é rigorosamente estruturado para garantir máxima manutenibilidade e segurança:

* **`/` (Raiz):** `index.html` (Interface visual limpa) e `server.js` (Ponto de entrada do servidor Node.js).
* **`css/`:** Estilos fatiados em módulos (`variables.css`, `layout.css`, `components.css`, `main.css`) com design system *Liquid Glass*.
* **`js/`:** Módulos ES6 independentes (`config.js`, `state.js`, `api.js`, `ui.js`, `auth.js`, `cliente.js`, `pix.js`, `admin.js`, `main.js`).
* **`server/`:** API backend robusta (`config.js`, `db.js`, `pix.js`, `routes.js`, `middleware.js`).
* **`database/`:** Schema SQL completo (`schema.sql`) com políticas RLS, triggers de auditoria imutável e views analíticas.

---

## 🚀 Como Executar Localmente

1. Clone o repositório em sua máquina ou abra via editor compatível (como Spck Editor / VS Code).
2. Instale as dependências do servidor:
   ```bash
   npm install
