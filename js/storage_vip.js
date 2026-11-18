// =====================================================================
// VIP DA NICOLLY - js/storage_vip.js (Storage, Galeria, Curtidas e Favoritos)
// =====================================================================
import { supabase } from './config.js';

export const SupabaseStorageVIP = {
    // 1. Upload e publicação de conteúdos exclusivos
    async publicarConteudo(arquivo, titulo, descricao) {
        if (!arquivo) throw new Error('Selecione uma foto ou vídeo primeiro.');

        const extensao = arquivo.name.split('.').pop();
        const nomeUnico = `${Date.now()}_${Math.random().toString(36).substring(2, 7)}.${extensao}`;
        const tipoMidia = arquivo.type.startsWith('video') ? 'video' : 'foto';

        const { error: errUpload } = await supabase.storage
            .from('midias_vip')
            .upload(nomeUnico, arquivo, { cacheControl: '3600', upsert: false });

        if (errUpload) throw errUpload;

        const { data: urlData } = supabase.storage
            .from('midias_vip')
            .getPublicUrl(nomeUnico);

        const { error: errDb } = await supabase
            .from('conteudos_vip')
            .insert([{
                titulo: titulo || 'Conteúdo Exclusivo',
                descricao: descricao || '',
                tipo: tipoMidia,
                url_midia: urlData.publicUrl,
                ativo: true
            }]);

        if (errDb) throw errDb;
        return urlData.publicUrl;
    },

    // 2. Sistema de Curtidas
    async curtirConteudo(conteudoId, emailUsuario) {
        if (!emailUsuario) return;
        const { data: jaCurtiu } = await supabase
            .from('curtidas_vip')
            .select('id')
            .eq('conteudo_id', conteudoId)
            .eq('usuario_email', emailUsuario)
            .maybeSingle();

        if (jaCurtiu) {
            await supabase.from('curtidas_vip').delete().eq('id', jaCurtiu.id);
        } else {
            await supabase.from('curtidas_vip').insert([{ conteudo_id: conteudoId, usuario_email: emailUsuario }]);
        }
    },

    // 3. Sistema de Favoritos
    async alternarFavorito(conteudoId, emailUsuario) {
        if (!emailUsuario) return;
        const { data: jaFavorito } = await supabase
            .from('favoritos_vip')
            .select('id')
            .eq('usuario_email', emailUsuario.toLowerCase())
            .eq('conteudo_id', conteudoId)
            .maybeSingle();

        if (jaFavorito) {
            await supabase.from('favoritos_vip').delete().eq('id', jaFavorito.id);
            alert("Removido dos favoritos com sucesso.");
        } else {
            await supabase.from('favoritos_vip').insert([{ usuario_email: emailUsuario.toLowerCase(), conteudo_id: conteudoId }]);
            alert("Adicionado aos favoritos com sucesso!");
        }
    },

    // 4. Renderização completa da Galeria VIP para os clientes
    async renderizarAreaCliente(containerId, emailUsuario = '') {
        const container = document.getElementById(containerId);
        if (!container) return;

        const { data: conteudos, error } = await supabase
            .from('conteudos_vip')
            .select('*')
            .eq('ativo', true)
            .order('criado_em', { ascending: false });

        if (error || !conteudos || conteudos.length === 0) {
            container.innerHTML = '<p style="color: #9ca3af; text-align: center; padding: 20px;">Nenhum conteúdo publicado na Área VIP ainda. Volte em breve!</p>';
            return;
        }

        container.innerHTML = conteudos.map(item => {
            let midiaHtml = '';
            if (item.tipo === 'foto') {
                midiaHtml = `<img src="${item.url_midia}" alt="${item.titulo}" style="width: 100%; border-radius: 10px; margin-top: 12px; max-height: 450px; object-fit: cover;">`;
            } else if (item.tipo === 'video') {
                midiaHtml = `<video src="${item.url_midia}" controls style="width: 100%; border-radius: 10px; margin-top: 12px; max-height: 450px;"></video>`;
            } else {
                midiaHtml = `<a href="${item.url_midia}" target="_blank" class="btn-primary" style="display: inline-block; margin-top: 12px; text-decoration: none;">Acessar Link Exclusivo</a>`;
            }

            return `
                <div style="background: #111827; border: 1px solid rgba(255,255,255,0.1); border-radius: 14px; padding: 20px; margin-bottom: 18px;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <h3 style="color: #fff; font-size: 1.15rem;">${item.titulo}</h3>
                        <div style="display: flex; gap: 8px;">
                            <button onclick="window.acaoFavorito('${item.id}')" style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: #fbbf24; padding: 6px 12px; border-radius: 20px; cursor: pointer;">⭐ Favorito</button>
                            <button onclick="window.acaoCurtir('${item.id}')" style="background: rgba(236,72,153,0.15); border: 1px solid rgba(236,72,153,0.4); color: #f472b6; padding: 6px 14px; border-radius: 20px; cursor: pointer; font-weight: 600;">❤️ Curtir</button>
                        </div>
                    </div>
                    ${item.descricao ? `<p style="color: #9ca3af; font-size: 0.9rem; margin-top: 6px;">${item.descricao}</p>` : ''}
                    ${midiaHtml}
                </div>
            `;
        }).join('');

        window.acaoCurtir = async (id) => {
            const { data: { session } } = await supabase.auth.getSession();
            const email = session?.user?.email || emailUsuario;
            if (!email) return alert("Faça login para curtir os conteúdos.");
            await SupabaseStorageVIP.curtirConteudo(id, email);
            await SupabaseStorageVIP.renderizarAreaCliente(containerId, email);
        };

        window.acaoFavorito = async (id) => {
            const { data: { session } } = await supabase.auth.getSession();
            const email = session?.user?.email || emailUsuario;
            if (!email) return alert("Faça login para favoritar os conteúdos.");
            await SupabaseStorageVIP.alternarFavorito(id, email);
        };
    }
};
