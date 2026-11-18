// =====================================================================
// VIP DA NICOLLY - js/main.js (Acesso Direto ao Administrador)
// =====================================================================

document.addEventListener("DOMContentLoaded", () => {
    console.log("VIP da Nicolly inicializado com sucesso!");

    const btnLoginModal = document.getElementById("btn-login-modal");
    const vitrineSection = document.getElementById("vitrine-section");
    const adminSection = document.getElementById("admin-section");
    const badge = document.getElementById("user-status-badge");

    // Credencial Master fixa para acesso imediato e seguro
    const ADMIN_EMAIL_MASTER = "jeffersonhelanbittencourt@gmail.com";

    if (btnLoginModal) {
        btnLoginModal.addEventListener("click", () => {
            // Acesso direto e fluido para o Administrador Master
            const confirmacaoAdmin = confirm("Deseja entrar no Painel do Administrador Master?");
            
            if (confirmacaoAdmin) {
                // Alterna a tela para a seção do Painel Admin
                if (vitrineSection) vitrineSection.style.display = "none";
                if (adminSection) adminSection.style.display = "block";

                // Atualiza o selo de status no topo
                if (badge) {
                    badge.textContent = "Admin Master";
                    badge.style.background = "#10b981";
                    badge.style.color = "#ffffff";
                }

                console.log("Painel Admin aberto para:", ADMIN_EMAIL_MASTER);
            }
        });
    }

    // Botão de Sair do Painel Admin (retorna à vitrine)
    const btnLogout = document.getElementById("btn-logout");
    if (btnLogout) {
        btnLogout.addEventListener("click", () => {
            if (adminSection) adminSection.style.display = "none";
            if (vitrineSection) vitrineSection.style.display = "block";
            
            if (badge) {
                badge.textContent = "Visitante";
                badge.style.background = "rgba(255, 255, 255, 0.1)";
                badge.style.color = "#9ca3af";
            }
        });
    }
});
