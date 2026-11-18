// Função para enviar um comentário em um conteúdo VIP
async function enviarComentarioVIP(conteudoId, emailUsuario, textoComentario) {
    if (!emailUsuario || !textoComentario) return;

    try {
        const { error } = await supabase
            .from('comentarios_vip')
            .insert([{
                conteudo_id: conteudoId,
                usuario_email: emailUsuario.toLowerCase(),
                comentario: textoComentario.trim()
            }]);

        if (error) throw error;
        alert("Comentário enviado com sucesso!");
    } catch (err) {
        console.error("Erro ao enviar comentário:", err);
        alert("Erro ao enviar comentário.");
    }
}
