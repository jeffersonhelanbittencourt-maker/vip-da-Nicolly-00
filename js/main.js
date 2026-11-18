// =====================================================================
// VIP DA NICOLLY - js/main.js (Controlador Principal Mestre e Unificado)
// =====================================================================
import { supabase, ADMIN_EMAIL_MASTER } from './config.js';
import { SupabaseRealtime } from './realtime.js';
import { SupabaseStorageVIP } from './storage_vip.js';
import { MercadoPagoVIP } from './pagamentos.js';
import { SupabaseCupons } from './cupons.js';
import { SupabaseAfiliados } from './afiliados.js';

let modoCadastro = false;

document.addEventListener("DOMContentLoaded", async () => {
    // 0. Verifica e salva o código de Afiliado se houver ?ref= na URL
    SupabaseAfiliados.verificarIndicaçãoURL();

    const btnAbrirLogin = document.getElementById("btn-abrir-login");
    const modalLogin = document.getElementById("modal-login");
    const btnFecharModal = document.getElementById("btn-fechar-modal");
    const btnAlternarModo = document.getElementById("btn-alternar-modo-auth");
    const btnEsqueciSenha = document.getElementById("btn-esqueci-senha");
    const formLoginUnico = document.getElementById("form-login-unico");

    const vitrineSection = document.getElementById("vitrine-section");
    const clienteSection = document.getElementById("cliente-section");
    const adminSection = document.getElementById("admin-section");
    const badge = document.getElementById("user-status-badge");

    // =====================================================================
    // 1. GERENCIADOR DE SESSÃO E ROTAS INTELIGENTES (SUPABASE)
    // =====================================================================
    async function aplicarSessaoUsuario(user) {
        if (!user || !user.email) return;
        const email = user.email.toLowerCase();

        // Consulta a tabela admins_vip no Supabase para verificar permissão de admin
        const { data: adminData } = await supabase
            .from('admins_vip')
            .select('*')
            .eq('email', email)
            .maybeSingle();

        // A. Painel Admin Master (Direto se for master ou admin cadastrado)
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

        // B. Área do Cliente VIP
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
        await SupabaseAfiliados.renderizarPainelAfiliado(email, "cliente-afiliados-container");
    }

    // =====================================================================
    // 2. PAINEL ADMINISTRATIVO (Estatísticas e Faturamento)
    // =====================================================================
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

    // =====================================================================
    // 3. NOTIFICAÇÕES DO CLIENTE
    // =====================================================================
    async function carregarNotificacoesCliente(emailCliente, containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;

        const { data: notificacoes } = await supabase
            .from('notificacoes_vip')
            .select('*')
            .eq('email_destinatario', emailCliente.toLowerCase())
            .order('criado_em', { ascending: false });

        if (!notificacoes || notificacoes.length === 0) {
            container.innerHTML = `<p style="color: #9ca3af; font-size: 0.85rem;">Nenhuma notificação nova no momento.</p>`;
            return;
        }

        container.innerHTML = notificacoes.map(item => `
            <div style="background: #1f2937; border-left: 4px solid #ec4899; padding: 10px 14px; border-radius: 8px; margin-bottom: 8px;">
                <h4 style="color: #fff; font-size: 0.9rem;">${item.titulo}</h4>
                <p style="color: #d1d5db; font-size: 0.8rem;">${item.mensagem}</p>
            </div>
        `).join('');
    }

    // =====================================================================
    // 4. AUTENTICAÇÃO, CADASTRO, TELEFONE E RECUPERAÇÃO DE SENHA
    // =====================================================================
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) await aplicarSessaoUsuario(session.user);

    if (btnAbrirLogin && modalLogin) {
        btnAbrirLogin.addEventListener("click", () => modalLogin.style.display = "flex");
    }
    if (btnFecharModal && modalLogin) {
        btnFecharModal.addEventListener("click", () => modalLogin.style.display = "none");
    }

    // Alternar entre Login e Cadastro (exibe campo de WhatsApp/Celular)
    if (btnAlternarModo) {
        btnAlternarModo.addEventListener("click", () => {
            modoCadastro = !modoCadastro;
            const grupoTelefone = document.getElementById("grupo-telefone");
            
            document.getElementById("modal-auth-titulo").textContent = modoCadastro ? "Criar Conta VIP" : "Acessar Plataforma";
            document.getElementById("btn-submit-auth").textContent = modoCadastro ? "Cadastrar e Entrar" : "Entrar na Conta";
            btnAlternarModo.textContent = modoCadastro ? "Já tem conta? Fazer login" : "Criar conta agora";
            
            if (grupoTelefone) {
                grupoTelefone.style.display = modoCadastro ? "block" : "none";
                const inputTel = document.getElementById("login-telefone");
                if (inputTel) inputTel.required = modoCadastro;
            }
        });
    }

    // Recuperação de senha nativa do Supabase ("Esqueci a senha")
    if (btnEsqueciSenha) {
        btnEsqueciSenha.addEventListener("click", async () => {
            const emailInput = document.getElementById("login-email").value.trim().toLowerCase();
            if (!emailInput) {
                alert("Por favor, digite seu e-mail no campo acima antes de clicar em 'Esqueci a senha'.");
                return;
            }
            const { error } = await supabase.auth.resetPasswordForEmail(emailInput, {
                redirectTo: window.location.href,
            });
            if (error) {
                alert("Erro ao enviar e-mail de recuperação: " + error.message);
            } else {
                alert("✅ E-mail de recuperação de senha enviado com sucesso! Verifique sua caixa de entrada.");
            }
        });
    }

    // Envio do formulário de autenticação (Login ou Cadastro com Telefone)
    if (formLoginUnico) {
        formLoginUnico.addEventListener("submit", async (e) => {
            e.preventDefault();
            const email = document.getElementById("login-email").value.trim().toLowerCase();
            const password = document.getElementById("login-senha").value;
            const telefone = document.getElementById("login-telefone")?.value.trim() || '';

            if (modoCadastro) {
                const { data, error } = await supabase.auth.signUp({ 
                    email, 
                    password,
                    options: { data: { telefone: telefone } }
                });
                if (error) return alert("Erro ao criar conta: " + error.message);

                await supabase.from('clientes_vip').upsert({ 
                    email: email, 
                    telefone: telefone,
                    status: 'aprovado' 
                }, { onConflict: 'email' });

                if (modalLogin) modalLogin.style.display = "none";
                alert("✅ Conta criada com sucesso!");
                if (data.user) await aplicarSessaoUsuario(data.user);
            } else {
                const { data, error } = await supabase.auth.signInWithPassword({ email, password });
                if (error) return alert("E-mail ou senha incorretos.");
                if (modalLogin) modalLogin.style.display = "none";
                if (data.user) await aplicarSessaoUsuario(data.user);
            }
        });
    }

    // =====================================================================
    // 5. UPLOAD DE MÍDIA (PAINEL ADMIN)
    // =====================================================================
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
                alert("✅ Conteúdo publicado com sucesso no Supabase Storage!");
                formUpload.reset();
                await carregarDadosPainelAdmin();
            } catch (err) {
                alert("Erro ao publicar conteúdo: " + err.message);
            } finally {
                if (btnEnviar) {
                    btnEnviar.disabled = false;
                    btnEnviar.textContent = "Publicar no Supabase Storage";
                }
            }
        });
    }

    // =====================================================================
    // 6. LOGOUT GERAL
    // =====================================================================
    const sairGeral = async () => {
        await supabase.auth.signOut();
        if (adminSection) adminSection.style.display = "none";
        if (clienteSection) clienteSection.style.display = "none";
        if (vitrineSection) vitrineSection.style.display = "block";
        if (btnAbrirLogin) btnAbrirLogin.style.display = "inline-block";
        if (badge) {
            badge.textContent = "Visitante";
            badge.style.background = "rgba(255, 255, 255, 0.08)";
            badge.style.color = "#9ca3af";
        }
    };

    const btnLogoutAdmin = document.getElementById("btn-logout-admin");
    const btnSairCliente = document.getElementById("btn-sair-cliente");
    if (btnLogoutAdmin) btnLogoutAdmin.addEventListener("click", sairGeral);
    if (btnSairCliente) btnSairCliente.addEventListener("click", sairGeral);

    // =====================================================================
    // 7. INICIALIZAÇÃO DE MÓDULOS GLOBAIS (Realtime e Vitrine)
    // =====================================================================
    carregarPlanosDoSupabase();
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

// =====================================================================
// 8. VITRINE DE PLANOS COM CUPONS E MERCADO PAGO
// =====================================================================
async function carregarPlanosDoSupabase() {
    const container = document.getElementById("planos-container");
    if (!container) return;

    const { data: planos } = await supabase.from('planos_vip').select('*').eq('ativo', true);
    if (!planos) return;

    container.innerHTML = planos.map(plano => `
        <div class="plano-card">
            <div>
                <h3 style="color: #fff; font-size: 1.25rem;">${plano.nome}</h3>
                <p style="color: #9ca3af; margin: 10px 0; font-size: 0.9rem;">${plano.descricao || ''}</p>
                <p id="preco-plano-${plano.id}" style="font-size: 1.6rem; font-weight: 700; color: #ec4899; margin: 15px 0;">R$ ${Number(plano.valor).toFixed(2)}</p>
            </div>
            
            <div style="margin: 12px 0; display: flex; gap: 8px;">
                <input type="text" id="input-cupom-${plano.id}" placeholder="Cupom (ex: VIP10)" style="text-transform: uppercase;">
                <button type="button" id="btn-aplicar-cupom-${plano.id}" style="background: #374151; color: #fff; border: none; padding: 8px 12px; border-radius: 6px; cursor: pointer; font-size: 0.85rem;">Aplicar</button>
            </div>

            <button class="btn-primary" id="btn-plano-${plano.id}" style="margin-top: 10px;">Assinar com Pix</button>
        </div>
    `).join('');

    planos.forEach(plano => {
        let precoAtual = Number(plano.valor);
        const inputCupom = document.getElementById(`input-cupom-${plano.id}`);
        const btnAplicar = document.getElementById(`btn-aplicar-cupom-${plano.id}`);
        const txtPreco = document.getElementById(`preco-plano-${plano.id}`);
        const btnAssinar = document.getElementById(`btn-plano-${plano.id}`);

        if (btnAplicar) {
            btnAplicar.addEventListener("click", async () => {
                const codigo = inputCupom.value;
                const resultado = await SupabaseCupons.validarEAplicarCupom(codigo, Number(plano.valor));
                precoAtual = resultado.valorFinal;
                txtPreco.textContent = `R$ ${precoAtual.toFixed(2)}`;
            });
        }

        if (btnAssinar) {
            btnAssinar.addEventListener("click", async () => {
                const { data: { session } } = await supabase.auth.getSession();
                const emailUsuario = session?.user?.email;

                if (!emailUsuario) {
                    alert("Por favor, faça login ou crie sua conta antes de assinar um plano!");
                    const modalLogin = document.getElementById("modal-login");
                    if (modalLogin) modalLogin.style.display = "flex";
                    return;
                }

                await MercadoPagoVIP.gerenciarPagamentoPix(plano.id, plano.nome, precoAtual, emailUsuario);
            });
        }
    });
}
