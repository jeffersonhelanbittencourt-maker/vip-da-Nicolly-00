// =====================================================================
// VIP DA NICOLLY - js/main.js (Sistema Unificado e Completo)
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

        const { data: adminData } = await supabase
            .from('admins_vip')
            .select('*')
            .eq('email', email)
            .maybeSingle();

        // 1. Painel Admin Master
        if (email === ADMIN_EMAIL_MASTER.toLowerCase() || (adminData && adminData.ativo)) {
            vitrineSection.style.display = "none";
            clienteSection.style.display = "none";
            adminSection.style.display = "block";
            badge.textContent = "Admin Master";
            badge.style.background = "#10b981";
            badge.style.color = "#fff";
            if (btnAbrirLogin) btnAbrirLogin.style.display = "none";
            
            // Carrega estatísticas financeiras instantâneas do banco
            await carregarDadosPainelAdmin();
            return;
        }

        // 2. Área do Cliente
        vitrineSection.style.display = "none";
        adminSection.style.display = "none";
        clienteSection.style.display = "block";
        badge.textContent = "Membro VIP";
        badge.style.background = "#ec4899";
        badge.style.color = "#fff";
        if (btnAbrirLogin) btnAbrirLogin.style.display = "none";

        const tituloCliente = document.getElementById("cliente-welcome-title");
        if (tituloCliente) tituloCliente.textContent = `Olá, ${email.split('@')[0]}!`;

        await SupabaseStorageVIP.renderizarAreaCliente("galeria-vip-container", email);
        await carregarNotificacoesCliente(email, "cliente-notificacoes-container");
    }

    // Carregar Estatísticas no Painel Admin
    async function carregarDadosPainelAdmin() {
        const containerStats = document.getElementById("admin-stats-container");
        if (!containerStats) return;

        try {
            const { data: stats } = await supabase.rpc('obter_estatisticas_vip');
            const { data: financeiro } = await supabase.from('vw_resumo_financeiro').select('*').single();

            containerStats.innerHTML = `
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; margin-top: 10px;">
                    <div style="background: #1f2937; padding: 15px; border-radius: 8px;">
                        <p style="color: #9ca3af; font-size: 0.8rem;">Faturamento Total</p>
                        <h3 style="color: #10b981; font-size: 1.4rem; margin-top: 5px;">R$ ${Number(financeiro?.faturamento_total || 0).toFixed(2)}</h3>
                    </div>
                    <div style="background: #1f2937; padding: 15px; border-radius: 8px;">
                        <p style="color: #9ca3af; font-size: 0.8rem;">Faturamento Hoje</p>
                        <h3 style="color: #38bdf8; font-size: 1.4rem; margin-top: 5px;">R$ ${Number(financeiro?.faturamento_hoje || 0).toFixed(2)}</h3>
                    </div>
                    <div style="background: #1f2937; padding: 15px; border-radius: 8px;">
                        <p style="color: #9ca3af; font-size: 0.8rem;">Clientes Ativos</p>
                        <h3 style="color: #ec4899; font-size: 1.4rem; margin-top: 5px;">${stats?.clientes_ativos || 0}</h3>
                    </div>
                    <div style="background: #1f2937; padding: 15px; border-radius: 8px;">
                        <p style="color: #9ca3af; font-size: 0.8rem;">Conteúdos Publicados</p>
                        <h3 style="color: #a855f7; font-size: 1.4rem; margin-top: 5px;">${stats?.conteudos_publicados || 0}</h3>
                    </div>
                </div>
            `;
        } catch (err) {
            console.error("Erro ao carregar estatísticas:", err);
        }
    }

    // Carregar Notificações do Cliente
    async function carregarNotificacoesCliente(emailCliente, containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;

        const { data: notificacoes } = await supabase
            .from('notificacoes_vip')
            .select('*')
            .eq('email_destinatario', emailCliente.toLowerCase())
            .order('criado_em', { ascending: false });

        if (!notificacoes || notificacoes.length === 0) return;

        container.innerHTML = notificacoes.map(item => `
            <div style="background: #1f2937; border-left: 4px solid #ec4899; padding: 10px 14px; border-radius: 8px; margin-bottom: 8px;">
                <h4 style="color: #fff; font-size: 0.9rem;">${item.titulo}</h4>
                <p style="color: #d1d5db; font-size: 0.8rem;">${item.mensagem}</p>
            </div>
        `).join('');
    }

    // Verificar sessão ao abrir
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) await aplicarSessaoUsuario(session.user);

    // Eventos de Modal
    if (btnAbrirLogin) btnAbrirLogin.addEventListener("click", () => modalLogin.style.display = "flex");
    if (btnFecharModal) btnFecharModal.addEventListener("click", () => modalLogin.style.display = "none");

    if (btnAlternarModo) {
        btnAlternarModo.addEventListener("click", () => {
            modoCadastro = !modoCadastro;
            document.getElementById("modal-auth-titulo").textContent = modoCadastro ? "Criar Conta VIP" : "Acessar Plataforma";
            document.getElementById("btn-submit-auth").textContent = modoCadastro ? "Cadastrar e Entrar" : "Entrar na Conta";
            btnAlternarModo.textContent = modoCadastro ? "Já tem conta? Fazer login" : "Não tem conta? Criar conta agora";
        });
    }

    // Autenticação Supabase Auth
    if (formLoginUnico) {
        formLoginUnico.addEventListener("submit", async (e) => {
            e.preventDefault();
            const email = document.getElementById("login-email").value.trim().toLowerCase();
            const password = document.getElementById("login-senha").value;

            if (modoCadastro) {
                const { data, error } = await supabase.auth.signUp({ email, password });
                if (error) return alert("Erro ao criar conta: " + error.message);
                await supabase.from('clientes_vip').upsert({ email, status: 'aprovado' }, { onConflict: 'email' });
                modalLogin.style.display = "none";
                alert("Conta criada com sucesso!");
                if (data.user) await aplicarSessaoUsuario(data.user);
            } else {
                const { data, error } = await supabase.auth.signInWithPassword({ email, password });
                if (error) return alert("E-mail ou senha incorretos.");
                modalLogin.style.display = "none";
                if (data.user) await aplicarSessaoUsuario(data.user);
            }
        });
    }

    // Upload de Mídia Admin
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
                btnEnviar.textContent = "Enviando...";
                await SupabaseStorageVIP.publicarConteudo(arquivo, titulo, descricao);
                alert("✅ Conteúdo publicado com sucesso!");
                formUpload.reset();
                await carregarDadosPainelAdmin();
            } catch (err) {
                alert("Erro ao publicar: " + err.message);
            } finally {
                btnEnviar.disabled = false;
                btnEnviar.textContent = "Publicar no Supabase Storage";
            }
        });
    }

    // Logout
    const sairGeral = async () => {
        await supabase.auth.signOut();
        adminSection.style.display = "none";
        clienteSection.style.display = "none";
        vitrineSection.style.display = "block";
        if (btnAbrirLogin) btnAbrirLogin.style.display = "inline-block";
        badge.textContent = "Visitante";
        badge.style.background = "rgba(255, 255, 255, 0.1)";
        badge.style.color = "#9ca3af";
    };

    const btnLogoutAdmin = document.getElementById("btn-logout-admin");
    const btnSairCliente = document.getElementById("btn-sair-cliente");
    if (btnLogoutAdmin) btnLogoutAdmin.addEventListener("click", sairGeral);
    if (btnSairCliente) btnSairCliente.addEventListener("click", sairGeral);

    // Inicializadores globais
    carregarPlanosDoSupabase();
    SupabaseAI.iniciarChatUI();
    SupabaseRealtime.iniciar(
        () => carregarPlanosDoSupabase(),
        (pagamento) => {
            if (adminSection.style.display === "block") {
                alert(`💰 PIX APROVADO AO VIVO!\nCliente: ${pagamento.email}\nValor: R$ ${Number(pagamento.valor).toFixed(2)}`);
                carregarDadosPainelAdmin();
            }
        }
    );
});

async function carregarPlanosDoSupabase() {
    const container = document.getElementById("planos-container");
    if (!container) return;

    const { data: planos } = await supabase.from('planos_vip').select('*').eq('ativo', true);
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
