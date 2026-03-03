const SB_URL = 'https://btzfjrpbzigqsifbmjnb.supabase.co'; 
const SB_KEY = 'sb_publishable_aOC-9tDq5jpRyZM3swEmSA_2anmUryO'; 
const _supabase = supabase.createClient(SB_URL, SB_KEY);

let usuarioLogado = null;
let carrinho = [];

// --- EFEITO PARTICULAS ---
if(typeof particlesJS !== 'undefined') {
    particlesJS("particles-js", { "particles": { "number": { "value": 60 }, "color": { "value": "#d4af37" }, "line_linked": { "color": "#d4af37" }, "move": { "speed": 1.5 } } });
}

// --- LOGIN ---
async function fazerLogin() {
    const user = document.getElementById('user').value;
    const pass = document.getElementById('pass').value;
    const { data, error } = await _supabase.from('usuarios').select('*').eq('login', user).eq('senha', pass).single();
    
    if (error || !data) return alert("Acesso Negado!");
    if (!data.ativo) return alert("Usuário Inativo!");

    usuarioLogado = data;
    document.getElementById('particles-js').style.display = 'none';
    document.getElementById('tela-login').style.display = 'none';
    document.getElementById('painel-admin').style.display = 'flex';
    document.getElementById('user-info').innerHTML = `Operador: <b>${data.login.toUpperCase()}</b> | Nível: ${data.nivel}`;
    
    aplicarPermissoesVisuais();
    mostrarAba('vendas');
}

// --- NAVEGAÇÃO ---
function mostrarAba(aba) {
    document.querySelectorAll('.aba').forEach(a => a.style.display = 'none');
    document.getElementById('aba-' + aba).style.display = 'block';
    if(aba === 'estoque') carregarEstoque();
    if(aba === 'historico') carregarHistorico();
    if(aba === 'usuarios') carregarUsuarios();
    if(aba === 'vendas') document.getElementById('venda-codigo').focus();
}

// --- PDV / VENDAS ---
async function adicionarAoCarrinho() {
    const cod = document.getElementById('venda-codigo').value;
    const qtd = parseInt(document.getElementById('venda-qtd').value) || 1;
    if(!cod) return;

    const { data: p } = await _supabase.from('produtos').select('*').eq('codigo_barras', cod).single();
    if(!p) return alert("Produto não cadastrado!");

    carrinho.push({ ...p, qtd_venda: qtd });
    renderCarrinho();
    document.getElementById('venda-codigo').value = "";
    document.getElementById('venda-codigo').focus();
}

function renderCarrinho() {
    const tbody = document.getElementById('corpo-carrinho');
    tbody.innerHTML = "";
    let total = 0;
    carrinho.forEach((item, i) => {
        const sub = item.preco * item.qtd_venda;
        total += sub;
        tbody.innerHTML += `
            <tr>
                <td>${item.tipo}</td>
                <td>${item.qtd_venda}</td>
                <td>R$ ${item.preco.toFixed(2)}</td>
                <td>R$ ${sub.toFixed(2)}</td>
                <td>
                    <button onclick="abrirModalEditarItem(${i})" style="background:none; font-size:1.2rem;">✏️</button>
                    <button onclick="removerItemCarrinho(${i})" style="background:none; font-size:1.2rem;">❌</button>
                </td>
            </tr>`;
    });
    document.getElementById('total-valor').innerText = `R$ ${total.toFixed(2).replace('.',',')}`;
}

// EDITAR ITEM NO CARRINHO
function abrirModalEditarItem(i) {
    document.getElementById('edit-carrinho-index').value = i;
    document.getElementById('edit-carrinho-nome').value = carrinho[i].tipo;
    document.getElementById('edit-carrinho-preco').value = carrinho[i].preco;
    document.getElementById('edit-carrinho-qtd').value = carrinho[i].qtd_venda;
    document.getElementById('modal-editar-item').style.display = 'flex';
}

function salvarEdicaoCarrinho() {
    const i = document.getElementById('edit-carrinho-index').value;
    carrinho[i].preco = parseFloat(document.getElementById('edit-carrinho-preco').value);
    carrinho[i].qtd_venda = parseInt(document.getElementById('edit-carrinho-qtd').value);
    fecharModalCarrinho();
    renderCarrinho();
}

function fecharModalCarrinho() { document.getElementById('modal-editar-item').style.display = 'none'; }

async function finalizarVenda() {
    if(carrinho.length === 0) return alert("Carrinho vazio!");
    
    let pgto = document.getElementById('venda-pagamento').value;
    if(pgto === "Cartão de Crédito") pgto += ` (${document.getElementById('venda-parcelas').value}x)`;

    const totalVenda = parseFloat(document.getElementById('total-valor').innerText.replace('R$ ','').replace(',','.'));

    const { error } = await _supabase.from('historico_vendas').insert([{
        loja_id: usuarioLogado.loja_id,
        cliente: document.getElementById('venda-cliente').value || "Consumidor Final",
        total: totalVenda,
        produtos: carrinho.map(c => `${c.qtd_venda}x ${c.tipo}`).join(", "),
        pagamento: pgto
    }]);

    if(!error) {
        imprimirCupom(pgto, document.getElementById('total-valor').innerText);
        carrinho = [];
        renderCarrinho();
        document.getElementById('venda-cliente').value = "";
        alert("Venda Finalizada!");
    } else {
        alert("Erro ao salvar: " + error.message);
    }
}

// CUPOM ZEBRA
function imprimirCupom(pgto, total) {
    const win = window.open('','','width=320');
    const itens = carrinho.map(i => `${i.qtd_venda}x ${i.tipo.substring(0,15)} R$ ${(i.preco*i.qtd_venda).toFixed(2)}`).join('<br>');
    win.document.write(`
        <html><body style="font-family:monospace; font-size:12px;">
        <center>============================<br><b>GESTÃO NOGUEIRA</b><br>============================</center><br>
        DATA: ${new Date().toLocaleString()}<br>PGTO: ${pgto}<br>
        ----------------------------<br>${itens}<br>----------------------------<br>
        <b>TOTAL: ${total}</b><br><br><center>Obrigada pela preferência!</center>
        <script>window.onload=function(){window.print();window.close();};</script></body></html>`);
    win.document.close();
}

// --- ESTOQUE ---
async function carregarEstoque() {
    const { data } = await _supabase.from('produtos').select('*').order('tipo');
    const tbody = document.getElementById('corpo-estoque');
    tbody.innerHTML = "";
    data?.forEach(p => {
        tbody.innerHTML += `<tr><td>${p.codigo_barras}</td><td>${p.tipo}</td><td>R$ ${p.preco.toFixed(2)}</td><td>${p.quantidade}</td>
        <td class="somente-gerente">
            <button onclick='prepararEdicaoProduto(${JSON.stringify(p)})'>✏️</button>
            <button onclick="excluirProduto(${p.id})">🗑️</button>
        </td></tr>`;
    });
}

async function salvarProduto() {
    const id = document.getElementById('edit-id-produto').value;
    const dados = {
        loja_id: usuarioLogado.loja_id,
        codigo_barras: document.getElementById('cad-codigo').value,
        tipo: document.getElementById('cad-tipo').value,
        preco: parseFloat(document.getElementById('cad-preco').value),
        quantidade: parseInt(document.getElementById('cad-qtd').value)
    };

    if(id) await _supabase.from('produtos').update(dados).eq('id', id);
    else await _supabase.from('produtos').insert([dados]);
    
    fecharModalProduto(); carregarEstoque();
}

// --- USUÁRIOS ---
async function carregarUsuarios() {
    const { data } = await _supabase.from('usuarios').select('*');
    const tbody = document.getElementById('corpo-usuarios');
    tbody.innerHTML = "";
    data?.forEach(u => {
        const status = u.ativo ? '<span style="color:#2ecc71">● Ativo</span>' : '<span style="color:#ff4d4d">● Inativo</span>';
        tbody.innerHTML += `<tr><td>${u.login}</td><td>${u.nivel}</td><td>${status}</td>
        <td><button onclick='prepararEdicaoUsuario(${JSON.stringify(u)})'>✏️</button>
        <button onclick="excluirUsuario(${u.id})">🗑️</button></td></tr>`;
    });
}

async function salvarUsuario() {
    const id = document.getElementById('edit-id-usuario').value;
    const dados = {
        loja_id: usuarioLogado.loja_id,
        login: document.getElementById('user-login').value,
        senha: document.getElementById('user-senha').value,
        nivel: document.getElementById('user-nivel').value,
        ativo: document.getElementById('user-status').value === "true"
    };
    if(id) await _supabase.from('usuarios').update(dados).eq('id', id);
    else await _supabase.from('usuarios').insert([dados]);
    fecharModalUsuario(); carregarUsuarios();
}

// --- HISTÓRICO ---
async function carregarHistorico() {
    const { data } = await _supabase.from('historico_vendas').select('*').order('created_at', {ascending: false});
    const tbody = document.getElementById('corpo-historico');
    tbody.innerHTML = "";
    data?.forEach(v => {
        tbody.innerHTML += `<tr><td>${new Date(v.created_at).toLocaleDateString()}</td><td>${v.cliente}</td><td>${v.produtos}</td><td>R$ ${v.total.toFixed(2)}</td><td>${v.pagamento}</td>
        <td><button onclick="excluirVenda(${v.id})" class="somente-gerente">🗑️</button></td></tr>`;
    });
}

// --- FUNÇÕES AUXILIARES ---
function aplicarPermissoesVisuais() {
    const isGerente = usuarioLogado.nivel === 'gerente';
    document.querySelectorAll('.somente-gerente').forEach(el => el.style.display = isGerente ? 'table-cell' : 'none');
    if(!isGerente) document.querySelectorAll('button.somente-gerente').forEach(el => el.style.display = 'none');
}

function atalhosTeclado(e) {
    if(e.key === "Enter" && document.activeElement.id === "venda-codigo") adicionarAoCarrinho();
    if(e.key === "F9") finalizarVenda();
}

function abrirModalProduto() { document.getElementById('edit-id-produto').value=""; document.getElementById('modal-produto').style.display='flex'; }
function abrirModalUsuario() { document.getElementById('edit-id-usuario').value=""; document.getElementById('modal-usuario').style.display='flex'; }
function fecharModalProduto() { document.getElementById('modal-produto').style.display='none'; }
function fecharModalUsuario() { document.getElementById('modal-usuario').style.display='none'; }
function removerItemCarrinho(i) { carrinho.splice(i,1); renderCarrinho(); }
function verificarParcelas() { document.getElementById('campo-parcelas').style.display = (document.getElementById('venda-pagamento').value === "Cartão de Crédito") ? "block" : "none"; }

function prepararEdicaoProduto(p) {
    document.getElementById('edit-id-produto').value = p.id;
    document.getElementById('cad-codigo').value = p.codigo_barras;
    document.getElementById('cad-tipo').value = p.tipo;
    document.getElementById('cad-preco').value = p.preco;
    document.getElementById('cad-qtd').value = p.quantidade;
    document.getElementById('modal-produto').style.display = 'flex';
}

function prepararEdicaoUsuario(u) {
    document.getElementById('edit-id-usuario').value = u.id;
    document.getElementById('user-login').value = u.login;
    document.getElementById('user-senha').value = u.senha;
    document.getElementById('user-nivel').value = u.nivel;
    document.getElementById('user-status').value = u.ativo.toString();
    document.getElementById('modal-usuario').style.display = 'flex';
}

function gerarPDF() { const { jsPDF } = window.jspdf; const doc = new jsPDF(); doc.text("Vendas Gestão Nogueira", 10, 10); doc.autoTable({ html: '#aba-historico table' }); doc.save("vendas.pdf"); }
function gerarExcel() { const wb = XLSX.utils.table_to_book(document.querySelector("#aba-historico table")); XLSX.writeFile(wb, "vendas.xlsx"); }
async function excluirVenda(id) { if(confirm("Excluir venda permanentemente?")) { await _supabase.from('historico_vendas').delete().eq('id', id); carregarHistorico(); } }
async function excluirUsuario(id) { if(confirm("Excluir usuário?")) { await _supabase.from('usuarios').delete().eq('id', id); carregarUsuarios(); } }
async function excluirProduto(id) { if(confirm("Excluir produto do estoque?")) { await _supabase.from('produtos').delete().eq('id', id); carregarEstoque(); } }
