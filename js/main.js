// =====================================================================
// VIP DA NICOLLY - js/main.js (Controlador Principal Completo com Mercado Pago)
// =====================================================================
import { supabase, ADMIN_EMAIL_MASTER } from './config.js';
import { SupabaseAI } from './ai_assistant.js';
import { SupabaseRealtime } from './realtime.js';
import { SupabaseStorageVIP } from './storage_vip.js';
import { MercadoPagoVIP } from './pagamentos.js';

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

    // Gerenciador de Sessão e Rotas Inteligentes
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
            if (vitrineSection) vitrineSection.style.display = "none";
            if (clienteSection) clienteSection.style.display = "none";
            if (adminSection) adminSection.style.display = "block";
            if (badge) {
                badge.textContent = "Admin Master";
                badge.style.background = "#10b981";
                badge.style.color = "#fff";
            }
            if (btnAbrirLogin) btnAbrirLogin.style.display = "none";
            
            await carregarDadosPainelAdmin();
            return;
        }

        // 2. Área do Cliente VIP
        if (vitrineSection) vitrineSection.style.display = "none";
        if (adminSection) adminSection.style.display = "none";
        if (clienteSection) clienteSection.style.display = "block";
        if (badge) {
            badge.textContent = "Membro VIP";
            badge.style.background = "#ec4899";
            badge.style.color = "#fff";
        }
        if (btnAbrirLogin) btnAbrirLogin.style.display = "none";

        const tituloCliente = document.getElementById("cliente-welcome-title");
        if (tituloCliente) tituloCliente.textContent = `Olá, ${email.split('@')[0]}!`;

        await SupabaseStorageVIP.renderizarAreaCliente("galeria-vip-container", email);
        await carregarNotificacoesCliente(email, "cliente-notificacoes-container");
    }

    // Carregar Estatísticas e Dados Financeiros do Admin
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
            console.error("Erro ao carregar estatísticas do admin:", err);
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

        if (!notificacoes || notificacoes.length === 0) {
            container.innerHTML = `<p style="color: #9ca3af; font-size: 0.85rem;">Nenhuma notificação nova.</p>`;
            return;
        }

        container.innerHTML = notificacoes.map(item => `
            <div style="background: #1f2937; border-left: 4px solid #ec4899; padding: 10px 14px; border-radius: 8px; margin-bottom: 8px;">
                <h4 style="color: #fff; font-size: 0.9rem;">${item.titulo}</h4>
                <p style="color: #d1d5db; font-size: 0.8rem;">${item.mensagem}</p>
            </div>
        `).join('');
    }

    // Checar sessão ativa inicial
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) await aplicarSessaoUsuario(session.user);

    // Eventos do Modal de Autenticação
    if (btnAbrirLogin && modalLogin) {
        btnAbrirLogin.addEventListener("click", () => modalLogin.style.display = "flex");
    }
    if (btnFecharModal && modalLogin) {
        btnFecharModal.addEventListener("click", () => modalLogin.style.display = "none");
    }

    if (btnAlternarModo) {
        btnAlternarModo.addEventListener("click", () => {
            modoCadastro = !modoCadastro;
            document.getElementById("modal-auth-titulo").textContent = modoCadastro ? "Criar Conta VIP" : "Acessar Plataforma";
            document.getElementById("btn-submit-auth").textContent = modoCadastro ? "Cadastrar e Entrar" : "Entrar na Conta";
            btnAlternarModo.textContent = modoCadastro ? "Já tem conta? Fazer login" : "Não tem conta? Criar conta agora";
        });
    }

    // Processamento do Formulário de Login / Cadastro
    if (formLoginUnico) {
        formLoginUnico.addEventListener("submit", async (e) => {
            e.preventDefault();
            const email = document.getElementById("login-email").value.trim().toLowerCase();
            const password = document.getElementById("login-senha").value;

            if (modoCadastro) {
                const { data, error } = await supabase.auth.signUp({ email, password });
                if (error) return alert("Erro ao criar conta: " + error.message);
                await supabase.from('clientes_vip').upsert({ email, status: 'aprovado' }, { onConflict: 'email' });
                if (modalLogin) modalLogin.style.display = "none";
                alert("Conta criada com sucesso!");
                if (data.user) await aplicarSessaoUsuario(data.user);
            } else {
                const { data, error } = await supabase.auth.signInWithPassword({ email, password });
                if (error) return alert("E-mail ou senha incorretos.");
                if (modalLogin) modalLogin.style.display = "none";
                if (data.user) await aplicarSessaoUsuario(data.user);
            }
        });
    }

    // Processamento de Upload de Mídia pelo Admin
    const formUpload = document.getElementById("form-upload-vip");
    if (formUpload) {
        formUpload.addEventListener("submit", async (e) => {
            e.preventDefault();
            const btnEnviar = document.getElementById("btn-enviar-midia");
            const titulo = document.getElementById("midia-titulo").value.trim();
            const descricao = document.getElementById("midia-descricao").value.trim();
            const arquivo = document.getElementById("midia-arquivo").files[0];

            try {
                if (btnEnviar) {
                    btnEnviar.disabled = true;
                    btnEnviar.textContent = "Enviando...";
                }
                await SupabaseStorageVIP.publicarConteudo(arquivo, titulo, descricao);
                alert("✅ Conteúdo publicado com sucesso!");
                formUpload.reset();
                await carregarDadosPainelAdmin();
            } catch (err) {
                alert("Erro ao publicar: " + err.message);
            } finally {
                if (btnEnviar) {
                    btnEnviar.disabled = false;
                    btnEnviar.textContent = "Publicar no Supabase Storage";
                }
            }
        });
    }

    // Ação de Logout Geral
    const sairGeral = async () => {
        await supabase.auth.signOut();
        if (adminSection) adminSection.style.display = "none";
        if (clienteSection) clienteSection.style.display = "none";
        if (vitrineSection) vitrineSection.style.display = "block";
        if (btnAbrirLogin) btnAbrirLogin.style.display = "inline-block";
        if (badge) {
            badge.textContent = "Visitante";
            badge.style.background = "rgba(255, 255, 255, 0.1)";
            badge.style.color = "#9ca3af";
        }
    };

    const btnLogoutAdmin = document.getElementById("btn-logout-admin");
    const btnSairCliente = document.getElementById("btn-sair-cliente");
    if (btnLogoutAdmin) btnLogoutAdmin.addEventListener("click", sairGeral);
    if (btnSairCliente) btnSairCliente.addEventListener("click", sairGeral);

    // Inicialização de módulos globais
    carregarPlanosDoSupabase();
    SupabaseAI.iniciarChatUI();
    SupabaseRealtime.iniciar(
        () => carregarPlanosDoSupabase(),
        (pagamento) => {
            if (adminSection && adminSection.style.display === "block") {
                alert(`💰 PIX APROVADO AO VIVO!\nCliente: ${pagamento.email}\nValor: R$ ${Number(pagamento.valor).toFixed(2)}`);
                carregarDadosPainelAdmin();
            }
        }
    );
});

// Função para renderizar os planos na vitrine pública com Mercado Pago integrado
async function carregarPlanosDoSupabase() {
    const container = document.getElementById("planos-container");
    if (!container) return;

    const { data: planos } = await supabase.from('planos_vip').select('*').eq('ativo', true);
    if (!planos) return;

    container.innerHTML = planos.map(plano => `
        <div class="plano-card" style="background: #111827; border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; padding: 24px; text-align: center;">
            <div>
                <h3 style="color: #fff; font-size: 1.25rem;">${plano.nome}</h3>
                <p style="color: #9ca3af; margin: 10px 0; font-size: 0.9rem;">${plano.descricao || ''}</p>
                <p style="font-size: 1.6rem; font-weight: 700; color: #ec4899; margin: 15px 0;">R$ ${Number(plano.valor).toFixed(2)}</p>
            </div>
            <button class="btn-primary" id="btn-plano-${plano.id}">Assinar com Pix</button>
        </div>
    `).join('');

    planos.forEach(plano => {
        const btn = document.getElementById(`btn-plano-${plano.id}`);
        if (btn) {
            btn.addEventListener("click", async () => {
                const { data: { session } } = await supabase.auth.getSession();
                const emailUsuario = session?.user?.email;

                if (!emailUsuario) {
                    alert("Por favor, faça login ou crie sua conta antes de assinar um plano!");
                    const modalLogin = document.getElementById("modal-login");
                    if (modalLogin) modalLogin.style.display = "flex";
                    return;
                }

                await MercadoPagoVIP.gerarPagamentoPix(plano.id, plano.nome, plano.valor, emailUsuario);
            });
        }
    });
}
