const SB_URL = 'https://btzfjrpbzigqsifbmjnb.supabase.co'; 
const SB_KEY = 'sb_publishable_aOC-9tDq5jpRyZM3swEmSA_2anmUryO'; 
const _supabase = supabase.createClient(SB_URL, SB_KEY);

let usuarioLogado = null;
let carrinho = [];

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
    document.getElementById('user-info').innerHTML = `Logado como: <b>${data.login.toUpperCase()}</b> (${data.nivel})`;
    
    configurarPermissoes();
    mostrarAba('vendas');
}

function configurarPermissoes() {
    const eGerente = usuarioLogado.nivel === 'gerente';
    document.querySelectorAll('.somente-gerente').forEach(el => {
        el.style.display = eGerente ? 'flex' : 'none';
    });
}

// --- GESTÃO DE USUÁRIOS (CORRIGIDO PARA EXCLUIR E VINCULAR LOJA) ---
async function carregarUsuarios() {
    const { data } = await _supabase.from('usuarios').select('*').eq('loja_id', usuarioLogado.loja_id);
    const tbody = document.getElementById('corpo-usuarios');
    tbody.innerHTML = "";
    
    data.forEach(u => {
        const botoes = usuarioLogado.nivel === 'gerente' ? `
            <button onclick='editarUsuario(${JSON.stringify(u)})' style="background:#3498db; margin-right:5px;">✏️</button>
            <button onclick="excluirUsuario(${u.id})" style="background:#e74c3c;">🗑️</button>
        ` : '-';

        tbody.innerHTML += `<tr>
            <td>${u.login}</td>
            <td>${u.nivel.toUpperCase()}</td>
            <td>${u.ativo ? '✅ Ativo' : '❌ Inativo'}</td>
            <td>${botoes}</td>
        </tr>`;
    });
}

async function salvarUsuario() {
    if(usuarioLogado.nivel !== 'gerente') return alert("Ação restrita a Gerentes!");
    
    const id = document.getElementById('edit-id-usuario').value;
    const u = {
        login: document.getElementById('user-login').value,
        senha: document.getElementById('user-senha').value,
        nivel: document.getElementById('user-nivel').value,
        ativo: document.getElementById('user-status').value === 'true',
        loja_id: usuarioLogado.loja_id // AQUI GARANTE QUE NÃO FICA NULL
    };

    if(id) await _supabase.from('usuarios').update(u).eq('id', id);
    else await _supabase.from('usuarios').insert([u]);

    fecharModalUsuario();
    carregarUsuarios();
}

async function excluirUsuario(id) {
    if(usuarioLogado.nivel !== 'gerente') return alert("Permissão negada!");
    if(id === usuarioLogado.id) return alert("Você não pode excluir seu próprio perfil!");
    
    if(confirm("Deseja EXCLUIR permanentemente este usuário?")) {
        await _supabase.from('usuarios').delete().eq('id', id);
        carregarUsuarios();
    }
}

// --- HISTÓRICO E ESTORNO ---
async function carregarHistorico() {
    const { data } = await _supabase.from('historico_vendas').select('*').eq('loja_id', usuarioLogado.loja_id).order('data_venda', {ascending: false});
    const tbody = document.getElementById('corpo-historico');
    tbody.innerHTML = "";
    
    data.forEach(v => {
        const acao = usuarioLogado.nivel === 'gerente' 
            ? `<button onclick="excluirVenda(${v.id})" style="background:#ff4d4d">Estornar</button>` 
            : '---';

        tbody.innerHTML += `<tr>
            <td>${new Date(v.data_venda).toLocaleString()}</td>
            <td>${v.cliente}</td>
            <td>${v.pagamento}</td>
            <td>R$ ${Number(v.total).toFixed(2)}</td>
            <td>${acao}</td>
        </tr>`;
    });
}

async function excluirVenda(id) {
    if(usuarioLogado.nivel !== 'gerente') return alert("Apenas gerentes estornam vendas!");
    if(!confirm("Estornar venda e devolver estoque?")) return;

    const { data: venda } = await _supabase.from('historico_vendas').select('itens_detalhados').eq('id', id).single();
    if (venda && venda.itens_detalhados) {
        for (const item of venda.itens_detalhados) {
            const { data: p } = await _supabase.from('produtos').select('quantidade').eq('id', item.id).single();
            if (p) await _supabase.from('produtos').update({ quantidade: p.quantidade + item.qtd_venda }).eq('id', item.id);
        }
    }
    await _supabase.from('historico_vendas').delete().eq('id', id);
    carregarHistorico();
}

// --- ESTOQUE ---
async function carregarEstoque() {
    const { data } = await _supabase.from('produtos').select('*').eq('loja_id', usuarioLogado.loja_id).order('tipo');
    const tbody = document.getElementById('corpo-estoque');
    tbody.innerHTML = "";
    data.forEach(p => {
        const acoes = usuarioLogado.nivel === 'gerente' ? `
            <button onclick='editarProduto(${JSON.stringify(p)})'>✏️</button>
            <button onclick="excluirProduto(${p.id})" style="background:#ff4d4d; margin-left:5px">🗑️</button>
        ` : '-';
        tbody.innerHTML += `<tr><td>${p.codigo_barras}</td><td>${p.tipo}</td><td>R$ ${p.preco.toFixed(2)}</td><td>${p.quantidade}</td><td>${acoes}</td></tr>`;
    });
}

// --- VENDAS ---
async function adicionarAoCarrinho() {
    const cod = document.getElementById('venda-codigo').value;
    const qtd = parseInt(document.getElementById('venda-qtd').value) || 1;
    if(!cod) return;
    const { data: p } = await _supabase.from('produtos').select('*').eq('codigo_barras', cod).eq('loja_id', usuarioLogado.loja_id).single();
    if(!p) return alert("Produto não encontrado!");
    carrinho.push({ ...p, qtd_venda: qtd });
    renderCarrinho();
    document.getElementById('venda-codigo').value = "";
}

function renderCarrinho() {
    const tbody = document.getElementById('corpo-carrinho');
    tbody.innerHTML = "";
    let total = 0;
    carrinho.forEach((item, i) => {
        const sub = item.preco * item.qtd_venda;
        total += sub;
        tbody.innerHTML += `<tr><td>${item.tipo}</td><td>${item.qtd_venda}</td><td>R$ ${item.preco.toFixed(2)}</td><td>R$ ${sub.toFixed(2)}</td><td><button onclick="removerItemCarrinho(${i})" style="background:transparent; color:red">❌</button></td></tr>`;
    });
    document.getElementById('total-valor').innerText = `R$ ${total.toFixed(2)}`;
}

async function finalizarVenda() {
    if(!carrinho.length) return alert("Carrinho vazio!");
    const totalT = document.getElementById('total-valor').innerText;
    const valorNum = parseFloat(totalT.replace('R$ ','').replace(',','.'));

    const { error } = await _supabase.from('historico_vendas').insert([{
        cliente: document.getElementById('venda-cliente').value || "Consumidor",
        total: valorNum,
        produtos: carrinho.map(c => `${c.qtd_venda}x ${c.tipo}`).join(", "),
        pagamento: document.getElementById('venda-pagamento').value,
        data_venda: new Date().toISOString(),
        loja_id: usuarioLogado.loja_id,
        itens_detalhados: carrinho 
    }]);

    if(!error) {
        for (const item of carrinho) {
            await _supabase.from('produtos').update({ quantidade: item.quantidade - item.qtd_venda }).eq('id', item.id);
        }
        alert("Venda Finalizada!");
        carrinho = []; renderCarrinho();
    }
}

// --- AUXILIARES ---
function mostrarAba(aba) {
    document.querySelectorAll('.aba').forEach(a => a.style.display = 'none');
    document.getElementById('aba-' + aba).style.display = 'block';
    if(aba === 'estoque') carregarEstoque();
    if(aba === 'historico') carregarHistorico();
    if(aba === 'usuarios') carregarUsuarios();
}
function abrirModalUsuario() { 
    document.getElementById('edit-id-usuario').value=""; 
    document.getElementById('user-login').value="";
    document.getElementById('modal-usuario').style.display='flex'; 
}
function editarUsuario(u) {
    document.getElementById('edit-id-usuario').value = u.id;
    document.getElementById('user-login').value = u.login;
    document.getElementById('user-senha').value = u.senha;
    document.getElementById('user-nivel').value = u.nivel;
    document.getElementById('user-status').value = u.ativo.toString();
    document.getElementById('modal-usuario').style.display = 'flex';
}
function fecharModalUsuario() { document.getElementById('modal-usuario').style.display='none'; }
function removerItemCarrinho(i) { carrinho.splice(i,1); renderCarrinho(); }
function atalhosTeclado(e) { if(e.key === "F9") finalizarVenda(); }
async function excluirProduto(id) { if(confirm("Excluir produto?")) { await _supabase.from('produtos').delete().eq('id', id); carregarEstoque(); } }

// Funções de PDF/Excel (Mantidas)
function gerarPDF() { const { jsPDF } = window.jspdf; const doc = new jsPDF(); doc.text("Relatório de Vendas", 10, 10); doc.autoTable({ html: '#aba-historico table' }); doc.save("vendas.pdf"); }
function gerarExcel() { const wb = XLSX.utils.table_to_book(document.querySelector("#aba-historico table")); XLSX.writeFile(wb, "vendas.xlsx"); }
