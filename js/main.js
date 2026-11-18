// =====================================================================
// VIP DA NICOLLY - js/main.js (100% Supabase: Auth, Storage, AI, Realtime)
// =====================================================================

import { supabase, ADMIN_EMAIL_MASTER } from './config.js';
import { SupabaseAI } from './ai_assistant.js';
import { SupabaseRealtime } from './realtime.js';
import { SupabaseStorageVIP } from './storage_vip.js';

let modoCadastro = false;

document.addEventListener("DOMContentLoaded", async () => {
    const btnAbrirLogin = document.getElementById("btn-abrir-login");
    const modalLogin = document.getElementById("modal-login");
    const btnFecharModal = document.getElementById("btn-fechar-modal");
    const btnAlternarModo = document.getElementById("btn-alternar-modo-auth");
    const formLoginUnico = document.getElementById("form-login-unico");

    const vitrineSection = document.getElementById("vitrine-section");
    const clienteSection = document.getElementById("cliente-section");
    const adminSection = document.getElementById("admin-section");
    const badge = document.getElementById("user-status-badge");

    // Função para direcionar o usuário logado para a tela certa
    async function aplicarSessaoUsuario(user) {
        if (!user || !user.email) return;
        const email = user.email.toLowerCase();

        // 1. Verifica se é o Admin Master ou está na tabela admins_vip
        const { data: adminData } = await supabase
            .from('admins_vip')
            .select('*')
            .eq('email', email)
            .maybeSingle();

        if (email === ADMIN_EMAIL_MASTER.toLowerCase() || (adminData && adminData.ativo)) {
            vitrineSection.style.display = "none";
            clienteSection.style.display = "none";
            adminSection.style.display = "block";
            badge.textContent = "Admin Master";
            badge.style.background = "#10b981";
            badge.style.color = "#fff";
            btnAbrirLogin.style.display = "none";
            return;
        }

        // 2. Caso contrário, abre a Área do Cliente e carrega a galeria exclusiva
        vitrineSection.style.display = "none";
        adminSection.style.display = "none";
        clienteSection.style.display = "block";
        badge.textContent = "Membro VIP";
        badge.style.background = "#ec4899";
        badge.style.color = "#fff";
        btnAbrirLogin.style.display = "none";

        const tituloCliente = document.getElementById("cliente-welcome-title");
        if (tituloCliente) tituloCliente.textContent = `Olá, ${email.split('@')[0]}!`;

        await SupabaseStorageVIP.renderizarAreaCliente("galeria-vip-container");
    }

    // Verifica se já existe uma sessão salva no Supabase Auth ao abrir o site
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
        await aplicarSessaoUsuario(session.user);
    }

    // Abrir / Fechar Modal
    if (btnAbrirLogin) btnAbrirLogin.addEventListener("click", () => modalLogin.style.display = "flex");
    if (btnFecharModal) btnFecharModal.addEventListener("click", () => modalLogin.style.display = "none");

    // Alternar entre "Entrar" e "Criar Nova Conta"
    if (btnAlternarModo) {
        btnAlternarModo.addEventListener("click", () => {
            modoCadastro = !modoCadastro;
            document.getElementById("modal-auth-titulo").textContent = modoCadastro ? "Criar Conta VIP" : "Acessar Plataforma";
            document.getElementById("btn-submit-auth").textContent = modoCadastro ? "Cadastrar e Entrar" : "Entrar na Conta";
            btnAlternarModo.textContent = modoCadastro ? "Já tem conta? Fazer login" : "Não tem conta? Criar conta agora";
        });
    }

    // Envio do Formulário de Login ou Cadastro no Supabase Auth
    if (formLoginUnico) {
        formLoginUnico.addEventListener("submit", async (e) => {
            e.preventDefault();
            const email = document.getElementById("login-email").value.trim().toLowerCase();
            const password = document.getElementById("login-senha").value;

            if (!email || !password) return;

            if (modoCadastro) {
                const { data, error } = await supabase.auth.signUp({ email, password });
                if (error) {
                    alert("Erro ao criar conta: " + error.message);
                    return;
                }
                // Garante registro na tabela clientes_vip
                await supabase.from('clientes_vip').upsert({ email, status: 'aprovado' }, { onConflict: 'email' });
                modalLogin.style.display = "none";
                alert("Conta criada com sucesso no Supabase!");
                if (data.user) await aplicarSessaoUsuario(data.user);
            } else {
                const { data, error } = await supabase.auth.signInWithPassword({ email, password });
                if (error) {
                    alert("E-mail ou senha incorretos. Se ainda não criou sua senha no Supabase Auth, clique em 'Criar conta agora'.");
                    return;
                }
                modalLogin.style.display = "none";
                if (data.user) await aplicarSessaoUsuario(data.user);
            }
        });
    }

    // Upload de Fotos/Vídeos pelo Painel Admin para o Supabase Storage
    const formUpload = document.getElementById("form-upload-vip");
    if (formUpload) {
        formUpload.addEventListener("submit", async (e) => {
            e.preventDefault();
            const btnEnviar = document.getElementById("btn-enviar-midia");
            const titulo = document.getElementById("midia-titulo").value.trim();
            const descricao = document.getElementById("midia-descricao").value.trim();
            const arquivo = document.getElementById("midia-arquivo").files[0];

            try {
                btnEnviar.disabled = true;
                btnEnviar.textContent = "Enviando para o Supabase Storage...";
                await SupabaseStorageVIP.publicarConteudo(arquivo, titulo, descricao);
                alert("✅ Conteúdo publicado com sucesso na Área VIP!");
                formUpload.reset();
            } catch (err) {
                alert("Erro ao publicar mídia: " + err.message);
            } finally {
                btnEnviar.disabled = false;
                btnEnviar.textContent = "Publicar no Supabase Storage";
            }
        });
    }

    // Logout Real do Supabase Auth
    const sairGeral = async () => {
        await supabase.auth.signOut();
        adminSection.style.display = "none";
        clienteSection.style.display = "none";
        vitrineSection.style.display = "block";
        btnAbrirLogin.style.display = "inline-block";
        badge.textContent = "Visitante";
        badge.style.background = "rgba(255, 255, 255, 0.1)";
        badge.style.color = "#9ca3af";
    };

    const btnLogoutAdmin = document.getElementById("btn-logout-admin");
    const btnSairCliente = document.getElementById("btn-sair-cliente");
    if (btnLogoutAdmin) btnLogoutAdmin.addEventListener("click", sairGeral);
    if (btnSairCliente) btnSairCliente.addEventListener("click", sairGeral);

    // Inicializa Vitrine, IA e Realtime
    carregarPlanosDoSupabase();
    SupabaseAI.iniciarChatUI();
    SupabaseRealtime.iniciar(
        () => carregarPlanosDoSupabase(),
        (pagamento) => {
            if (adminSection.style.display === "block") {
                alert(`💰 NOVO PIX APROVADO AO VIVO!\nCliente: ${pagamento.email}\nValor: R$ ${Number(pagamento.valor).toFixed(2)}`);
            }
        }
    );
});

async function carregarPlanosDoSupabase() {
    const container = document.getElementById("planos-container");
    if (!container) return;

    const { data: planos } = await supabase
        .from('planos_vip')
        .select('*')
        .eq('ativo', true);

    if (!planos) return;

    container.innerHTML = planos.map(plano => `
        <div class="plano-card">
            <div>
                <h3>${plano.nome}</h3>
                <p style="color: #9ca3af; margin: 10px 0; font-size: 0.95rem;">${plano.descricao || ''}</p>
                <p style="font-size: 1.5rem; font-weight: 700; color: #ec4899; margin: 15px 0;">R$ ${Number(plano.valor).toFixed(2)}</p>
            </div>
            <button class="btn-primary" onclick="alert('Redirecionando para o Pix do plano ${plano.nome}...')">Assinar Plano</button>
        </div>
    `).join('');
}
