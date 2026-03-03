const SB_URL = 'https://btzfjrpbzigqsifbmjnb.supabase.co'; 
const SB_KEY = 'sb_publishable_aOC-9tDq5jpRyZM3swEmSA_2anmUryO'; 
const _supabase = supabase.createClient(SB_URL, SB_KEY);

const LOJA_ID_ATUAL = '8777a06a-e35f-4c3a-b94d-e8c155a1899f';

let usuarioLogado = null;
let carrinho = [];

// --- EFEITO PARTICULAS ---
if(typeof particlesJS !== 'undefined') {
    particlesJS("particles-js", { "particles": { "number": { "value": 60 }, "color": { "value": "#d4af37" }, "line_linked": { "color": "#d4af37" }, "move": { "speed": 1.5 } } });
}

// --- MONITOR DE PRESENÇA (CORRIGIDO) ---
async function atualizarPresenca() {
    if (usuarioLogado && usuarioLogado.id) {
        try {
            await _supabase
                .from('usuarios')
                .update({ ultima_atividade: new Date().toISOString() })
                .eq('id', usuarioLogado.id);
        } catch (e) {
            console.log("Erro ao atualizar presença:", e);
        }
    }
}

// --- LOGIN ---
async function fazerLogin() {
    const user = document.getElementById('user').value;
    const pass = document.getElementById('pass').value;
    const { data, error } = await _supabase.from('usuarios').select('*').eq('login', user).eq('senha', pass).eq('loja_id', LOJA_ID_ATUAL).single();
    
    if (error || !data) return alert("Acesso Negado!");
    if (!data.ativo) return alert("Usuário Inativo!");

    usuarioLogado = data;
    
    // ATIVA O MONITOR IMEDIATAMENTE APÓS LOGIN
    atualizarPresenca(); 
    setInterval(atualizarPresenca, 30000); 

    document.getElementById('particles-js').style.display = 'none';
    document.getElementById('tela-login').style.display = 'none';
    document.getElementById('painel-admin').style.display = 'flex';
    document.getElementById('user-info').innerText = `Operador: ${data.login.toUpperCase()}`;
    aplicarPermissoesVisuais();
    mostrarAba('vendas');
}

function mostrarAba(aba) {
    document.querySelectorAll('.aba').forEach(a => a.style.display = 'none');
    document.getElementById('aba-' + aba).style.display = 'block';
    if(aba === 'vendas') document.getElementById('venda-codigo').focus();
    if(aba === 'estoque') carregarEstoque();
    if(aba === 'historico') carregarHistorico();
    if(aba === 'usuarios') carregarUsuarios();
}

function aplicarPermissoesVisuais() {
    const isG = usuarioLogado.nivel === 'gerente';
    document.querySelectorAll('.somente-gerente').forEach(el => el.style.display = isG ? 'block' : 'none');
}

// --- VENDAS ---
async function adicionarAoCarrinho() {
    const cod = document.getElementById('venda-codigo').value;
    const qtd = parseInt(document.getElementById('venda-qtd').value) || 1;
    const { data: p } = await _supabase.from('produtos').select('*').eq('codigo_barras', cod).eq('loja_id', LOJA_ID_ATUAL).single();
    if (!p) return alert("Produto não cadastrado nesta loja!");
    
    carrinho.push({ ...p, qtd_venda: qtd });
    renderCarrinho();
    document.getElementById('venda-codigo').value = "";
    document.getElementById('venda-codigo').focus();
}

function renderCarrinho() {
    const tbody = document.getElementById('corpo-carrinho');
    tbody.innerHTML = "";
    let t = 0;
    carrinho.forEach((item, i) => {
        const sub = item.preco * item.qtd_venda;
        t += sub;
        tbody.innerHTML += `<tr><td>${item.tipo}</td><td>${item.qtd_venda}</td><td>R$ ${item.preco.toFixed(2)}</td><td>R$ ${sub.toFixed(2)}</td>
        <td><button onclick="abrirModalEditarItem(${i})">✏️</button><button onclick="removerItemCarrinho(${i})">❌</button></td></tr>`;
    });
    document.getElementById('total-valor').innerText = `R$ ${t.toFixed(2).replace('.',',')}`;
}

async function finalizarVenda() {
    if(!carrinho.length) return alert("Carrinho vazio!");
    let pgto = document.getElementById('venda-pagamento').value;
    if(pgto === "Cartão de Crédito") pgto += ` (${document.getElementById('venda-parcelas').value}x)`;
    const totalT = document.getElementById('total-valor').innerText;

    const { error } = await _supabase.from('historico_vendas').insert([{
        cliente: document.getElementById('venda-cliente').value || "Consumidor",
        total: parseFloat(totalT.replace('R$ ','').replace(',','.')),
        produtos: carrinho.map(c => `${c.qtd_venda}x ${c.tipo}`).join(", "),
        pagamento: pgto,
        data_venda: new Date().toLocaleString('sv-SE'),
        loja_id: LOJA_ID_ATUAL 
    }]);

    if(!error) {
        if(confirm("Imprimir cupom?")) imprimirCupom(pgto, totalT);
        carrinho = []; renderCarrinho();
        document.getElementById('venda-cliente').value = "";
    } else {
        alert("Erro ao salvar venda: " + error.message);
    }
}

// --- IMPRESSÃO ---
function imprimirCupom(pgto, total) {
    const win = window.open('','','width=320,height=600');
    const agora = new Date().toLocaleString('pt-BR');
    const cliente = document.getElementById('venda-cliente').value || "Consumidor";
    
    win.document.write(`
        <html><body style="font-family:'Courier New',monospace; width:280px; padding:5px; font-size:12px;">
        <center>============================<br><b>ISADORA NOGUEIRA STORE</b><br>============================</center><br>
        DATA: ${agora}<br>CLIENTE: ${cliente.toUpperCase()}<br>PGTO: ${pgto}<br>
        ----------------------------<br>
        ${carrinho.map(i => `${i.qtd_venda}x ${i.tipo.substring(0,15)}... R$ ${(i.preco*i.qtd_venda).toFixed(2)}`).join('<br>')}
        <br>----------------------------<br>
        <b>TOTAL GERAL: ${total}</b><br><br>
        <center>Obrigado pela preferência!</center>
        <script>window.onload=function(){window.print();window.close();};</script></body></html>
    `);
    win.document.close();
}

// --- ESTOQUE E USUÁRIOS ---
async function carregarEstoque() {
    const { data } = await _supabase.from('produtos').select('*').eq('loja_id', LOJA_ID_ATUAL).order('tipo');
    const tbody = document.getElementById('corpo-estoque');
    tbody.innerHTML = "";
    data?.forEach(p => {
        tbody.innerHTML += `<tr><td>${p.codigo_barras}</td><td>${p.tipo}</td><td>R$ ${p.preco.toFixed(2)}</td><td>${p.quantidade}</td>
        <td class="somente-gerente"><button onclick='prepararEdicaoProduto(${JSON.stringify(p)})'>✏️</button><button onclick="excluirProduto(${p.id})">🗑️</button></td></tr>`;
    });
}

async function carregarUsuarios() {
    const { data } = await _supabase.from('usuarios').select('*').eq('loja_id', LOJA_ID_ATUAL).order('login');
    const tbody = document.getElementById('corpo-usuarios');
    tbody.innerHTML = "";
    data?.forEach(u => {
        const cor = u.ativo ? '#2ecc71' : '#e74c3c';
        tbody.innerHTML += `<tr><td>${u.login}</td><td>${u.nivel}</td><td><span style="color:${cor}">●</span> ${u.ativo?'Ativo':'Inativo'}</td>
        <td><button onclick='prepararEdicaoUsuario(${JSON.stringify(u)})'>✏️</button><button onclick="excluirUsuario(${u.id})">🗑️</button></td></tr>`;
    });
}

// --- AUXILIARES E ATALHOS ---
function removerItemCarrinho(i) { carrinho.splice(i,1); renderCarrinho(); }
function atalhosTeclado(e) { if(e.key === "F1") mostrarAba('vendas'); if(e.key === "F2") finalizarVenda(); }
window.onkeydown = atalhosTeclado;
