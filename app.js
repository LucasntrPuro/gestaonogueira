const SB_URL = 'https://btzfjrpbzigqsifbmjnb.supabase.co'; 
const SB_KEY = 'sb_publishable_aOC-9tDq5jpRyZM3swEmSA_2anmUryO'; 
const _supabase = supabase.createClient(SB_URL, SB_KEY);

let usuarioLogado = null;
let carrinho = [];

if(typeof particlesJS !== 'undefined') {
    particlesJS("particles-js", { "particles": { "number": { "value": 60 }, "color": { "value": "#d4af37" }, "line_linked": { "color": "#d4af37" }, "move": { "speed": 1.5 } } });
}

async function fazerLogin() {
    const user = document.getElementById('user').value;
    const pass = document.getElementById('pass').value;
    const { data, error } = await _supabase.from('usuarios').select('*').eq('login', user).eq('senha', pass).single();
    
    if (error || !data) return alert("Acesso Negado!");
    usuarioLogado = data;
    
    document.getElementById('tela-login').style.display = 'none';
    document.getElementById('painel-admin').style.display = 'flex';
    document.getElementById('user-info').innerHTML = `Operador: <b>${data.login.toUpperCase()}</b>`;
    
    mostrarAba('vendas');
}

function mostrarAba(abaNome) {
    // Esconde todas as abas
    document.querySelectorAll('.aba').forEach(aba => {
        aba.style.display = 'none';
    });
    
    // Mostra a aba selecionada
    const abaAtiva = document.getElementById('aba-' + abaNome);
    if(abaAtiva) {
        abaAtiva.style.display = 'block';
    }

    // Carrega dados se necessário
    if(abaNome === 'estoque') carregarEstoque();
}

// ... Resto das funções de Carrinho e Estoque permanecem as mesmas que já tinhas ...
