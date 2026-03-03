const SB_URL = 'https://btzfjrpbzigqsifbmjnb.supabase.co'; 
const SB_KEY = 'sb_publishable_aOC-9tDq5jpRyZM3swEmSA_2anmUryO'; 
const _supabase = supabase.createClient(SB_URL, SB_KEY);

// ID fixo da Loja para garantir o vínculo correto
const LOJA_ID_ATUAL = '8777a06a-e35f-4c3a-b94d-e8c155a1899f';

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
    const { data, error } = await _supabase.from('usuarios').select('*').eq('login', user).eq('senha', pass).eq('loja_id', LOJA_ID_ATUAL).single();
    
    if (error || !data) return alert("Acesso Negado!");
    if (!data.ativo) return alert("Usuário Inativo!");

    usuarioLogado = data;
    document.getElementById('particles-js').style.display = 'none';
    document.getElementById('tela-login').style.display = 'none';
    document.getElementById('painel-admin').style.display = 'flex';
    document.getElementById('user-info').innerText = `Operador: ${data.login.toUpperCase()}`;
    
    // Inicia monitor de presença
    atualizarPresenca(); 
    setInterval(atualizarPresenca, 30000); 
    
    aplicarPermissoesVisuais();
    mostrarAba('vendas');
}

// --- PRESENÇA ONLINE ---
async function atualizarPresenca() {
    if (usuarioLogado && usuarioLogado.id) {
        await _supabase
            .from('usuarios')
            .update({ ultima_atividade: new Date().toISOString() })
            .eq('id', usuarioLogado.id);
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

// --- VENDAS (COM BAIXA DE ESTOQUE) ---
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
        // 1. BAIXA DE ESTOQUE NO BANCO
        for (const item of carrinho) {
            const novaQtd = item.quantidade - item.qtd_venda;
            await _supabase.from('produtos').update({ quantidade: novaQtd }).eq('id', item.id);
        }

        // 2. REGISTRA A VENDA
        const { error } = await _supabase.from('historico_vendas').insert([{
            cliente: document.getElementById('venda-cliente').value || "Consumidor",
            total: parseFloat(totalT.replace('R$ ','').replace(',','.')),
            produtos: carrinho.map(c => c.qtd_venda + "x " + c.tipo).join(", "),
            pagamento: pgto,
            data_venda: new Date().toLocaleString('sv-SE'),
            loja_id: LOJA_ID_ATUAL 
        }]);

        if(!error) {
            alert("Venda Finalizada com sucesso!");
            carrinho = []; 
            renderCarrinho();
            document.getElementById('venda-cliente').value = "";
        } else { throw error; }
    } catch (e) { alert("Erro ao processar venda: " + e.message); }
}

// --- ESTOQUE ---
async function carregarEstoque() {
    const { data } = await _supabase.from('produtos').select('*').eq('loja_id', LOJA_ID_ATUAL).order('tipo');
    const tbody = document.getElementById('corpo-estoque');
    tbody.innerHTML = "";
    data?.forEach(p => {
        tbody.innerHTML += `<tr><td>${p.codigo_barras}</td><td>${p.tipo}</td><td>R$ ${p.preco.toFixed(2)}</td><td>${p.quantidade}</td>
        <td class="somente-gerente"><button onclick='prepararEdicaoProduto(${JSON.stringify(p)})'>✏️</button><button onclick="excluirProduto(${p.id})">🗑️</button></td></tr>`;
    });
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
    if(id) await _supabase.from('produtos').update(d).eq('id', id); 
    else await _supabase.from('produtos').insert([d]);
    fecharModalProduto(); carregarEstoque();
}

// --- HISTÓRICO COM ESTORNO AUTOMÁTICO ---
async function carregarHistorico() {
    const { data } = await _supabase.from('historico_vendas').select('*').eq('loja_id', LOJA_ID_ATUAL).order('data_venda', {ascending: false});
    const tbody = document.getElementById('corpo-historico');
    tbody.innerHTML = "";
    data?.forEach(v => {
        tbody.innerHTML += `<tr><td>${new Date(v.data_venda).toLocaleDateString()}</td><td>${v.cliente}</td><td>${v.produtos}</td><td>${v.pagamento}</td><td>R$ ${v.total.toFixed(2)}</td>
        <td><button class="somente-gerente" onclick="excluirVenda(${v.id})">🗑️</button></td></tr>`;
    });
}

async function excluirVenda(id) { 
    if(confirm("Deseja excluir esta venda e DEVOLVER os produtos ao estoque?")) { 
        try {
            // 1. Pega os dados da venda para saber o que estornar
            const { data: v } = await _supabase.from('historico_vendas').select('*').eq('id', id).single();
            
            if (v && v.produtos) {
                const itens = v.produtos.split(', ');
                for (const item of itens) {
                    const partes = item.split('x '); // Ex: ["2", "Camiseta"]
                    if (partes.length === 2) {
                        const qtd = parseInt(partes[0]);
                        const nome = partes[1].trim();
                        
                        // Busca o produto pelo nome para pegar a qtd atual
                        const { data: p } = await _supabase.from('produtos').select('id, quantidade').eq('tipo', nome).eq('loja_id', LOJA_ID_ATUAL).single();
                        
                        if (p) {
                            // Soma a quantidade de volta
                            await _supabase.from('produtos').update({ quantidade: p.quantidade + qtd }).eq('id', p.id);
                        }
                    }
                }
            }
            // 2. Exclui a venda do histórico
            await _supabase.from('historico_vendas').delete().eq('id', id); 
            carregarHistorico(); 
            alert("Venda removida e estoque atualizado!");
        } catch (e) { alert("Erro ao estornar: " + e.message); }
    } 
}

// --- OUTRAS FUNÇÕES ---
async function carregarUsuarios() {
    const { data } = await _supabase.from('usuarios').select('*').eq('loja_id', LOJA_ID_ATUAL).order('login');
    const tbody = document.getElementById('corpo-usuarios');
    tbody.innerHTML = data?.map(u => `<tr><td>${u.login}</td><td>${u.nivel}</td><td>${u.ativo?'Sim':'Não'}</td><td><button onclick="excluirUsuario(${u.id})">🗑️</button></td></tr>`).join('') || "";
}

function prepararEdicaoProduto(p) { 
    document.getElementById('edit-id-produto').value = p.id; 
    document.getElementById('cad-codigo').value = p.codigo_barras; 
    document.getElementById('cad-tipo').value = p.tipo; 
    document.getElementById('cad-preco').value = p.preco; 
    document.getElementById('cad-qtd').value = p.quantidade; 
    document.getElementById('modal-produto').style.display='flex'; 
}

function abrirModalProduto() { document.getElementById('edit-id-produto').value=""; document.getElementById('modal-produto').style.display='flex'; }
function fecharModalProduto() { document.getElementById('modal-produto').style.display='none'; }
function removerItemCarrinho(i) { carrinho.splice(i,1); renderCarrinho(); }
async function excluirProduto(id) { if(confirm("Excluir?")) { await _supabase.from('produtos').delete().eq('id', id); carregarEstoque(); } }
async function excluirUsuario(id) { if(confirm("Excluir?")) { await _supabase.from('usuarios').delete().eq('id', id); carregarUsuarios(); } }

window.onkeydown = (e) => { if(e.key === "F1") mostrarAba('vendas'); if(e.key === "F2") finalizarVenda(); };
