const SB_URL = 'https://btzfjrpbzigqsifbmjnb.supabase.co'; 
const SB_KEY = 'sb_publishable_aOC-9tDq5jpRyZM3swEmSA_2anmUryO'; 
const _supabase = supabase.createClient(SB_URL, SB_KEY);

let usuarioLogado = null;
let carrinho = [];

// --- INICIALIZAÇÃO ---
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
    document.getElementById('user-info').innerHTML = `Operador: <b>${data.login.toUpperCase()}</b>`;
    
    if(data.nivel !== 'gerente') {
        document.querySelectorAll('.somente-gerente').forEach(el => el.style.display = 'none');
    }
    mostrarAba('vendas');
}

// --- NAVEGAÇÃO ---
function mostrarAba(aba) {
    document.querySelectorAll('.aba').forEach(a => a.style.display = 'none');
    document.getElementById('aba-' + aba).style.display = 'block';
    if(aba === 'estoque') carregarEstoque();
    if(aba === 'historico') carregarHistorico();
    if(aba === 'usuarios') carregarUsuarios();
}

// --- PDV ---
async function adicionarAoCarrinho() {
    const cod = document.getElementById('venda-codigo').value;
    const qtd = parseInt(document.getElementById('venda-qtd').value) || 1;
    if(!cod) return;

    const { data: p } = await _supabase.from('produtos').select('*').eq('codigo_barras', cod).single();
    if(!p) return alert("Produto não encontrado!");
    if(p.qtd < qtd) return alert("Estoque insuficiente!");

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
        tbody.innerHTML += `<tr>
            <td>${item.tipo}</td>
            <td>${item.qtd_venda}</td>
            <td>R$ ${item.preco.toFixed(2)}</td>
            <td>R$ ${sub.toFixed(2)}</td>
            <td><button onclick="removerItemCarrinho(${i})" style="background:transparent">❌</button></td>
        </tr>`;
    });
    document.getElementById('total-valor').innerText = `R$ ${total.toFixed(2)}`;
}

async function finalizarVenda() {
    if(carrinho.length === 0) return alert("Carrinho vazio!");
    const total = carrinho.reduce((acc, cur) => acc + (cur.preco * cur.qtd_venda), 0);
    const novaVenda = {
        data: new Date().toISOString(),
        cliente: document.getElementById('venda-cliente').value || "Consumidor Final",
        total,
        pagamento: document.getElementById('venda-pagamento').value,
        operador: usuarioLogado.login,
        itens: carrinho
    };

    const { error } = await _supabase.from('historico_vendas').insert([novaVenda]);
    if(error) return alert("Erro ao salvar venda");

    for(const item of carrinho) {
        await _supabase.from('produtos').update({ qtd: item.qtd - item.qtd_venda }).eq('id', item.id);
    }

    alert("Venda Finalizada!");
    carrinho = [];
    renderCarrinho();
}

// --- ESTORNO DE ESTOQUE (CORREÇÃO) ---
async function excluirVenda(id) {
    if (confirm("Deseja realmente excluir esta venda? O estoque será devolvido.")) {
        try {
            const { data: venda } = await _supabase.from('historico_vendas').select('itens').eq('id', id).single();
            if (venda && venda.itens) {
                for (const item of venda.itens) {
                    const { data: p } = await _supabase.from('produtos').select('qtd').eq('codigo_barras', item.codigo_barras).single();
                    if (p) {
                        await _supabase.from('produtos').update({ qtd: p.qtd + item.qtd_venda }).eq('codigo_barras', item.codigo_barras);
                    }
                }
            }
            await _supabase.from('historico_vendas').delete().eq('id', id);
            carregarHistorico();
            alert("Venda excluída e estoque estornado!");
        } catch (e) { alert("Erro ao excluir."); }
    }
}

// --- USUÁRIOS ---
async function carregarUsuarios() {
    const { data } = await _supabase.from('usuarios').select('*').order('login');
    const tbody = document.getElementById('corpo-usuarios');
    tbody.innerHTML = "";
    data.forEach(u => {
        const statusCor = u.ativo ? '#2ecc71' : '#ff4d4d';
        tbody.innerHTML += `<tr>
            <td>${u.login}</td>
            <td>${u.nivel.toUpperCase()}</td>
            <td><span style="height:10px; width:10px; background-color:${statusCor}; border-radius:50%; display:inline-block; margin-right:5px;"></span> ${u.ativo ? 'Ativo' : 'Inativo'}</td>
            <td>
                <button onclick='editarUsuario(${JSON.stringify(u)})' style="background:#3498db; margin-right:5px;">✏️</button>
                <button onclick="excluirUsuario(${u.id})" style="background:#e74c3c">🗑️</button>
            </td>
        </tr>`;
    });
}

function abrirModalUsuario() {
    document.getElementById('edit-id-usuario').value = "";
    document.getElementById('user-login').value = "";
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
    if (id) await _supabase.from('usuarios').update(u).eq('id', id);
    else await _supabase.from('usuarios').insert([u]);
    document.getElementById('modal-usuario').style.display = 'none';
    carregarUsuarios();
}

// --- RESTANTE DAS FUNÇÕES (Estoque, PDF, etc) permanecem as mesmas do seu original ---
async function carregarEstoque() {
    const { data } = await _supabase.from('produtos').select('*').order('tipo');
    const tbody = document.getElementById('corpo-estoque');
    tbody.innerHTML = "";
    data.forEach(p => {
        tbody.innerHTML += `<tr><td>${p.codigo_barras}</td><td>${p.tipo}</td><td>R$ ${p.preco.toFixed(2)}</td><td>${p.qtd}</td><td><button onclick='editarProduto(${JSON.stringify(p)})'>✏️</button></td></tr>`;
    });
}

async function carregarHistorico() {
    const { data } = await _supabase.from('historico_vendas').select('*').order('data', {ascending: false});
    const tbody = document.querySelector("#aba-historico tbody");
    tbody.innerHTML = "";
    data.forEach(v => {
        tbody.innerHTML += `<tr>
            <td>${new Date(v.data).toLocaleString()}</td>
            <td>${v.cliente}</td>
            <td>${v.pagamento}</td>
            <td>R$ ${Number(v.total).toFixed(2)}</td>
            <td><button onclick="excluirVenda(${v.id})" style="background:#ff4d4d">Excluir</button></td>
        </tr>`;
    });
}

function fecharModalUsuario() { document.getElementById('modal-usuario').style.display = 'none'; }
function removerItemCarrinho(i) { carrinho.splice(i,1); renderCarrinho(); }
function atalhosTeclado(e) { if(e.key === "F9") finalizarVenda(); }
