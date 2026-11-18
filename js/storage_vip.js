// Função para curtir ou descurtir conteúdos na Área VIP usando o Supabase
async function curtirConteudoVIP(conteudoId, emailUsuario, containerId) {
    if (!emailUsuario) {
        alert("Você precisa estar logado para curtir um conteúdo.");
        return;
    }

    try {
        // Verifica se o usuário já curtiu este conteúdo
        const { data: jaCurtiu } = await supabase
            .from('curtidas_vip')
            .select('id')
            .eq('conteudo_id', conteudoId)
            .eq('usuario_email', emailUsuario)
            .maybeSingle();

        if (jaCurtiu) {
            // Se já curtiu, remove a curtida (Descurtir)
            await supabase
                .from('curtidas_vip')
                .delete()
                .eq('id', jaCurtiu.id);
        } else {
            // Se não curtiu, adiciona a curtida
            await supabase
                .from('curtidas_vip')
                .insert([{ conteudo_id: conteudoId, usuario_email: emailUsuario }]);
        }

        // Recarrega a galeria para atualizar o contador na tela instantaneamente
        if (typeof SupabaseStorageVIP !== 'undefined' && SupabaseStorageVIP.renderizarAreaCliente) {
            await SupabaseStorageVIP.renderizarAreaCliente(containerId, emailUsuario);
        }
    } catch (err) {
        console.error("Erro ao processar curtida:", err);
    }
}
