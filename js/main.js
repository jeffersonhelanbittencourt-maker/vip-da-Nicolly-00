// Função para carregar as estatísticas e faturamento direto das funções RPC do Supabase
async function carregarDadosPainelAdmin() {
    const containerStats = document.getElementById("admin-stats-container");
    if (!containerStats) return;

    try {
        // 1. Puxa as estatísticas instantâneas criadas no Supabase
        const { data: stats, error: errStats } = await supabase.rpc('obter_estatisticas_vip');
        
        // 2. Puxa o resumo financeiro detalhado da View do Supabase
        const { data: financeiro, error: errFin } = await supabase
            .from('vw_resumo_financeiro')
            .select('*')
            .single();

        if (errStats || errFin) throw new Error('Erro ao buscar dados do Supabase.');

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
        console.error("Erro ao carregar painel admin:", err);
    }
}
