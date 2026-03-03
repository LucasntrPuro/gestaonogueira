const SB_URL = 'https://btzfjrpbzigqsifbmjnb.supabase.co'; 
const SB_KEY = 'sb_publishable_aOC-9tDq5jpRyZM3swEmSA_2anmUryO'; 
const _supabase = supabase.createClient(SB_URL, SB_KEY);

// ID fixo da Isadora Nogueira Store
const LOJA_ID_ATUAL = '8777a06a-e35f-4c3a-b94d-e8c155a1899f';

let usuarioLogado = null;
let carrinho = [];

// --- EFEITO PARTICULAS ---
if(typeof particlesJS !== 'undefined') {
    particlesJS("particles-js", { "particles": { "number": { "value": 60 }, "color": { "value": "#d4af37" }, "line_linked": { "color": "#d4af37" }, "move": { "speed": 1.5 } } });
}

// --- LOGIN E PRESENÇA ---
async function fazerLogin() {
    const user = document.getElementById('user').value;
    const pass = document.getElementById('pass').value;
    const { data, error } = await _supabase.from('usuarios').select('*').eq('login', user).eq('senha', pass).eq('loja_id', LOJA_ID_ATUAL).single();
    
    if (error || !data) return alert("Acesso Negado!");
    if (!data.ativo) return alert("Usuário Inativo!");

    usuarioLogado = data;
    document.getElementById('particles-js').style.display = 'none';
    document.getElementById('tela-login').style.display = 'none';
    document.getElementById('painel-admin').style.display = 'flex';
    document.getElementById('user-info').innerText = `Operador: ${data.login.toUpperCase()}`;
    
    atualizarPresenca(); 
    setInterval(atualizarPresenca, 30000); 
    
    aplicarPermissoesVisuais();
    mostrarAba('vendas');
}

async function atualizarPresenca() {
    if (usuarioLogado && usuarioLogado.id) {
        await _supabase.from('usuarios').update({ ultima_atividade: new Date().toISOString() }).eq('id', usuarioLogado.id);
    }
}

// --- NAVEGAÇÃO ---
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

// --- MODAIS (CORREÇÃO AQUI) ---
function abrirModalProduto() {
    document.getElementById('edit-id-produto').value = ""; // Indica novo
    document.getElementById('cad-codigo').value = "";
    document.getElementById('cad-tipo').value = "";
    document.getElementById('cad-preco').value = "";
    document.getElementById('cad-qtd').value = "";
    document.getElementById('modal-produto').style.display = 'flex';
}

function abrirModalUsuario() {
    document.getElementById('edit-id-usuario').value = ""; // Indica novo
    document.getElementById('user-login').value = "";
    document.getElementById('user-senha').value = "";
    document.getElementById('user-nivel').value = "vendedor";
    document.getElementById('user-status').value = "true";
    document.getElementById('modal-usuario').style.display = 'flex';
}

function fecharModalProduto() { document.getElementById('modal-produto').style.display = 'none'; }
function fecharModalUsuario() { document.getElementById('modal-usuario').style.display = 'none'; }

// --- ESTOQUE ---
async function carregarEstoque() {
    const { data } = await _supabase.from('produtos').select('*').eq('loja_id', LOJA_ID_ATUAL).order('tipo');
    const tbody = document.getElementById('corpo-estoque');
    tbody.innerHTML = data?.map(p => `
        <tr><td>${p.codigo_barras}</td><td>${p.tipo}</td><td>R$ ${p.preco.toFixed(2)}</td><td>${p.quantidade}</td>
        <td class="somente-gerente"><button onclick='prepararEdicaoProduto(${JSON.stringify(p)})'>✏️</button><button onclick="excluirProduto(${p.id})">🗑️</button></td></tr>`).join('') || "";
    aplicarPermissoesVisuais();
}

async function salvarProduto() {
    const id = document.getElementById('edit-id-produto').value;
    const d = { 
        codigo_barras: document.getElementById('cad-codigo').value, 
        tipo: document.getElementById('cad-tipo').value, 
        preco: parseFloat(document.getElementById('cad-preco').value), 
        quantidade: parseInt(document.getElementById('cad-qtd').value),
        loja_id: LOJA_ID_ATUAL 
    };
    if(id) await _supabase.from('produtos').update(d).eq('id', id).eq('loja_id', LOJA_ID_ATUAL); 
    else await _supabase.from('produtos').insert([d]);
    fecharModalProduto(); carregarEstoque();
}

function prepararEdicaoProduto(p) {
    document.getElementById('edit-id-produto').value = p.id;
    document.getElementById('cad-codigo').value = p.codigo_barras;
    document.getElementById('cad-tipo').value = p.tipo;
    document.getElementById('cad-preco').value = p.preco;
    document.getElementById('cad-qtd').value = p.quantidade;
    document.getElementById('modal-produto').style.display = 'flex';
}

// --- USUÁRIOS ---
async function carregarUsuarios() {
    const { data } = await _supabase.from('usuarios').select('*').eq('loja_id', LOJA_ID_ATUAL).order('login');
    const tbody = document.getElementById('corpo-usuarios');
    tbody.innerHTML = data?.map(u => `
        <tr><td>${u.login}</td><td>${u.nivel}</td><td><span style="color:${u.ativo?'#2ecc71':'#e74c3c'}">●</span> ${u.ativo?'Ativo':'Inativo'}</td>
        <td><button onclick='prepararEdicaoUsuario(${JSON.stringify(u)})'>✏️</button><button onclick="excluirUsuario(${u.id})">🗑️</button></td></tr>`).join('') || "";
}

async function salvarUsuario() {
    const id = document.getElementById('edit-id-usuario').value;
    const d = { 
        login: document.getElementById('user-login').value, 
        senha: document.getElementById('user-senha').value, 
        nivel: document.getElementById('user-nivel').value, 
        ativo: document.getElementById('user-status').value === "true",
        loja_id: LOJA_ID_ATUAL
    };
    if(id) await _supabase.from('usuarios').update(d).eq('id', id).eq('loja_id', LOJA_ID_ATUAL); 
    else await _supabase.from('usuarios').insert([d]);
    fecharModalUsuario(); carregarUsuarios();
}

function prepararEdicaoUsuario(u) {
    document.getElementById('edit-id-usuario').value = u.id;
    document.getElementById('user-login').value = u.login;
    document.getElementById('user-senha').value = u.senha;
    document.getElementById('user-nivel').value = u.nivel;
    document.getElementById('user-status').value = u.ativo.toString();
    document.getElementById('modal-usuario').style.display = 'flex';
}

// --- VENDAS COM BAIXA DE ESTOQUE ---
async function adicionarAoCarrinho() {
    const cod = document.getElementById('venda-codigo').value;
    const qtd = parseInt(document.getElementById('venda-qtd').value) || 1;
    const { data: p } = await _supabase.from('produtos').select('*').eq('codigo_barras', cod).eq('loja_id', LOJA_ID_ATUAL).single();
    if (!p) return alert("Produto não cadastrado!");
    if (p.quantidade < qtd) return alert("Estoque insuficiente! Disponível: " + p.quantidade);
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
        <td><button onclick="removerItemCarrinho(${i})">❌</button></td></tr>`;
    });
    document.getElementById('total-valor').innerText = `R$ ${t.toFixed(2).replace('.',',')}`;
}

async function finalizarVenda() {
    if(!carrinho.length) return alert("Carrinho vazio!");
    let pgto = document.getElementById('venda-pagamento').value;
    if(pgto === "Cartão de Crédito") pgto += " (" + document.getElementById('venda-parcelas').value + "x)";
    const totalT = document.getElementById('total-valor').innerText;

    try {
        for (const item of carrinho) {
            await _supabase.from('produtos').update({ quantidade: item.quantidade - item.qtd_venda }).eq('id', item.id);
        }
        await _supabase.from('historico_vendas').insert([{
            cliente: document.getElementById('venda-cliente').value || "Consumidor",
            total: parseFloat(totalT.replace('R$ ','').replace(',','.')),
            produtos: carrinho.map(c => c.qtd_venda + "x " + c.tipo).join(", "),
            pagamento: pgto,
            data_venda: new Date().toLocaleString('sv-SE'),
            loja_id: LOJA_ID_ATUAL 
        }]);
        alert("Venda Finalizada!");
        carrinho = []; renderCarrinho();
    } catch (e) { alert("Erro ao vender: " + e.message); }
}

// --- EXCLUSÕES COM ESTORNO ---
async function excluirVenda(id) { 
    if(confirm("Excluir esta venda e estornar produtos?")) { 
        try {
            const { data: v } = await _supabase.from('historico_vendas').select('*').eq('id', id).single();
            if (v && v.produtos) {
                const itens = v.produtos.split(', ');
                for (const item of itens) {
                    const partes = item.split('x ');
                    if (partes.length === 2) {
                        const qtd = parseInt(partes[0]);
                        const nome = partes[1].trim();
                        const { data: p } = await _supabase.from('produtos').select('id, quantidade').eq('tipo', nome).eq('loja_id', LOJA_ID_ATUAL).single();
                        if (p) await _supabase.from('produtos').update({ quantidade: p.quantidade + qtd }).eq('id', p.id);
                    }
                }
            }
            await _supabase.from('historico_vendas').delete().eq('id', id); carregarHistorico(); 
        } catch (e) { alert("Erro ao excluir: " + e.message); }
    } 
}

async function carregarHistorico() {
    const { data } = await _supabase.from('historico_vendas').select('*').eq('loja_id', LOJA_ID_ATUAL).order('data_venda', {ascending: false});
    document.getElementById('corpo-historico').innerHTML = data?.map(v => `
        <tr><td>${new Date(v.data_venda).toLocaleDateString()}</td><td>${v.cliente}</td><td>${v.produtos}</td><td>${v.pagamento}</td><td>R$ ${v.total.toFixed(2)}</td>
        <td><button class="somente-gerente" onclick="excluirVenda(${v.id})">🗑️</button></td></tr>`).join('') || "";
}

async function excluirProduto(id) { if(confirm("Excluir?")) { await _supabase.from('produtos').delete().eq('id', id); carregarEstoque(); } }
async function excluirUsuario(id) { if(confirm("Excluir?")) { await _supabase.from('usuarios').delete().eq('id', id); carregarUsuarios(); } }
function removerItemCarrinho(i) { carrinho.splice(i,1); renderCarrinho(); }
window.onkeydown = (e) => { if(e.key === "F1") mostrarAba('vendas'); if(e.key === "F2") finalizarVenda(); };
