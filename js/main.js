// =====================================================================
// VIP DA NICOLLY - js/main.js (Autenticação e Roteamento via Supabase)
// =====================================================================

import { supabase, ADMIN_EMAIL_MASTER } from './config.js';

document.addEventListener("DOMContentLoaded", async () => {
    console.log("VIP da Nicolly conectado ao Supabase!");

    const btnAbrirLogin = document.getElementById("btn-abrir-login");
    const modalLogin = document.getElementById("modal-login");
    const btnFecharModal = document.getElementById("btn-fechar-modal");
    const formLoginUnico = document.getElementById("form-login-unico");

    const vitrineSection = document.getElementById("vitrine-section");
    const clienteSection = document.getElementById("cliente-section");
    const adminSection = document.getElementById("admin-section");
    const badge = document.getElementById("user-status-badge");

    // Abrir / Fechar Modal
    if (btnAbrirLogin) btnAbrirLogin.addEventListener("click", () => modalLogin.style.display = "flex");
    if (btnFecharModal) btnFecharModal.addEventListener("click", () => modalLogin.style.display = "none");

    // Carregar planos do Supabase na vitrine
    carregarPlanosDoSupabase();

    // Sistema de Login Inteligente (Consulta 100% Supabase)
    if (formLoginUnico) {
        formLoginUnico.addEventListener("submit", async (e) => {
            e.preventDefault();
            const emailInput = document.getElementById("login-email").value.trim().toLowerCase();

            if (!emailInput) return;

            modalLogin.style.display = "none";

            // 1. Verificar se é o Admin Master (Jefferson)
            if (emailInput === ADMIN_EMAIL_MASTER.toLowerCase()) {
                vitrineSection.style.display = "none";
                clienteSection.style.display = "none";
                adminSection.style.display = "block";
                badge.textContent = "Admin Master";
                badge.style.background = "#10b981";
                alert("Bem-vindo ao Painel Master, Jefferson!");
                return;
            }

            // 2. Verificar se é um Administrador cadastrado na tabela admins_vip
            const { data: adminData } = await supabase
                .from('admins_vip')
                .select('*')
                .eq('email', emailInput)
                .single();

            if (adminData && adminData.ativo) {
                vitrineSection.style.display = "none";
                clienteSection.style.display = "none";
                adminSection.style.display = "block";
                badge.textContent = "Administrador";
                badge.style.background = "#8b5cf6";
                alert(`Bem-vindo, ${adminData.nome || 'Admin'}!`);
                return;
            }

            // 3. Verificar se é um Cliente na tabela clientes_vip
            const { data: clienteData } = await supabase
                .from('clientes_vip')
                .select('*')
                .eq('email', emailInput)
                .single();

            if (clienteData) {
                vitrineSection.style.display = "none";
                adminSection.style.display = "none";
                clienteSection.style.display = "block";
                badge.textContent = "Membro VIP";
                badge.style.background = "#ec4899";
                
                document.getElementById("cliente-welcome-title").textContent = `Olá, ${clienteData.nome || 'Cliente'}!`;
                alert("Login de Cliente realizado com sucesso!");
                return;
            }

            alert("E-mail não encontrado ou sem assinatura ativa no Supabase.");
        });
    }

    // Botões de Sair / Logout
    const sairGeral = () => {
        adminSection.style.display = "none";
        clienteSection.style.display = "none";
        vitrineSection.style.display = "block";
        badge.textContent = "Visitante";
        badge.style.background = "rgba(255, 255, 255, 0.1)";
        badge.style.color = "#9ca3af";
    };

    const btnLogoutAdmin = document.getElementById("btn-logout-admin");
    const btnSairCliente = document.getElementById("btn-sair-cliente");
    if (btnLogoutAdmin) btnLogoutAdmin.addEventListener("click", sairGeral);
    if (btnSairCliente) btnSairCliente.addEventListener("click", sairGeral);
});

// Função para buscar planos cadastrados no Supabase
async function carregarPlanosDoSupabase() {
    const container = document.getElementById("planos-container");
    if (!container) return;

    try {
        const { data: planos, error } = await supabase
            .from('planos_vip')
            .select('*')
            .eq('ativo', true);

        if (error) throw error;

        container.innerHTML = "";
        if (!planos || planos.length === 0) {
            container.innerHTML = "<p style='color: #9ca3af;'>Nenhum plano cadastrado no momento.</p>";
            return;
        }

        planos.forEach(plano => {
            const card = document.createElement("div");
            card.className = "plano-card";
            card.innerHTML = `
                <div>
                    <h3>${plano.nome}</h3>
                    <p style="color: #9ca3af; margin: 10px 0; font-size: 0.95rem;">${plano.descricao || ''}</p>
                    <p style="font-size: 1.5rem; font-weight: 700; color: #ec4899; margin: 15px 0;">R$ ${Number(plano.valor).toFixed(2)}</p>
                </div>
                <button class="btn-primary" onclick="alert('Redirecionando para o Pix do plano ${plano.nome}...')">Assinar Plano</button>
            `;
            container.appendChild(card);
        });
    } catch (err) {
        console.error("Erro ao carregar planos do Supabase:", err);
    }
}
