// =====================================================================
// VIP DA NICOLLY - js/ai_assistant.js (Nicolly AI - Suporte Conversacional)
// =====================================================================

import { supabase } from './config.js';

export const SupabaseAI = {
    iniciarChatUI() {
        const btnAbrir = document.getElementById('btn-abrir-chat-ia');
        const btnFechar = document.getElementById('btn-fechar-chat-ia');
        const popup = document.getElementById('chat-ia-popup');
        const form = document.getElementById('form-chat-ia');
        const input = document.getElementById('input-chat-ia');
        const areaMensagens = document.getElementById('chat-ia-mensagens');
        const chips = document.querySelectorAll('.chip-ia');

        if (!btnAbrir || !popup) return;

        // Abrir e Fechar o Pop-up
        btnAbrir.addEventListener('click', () => {
            const aberto = popup.style.display === 'flex';
            popup.style.display = aberto ? 'none' : 'flex';
            if (!aberto && input) input.focus();
        });

        if (btnFechar) {
            btnFechar.addEventListener('click', () => {
                popup.style.display = 'none';
            });
        }

        // Botões de sugestão rápida (Chips)
        chips.forEach(chip => {
            chip.addEventListener('click', () => {
                const texto = chip.getAttribute('data-msg');
                if (texto) this.processarEnvioUsuario(texto, areaMensagens);
            });
        });

        // Envio pelo formulário
        if (form) {
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                const texto = input.value.trim();
                if (!texto) return;
                input.value = '';
                this.processarEnvioUsuario(texto, areaMensagens);
            });
        }
    },

    adicionarBalao(areaMensagens, htmlTexto, remetente = 'ia') {
        const div = document.createElement('div');
        if (remetente === 'usuario') {
            div.style.cssText = 'background: linear-gradient(135deg, #ec4899, #8b5cf6); color: #ffffff; padding: 10px 14px; border-radius: 14px 14px 4px 14px; font-size: 0.88rem; line-height: 1.45; max-width: 82%; align-self: flex-end; word-wrap: break-word;';
        } else {
            div.style.cssText = 'background: #1f2937; color: #f3f4f6; padding: 12px 14px; border-radius: 14px 14px 14px 4px; font-size: 0.88rem; line-height: 1.45; max-width: 85%; align-self: flex-start; border: 1px solid rgba(255,255,255,0.06); word-wrap: break-word;';
        }
        div.innerHTML = htmlTexto;
        areaMensagens.appendChild(div);
        areaMensagens.scrollTop = areaMensagens.scrollHeight;
        return div;
    },

    async processarEnvioUsuario(texto, areaMensagens) {
        // 1. Mostra a mensagem do usuário
        this.adicionarBalao(areaMensagens, texto, 'usuario');

        // 2. Mostra indicador "Nicolly AI está digitando..."
        const digitando = this.adicionarBalao(areaMensagens, '<span style="color: #9ca3af; font-style: italic;">Nicolly AI está digitando...</span>', 'ia');

        // 3. Verifica se quem está falando é o Admin Master logado na tela
        const isAdmin = document.getElementById('admin-section')?.style.display === 'block';

        // Pequeno atraso natural para parecer uma conversa real
        await new Promise(r => setTimeout(r, 450));

        const resposta = await this.gerarRespostaInteligente(texto, isAdmin);
        digitando.innerHTML = resposta;
        areaMensagens.scrollTop = areaMensagens.scrollHeight;
    },

    async verificarSaudeProjeto() {
        const linhas = ['<strong>🩺 Diagnóstico do Banco Supabase:</strong><br>'];

        const { data: planos, error: errP } = await supabase.from('planos_vip').select('slug');
        linhas.push(errP ? '❌ Erro em <code>planos_vip</code> (verifique RLS).' : `✅ <strong>Planos:</strong> ${planos.length} planos ativos.`);

        const { data: admins, error: errA } = await supabase.from('admins_vip').select('email');
        linhas.push(errA ? '❌ Erro em <code>admins_vip</code>.' : `✅ <strong>Admins:</strong> ${admins.length} administrador ativo.`);

        const { count, error: errC } = await supabase.from('clientes_vip').select('*', { count: 'exact', head: true });
        linhas.push(errC ? '❌ Erro em <code>clientes_vip</code>.' : `✅ <strong>Clientes:</strong> ${count || 0} registros na base.`);

        return linhas.join('<br>');
    },

    async gerarRespostaInteligente(pergunta, isAdmin = false) {
        const msg = pergunta.toLowerCase();

        // Saudações naturais
        if (/^(oi|olá|ola|bom dia|boa tarde|boa noite|eai|e aí|tudo bem)/i.test(msg)) {
            return isAdmin
                ? 'Olá, <strong>Jefferson</strong>! 👑 Estou conectada ao seu banco Supabase. Você pode me pedir o <strong>status</strong> do sistema ou o resumo de <strong>vendas</strong>.'
                : 'Oi! Tudo ótimo por aqui e com você? 😊 Como posso te ajudar a entrar para o <strong>VIP da Nicolly</strong> hoje?';
        }

        // Identidade da IA
        if (msg.includes('quem é você') || msg.includes('quem e voce') || msg.includes('seu nome') || msg.includes('o que você é')) {
            return 'Eu sou a <strong>Nicolly AI</strong>, a assistente virtual oficial desta plataforma! Fui integrada diretamente ao banco de dados Supabase para tirar suas dúvidas em tempo real, mostrar planos, cupons e ajudar no seu acesso VIP. ✨';
        }

        // Comandos exclusivos quando o Admin está logado
        if (isAdmin) {
            if (msg.includes('status') || msg.includes('tudo certo') || msg.includes('diagnóstico') || msg.includes('banco')) {
                return await this.verificarSaudeProjeto();
            }
            if (msg.includes('venda') || msg.includes('faturamento') || msg.includes('dinheiro') || msg.includes('relatório')) {
                const { data: pagos } = await supabase.from('pagamentos_vip').select('valor').eq('status', 'aprovado');
                const total = (pagos || []).reduce((acc, item) => acc + Number(item.valor), 0);
                return `📊 <strong>Resumo Financeiro (Supabase):</strong><br>• Assinaturas aprovadas: <strong>${(pagos || []).length}</strong><br>• Faturamento total: <strong>R$ ${total.toFixed(2)}</strong>`;
            }
        }

        // Consulta real aos Planos no Supabase
        if (msg.includes('plano') || msg.includes('valor') || msg.includes('preço') || msg.includes('preco') || msg.includes('quanto') || msg.includes('assinar')) {
            const { data: planos } = await supabase.from('planos_vip').select('nome, valor, descricao').eq('ativo', true);
            if (planos && planos.length > 0) {
                const lista = planos.map(p => `• <strong>${p.nome}:</strong> R$ ${Number(p.valor).toFixed(2)}<br><span style="color:#9ca3af; font-size:0.8rem;">${p.descricao || ''}</span>`).join('<br><br>');
                return `💎 <strong>Nossos Planos VIP disponíveis agora:</strong><br><br>${lista}<br><br>Escolha o seu preferido na tela principal para liberar seu acesso!`;
            }
        }

        // Consulta real aos Cupons no Supabase
        if (msg.includes('cupom') || msg.includes('desconto') || msg.includes('promoção') || msg.includes('promocao')) {
            const { data: cupons } = await supabase.from('cupons_vip').select('codigo, percentual').eq('ativo', true);
            if (cupons && cupons.length > 0) {
                const c = cupons[0];
                return `🎟️ Temos um cupom ativo no sistema!<br>Use o código <strong>${c.codigo}</strong> para ganhar <strong>${c.percentual}% de desconto</strong> na sua assinatura!`;
            }
            return 'No momento estamos com valores promocionais diretos nos planos da vitrine! 😉';
        }

        // Dúvidas sobre Pix, Liberação e Segurança
        if (msg.includes('pix') || msg.includes('pagar') || msg.includes('pagamento') || msg.includes('cartão')) {
            return '⚡ Aceitamos <strong>Pix com aprovação automática</strong> via Mercado Pago! Assim que você finaliza o pagamento, nosso sistema reconhece na hora e libera seu acesso VIP sem precisar esperar.';
        }

        if (msg.includes('acesso') || msg.includes('entrar') || msg.includes('login') || msg.includes('grupo')) {
            return '🔐 Após assinar, basta clicar em <strong>"Entrar / Acessar"</strong> no topo da página e informar o mesmo e-mail usado na compra para abrir sua Área VIP exclusiva.';
        }

        if (msg.includes('suporte') || msg.includes('ajuda') || msg.includes('humano') || msg.includes('whatsapp')) {
            const { data: cfg } = await supabase.from('configuracoes').select('valor').eq('chave', 'suporte_whatsapp').single();
            if (cfg && cfg.valor) {
                return `📱 Se precisar de atendimento direto, nosso WhatsApp oficial de suporte é: <strong>${cfg.valor}</strong>`;
            }
            return 'Estou aqui 24 horas por dia para resolver qualquer dúvida sobre planos, pagamentos ou acesso! Pode me perguntar o que precisar. 😊';
        }

        return 'Entendi! 😊 Posso te passar informações detalhadas sobre:<br>• <strong>Planos e valores</strong><br>• <strong>Cupons de desconto</strong><br>• <strong>Como pagar com Pix</strong><br>• <strong>Como acessar sua conta VIP</strong><br><br>Sobre qual desses assuntos você gostaria de saber?';
    }
};
