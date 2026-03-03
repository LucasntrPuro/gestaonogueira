const SB_URL = 'https://btzfjrpbzigqsifbmjnb.supabase.co'; 
const SB_KEY = 'sb_publishable_aOC-9tDq5jpRyZM3swEmSA_2anmUryO'; 
const _supabase = supabase.createClient(SB_URL, SB_KEY);

// ID fixo da Isadora Nogueira Store
const LOJA_ID_ATUAL = '8777a06a-e35f-4c3a-b94d-e8c155a1899f';

let usuarioLogado = null;
let carrinho = [];

// --- LOGIN E PRESENÇA ---
async function fazerLogin() {
    const user = document.getElementById('user').value;
    const pass = document.getElementById('pass').value;
    const { data, error } = await _supabase.from('usuarios').select('*').eq('login', user).eq('senha', pass).eq('loja_id', LOJA_ID_ATUAL).single();
    
    if (error || !data) return alert("Acesso Negado!");
    if (!data.ativo) return alert("Usuário Inativo!");

    usuarioLogado = data;
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

// --- ESTOQUE (PRODUTOS) ---
async function carregarEstoque() {
    const { data, error } = await _supabase
        .from('produtos')
        .select('*')
        .eq('loja_id', LOJA_ID_ATUAL)
        .order('tipo');

    const tbody = document.getElementById('corpo-estoque');
    tbody.innerHTML = data?.map(p => `
        <tr>
            <td>${p.codigo_barras}</td>
            <td>${p.tipo}</td>
            <td>R$ ${p.preco.toFixed(2)}</td>
            <td>${p.quantidade}</td>
            <td class="somente-gerente">
                <button onclick='prepararEdicaoProduto(${JSON.stringify(p)})'>✏️</button>
                <button onclick="excluirProduto(${p.id})">🗑️</button>
            </td>
        </tr>`).join('') || "";
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

    if(!d.tipo || isNaN(d.preco)) return alert("Preencha os campos obrigatórios!");

    try {
        if(id) {
            await _supabase.from('produtos').update(d).eq('id', id).eq('loja_id', LOJA_ID_ATUAL);
        } else {
            await _supabase.from('produtos').insert([d]);
        }
        alert("Produto salvo!");
        fecharModalProduto();
        carregarEstoque(); // Atualiza a lista na hora
    } catch (e) { alert("Erro ao salvar: " + e.message); }
}

// --- VENDAS COM BAIXA DE ESTOQUE ---
async function adicionarAoCarrinho() {
    const cod = document.getElementById('venda-codigo').value;
    const qtd = parseInt(document.getElementById('venda-qtd').value) || 1;
    const { data: p } = await _supabase.from('produtos').select('*').eq('codigo_barras', cod).eq('loja_id', LOJA_ID_ATUAL).single();
    
    if (!p) return alert("Produto não encontrado!");
    if (p.quantidade < qtd) return alert("Estoque insuficiente!");
    
    carrinho.push({ ...p, qtd_venda: qtd });
    renderCarrinho();
    document.getElementById('venda-codigo').value = "";
}

async function finalizarVenda() {
    if(!carrinho.length) return alert("Carrinho vazio!");
    const pgto = document.getElementById('venda-pagamento').value;
    const totalT = document.getElementById('total-valor').innerText;

    try {
        // Baixa de estoque automática
        for (const item of carrinho) {
            await _supabase.from('produtos').update({ quantidade: item.quantidade - item.qtd_venda }).eq('id', item.id);
        }

        await _supabase.from('historico_vendas').insert([{
            cliente: document.getElementById('venda-cliente').value || "Consumidor",
            total: parseFloat(totalT.replace('R$ ','').replace(',','.')),
            produtos: carrinho.map(c => `${c.qtd_venda}x ${c.tipo}`).join(", "),
            pagamento: pgto,
            data_venda: new Date().toLocaleString('sv-SE'),
            loja_id: LOJA_ID_ATUAL 
        }]);

        alert("Venda Finalizada!");
        carrinho = []; renderCarrinho();
    } catch (e) { alert("Erro ao vender: " + e.message); }
}

// --- ESTORNO DE ESTOQUE ---
async function excluirVenda(id) { 
    if(confirm("Deseja excluir a venda e DEVOLVER os produtos ao estoque?")) { 
        try {
            const { data: v } = await _supabase.from('historico_vendas').select('*').eq('id', id).single();
            if (v && v.produtos) {
                const itens = v.produtos.split(', ');
                for (const item of itens) {
                    const partes = item.split('x ');
                    const qtd = parseInt(partes[0]);
                    const nome = partes[1].trim();
                    const { data: p } = await _supabase.from('produtos').select('id, quantidade').eq('tipo', nome).eq('loja_id', LOJA_ID_ATUAL).single();
                    if (p) await _supabase.from('produtos').update({ quantidade: p.quantidade + qtd }).eq('id', p.id);
                }
            }
            await _supabase.from('historico_vendas').delete().eq('id', id).eq('loja_id', LOJA_ID_ATUAL); 
            carregarHistorico(); 
            alert("Venda excluída e stock atualizado!");
        } catch (e) { alert("Erro ao excluir: " + e.message); }
    } 
}

// --- AUXILIARES ---
function abrirModalProduto() { 
    document.getElementById('edit-id-produto').value = ""; 
    document.getElementById('modal-produto').style.display = 'flex'; 
}
function fecharModalProduto() { document.getElementById('modal-produto').style.display = 'none'; }
function prepararEdicaoProduto(p) {
    document.getElementById('edit-id-produto').value = p.id;
    document.getElementById('cad-codigo').value = p.codigo_barras;
    document.getElementById('cad-tipo').value = p.tipo;
    document.getElementById('cad-preco').value = p.preco;
    document.getElementById('cad-qtd').value = p.quantidade;
    document.getElementById('modal-produto').style.display = 'flex';
}
function removerItemCarrinho(i) { carrinho.splice(i,1); renderCarrinho(); }
async function carregarHistorico() {
    const { data } = await _supabase.from('historico_vendas').select('*').eq('loja_id', LOJA_ID_ATUAL).order('data_venda', {ascending: false});
    document.getElementById('corpo-historico').innerHTML = data?.map(v => `
        <tr><td>${new Date(v.data_venda).toLocaleDateString()}</td><td>${v.cliente}</td><td>${v.produtos}</td><td>${v.pagamento}</td><td>R$ ${v.total.toFixed(2)}</td>
        <td><button class="somente-gerente" onclick="excluirVenda(${v.id})">🗑️</button></td></tr>`).join('') || "";
}
