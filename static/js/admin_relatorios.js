document.addEventListener('DOMContentLoaded', function () {
    const totalArrecadadoEl = document.getElementById('total-arrecadado');
    const totalVendasEl = document.getElementById('total-vendas');
    const periodoTextEl = document.getElementById('periodo-texto');
    const periodoTextEl2 = document.getElementById('periodo-texto-2');
    const dataInicioEl = document.getElementById('data-inicio-relatorio');
    const relatoriosDiv = document.getElementById('relatorios'); 
    const btnDownloadPdf = document.getElementById('btn-download-pdf'); // NOVO: Botão de Download PDF
    
    // Variável para rastrear o período ativo atualmente selecionado (padrão: diário)
    let periodoAtivo = 'diario'; 
    
    if (!relatoriosDiv) return; 
    
    const botoes = relatoriosDiv.querySelectorAll('.btn[data-periodo]');

    // --- FUNÇÕES DE UTILIDADE ---

    // Função para formatar números para BRL
    const formatBRL = (value) => {
        return parseFloat(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    };

    // --- FUNÇÃO PRINCIPAL: BUSCA DE DADOS ---

    const fetchRelatorio = async (periodo) => {
        // Sai se a seção de relatórios não estiver visível (para evitar chamadas desnecessárias)
        if (relatoriosDiv.style.display === 'none') return;
        
        // 1. Atualiza o estado de carregamento e o período ativo
        totalArrecadadoEl.textContent = 'Buscando...';
        totalVendasEl.textContent = 'Buscando...';
        dataInicioEl.textContent = 'Dados a partir de: Buscando...';
        periodoAtivo = periodo; // Atualiza o período ativo para a função de download
        
        try {
            const response = await fetch(`/admin/api/relatorio?periodo=${periodo}`);
            if (!response.ok) {
                throw new Error('Erro ao buscar dados do relatório.');
            }
            const data = await response.json();

            if (data.ok) {
                // 2. Atualiza os cards com os dados
                totalArrecadadoEl.textContent = formatBRL(data.total_arrecadado);
                totalVendasEl.textContent = data.total_vendas.toString();
                
                // 3. Atualiza o texto do período
                const textoPeriodo = {
                    'diario': 'Hoje',
                    'semanal': 'Últimos 7 dias',
                    'mensal': 'Últimos 30 dias'
                };
                periodoTextEl.textContent = textoPeriodo[periodo] || 'Período Indefinido';
                periodoTextEl2.textContent = periodoTextEl.textContent;

                // 4. Converte e exibe a data de início (UTC -> BRT)
                const dataInicial = new Date(data.data_inicio + 'Z'); 
                const dataFormatada = dataInicial.toLocaleDateString('pt-BR') + ' ' + dataInicial.toLocaleTimeString('pt-BR');
                dataInicioEl.textContent = `Dados a partir de: ${dataFormatada}`;
                
            } else {
                totalArrecadadoEl.textContent = 'Erro';
                totalVendasEl.textContent = 'Erro';
                dataInicioEl.textContent = `Erro: ${data.error}`;
            }

        } catch (error) {
            console.error('Erro no relatório:', error);
            totalArrecadadoEl.textContent = 'Falha na Conexão';
            totalVendasEl.textContent = 'Falha na Conexão';
            dataInicioEl.textContent = 'Falha ao conectar com o servidor.';
        }
    };

    // --- EVENT LISTENERS DE PERÍODO ---

    botoes.forEach(button => {
        button.addEventListener('click', function() {
            // Lógica de troca de classes dos botões (btn-primary <-> ghost)
            botoes.forEach(b => {
                b.classList.remove('btn-primary', 'active');
                b.classList.add('ghost');
            });
            this.classList.remove('ghost');
            this.classList.add('btn-primary', 'active');
            
            // Busca os dados
            const periodo = this.getAttribute('data-periodo');
            fetchRelatorio(periodo);
        });
    });
    
   // --- EVENT LISTENER DE DOWNLOAD PDF/CSV ---
    
    if (btnDownloadPdf) {
        btnDownloadPdf.addEventListener('click', function() {
            // MUDANÇA AQUI: Chamamos a nova rota CSV
            const downloadUrl = `/admin/relatorio/csv?periodo=${periodoAtivo}`;
            
            // Abre a URL em uma nova aba, que forçará o download do CSV
            window.open(downloadUrl, '_blank');
        });
    }

    // --- INICIALIZAÇÃO E CONTROLE DE ABAS ---

    const initializeRelatorio = () => {
        // Inicializa com o período padrão (diário) apenas se a aba estiver visível
        if (relatoriosDiv.style.display !== 'none') {
            const botaoDiario = document.getElementById('btn-diario');
            
            // Garante que o estado visual inicial seja o de "Hoje"
            botoes.forEach(b => {
                b.classList.remove('btn-primary', 'active');
                b.classList.add('ghost');
            });
            if (botaoDiario) {
                botaoDiario.classList.remove('ghost');
                botaoDiario.classList.add('btn-primary', 'active');
                fetchRelatorio('diario');
            }
        }
    }
    
    // Adiciona o listener para inicializar o relatório quando a aba for aberta
    document.addEventListener('tabChange', (e) => {
        if (e.detail.tabName === 'relatorios') {
            initializeRelatorio();
        }
    });

    // Carrega o relatório diário se a aba for aberta por padrão
    initializeRelatorio();
});