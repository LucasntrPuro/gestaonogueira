const SB_URL = 'https://btzfjrpbzigqsifbmjnb.supabase.co'; 
const SB_KEY = 'sb_publishable_aOC-9tDq5jpRyZM3swEmSA_2anmUryO'; 
const _supabase = supabase.createClient(SB_URL, SB_KEY);

const LOJA_ID_ATUAL = '8777a06a-e35f-4c3a-b94d-e8c155a1899f';

let usuarioLogado = null;
let carrinho = [];

// --- LOGIN ---
async function fazerLogin() {
    const user = document.getElementById('user').value;
    const pass = document.getElementById('pass').value;
    
    // Busca usuário vinculado a esta loja específica
    const { data, error } = await _supabase.from('usuarios')
        .select('*')
        .eq('login', user)
        .eq('senha', pass)
        .eq('loja_id', LOJA_ID_ATUAL)
        .single();
    
    if (error || !data) return alert("Acesso Negado! Verifique login/senha.");
    if (!data.ativo) return alert("Usuário Inativo!");

    usuarioLogado = data;
    document.getElementById('tela-login').style.display = 'none';
    document.getElementById('painel-admin').style.display = 'flex';
    document.getElementById('user-info').innerText = `Operador: ${data.login.toUpperCase()}`;
    
    // Heartbeat para o Admin Master ver que você está online
    atualizarPresenca(); 
    setInterval(atualizarPresenca, 30000); 
    
    aplicarPermissoesVisuais();
    mostrarAba('vendas');
}

async function atualizarPresenca() {
    if (usuarioLogado) {
        await _supabase.from('usuarios').update({ ultima_atividade: new Date().toISOString() }).eq('id', usuarioLogado.id);
    }
}

// --- ABA VENDAS (LANÇAR ITENS E PARCELAS) ---

// Função para mostrar/esconder parcelas (Cartão de Crédito)
function verificarParcelas() {
    const metodo = document.getElementById('venda-pagamento').value;
    const campoParcelas = document.getElementById('campo-parcelas');
    if (metodo === "Cartão de Crédito") {
        campoParcelas.style.display = 'block';
    } else {
        campoParcelas.style.display = 'none';
    }
}

async function adicionarAoCarrinho() {
    const cod = document.getElementById('venda-codigo').value;
    const qtd = parseInt(document.getElementById('venda-qtd').value) || 1;

    if(!cod) return alert("Digite o código do produto!");

    const { data: p, error } = await _supabase
        .from('produtos')
        .select('*')
        .eq('codigo_barras', cod)
        .eq('loja_id', LOJA_ID_ATUAL)
        .single();
    
    if (error || !p) return alert("Produto não encontrado nesta loja!");
    if (p.quantidade < qtd) return alert("Estoque insuficiente! Atual: " + p.quantidade);
    
    carrinho.push({ ...p, qtd_venda: qtd });
    renderCarrinho();
    
    // Limpa campos e volta o foco
    document.getElementById('venda-codigo').value = "";
    document.getElementById('venda-qtd').value = "1";
    document.getElementById('venda-codigo').focus();
}

function renderCarrinho() {
    const tbody = document.getElementById('corpo-carrinho');
    tbody.innerHTML = "";
    let t = 0;
    carrinho.forEach((item, i) => {
        const sub = item.preco * item.qtd_venda;
        t += sub;
        tbody.innerHTML += `<tr>
            <td>${item.tipo}</td>
            <td>${item.qtd_venda}</td>
            <td>R$ ${item.preco.toFixed(2)}</td>
            <td>R$ ${sub.toFixed(2)}</td>
            <td><button onclick="removerItemCarrinho(${i})">❌</button></td>
        </tr>`;
    });
    document.getElementById('total-valor').innerText = `R$ ${t.toFixed(2).replace('.',',')}`;
}

async function finalizarVenda() {
    if(!carrinho.length) return alert("Carrinho vazio!");
    
    let pgto = document.getElementById('venda-pagamento').value;
    if(pgto === "Cartão de Crédito") {
        const parc = document.getElementById('venda-parcelas').value;
        pgto += ` (${parc}x)`;
    }

    try {
        // Baixa de estoque
        for (const item of carrinho) {
            await _supabase.from('produtos').update({ quantidade: item.quantidade - item.qtd_venda }).eq('id', item.id);
        }

        // Salva histórico
        await _supabase.from('historico_vendas').insert([{
            cliente: document.getElementById('venda-cliente').value || "Consumidor",
            total: parseFloat(document.getElementById('total-valor').innerText.replace('R$ ','').replace(',','.')),
            produtos: carrinho.map(c => `${c.qtd_venda}x ${c.tipo}`).join(", "),
            pagamento: pgto,
            data_venda: new Date().toLocaleString('sv-SE'),
            loja_id: LOJA_ID_ATUAL 
        }]);

        alert("Venda Finalizada!");
        carrinho = []; 
        renderCarrinho();
        document.getElementById('venda-cliente').value = "";
    } catch (e) { alert("Erro ao processar venda."); }
}

// --- ESTOQUE E USUÁRIOS ---
async function carregarEstoque() {
    const { data } = await _supabase.from('produtos').select('*').eq('loja_id', LOJA_ID_ATUAL).order('tipo');
    const tbody = document.getElementById('corpo-estoque');
    tbody.innerHTML = data?.map(p => `
        <tr><td>${p.codigo_barras}</td><td>${p.tipo}</td><td>R$ ${p.preco.toFixed(2)}</td><td>${p.quantidade}</td>
        <td class="somente-gerente">
            <button onclick='prepararEdicaoProduto(${JSON.stringify(p)})'>✏️</button>
            <button onclick="excluirProduto(${p.id})">🗑️</button>
        </td></tr>`).join('') || "";
    aplicarPermissoesVisuais();
}

async function carregarUsuarios() {
    const { data } = await _supabase.from('usuarios').select('*').eq('loja_id', LOJA_ID_ATUAL).order('login');
    const tbody = document.getElementById('corpo-usuarios');
    tbody.innerHTML = data?.map(u => `
        <tr><td>${u.login}</td><td>${u.nivel}</td><td><span style="color:${u.ativo?'#2ecc71':'#e74c3c'}">●</span> ${u.ativo?'Ativo':'Inativo'}</td>
        <td><button onclick='prepararEdicaoUsuario(${JSON.stringify(u)})'>✏️</button></td></tr>`).join('') || "";
}

// --- NAVEGAÇÃO ---
function mostrarAba(aba) {
    document.querySelectorAll('.aba').forEach(a => a.style.display = 'none');
    document.getElementById('aba-' + aba).style.display = 'block';
    if(aba === 'estoque') carregarEstoque();
    if(aba === 'historico') carregarHistorico();
    if(aba === 'usuarios') carregarUsuarios();
}

function aplicarPermissoesVisuais() {
    const isG = usuarioLogado.nivel === 'gerente';
    document.querySelectorAll('.somente-gerente').forEach(el => el.style.display = isG ? 'block' : 'none');
}

// --- MODAIS E AUXILIARES ---
function removerItemCarrinho(i) { carrinho.splice(i,1); renderCarrinho(); }

// Evento para o campo de pagamento (Cartão)
document.addEventListener('change', function(e){
    if(e.target && e.target.id === 'venda-pagamento'){
       verificarParcelas();
    }
});

window.onkeydown = (e) => { 
    if(e.key === "F1") mostrarAba('vendas'); 
    if(e.key === "F2") finalizarVenda(); 
};
