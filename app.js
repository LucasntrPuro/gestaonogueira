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
    carrinho.push({ ...p, qtd_venda: qtd });
    renderCarrinho();
    document.getElementById('venda-codigo').value = "";
}

function renderCarrinho() {
    const tbody = document.getElementById('corpo-carrinho');
    tbody.innerHTML = ""; let total = 0;
    carrinho.forEach((item, i) => {
        const sub = item.preco * item.qtd_venda; total += sub;
        tbody.innerHTML += `<tr><td>${item.tipo}</td><td>${item.qtd_venda}</td><td>R$ ${item.preco.toFixed(2)}</td><td>R$ ${sub.toFixed(2)}</td><td><button onclick="removerItemCarrinho(${i})">❌</button></td></tr>`;
    });
    document.getElementById('total-valor').innerText = `R$ ${total.toFixed(2)}`;
}

async function finalizarVenda() {
    if(carrinho.length === 0) return;
    const total = carrinho.reduce((acc, cur) => acc + (cur.preco * cur.qtd_venda), 0);
    const novaVenda = {
        data: new Date().toISOString(),
        cliente: document.getElementById('venda-cliente').value || "Consumidor Final",
        total: total,
        pagamento: document.getElementById('venda-pagamento').value,
        itens: carrinho
    };
    const { error } = await _supabase.from('historico_vendas').insert([novaVenda]);
    if(!error) {
        for(const item of carrinho) {
            const { data: prod } = await _supabase.from('produtos').select('qtd').eq('id', item.id).single();
            await _supabase.from('produtos').update({ qtd: prod.qtd - item.qtd_venda }).eq('id', item.id);
        }
        alert("Venda realizada!");
        carrinho = []; renderCarrinho();
    }
}

// --- ESTOQUE ---
async function carregarEstoque() {
    const { data } = await _supabase.from('produtos').select('*').order('tipo');
    const tbody = document.getElementById('corpo-estoque');
    tbody.innerHTML = "";
    data.forEach(p => {
        tbody.innerHTML += `<tr><td>${p.codigo_barras}</td><td>${p.tipo}</td><td>R$ ${p.preco.toFixed(2)}</td><td>${p.qtd}</td><td class="somente-gerente"><button onclick='editarProduto(${JSON.stringify(p)})'>✏️</button> <button onclick="excluirProduto(${p.id})">🗑️</button></td></tr>`;
    });
}

// --- HISTÓRICO COM ESTORNO ---
async function carregarHistorico() {
    const { data } = await _supabase.from('historico_vendas').select('*').order('data', { ascending: false });
    const tbody = document.querySelector("#aba-historico tbody");
    tbody.innerHTML = "";
    data.forEach(v => {
        tbody.innerHTML += `<tr>
            <td>${new Date(v.data).toLocaleString()}</td>
            <td>${v.cliente}</td>
            <td>${v.pagamento}</td>
            <td>R$ ${v.total.toFixed(2)}</td>
            <td><button onclick="excluirVenda(${v.id})" style="background:#ff4d4d">Excluir</button></td>
        </tr>`;
    });
}

async function excluirVenda(id) {
    if(!confirm("Deseja excluir? O stock será devolvido.")) return;
    const { data: venda } = await _supabase.from('historico_vendas').select('itens').eq('id', id).single();
    for(const item of venda.itens) {
        const { data: p } = await _supabase.from('produtos').select('qtd').eq('codigo_barras', item.codigo_barras).single();
        if(p) await _supabase.from('produtos').update({ qtd: p.qtd + item.qtd_venda }).eq('codigo_barras', item.codigo_barras);
    }
    await _supabase.from('historico_vendas').delete().eq('id', id);
    carregarHistorico();
}

// --- USUÁRIOS ---
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
            <td><button onclick='editarUsuario(${JSON.stringify(u)})'>✏️</button> <button onclick="excluirUsuario(${u.id})">🗑️</button></td>
        </tr>`;
    });
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
    fecharModalUsuario(); carregarUsuarios();
}

// --- AUXILIARES ---
function abrirModalUsuario() { 
    document.getElementById('edit-id-usuario').value=""; 
    document.getElementById('user-login').value="";
    document.getElementById('user-senha').value="";
    document.getElementById('modal-usuario').style.display='flex'; 
}
function editarUsuario(u) {
    document.getElementById('edit-id-usuario').value=u.id;
    document.getElementById('user-login').value=u.login;
    document.getElementById('user-senha').value=u.senha;
    document.getElementById('user-nivel').value=u.nivel;
    document.getElementById('user-status').value=u.ativo.toString();
    document.getElementById('modal-usuario').style.display='flex';
}
function fecharModalUsuario() { document.getElementById('modal-usuario').style.display='none'; }
function editarProduto(p) {
    document.getElementById('edit-id-produto').value=p.id;
    document.getElementById('cad-codigo').value=p.codigo_barras;
    document.getElementById('cad-tipo').value=p.tipo;
    document.getElementById('cad-preco').value=p.preco;
    document.getElementById('cad-qtd').value=p.qtd;
    document.getElementById('modal-produto').style.display='flex';
}
function abrirModalProduto() { document.getElementById('edit-id-produto').value=""; document.getElementById('modal-produto').style.display='flex'; }
function fecharModalProduto() { document.getElementById('modal-produto').style.display='none'; }
function removerItemCarrinho(i) { carrinho.splice(i,1); renderCarrinho(); }
async function excluirUsuario(id) { if(confirm(\"Excluir?\")) { await _supabase.from('usuarios').delete().eq('id', id); carregarUsuarios(); } }
async function excluirProduto(id) { if(confirm(\"Excluir?\")) { await _supabase.from('produtos').delete().eq('id', id); carregarEstoque(); } }
function atalhosTeclado(e) { if(e.key === "F9") finalizarVenda(); }
