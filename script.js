let data = { clients: [{ id: 1, name: 'João Silva', phone: '(11) 99999-8888', totalFiado: 350 }, { id: 2, name: 'Maria Oliveira', phone: '(11) 98888-7777', totalFiado: 120.5 }], sales: [{ id: 1, clientId: 1, product: 'Smartphone', value: 350, date: '2026-08-01', dueDate: '2026-08-31', status: 'pendente' }, { id: 2, clientId: 2, product: 'Fone', value: 120.5, date: '2026-07-20', dueDate: '2026-08-20', status: 'pago' }], settings: { storeName: 'Minha Loja', defaultDays: 30 } };
let nextId = 3;
let salesChart, paymentChart;

document.addEventListener('DOMContentLoaded', () => { loadData(); renderAll(); setupSidebar(); setupSearch(); setupModal(); setupFilter(); });

function setupSidebar() {
    document.querySelectorAll('.item').forEach(item => {
        item.addEventListener('click', function() {
            document.querySelectorAll('.item').forEach(m => m.classList.remove('active'));
            this.classList.add('active');
            document.querySelectorAll('.page-section').forEach(s => s.classList.remove('active'));
            document.getElementById(this.dataset.page).classList.add('active');
            if (window.innerWidth <= 992) { document.getElementById('sidebar').classList.remove('open'); }
        });
    });
    document.getElementById('menuToggle').addEventListener('click', () => { document.getElementById('sidebar').classList.toggle('open'); });
}

function setupSearch() {
    document.getElementById('searchInput').addEventListener('input', function(e) {
        const term = e.target.value.toLowerCase();
        document.querySelectorAll('#salesTableBody tr, #clientsTableBody tr, #allSalesTableBody tr').forEach(row => {
            row.style.display = row.textContent.toLowerCase().includes(term) ? '' : 'none';
        });
    });
}

function setupFilter() {
    document.getElementById('filterStatus').addEventListener('change', function() {
        document.querySelectorAll('#allSalesTableBody tr').forEach(row => {
            const status = row.querySelector('.status');
            row.style.display = (this.value === 'all' || (status && status.textContent.toLowerCase() === this.value)) ? '' : 'none';
        });
    });
}

function renderAll() { renderClients(); renderSales(); renderAllSales(); updateStats(); updateCharts(); updateBadges(); }

function renderClients() {
    const tbody = document.getElementById('clientsTableBody');
    tbody.innerHTML = '';
    data.clients.forEach(c => {
        tbody.innerHTML += `<tr><td><strong>${c.name}</strong></td><td>${c.phone}</td><td><strong>R$ ${c.totalFiado.toFixed(2)}</strong></td><td><span class="status ${c.totalFiado > 0 ? 'pendente' : 'pago'}">${c.totalFiado > 0 ? 'Devedor' : 'Quite'}</span></td>
        <td class="actions"><button class="edit" onclick="editClient(${c.id})"><i class="fas fa-edit"></i></button><button class="wpp" onclick="sendWpp('${c.phone}')"><i class="fab fa-whatsapp"></i></button><button class="del" onclick="deleteClient(${c.id})"><i class="fas fa-trash"></i></button></td></tr>`;
    });
}

function renderSales() {
    const tbody = document.getElementById('salesTableBody');
    tbody.innerHTML = '';
    data.sales.slice(-5).reverse().forEach(s => {
        const c = data.clients.find(cl => cl.id === s.clientId);
        tbody.innerHTML += `<tr><td><strong>${c ? c.name : 'Removido'}</strong></td><td>${s.product}</td><td><strong>R$ ${s.value.toFixed(2)}</strong></td><td>${formatDate(s.dueDate)}</td><td><span class="status ${s.status}">${s.status}</span></td>
        <td class="actions"><button class="edit" onclick="editSale(${s.id})"><i class="fas fa-edit"></i></button><button class="wpp" onclick="sendWpp('${c ? c.phone : ''}')"><i class="fab fa-whatsapp"></i></button><button class="del" onclick="deleteSale(${s.id})"><i class="fas fa-trash"></i></button></td></tr>`;
    });
}

function renderAllSales() {
    const tbody = document.getElementById('allSalesTableBody');
    tbody.innerHTML = '';
    data.sales.forEach(s => {
        const c = data.clients.find(cl => cl.id === s.clientId);
        tbody.innerHTML += `<tr><td><strong>${c ? c.name : 'Removido'}</strong></td><td>${s.product}</td><td><strong>R$ ${s.value.toFixed(2)}</strong></td><td>${formatDate(s.date)}</td><td>${formatDate(s.dueDate)}</td><td><span class="status ${s.status}">${s.status}</span></td>
        <td class="actions"><button class="edit" onclick="editSale(${s.id})"><i class="fas fa-edit"></i></button><button class="wpp" onclick="sendWpp('${c ? c.phone : ''}')"><i class="fab fa-whatsapp"></i></button><button class="del" onclick="deleteSale(${s.id})"><i class="fas fa-trash"></i></button></td></tr>`;
    });
}

function updateStats() {
    document.getElementById('totalRecebido').textContent = `R$ ${data.sales.filter(s => s.status === 'pago').reduce((s, v) => s + v.value, 0).toFixed(2)}`;
    document.getElementById('totalAReceber').textContent = `R$ ${data.sales.filter(s => s.status !== 'pago').reduce((s, v) => s + v.value, 0).toFixed(2)}`;
    document.getElementById('totalClientes').textContent = data.clients.length;
    document.getElementById('fiadosAtrasados').textContent = data.sales.filter(s => s.status === 'atrasado').length;
}

function updateCharts() {
    const months = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
    const vals = new Array(12).fill(0);
    data.sales.forEach(s => { const d = new Date(s.date+'T00:00:00'); if(d.getFullYear()===2026) vals[d.getMonth()] += s.value; });
    
    if(salesChart) salesChart.destroy();
    salesChart = new Chart(document.getElementById('salesChart'), { type: 'line', data: { labels: months.slice(0, new Date().getMonth()+1), datasets: [{ data: vals.slice(0, new Date().getMonth()+1), borderColor: '#3498db', tension: 0.4, fill: true }] }, options: { responsive: true, maintainAspectRatio: false } });

    if(paymentChart) paymentChart.destroy();
    const p = data.sales.reduce((acc, s) => { acc[s.status]++; return acc; }, {pago:0,pendente:0,atrasado:0});
    paymentChart = new Chart(document.getElementById('paymentChart'), { type: 'doughnut', data: { labels: ['Pago','Pendente','Atrasado'], datasets: [{ data: [p.pago, p.pendente, p.atrasado], backgroundColor: ['#27ae60','#f39c12','#e74c3c'] }] }, options: { responsive: true, maintainAspectRatio: false } });
}

function formatDate(d) { if(!d) return '-'; const dt = new Date(d+'T00:00:00'); return dt.toLocaleDateString('pt-BR'); }

function updateBadges() { document.getElementById('cBadge').textContent = data.clients.length; }

function openModal(type, item = null) {
    document.getElementById('modalOverlay').classList.add('active');
    document.getElementById('modalTitle').textContent = type === 'cliente' ? (item ? 'Editar' : 'Novo') + ' Cliente' : (item ? 'Editar' : 'Nova') + ' Venda';
    document.getElementById('editId').value = item ? item.id : '';
    
    if(type === 'cliente') {
        document.getElementById('clienteSelect').style.display = 'none';
        document.getElementById('newClientFields').style.display = 'block';
        document.getElementById('newClientName').value = item ? item.name : '';
        document.getElementById('newClientPhone').value = item ? item.phone : '';
    } else {
        document.getElementById('clienteSelect').style.display = 'block';
        document.getElementById('newClientFields').style.display = 'none';
        const sel = document.getElementById('clienteSelect');
        sel.innerHTML = '<option value="">Selecione</option>';
        data.clients.forEach(c => sel.innerHTML += `<option value="${c.id}">${c.name}</option>`);
        if(item) { sel.value = item.clientId; document.getElementById('produtoInput').value = item.product; document.getElementById('valorInput').value = item.value; document.getElementById('vencimentoInput').value = item.dueDate; document.getElementById('statusInput').value = item.status; }
    }
}

function closeModal() { document.getElementById('modalOverlay').classList.remove('active'); }

function toggleNewClient() {
    const f = document.getElementById('newClientFields');
    f.style.display = f.style.display === 'none' ? 'block' : 'none';
    document.getElementById('clienteSelect').style.display = f.style.display === 'block' ? 'none' : 'block';
}

function setupModal() {
    document.getElementById('modalForm').addEventListener('submit', function(e) {
        e.preventDefault();
        const id = document.getElementById('editId').value;
        const isClient = document.getElementById('clienteSelect').style.display === 'none';
        
        if(isClient) {
            const n = document.getElementById('newClientName').value.trim();
            const p = document.getElementById('newClientPhone').value.trim();
            if(!n||!p) return alert('Preencha nome e telefone');
            if(id) { const c = data.clients.find(cl=>cl.id===parseInt(id)); if(c){c.name=n;c.phone=p;} }
            else { data.clients.push({id:nextId++, name:n, phone:p, totalFiado:0}); }
        } else {
            const cId = parseInt(document.getElementById('clienteSelect').value);
            const prod = document.getElementById('produtoInput').value.trim();
            const val = parseFloat(document.getElementById('valorInput').value);
            const due = document.getElementById('vencimentoInput').value;
            const stat = document.getElementById('statusInput').value;
            if(!cId||!prod||!val||!due) return alert('Preencha todos os campos');
            
            if(id) { const s = data.sales.find(sl=>sl.id===parseInt(id)); if(s){const oldC=data.clients.find(c=>c.id===s.clientId); if(oldC&&s.status!=='pago') oldC.totalFiado-=s.value; const newC=data.clients.find(c=>c.id===cId); if(newC&&stat!=='pago') newC.totalFiado+=val; s.clientId=cId; s.product=prod; s.value=val; s.dueDate=due; s.status=stat;} }
            else { const newS = {id:nextId++, clientId:cId, product:prod, value:val, date:new Date().toISOString().split('T')[0], dueDate:due, status:stat}; data.sales.push(newS); const cl = data.clients.find(c=>c.id===cId); if(cl&&stat!=='pago') cl.totalFiado += val; }
        }
        saveData(); renderAll(); closeModal();
    });
}

function editClient(id) { const c = data.clients.find(cl=>cl.id===id); if(c) openModal('cliente', c); }
function editSale(id) { const s = data.sales.find(sl=>sl.id===id); if(s) openModal('venda', s); }

function deleteClient(id) { if(confirm('Excluir cliente?')) { data.clients = data.clients.filter(c=>c.id!==id); data.sales = data.sales.filter(s=>s.clientId!==id); saveData(); renderAll(); } }

function deleteSale(id) { if(confirm('Excluir venda?')) { const s = data.sales.find(sl=>sl.id===id); if(s){const c=data.clients.find(cl=>cl.id===s.clientId); if(c&&s.status!=='pago') c.totalFiado-=s.value;} data.sales = data.sales.filter(sl=>sl.id!==id); saveData(); renderAll(); } }

function sendWpp(p) { if(!p) return alert('Sem telefone'); const url = `https://wa.me/55${p.replace(/\D/g,'')}`; window.open(url, '_blank'); }

function saveSettings() { data.settings.storeName = document.getElementById('storeName').value; data.settings.defaultDays = parseInt(document.getElementById('defaultDays').value); saveData(); alert('Configurações salvas!'); }

function saveData() { try { localStorage.setItem('fiadoProData', JSON.stringify(data)); localStorage.setItem('fiadoProNextId', nextId.toString()); } catch(e){} }
function loadData() { try { const d = localStorage.getItem('fiadoProData'); if(d) { const p = JSON.parse(d); if(p.clients&&p.sales&&p.settings) data = p; } const n = localStorage.getItem('fiadoProNextId'); if(n) nextId = parseInt(n); else nextId = data.sales.length + data.clients.length + 1; document.getElementById('storeName').value = data.settings.storeName || 'Minha Loja'; document.getElementById('defaultDays').value = data.settings.defaultDays || 30; } catch(e){} }