// ========== UTILIDADES ==========
const { SQLite } = Capacitor;
const { LocalNotifications } = Capacitor;
const { BackgroundTask } = Capacitor;

let db;
let chartStatus, chartVenc;
let cfgEmpresa = { nome: '', contato: '', email: '', pix: '' };

// ========== INICIALIZAÇÃO ==========
window.onload = async () => {
  await initBanco();
  await carregarConfiguracoes();
  await renderizarDashboard();
  await renderizarPlanosSelect();
  await solicitarPermissoes();
  agendarVerificacaoDiaria();
};

// ========== BANCO DE DADOS ==========
async function initBanco() {
  db = await SQLite.createConnection({ database: 'iptv.db' });
  await db.execute(`CREATE TABLE IF NOT EXISTS configuracoes (id INTEGER PRIMARY KEY CHECK (id=1), nome_empresa TEXT, contato TEXT, email TEXT, chave_pix TEXT)`);
  await db.execute(`CREATE TABLE IF NOT EXISTS planos (id INTEGER PRIMARY KEY AUTOINCREMENT, nome TEXT, valor REAL, dias INTEGER)`);
  await db.execute(`CREATE TABLE IF NOT EXISTS templates (id INTEGER PRIMARY KEY AUTOINCREMENT, nome TEXT, mensagem TEXT)`);
  await db.execute(`CREATE TABLE IF NOT EXISTS clientes (id INTEGER PRIMARY KEY AUTOINCREMENT, nome TEXT, mac TEXT UNIQUE, plano TEXT, valor REAL, data_vencimento TEXT, status TEXT, observacao TEXT, data_cadastro TEXT DEFAULT CURRENT_DATE)`);
}

// ========== MENU E NAVEGAÇÃO ==========
function toggleMenu() {
  document.getElementById('sidebar').classList.toggle('open');
  document.getElementById('overlay').classList.toggle('active');
}
function showScreen(nome) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(`screen-${nome}`).classList.add('active');
  document.getElementById('page-title').textContent = {
    dashboard: 'Dashboard', clientes: 'Clientes', planos: 'Planos',
    templates: 'Templates', configuracoes: 'Configurações', backup: 'Backup'
  }[nome] || nome;
  toggleMenu();
  if (nome === 'dashboard') renderizarDashboard();
  if (nome === 'clientes') renderizarClientes();
  if (nome === 'planos') renderizarPlanos();
  if (nome === 'templates') renderizarTemplates();
}

// ========== STATUS DE VENCIMENTO ==========
function calcularStatus(dataVenc) {
  const hoje = new Date(); hoje.setHours(0,0,0,0);
  const dt = new Date(dataVenc); dt.setHours(0,0,0,0);
  const diff = Math.ceil((dt - hoje) / (1000*60*60*24));
  if (diff < 0) return 'Vencido';
  if (diff === 0) return 'Vencendo Hoje';
  return 'Ativo';
}

// ========== DASHBOARD ==========
async function renderizarDashboard() {
  const hoje = new Date().toISOString().split('T')[0];
  const clis = (await db.query('SELECT * FROM clientes')).values || [];
  
  let ativos = 0, vencHoje = 0, vencidos = 0, faturamento = 0;
  clis.forEach(c => {
    const s = calcularStatus(c.data_vencimento);
    if (s === 'Ativo') { ativos++; faturamento += c.valor; }
    if (s === 'Vencendo Hoje') vencHoje++;
    if (s === 'Vencido') vencidos++;
  });

  document.getElementById('qtd-ativos').textContent = ativos;
  document.getElementById('qtd-hoje').textContent = vencHoje;
  document.getElementById('qtd-vencidos').textContent = vencidos;
  document.getElementById('faturamento').textContent = `R$ ${faturamento.toFixed(2)}`;

  // Gráfico Status
  if (chartStatus) chartStatus.destroy();
  chartStatus = new Chart(document.getElementById('chartStatus'), {
    type: 'doughnut',
    data: { labels: ['Ativos', 'Vencendo Hoje', 'Vencidos'], datasets: [{ data: [ativos, vencHoje, vencidos], backgroundColor: ['#10b981','#f59e0b','#ef4444'] }] },
    options: { plugins: { legend: { labels: { color: '#e2e8f0' } } } }
  });

  // Gráfico últimos 7 dias
  const datas = [], qtds = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() + i);
    const ds = d.toISOString().split('T')[0];
    datas.push(d.toLocaleDateString('pt-BR'));
    qtds.push(clis.filter(c => c.data_vencimento === ds).length);
  }
  if (chartVenc) chartVenc.destroy();
  chartVenc = new Chart(document.getElementById('chartVenc'), {
    type: 'line',
    data: { labels: datas, datasets: [{ label: 'Vencimentos', data: qtds, borderColor: '#06b6d4', tension: 0.3, fill: true, backgroundColor: '#06b6d422' }] },
    options: { plugins: { legend: { labels: { color: '#e2e8f0' } } } },
    scales: { x: { ticks: { color: '#94a3b8' } }, y: { ticks: { color: '#94a3b8' } } }
  });

  // Últimos clientes
  const ultimos = clis.sort((a,b) => new Date(b.data_cadastro||0) - new Date(a.data_cadastro||0)).slice(0,5);
  document.getElementById('ultimos-clientes').innerHTML = ultimos.map(c => {
    const sts = calcularStatus(c.data_vencimento);
    const cls = sts === 'Ativo' ? 'ativo' : sts.startsWith('Vencendo') ? 'vencendo' : 'vencido';
    return `<tr><td>${c.nome}</td><td>${new Date(c.data_vencimento+'T00:00:00').toLocaleDateString('pt-BR')}</td><td><span class="badge ${cls}">${sts}</span></td></tr>`;
  }).join('');
}

// ========== CLIENTES ==========
async function renderizarClientes(filtro='todos', busca='') {
  let clis = (await db.query('SELECT * FROM clientes')).values || [];
  const hoje = new Date().toISOString().split('T')[0];

  clis = clis.map(c => ({...c, _statusCalc: calcularStatus(c.data_vencimento)}));
  if (filtro === 'ativos') clis = clis.filter(c => c._statusCalc === 'Ativo');
  if (filtro === 'hoje') clis = clis.filter(c => c._statusCalc === 'Vencendo Hoje');
  if (filtro === 'vencidos') clis = clis.filter(c => c._statusCalc === 'Vencido');
  if (busca) clis = clis.filter(c => c.nome.toLowerCase().includes(busca.toLowerCase()) || c.mac.includes(busca));

  document.getElementById('lista-clientes').innerHTML = clis.map(c => {
    const sts = c._statusCalc;
    const cls = sts === 'Ativo' ? 'ativo' : sts.startsWith('Vencendo') ? 'vencendo' : 'vencido';
    return `<tr>
      <td>${c.nome}</td><td>${c.mac}</td><td>${c.plano}</td><td>R$ ${Number(c.valor).toFixed(2)}</td>
      <td>${new Date(c.data_vencimento+'T00:00:00').toLocaleDateString('pt-BR')}</td>
      <td><span class="badge ${cls}">${sts}</span></td>
      <td>
        <button class="btn-sm" title="Enviar WhatsApp" onclick="enviarWhatsApp('${c.nome}','${c.data_vencimento}','${Number(c.valor).toFixed(2)}')">💬</button>
        <button class="btn-sm primary" onclick="editarCliente(${c.id})">✏️</button>
        <button class="btn-sm danger" onclick="excluirCliente(${c.id})">🗑️</button>
      </td>
    </tr>`;
  }).join('');
}
function filtrarClientes() {
  renderizarClientes(document.getElementById('filtro-status').value, document.getElementById('busca-cliente').value);
}

function abrirModalCliente(){ document.getElementById('modal-cliente').classList.add('open'); document.getElementById('modal-cliente-titulo').textContent='Adicionar Cliente'; document.getElementById('cli-id').value=''; document.getElementById('cli-nome').value=''; document.getElementById('cli-mac').value=''; document.getElementById('cli-valor').value=''; document.getElementById('cli-vencimento').value=''; document.getElementById('cli-obs').value=''; document.getElementById('cli-status').value='Ativo'; renderizarPlanosSelect(); }
function fecharModalCliente(){ document.getElementById('modal-cliente').classList.remove('open'); }
async function renderizarPlanosSelect(){
  const ps = (await db.query('SELECT * FROM planos')).values || [];
  const sel = document.getElementById('cli-plano');
  sel.innerHTML = ps.map(p=>`<option value="${p.nome}" data-valor="${p.valor}">${p.nome} - R$ ${Number(p.valor).toFixed(2)}</option>`).join('');
  sel.onchange = ()=>{ const opt = sel.selectedOptions[0]; if(opt) document.getElementById('cli-valor').value = opt.dataset.valor; };
  sel.onchange();
}
async function salvarCliente(){
  const id = document.getElementById('cli-id').value;
  const nome = document.getElementById('cli-nome').value.trim();
  const mac = document.getElementById('cli-mac').value.trim().toUpperCase();
  const plano = document.getElementById('cli-plano').value;
  const valor = document.getElementById('cli-valor').value;
  const data_vencimento = document.getElementById('cli-vencimento').value;
  const status = document.getElementById('cli-status').value;
  const obs = document.getElementById('cli-obs').value.trim();
  if(!/^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/.test(mac)) return alert('MAC inválido! Use formato XX:XX:XX:XX:XX:XX');
  if(id) await db.execute('UPDATE clientes SET nome=?, mac=?, plano=?, valor=?, data_vencimento=?, status=?, observacao=? WHERE id=?', [nome,mac,plano,valor,data_vencimento,status,obs,Number(id)]);
  else await db.execute('INSERT INTO clientes (nome,mac,plano,valor,data_vencimento,status,observacao) VALUES (?,?,?,?,?,?,?)', [nome,mac,plano,valor,data_vencimento,status,obs]);
  fecharModalCliente(); renderizarClientes();
}
async function editarCliente(id){
  const c = (await db.query('SELECT * FROM clientes WHERE id=?',[id])).values?.[0];
  if(!c) return;
  document.getElementById('modal-cliente-titulo').textContent='Editar Cliente';
  document.getElementById('cli-id').value=c.id;
  document.getElementById('cli-nome').value=c.nome;
  document.getElementById('cli-mac').value=c.mac;
  await renderizarPlanosSelect(); document.getElementById('cli-plano').value=c.plano;
  document.getElementById('cli-valor').value=c.valor;
  document.getElementById('cli-vencimento').value=c.data_vencimento;
  document.getElementById('cli-status').value=c.status;
  document.getElementById('cli-obs').value=c.observacao||'';
  document.getElementById('modal-cliente').classList.add('open');
}
async function excluirCliente(id){ if(confirm('Excluir cliente?')){ await db.execute('DELETE FROM clientes WHERE id=?',[id]); renderizarClientes(); } }

// ========== WHATSAPP ==========
function enviarWhatsApp(nome, data, valor){
  const dt = new Date(data+'T00:00:00').toLocaleDateString('pt-BR');
  const msg = encodeURIComponent(`Olá ${nome}! Tudo bem? 📆 Seu plano IPTV vence em ${dt}. Valor: R$ ${valor}. Favor realizar pagamento. — ${cfgEmpresa.nome||'Empresa'}`);
  window.open(`https://wa.me/${cfgEmpresa.contato?.replace(/\D/g,'')||''}?text=${msg}`, '_system');
}

// ========== PLANOS ==========
async function renderizarPlanos(){
  const ps = (await db.query('SELECT * FROM planos ORDER BY nome')).values||[];
  document.getElementById('lista-planos').innerHTML = ps.map(p=>`<tr><td>${p.nome}</td><td>R$ ${Number(p.valor).toFixed(2)}</td><td>${p.dias} dias</td><td><button class="btn-sm danger" onclick="excluirPlano(${p.id})">🗑️</button></td></tr>`).join('');
}
function abrirModalPlano(){ document.getElementById('modal-plano').classList.add('open'); document.getElementById('plano-id').value=''; document.getElementById('plano-nome').value=''; document.getElementById('plano-valor').value=''; document.getElementById('plano-dias').value=''; }
function fecharModalPlano(){ document.getElementById('modal-plano').classList.remove('open'); }
async function salvarPlano(){
  const id = document.getElementById('plano-id').value;
  const nome = document.getElementById('plano-nome').value.trim();
  const valor = document.getElementById('plano-valor').value;
  const dias = document.getElementById('plano-dias').value;
  if(id) await db.execute('UPDATE planos SET nome=?, valor=?, dias=? WHERE id=?',[nome,valor,dias,Number(id)]);
  else await db.execute('INSERT INTO planos (nome,valor,dias) VALUES (?,?,?)',[nome,valor,dias]);
  fecharModalPlano(); renderizarPlanos();
}
async function excluirPlano(id){ if(confirm('Excluir plano?')){ await db.execute('DELETE FROM planos WHERE id=?',[id]); renderizarPlanos(); } }

// ========== TEMPLATES ==========
async function renderizarTemplates(){
  const ts = (await db.query('SELECT * FROM templates')).values||[];
  document.getElementById('lista-templates').innerHTML = ts.map(t=>`<tr><td>${t.nome}</td><td style="max-width:400px;overflow:hidden;font-size:13px;">${t.mensagem}</td><td><button class="btn-sm danger" onclick="excluirTemplate(${t.id})">🗑️</button></td></tr>`).join('');
}
function abrirModalTemplate(){ document.getElementById('modal-template').classList.add('open'); document.getElementById('tpl-nome').value=''; document.getElementById('tpl-mensagem').value='Olá {nome}, seu plano IPTV vence em {data}. Valor: {valor}. Renove com {empresa}!'; }
function fecharModalTemplate(){ document.getElementById('modal-template').classList.remove('open'); }
async function salvarTemplate(){
  const nome = document.getElementById('tpl-nome').value.trim();
  const mensagem = document.getElementById('tpl-mensagem').value.trim();
  await db.execute('INSERT INTO templates (nome,mensagem) VALUES (?,?)',[nome,mensagem]);
  fecharModalTemplate(); renderizarTemplates();
}
async function excluirTemplate(id){ if(confirm('Excluir template?')){ await db.execute('DELETE FROM templates WHERE id=?',[id]); renderizarTemplates(); } }

// ========== CONFIGURAÇÕES ==========
async function carregarConfiguracoes(){
  const r = (await db.query('SELECT * FROM configuracoes WHERE id=1')).values?.[0];
  if(r){
    cfgEmpresa = { nome:r.nome_empresa||'', contato:r.contato||'', email:r.email||'', pix:r.chave_pix||'' };
    document.getElementById('cfg-nome').value = cfgEmpresa.nome;
    document.getElementById('cfg-contato').value = cfgEmpresa.contato;
    document.getElementById('cfg-email').value = cfgEmpresa.email;
    document.getElementById('cfg-pix').value = cfgEmpresa.pix;
  }
}
async function salvarConfiguracoes(){
  cfgEmpresa.nome = document.getElementById('cfg-nome').value.trim();
  cfgEmpresa.contato = document.getElementById('cfg-contato').value.trim();
  cfgEmpresa.email = document.getElementById('cfg-email').value.trim();
  cfgEmpresa.pix = document.getElementById('cfg-pix').value.trim();
  await db.execute('REPLACE INTO configuracoes (id,nome_empresa,contato,email,chave_pix) VALUES (1,?,?,?,?)', [1,cfgEmpresa.nome,cfgEmpresa.contato,cfgEmpresa.email,cfgEmpresa.pix]);
  alert('Salvo!');
}

// ========== BACKUP ==========
async function exportarBackup(){
  const dados = {
    exportadoEm: new Date().toISOString(),
    configuracoes: cfgEmpresa,
    clientes: (await db.query('SELECT * FROM clientes')).values||[],
    planos: (await db.query('SELECT * FROM planos')).values||[],
    templates: (await db.query('SELECT * FROM templates')).values||[]
  };
  const blob = new Blob([JSON.stringify(dados,null,2)],{type:'application/json'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `backup-iptv-${new Date().toISOString().slice(0,10)}.json`;
  a.click();
}
async function importarBackup(e){
  const f = e.target.files?.[0]; if(!f) return;
  const texto = await f.text();
  try {
    const d = JSON.parse(texto);
    if(d.configuracoes) await db.execute('REPLACE INTO configuracoes (id,nome_empresa,contato,email,chave_pix) VALUES (1,?,?,?,?)', [1,d.configuracoes.nome,d.configuracoes.contato,d.configuracoes.email,d.configuracoes.pix]);
    if(d.planos) for(const p of d.planos) await db.execute('INSERT OR IGNORE INTO planos (nome,valor,dias) VALUES (?,?,?)',[p.nome,p.valor,p.dias]);
    if(d.templates) for(const t of d.templates) await db.execute('INSERT OR IGNORE INTO templates (nome,mensagem) VALUES (?,?)',[t.nome,t.mensagem]);
    if(d.clientes) for(const c of d.clientes) await db.execute('INSERT OR IGNORE INTO clientes (nome,mac,plano,valor,data_vencimento,status,observacao,data_cadastro) VALUES (?,?,?,?,?,?,?,?)',[c.nome,c.mac,c.plano,c.valor,c.data_vencimento,c.status,c.observacao,c.data_cadastro]);
    alert('Importado com sucesso!');
    location.reload();
  }catch(err){ alert('Arquivo inválido!'); }
}

// ========== NOTIFICAÇÕES ==========
async function solicitarPermissoes(){
  await LocalNotifications.requestPermissions();
}
async function verificarVencimentosEEnviar(){
  const hoje = new Date().toISOString().split('T')[0];
  const clis = (await db.query('SELECT * FROM clientes WHERE data_vencimento = ?',[hoje])).values||[];
  if(clis.length === 0) return 0;
  await LocalNotifications.schedule({ notifications: [{
    title: '📆 Lembrete IPTV',
    body: `Hoje você tem ${clis.length} cliente(s) vencendo! Acesse o app e veja.`,
    id: 1,
    sound: 'notification.mp3',
    actionTypeId: 'OPEN_CLIENTES'
  }]});
  return clis.length;
}
async function dispararNotificacao(){
  await verificarVencimentosEEnviar();
  alert('Verificação executada! Notificação enviada se houver vencimentos hoje.');
}
async function agendarVerificacaoDiaria(){
  BackgroundTask.register({
    taskName: 'verificar-vencimentos',
    onRun: async () => {
      await verificarVencimentosEEnviar();
      BackgroundTask.finish({ taskName: 'verificar-vencimentos' });
    }
  });
  // Agenda diariamente às 08:00
  await LocalNotifications.schedule({
    notifications: [{
      title: '', body: '', id: 0,
      schedule: { on: { hour:8, minute:0 }, repeats: true, allowWhileIdle: true }
    }]
  });
}

// Clique na notificação → abre filtro vencendo hoje
LocalNotifications.addListener('localNotificationActionPerformed', ()=>{
  showScreen('clientes');
  document.getElementById('filtro-status').value = 'hoje';
  renderizarClientes('hoje');
});