// =====================================================================
// VIP DA NICOLLY - js/storage_vip.js (Storage e Galeria de Mídias)
// =====================================================================
import { supabase } from './config.js';

export const SupabaseStorageVIP = {
    // 1. Upload de mídias pelo Admin
    async publicarConteudo(arquivo, titulo, descricao) {
        if (!arquivo) throw new Error("Nenhum arquivo selecionado.");

        const nomeArquivo = `${Date.now()}_${arquivo.name.replace(/\s+/g, '_')}`;
        const { data: uploadData, error: uploadError } = await supabase.storage
            .from('conteudos_vip')
            .upload(nomeArquivo, arquivo);

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
            .from('conteudos_vip')
            .getPublicUrl(nomeArquivo);

        const tipoMidia = arquivo.type.startsWith('video') ? 'video' : 'foto';

        const { error: dbError } = await supabase
            .from('conteudos_vip')
            .insert([{
                titulo: titulo,
                descricao: descricao,
                url_arquivo: urlData.publicUrl,
                tipo: tipoMidia
            }]);

        if (dbError) throw dbError;
        return true;
    },

    // 2. Renderização da Galeria na Área do Cliente
    async renderizarAreaCliente(containerId, emailUsuario) {
        const container = document.getElementById(containerId);
        if (!container) return;

        try {
            const { data: conteudos, error } = await supabase
                .from('conteudos_vip')
                .select('*')
                .order('criado_em', { ascending: false });

            if (error) throw error;

            if (!conteudos || conteudos.length === 0) {
                container.innerHTML = `<p style="color: #9ca3af; text-align: center; padding: 20px;">Nenhum conteúdo publicado no momento.</p>`;
                return;
            }

            container.innerHTML = `
                <h3 style="color: #fff; font-size: 1.2rem; margin-bottom: 15px;">📸 Galeria de Conteúdos Exclusivos</h3>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 20px;">
                    ${conteudos.map(item => `
                        <div style="background: #111827; border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; overflow: hidden; display: flex; flex-direction: column;">
                            ${item.tipo === 'video' 
                                ? `<video src="${item.url_arquivo}" controls style="width: 100%; height: 200px; object-fit: cover; background: #000;"></video>`
                                : `<img src="${item.url_arquivo}" alt="${item.titulo}" style="width: 100%; height: 200px; object-fit: cover;">`
                            }
                            <div style="padding: 15px; display: flex; flex-direction: column; flex: 1; justify-content: space-between;">
                                <div>
                                    <h4 style="color: #fff; font-size: 1rem; margin-bottom: 6px;">${item.titulo}</h4>
                                    <p style="color: #9ca3af; font-size: 0.85rem; margin-bottom: 12px;">${item.descricao || ''}</p>
                                </div>
                                <div style="display: flex; gap: 10px; border-top: 1px solid rgba(255,255,255,0.08); pt-10; margin-top: 10px; padding-top: 10px;">
                                    <button class="btn-curtir" data-id="${item.id}" style="background: #1f2937; border: none; color: #ec4899; padding: 6px 12px; border-radius: 6px; cursor: pointer; font-size: 0.8rem; font-weight: 600;">❤️ Curtir</button>
                                </div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            `;

            // Ação de curtir
            container.querySelectorAll('.btn-curtir').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    const conteudoId = e.target.getAttribute('data-id');
                    await supabase.from('curtidas_vip').insert([{ conteudo_id: conteudoId, email: emailUsuario }]);
                    alert("❤️ Curtido com sucesso!");
                });
            });

        } catch (err) {
            console.error("Erro ao carregar galeria:", err);
        }
    }
};
