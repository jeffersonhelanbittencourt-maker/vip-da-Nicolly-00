// Função para adicionar ou remover um conteúdo dos favoritos do usuário
async function alternarFavoritoVIP(conteudoId, emailUsuario) {
    if (!emailUsuario) {
        alert("Você precisa estar logado para favoritar conteúdos.");
        return;
    }

    try {
        // Verifica se já está nos favoritos
        const { data: jaFavorito } = await supabase
            .from('favoritos_vip')
            .select('id')
            .eq('usuario_email', emailUsuario.toLowerCase())
            .eq('conteudo_id', conteudoId)
            .maybeSingle();

        if (jaFavorito) {
            // Se já for favorito, remove
            await supabase
                .from('favoritos_vip')
                .delete()
                .eq('id', jaFavorito.id);
            alert("Removido dos favoritos.");
        } else {
            // Se não for, adiciona
            await supabase
                .from('favoritos_vip')
                .insert([{ usuario_email: emailUsuario.toLowerCase(), conteudo_id: conteudoId }]);
            alert("Adicionado aos favoritos!");
        }
    } catch (err) {
        console.error("Erro ao gerenciar favoritos:", err);
    }
}
