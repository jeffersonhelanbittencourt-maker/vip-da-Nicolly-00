// =====================================================================
// VIP DA NICOLLY - js/ai_assistant.js (Assistente Inteligente Supabase)
// =====================================================================

import { supabase } from './config.js';

export const SupabaseAI = {
    // 1. Diagnóstico automático do projeto (Verifica se tudo está certinho)
    async verificarSaudeProjeto() {
        const relatorio = [];

        // Testa conexão com tabela de planos
        const { data: planos, error: errPlanos } = await supabase.from('planos_vip').select('slug');
        if (errPlanos) {
            relatorio.push("❌ Erro ao ler planos_vip: Verifique as políticas RLS no Supabase.");
        } else {
            relatorio.push(`✅ Tabela 'planos_vip' OK (${planos.length} planos ativos).`);
        }

        // Testa conexão com tabela de admins
        const { data: admins, error: errAdmins } = await supabase.from('admins_vip').select('email');
        if (errAdmins) {
            relatorio.push("❌ Erro ao ler admins_vip: Verifique se a tabela existe.");
        } else {
            relatorio.push(`✅ Tabela 'admins_vip' OK (${admins.length} administrador configurado).`);
        }

        // Testa conexão com clientes
        const { count, error: errClientes } = await supabase
            .from('clientes_vip')
            .select('*', { count: 'exact', head: true });
            
        if (errClientes) {
            relatorio.push("❌ Erro ao acessar 'clientes_vip'.");
        } else {
            relatorio.push(`✅ Tabela 'clientes_vip' OK (${count || 0} clientes registrados).`);
        }

        return relatorio.join("\n");
    },

    // 2. Assistente Inteligente para responder dúvidas usando dados reais do Supabase
    async responderPergunta(pergunta, isAdmin = false) {
        const texto = pergunta.toLowerCase();

        // Se for o Administrador perguntando sobre o status ou vendas
        if (isAdmin) {
            if (texto.includes("tudo certo") || texto.includes("status") || texto.includes("diagnóstico") || texto.includes("verificar")) {
                return await this.verificarSaudeProjeto();
            }

            if (texto.includes("vendas") || texto.includes("faturamento") || texto.includes("clientes")) {
                const { data: pagos } = await supabase
                    .from('pagamentos_vip')
                    .select('valor')
                    .eq('status', 'aprovado');

                const total = (pagos || []).reduce((acc, item) => acc + Number(item.valor), 0);
                return `📊 Resumo Financeiro Real (Supabase):\n• Pagamentos aprovados: ${(pagos || []).length}\n• Faturamento total: R$ ${total.toFixed(2)}`;
            }
        }

        // Respostas inteligentes para Clientes baseadas nos planos do banco
        if (texto.includes("plano") || texto.includes("valor") || texto.includes("preço") || texto.includes("quanto")) {
            const { data: planos } = await supabase
                .from('planos_vip')
                .select('nome, valor, descricao')
                .eq('ativo', true);

            if (planos && planos.length > 0) {
                const lista = planos.map(p => `• ${p.nome}: R$ ${Number(p.valor).toFixed(2)} (${p.descricao})`).join("\n");
                return `✨ Estes são os planos VIP disponíveis no momento:\n\n${lista}\n\nVocê pode assinar qualquer um deles via Pix com liberação imediata!`;
            }
        }

        if (texto.includes("pix") || texto.includes("pagamento") || texto.includes("acesso")) {
            return "⚡ O pagamento via Pix é processado automaticamente pelo Mercado Pago. Assim que você conclui o pagamento, o Supabase libera o seu acesso VIP na hora!";
        }

        return "🤖 Olá! Sou a Assistente Virtual do VIP da Nicolly conectada ao Supabase. Posso te informar sobre nossos **planos**, **valores**, **pagamento via Pix** ou verificar o **status do sistema**. Como posso ajudar?";
    }
};
