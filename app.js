const SB_URL = 'https://btzfjrpbzigqsifbmjnb.supabase.co'; 
const SB_KEY = 'sb_publishable_aOC-9tDq5jpRyZM3swEmSA_2anmUryO'; 
const _supabase = supabase.createClient(SB_URL, SB_KEY);

let usuarioLogado = null;
let carrinho = [];

// Iniciar Partículas
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
    document.getElementById('user-info').innerText = data.login.toUpperCase();
    
    mostrarAba('vendas');
}

function mostrarAba(abaNome) {
    // Esconde todas
    document.querySelectorAll('.aba').forEach(a => a.style.display = 'none');
    // Mostra a correta
    const aba = document.getElementById('aba-' + abaNome);
    if(aba) aba.style.display = 'block';

    // Carrega os dados
    if(abaNome === 'estoque') carregarEstoque();
    if(abaNome === 'historico') carregarHistorico();
    if(abaNome === 'usuarios') carregarUsuarios();
}

async function carregarUsuarios() {
    const { data } = await _supabase.from('usuarios').select('*');
    const tbody = document.getElementById('corpo-usuarios');
    tbody.innerHTML = "";
    data.forEach(u => {
        const cor = u.ativo ? '#2ecc71' : '#ff4d4d';
        tbody.innerHTML += `<tr>
            <td>${u.login}</td>
            <td>${u.nivel}</td>
            <td><span style="height:10px;width:10px;background:${cor};border-radius:50%;display:inline-block"></span> ${u.ativo ? 'Ativo' : 'Inativo'}</td>
            <td><button onclick='editarUsuario(${JSON.stringify(u)})'>✏️</button></td>
        </tr>`;
    });
}

// Funções de Modal
function abrirModalUsuario() { 
    document.getElementById('edit-id-usuario').value = "";
    document.getElementById('modal-usuario').style.display = 'flex'; 
}
function fecharModalUsuario() { document.getElementById('modal-usuario').style.display = 'none'; }

function editarUsuario(u) {
    document.getElementById('edit-id-usuario').value = u.id;
    document.getElementById('user-login').value = u.login;
    document.getElementById('user-senha').value = u.senha;
    document.getElementById('user-nivel').value = u.nivel;
    document.getElementById('user-status').value = u.ativo.toString();
    document.getElementById('modal-usuario').style.display = 'flex';
}

async function salvarUsuario() {
    const id = document.getElementById('edit-id-usuario').value;
    const dados = {
        login: document.getElementById('user-login').value,
        senha: document.getElementById('user-senha').value,
        nivel: document.getElementById('user-nivel').value,
        ativo: document.getElementById('user-status').value === 'true'
    };
    if(id) await _supabase.from('usuarios').update(dados).eq('id', id);
    else await _supabase.from('usuarios').insert([dados]);
    fecharModalUsuario(); carregarUsuarios();
}

function atalhosTeclado(e) {
    if(e.key === "F9") finalizarVenda();
}
