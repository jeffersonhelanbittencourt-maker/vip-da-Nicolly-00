// Função para carregar e exibir as notificações do cliente na Área VIP
async function carregarNotificacoesCliente(emailCliente, containerId) {
    const container = document.getElementById(containerId);
    if (!container || !emailCliente) return;

    try {
        // Busca as notificações destinadas ao e-mail do cliente
        const { data: notificacoes, error } = await supabase
            .from('notificacoes_vip')
            .select('*')
            .eq('email_destinatario', emailCliente.toLowerCase())
            .order('criado_em', { ascending: false });

        if (error) throw error;

        if (!notificacoes || notificacoes.length === 0) {
            container.innerHTML = `<p style="color: #9ca3af; font-size: 0.85rem;">Nenhuma notificação nova no momento.</p>`;
            return;
        }

        container.innerHTML = notificacoes.map(item => `
            <div style="background: #1f2937; border-left: 4px solid #ec4899; padding: 12px 16px; border-radius: 8px; margin-bottom: 10px;">
                <h4 style="color: #fff; font-size: 0.95rem; margin-bottom: 4px;">${item.titulo}</h4>
                <p style="color: #d1d5db; font-size: 0.85rem; line-height: 1.4;">${item.mensagem}</p>
                <span style="color: #9ca3af; font-size: 0.7rem; display: block; margin-top: 6px;">${new Date(item.criado_em).toLocaleDateString('pt-BR')}</span>
            </div>
        `).join('');

    } catch (err) {
        console.error("Erro ao carregar notificações:", err);
    }
}
