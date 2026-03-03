const SB_URL = 'https://btzfjrpbzigqsifbmjnb.supabase.co'; 
const SB_KEY = 'sb_publishable_aOC-9tDq5jpRyZM3swEmSA_2anmUryO'; 
const _supabase = supabase.createClient(SB_URL, SB_KEY);

let usuarioLogado = null;
let carrinho = [];

// Carregar partículas apenas após o DOM estar pronto
document.addEventListener('DOMContentLoaded', () => {
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
});

async function fazerLogin() {
    const user = document.getElementById('user').value;
    const pass = document.getElementById('pass').value;

    try {
        const { data, error } = await _supabase.from('usuarios').select('*').eq('login', user).eq('senha', pass).single();
        
        if (error || !data) return alert("Usuário ou senha incorretos!");
        if (!data.ativo) return alert("Usuário inativo!");

        usuarioLogado = data;
        document.getElementById('particles-js').style.display = 'none';
        document.getElementById('tela-login').style.display = 'none';
        document.getElementById('painel-admin').style.display = 'flex';
        document.getElementById('user-info').innerHTML = `Operador: <b>${data.login.toUpperCase()}</b>`;
        
        if(data.nivel !== 'gerente') {
            document.querySelectorAll('.somente-gerente').forEach(el => el.style.display = 'none');
        }
        mostrarAba('vendas');
    } catch (err) {
        alert("Erro ao conectar com o servidor.");
    }
}

function mostrarAba(aba) {
    document.querySelectorAll('.aba').forEach(a => a.style.display = 'none');
    const target = document.getElementById('aba-' + aba);
    if(target) target.style.display = 'block';
    
    if(aba === 'estoque') carregarEstoque();
    if(aba === 'historico') carregarHistorico();
    if(aba === 'usuarios') carregarUsuarios();
}

// --- FUNÇÕES DE USUÁRIO ---
async function carregarUsuarios() {
    const { data } = await _supabase.from('usuarios').select('*').order('login');
    const tbody = document.getElementById('corpo-usuarios');
    tbody.innerHTML = "";
    data.forEach(u => {
        const cor = u.ativo ? '#2ecc71' : '#ff4d4d';
        tbody.innerHTML += `<tr>
            <td>${u.login}</td>
            <td>${u.nivel.toUpperCase()}</td>
            <td><span style="height:10px;width:10px;background-color:${cor};border-radius:50%;display:inline-block;"></span> ${u.ativo ? 'Ativo' : 'Inativo'}</td>
            <td>
                <button onclick='editarUsuario(${JSON.stringify(u)})'>✏️</button>
                <button onclick="excluirUsuario(${u.id})" style="background:#e74c3c">🗑️</button>
            </td>
        </tr>`;
    });
}

function abrirModalUsuario() {
    document.getElementById('edit-id-usuario').value = "";
    document.getElementById('user-login').value = "";
    document.getElementById('user-senha').value = "";
    document.getElementById('modal-usuario').style.display = 'flex';
}

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
    const u = {
        login: document.getElementById('user-login').value,
        senha: document.getElementById('user-senha').value,
        nivel: document.getElementById('user-nivel').value,
        ativo: document.getElementById('user-status').value === 'true'
    };
    if(id) await _supabase.from('usuarios').update(u).eq('id', id);
    else await _supabase.from('usuarios').insert([u]);
    
    fecharModalUsuario();
    carregarUsuarios();
}

function fecharModalUsuario() { document.getElementById('modal-usuario').style.display = 'none'; }

// --- HISTÓRICO COM ESTORNO ---
async function carregarHistorico() {
    const { data } = await _supabase.from('historico_vendas').select('*').order('data', { ascending: false });
    const tbody = document.querySelector("#aba-historico tbody");
    tbody.innerHTML = "";
    data.forEach(v => {
        tbody.innerHTML += `<tr>
            <td>${new Date(v.data).toLocaleString()}</td>
            <td>${v.cliente}</td>
            <td>R$ ${Number(v.total).toFixed(2)}</td>
            <td><button onclick="excluirVenda(${v.id})" style="background:#ff4d4d">Excluir</button></td>
        </tr>`;
    });
}

async function excluirVenda(id) {
    if(!confirm("Deseja estornar esta venda?")) return;
    const { data: venda } = await _supabase.from('historico_vendas').select('itens').eq('id', id).single();
    
    for(const item of venda.itens) {
        const { data: p } = await _supabase.from('produtos').select('qtd').eq('codigo_barras', item.codigo_barras).single();
        if(p) await _supabase.from('produtos').update({ qtd: p.qtd + item.qtd_venda }).eq('codigo_barras', item.codigo_barras);
    }
    
    await _supabase.from('historico_vendas').delete().eq('id', id);
    carregarHistorico();
}

function atalhosTeclado(e) {
    if(e.key === "Enter" && document.getElementById('tela-login').style.display !== 'none') fazerLogin();
}
