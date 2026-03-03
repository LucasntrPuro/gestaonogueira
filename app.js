const SB_URL = 'https://btzfjrpbzigqsifbmjnb.supabase.co'; 
const SB_KEY = 'sb_publishable_aOC-9tDq5jpRyZM3swEmSA_2anmUryO'; 
const _supabase = supabase.createClient(SB_URL, SB_KEY);

let usuarioLogado = null;
let carrinho = [];

// Inicialização de Partículas
function carregarParticulas() {
    if(typeof particlesJS !== 'undefined') {
        particlesJS("particles-js", {
            "particles": {
                "number": { "value": 80 },
                "color": { "value": "#d4af37" },
                "line_linked": { "enable": true, "color": "#d4af37", "opacity": 0.3 },
                "move": { "speed": 1.5 }
            }
        });
    }
}

// Rodar quando a página abrir
window.onload = carregarParticulas;

async function fazerLogin() {
    const user = document.getElementById('user').value;
    const pass = document.getElementById('pass').value;

    try {
        const { data, error } = await _supabase.from('usuarios').select('*').eq('login', user).eq('senha', pass).single();
        
        if (error || !data) return alert("Acesso Negado!");
        if (!data.ativo) return alert("Usuário Inativo!");

        usuarioLogado = data;
        document.getElementById('particles-js').style.display = 'none';
        document.getElementById('tela-login').style.display = 'none';
        document.getElementById('painel-admin').style.display = 'flex';
        document.getElementById('user-info').innerHTML = `Operador: <b>${data.login.toUpperCase()}</b>`;
        
        mostrarAba('vendas');
    } catch (err) {
        alert("Erro de conexão!");
    }
}

function mostrarAba(aba) {
    document.querySelectorAll('.aba').forEach(a => a.style.display = 'none');
    const target = document.getElementById('aba-' + aba);
    if(target) target.style.display = 'block';
    
    if(aba === 'estoque') carregarEstoque();
}

async function adicionarAoCarrinho() {
    const cod = document.getElementById('venda-codigo').value;
    const qtd = parseInt(document.getElementById('venda-qtd').value) || 1;
    if(!cod) return;

    const { data: p, error } = await _supabase.from('produtos').select('*').eq('codigo_barras', cod).single();
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
        tbody.innerHTML += `<tr><td>${item.tipo}</td><td>${item.qtd_venda}</td><td>R$ ${item.preco.toFixed(2)}</td><td>R$ ${sub.toFixed(2)}</td><td><button onclick="removerItem(${i})">❌</button></td></tr>`;
    });
    document.getElementById('total-valor').innerText = `R$ ${total.toFixed(2)}`;
}

function removerItem(i) { carrinho.splice(i, 1); renderCarrinho(); }

function atalhosTeclado(e) {
    if(e.key === "Enter" && document.activeElement.id === "venda-codigo") adicionarAoCarrinho();
    if(e.key === "F9") finalizarVenda();
}

function abrirModalProduto() { document.getElementById('modal-produto').style.display = 'flex'; }
function fecharModalProduto() { document.getElementById('modal-produto').style.display = 'none'; }
