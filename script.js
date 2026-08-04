document.addEventListener('DOMContentLoaded', function() {
    // Elementos
    const menuToggle = document.getElementById('menu-toggle');
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('overlay');
    const menuItems = document.querySelectorAll('#sidebar ul li');
    const tabs = document.querySelectorAll('.tab-content');
    const listaClientes = document.getElementById('lista-clientes');
    const modal = document.getElementById('modal-cadastro');
    const closeModal = document.querySelector('.close-modal');
    const formCliente = document.getElementById('form-cliente');
    const btnNovo = document.getElementById('btn-novo-cliente');
    const modalTitle = document.getElementById('modal-title');
    const clienteId = document.getElementById('cliente-id');
    
    // Estado
    let clientes = JSON.parse(localStorage.getItem('iptv_clientes')) || [];

    // --- MENU LATERAL ---
    function toggleMenu(open) {
        if (open) {
            sidebar.classList.add('open');
            overlay.classList.add('show');
        } else {
            sidebar.classList.remove('open');
            overlay.classList.remove('show');
        }
    }

    menuToggle.addEventListener('click', () => toggleMenu(!sidebar.classList.contains('open')));
    overlay.addEventListener('click', () => toggleMenu(false));

    // Navegação por abas
    menuItems.forEach(item => {
        item.addEventListener('click', function() {
            const tabId = this.dataset.tab;
            
            // Atualizar menu
            menuItems.forEach(i => i.classList.remove('active'));
            this.classList.add('active');
            
            // Atualizar conteúdo
            tabs.forEach(tab => tab.classList.remove('active'));
            document.getElementById(tabId).classList.add('active');
            
            // Fechar menu
            toggleMenu(false);
        });
    });

    // --- CRUD CLIENTES ---
    function renderClientes() {
        listaClientes.innerHTML = '';
        if (clientes.length === 0) {
            listaClientes.innerHTML = '<p style="text-align:center; color:#64748b; padding:20px;">Nenhum cliente cadastrado.</p>';
            return;
        }

        clientes.forEach((cliente, index) => {
            const card = document.createElement('div');
            card.className = 'client-card';
            card.innerHTML = `
                <div class="client-info">
                    <h3>${cliente.nome}</h3>
                    <p>📱 ${cliente.telefone}</p>
                    <p>📅 Vence: ${cliente.data_vencimento} | ${cliente.status}</p>
                </div>
                <div class="client-actions">
                    <button class="btn-icon btn-whatsapp" data-telefone="${cliente.telefone}" data-nome="${cliente.nome}">💬</button>
                    <button class="btn-icon btn-edit" data-index="${index}">✏️</button>
                </div>
            `;
            listaClientes.appendChild(card);
        });

        // Eventos dos botões
        document.querySelectorAll('.btn-whatsapp').forEach(btn => {
            btn.addEventListener('click', function() {
                const telefone = this.dataset.telefone;
                const nome = this.dataset.nome;
                // Remove caracteres não numéricos
                const numeroLimpo = telefone.replace(/\D/g, '');
                if (numeroLimpo.length >= 10) {
                    window.open(`https://wa.me/55${numeroLimpo}?text=Olá%20${encodeURIComponent(nome)}!`, '_blank');
                } else {
                    alert('Número de telefone inválido para WhatsApp.');
                }
            });
        });

        document.querySelectorAll('.btn-edit').forEach(btn => {
            btn.addEventListener('click', function() {
                const index = parseInt(this.dataset.index);
                abrirModalEditar(index);
            });
        });

        // Atualizar Dashboard
        atualizarDashboard();
    }

    function salvarClientes() {
        localStorage.setItem('iptv_clientes', JSON.stringify(clientes));
        renderClientes();
    }

    function abrirModalEditar(index = null) {
        modal.classList.add('show');
        if (index !== null) {
            modalTitle.textContent = 'Editar Cliente';
            const cliente = clientes[index];
            clienteId.value = index;
            document.getElementById('nome').value = cliente.nome;
            document.getElementById('telefone').value = cliente.telefone;
            document.getElementById('mac').value = cliente.mac;
            document.getElementById('data_vencimento').value = cliente.data_vencimento;
            document.querySelector(`input[name="status"][value="${cliente.status}"]`).checked = true;
        } else {
            modalTitle.textContent = 'Novo Cliente';
            clienteId.value = '';
            formCliente.reset();
            document.querySelector('input[name="status"][value="Ativo"]').checked = true;
        }
    }

    function fecharModal() {
        modal.classList.remove('show');
    }

    // Eventos do Modal
    closeModal.addEventListener('click', fecharModal);
    modal.addEventListener('click', function(e) {
        if (e.target === this) fecharModal();
    });

    btnNovo.addEventListener('click', () => abrirModalEditar(null));

    // Submissão do formulário
    formCliente.addEventListener('submit', function(e) {
        e.preventDefault();
        
        const nome = document.getElementById('nome').value.trim();
        const telefone = document.getElementById('telefone').value.trim();
        const mac = document.getElementById('mac').value.trim();
        const data_vencimento = document.getElementById('data_vencimento').value;
        const status = document.querySelector('input[name="status"]:checked').value;
        const id = clienteId.value;

        // Validação simples
        if (!nome || !telefone || !mac || !data_vencimento) {
            alert('Preencha todos os campos obrigatórios.');
            return;
        }

        const clienteData = { nome, telefone, mac, data_vencimento, status };

        if (id !== '') {
            // Editar
            clientes[parseInt(id)] = clienteData;
        } else {
            // Novo
            clientes.push(clienteData);
        }

        salvarClientes();
        fecharModal();
    });

    // --- DASHBOARD ---
    function atualizarDashboard() {
        const hoje = new Date().toISOString().split('T')[0];
        const total = clientes.length;
        const vencHoje = clientes.filter(c => c.data_vencimento === hoje).length;
        const inadimplentes = clientes.filter(c => c.status === 'Inativo').length; // Simplificação: inativos = inadimplentes

        document.getElementById('totalClientes').textContent = total;
        document.getElementById('vencimentosHoje').textContent = vencHoje;
        document.getElementById('inadimplentes').textContent = inadimplentes;
    }

    // --- TEMPLATES (Copiar) ---
    document.querySelectorAll('.btn-copy').forEach(btn => {
        btn.addEventListener('click', function() {
            const text = this.dataset.text;
            navigator.clipboard.writeText(text).then(() => {
                const originalText = this.textContent;
                this.textContent = 'Copiado!';
                setTimeout(() => this.textContent = originalText, 2000);
            }).catch(err => {
                alert('Erro ao copiar: ' + err);
            });
        });
    });

    // Inicialização
    renderClientes();
});