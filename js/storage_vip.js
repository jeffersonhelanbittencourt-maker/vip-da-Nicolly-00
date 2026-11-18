// =====================================================================
// VIP DA NICOLLY - js/storage_vip.js (Supabase Storage & Conteúdo VIP)
// =====================================================================

import { supabase } from './config.js';

export const SupabaseStorageVIP = {
    // 1. Fazer upload de foto ou vídeo direto para o Supabase Storage (100% Free)
    async publicarConteudo(arquivo, titulo, descricao) {
        if (!arquivo) throw new Error('Selecione uma foto ou vídeo primeiro.');

        const extensao = arquivo.name.split('.').pop();
        const nomeUnico = `${Date.now()}_${Math.random().toString(36).substring(2, 7)}.${extensao}`;
        const tipoMidia = arquivo.type.startsWith('video') ? 'video' : 'foto';

        // Envia o arquivo para o bucket 'midias_vip' no Supabase
        const { error: errUpload } = await supabase.storage
            .from('midias_vip')
            .upload(nomeUnico, arquivo, { cacheControl: '3600', upsert: false });

        if (errUpload) throw errUpload;

        // Pega a URL pública gerada automaticamente pelo Supabase
        const { data: urlData } = supabase.storage
            .from('midias_vip')
            .getPublicUrl(nomeUnico);

        // Registra na tabela conteudos_vip para aparecer para os assinantes
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

    // 2. Renderizar os conteúdos exclusivos dentro da Área VIP do Cliente
    async renderizarAreaCliente(containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;

        const { data: conteudos, error } = await supabase
            .from('conteudos_vip')
            .select('*')
            .eq('ativo', true)
            .order('criado_em', { ascending: false });

        if (error || !conteudos || conteudos.length === 0) {
            container.innerHTML = '<p style="color: #9ca3af; text-align: center; padding: 20px;">Nenhum conteúdo publicado ainda. Volte em breve!</p>';
            return;
        }

        container.innerHTML = conteudos.map(item => {
            let midiaHtml = '';
            if (item.tipo === 'foto') {
                midiaHtml = `<img src="${item.url_midia}" alt="${item.titulo}" style="width: 100%; border-radius: 10px; margin-top: 12px; max-height: 400px; object-fit: cover;">`;
            } else if (item.tipo === 'video') {
                midiaHtml = `<video src="${item.url_midia}" controls style="width: 100%; border-radius: 10px; margin-top: 12px; max-height: 400px;"></video>`;
            } else {
                midiaHtml = `<a href="${item.url_midia}" target="_blank" class="btn-primary" style="display: inline-block; margin-top: 12px; text-decoration: none;">Acessar Link Exclusivo</a>`;
            }

            return `
                <div style="background: #111827; border: 1px solid rgba(255,255,255,0.1); border-radius: 14px; padding: 20px; margin-bottom: 16px;">
                    <h3 style="color: #fff; font-size: 1.15rem;">${item.titulo}</h3>
                    ${item.descricao ? `<p style="color: #9ca3af; font-size: 0.9rem; margin-top: 6px;">${item.descricao}</p>` : ''}
                    ${midiaHtml}
                </div>
            `;
        }).join('');
    }
};
