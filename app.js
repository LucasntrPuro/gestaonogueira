const SB_URL = 'https://btzfjrpbzigqsifbmjnb.supabase.co'; 
const SB_KEY = 'sb_publishable_aOC-9tDq5jpRyZM3swEmSA_2anmUryO'; 
const _supabase = supabase.createClient(SB_URL, SB_KEY);

let usuarioLogado = null;
let carrinho = [];

// --- EFEITO PARTICULAS ---
if(typeof particlesJS !== 'undefined') {
    particlesJS("particles-js", { "particles": { "number": { "value": 60 }, "color": { "value": "#d4af37" }, "line_linked": { "color": "#d4af37" }, "move": { "speed": 1.5 } } });
}

// --- LOGIN (Captura o loja_id do utilizador) ---
async function fazerLogin() {
    const user = document.getElementById('user').value;
    const pass = document.getElementById('pass').value;
    
    const { data, error } = await _supabase.from('usuarios').select('*').eq('login', user).eq('senha', pass).single();
    
    if (error || !data) return alert("Acesso Negado!");
    if (!data.ativo) return alert("Usuário Inativo!");

    usuarioLogado = data; // IMPORTANTE: Agora temos o usuarioLogado.loja_id salvo
    
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

// --- GESTÃO DE UTILIZADORES (CORRIGIDO PARA NÃO FICAR NULL) ---
async function carregarUsuarios() {
    // Filtra para mostrar apenas utilizadores da mesma loja
    const { data } = await _supabase.from('usuarios')
        .select('*')
        .eq('loja_id', usuarioLogado.loja_id);
        
    const tbody = document.getElementById('corpo-usuarios');
    tbody.innerHTML = "";
    data.forEach(u => {
        const cor = u.ativo ? '#2ecc71' : '#ff4d4d';
        tbody.innerHTML += `<tr>
            <td>${u.login}</td>
            <td>${u.nivel.toUpperCase()}</td>
            <td><span style="height:10px; width:10px; background-color:${cor}; border-radius:50%; display:inline-block; margin-right:5px;"></span> ${u.ativo ? 'Ativo' : 'Inativo'}</td>
            <td>
                <button onclick='editarUsuario(${JSON.stringify(u)})' style="background:#3498db; margin-right:5px;">✏️</button>
                <button onclick="excluirUsuario(${u.id})" style="background:#e74c3c;">🗑️</button>
            </td>
        </tr>`;
    });
}

async function salvarUsuario() {
    const id = document.getElementById('edit-id-usuario').value;
    const u = {
        login: document.getElementById('user-login').value,
        senha: document.getElementById('user-senha').value,
        nivel: document.getElementById('user-nivel').value,
        ativo: document.getElementById('user-status').value === 'true',
        // AQUI ESTÁ A CORREÇÃO: Vincula o novo utilizador à loja do administrador logado
        loja_id: usuarioLogado.loja_id 
    };

    let res;
    if(id) {
        res = await _supabase.from('usuarios').update(u).eq('id', id);
    } else {
        res = await _supabase.from('usuarios').insert([u]);
    }

    if(res.error) {
        alert("Erro ao salvar utilizador: " + res.error.message);
    } else {
        fecharModalUsuario();
        carregarUsuarios();
        alert("Utilizador guardado com sucesso!");
    }
}

// --- PDV / VENDAS (Com vínculo de Loja) ---
async function adicionarAoCarrinho() {
    const cod = document.getElementById('venda-codigo').value;
    const qtd = parseInt(document.getElementById('venda-qtd').value) || 1;
    if(!cod) return;

    const { data: p } = await _supabase.from('produtos')
        .select('*')
        .eq('codigo_barras', cod)
        .eq('loja_id', usuarioLogado.loja_id) // Só busca produtos da loja logada
        .single();

    if(!p) return alert("Produto não encontrado nesta loja!");
    if(p.quantidade < qtd) return alert("Stock insuficiente!");

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
            <td><button onclick="removerItemCarrinho(${i})" style="background:transparent; color:red">❌</button></td>
        </tr>`;
    });
    document.getElementById('total-valor').innerText = `R$ ${total.toFixed(2)}`;
}

async function finalizarVenda() {
    if(!carrinho.length) return alert("Carrinho vazio!");
    
    let pgto = document.getElementById('venda-pagamento').value;
    if(pgto === "Cartão de Crédito") pgto += ` (${document.getElementById('venda-parcelas').value}x)`;
    
    const totalT = document.getElementById('total-valor').innerText;
    const valorNumerico = parseFloat(totalT.replace('R$ ','').replace('.','').replace(',','.'));

    const { error } = await _supabase.from('historico_vendas').insert([{
        cliente: document.getElementById('venda-cliente').value || "Consumidor",
        total: valorNumerico,
        produtos: carrinho.map(c => `${c.qtd_venda}x ${c.tipo}`).join(", "),
        pagamento: pgto,
        data_venda: new Date().toISOString(),
        loja_id: usuarioLogado.loja_id, // VÍNCULO AUTOMÁTICO
        itens_detalhados: carrinho 
    }]);

    if(!error) {
        for (const item of carrinho) {
            await _supabase.from('produtos')
                .update({ quantidade: item.quantidade - item.qtd_venda })
                .eq('id', item.id);
        }
        alert("Venda finalizada!");
        carrinho = []; 
        renderCarrinho();
    } else {
        alert("Erro ao gravar venda.");
    }
}

// --- ESTOQUE (Filtro por Loja) ---
async function carregarEstoque() {
    const { data } = await _supabase.from('produtos')
        .select('*')
        .eq('loja_id', usuarioLogado.loja_id)
        .order('tipo');
    
    const tbody = document.getElementById('corpo-estoque');
    tbody.innerHTML = "";
    data.forEach(p => {
        tbody.innerHTML += `<tr>
            <td>${p.codigo_barras}</td>
            <td>${p.tipo}</td>
            <td>R$ ${p.preco.toFixed(2)}</td>
            <td>${p.quantidade}</td>
            <td>
                <button onclick='editarProduto(${JSON.stringify(p)})'>✏️</button>
                <button onclick="excluirProduto(${p.id})" style="background:#ff4d4d; margin-left:5px">🗑️</button>
            </td>
        </tr>`;
    });
}

async function salvarProduto() {
    const id = document.getElementById('edit-id-produto').value;
    const p = {
        codigo_barras: document.getElementById('cad-codigo').value,
        tipo: document.getElementById('cad-tipo').value,
        preco: parseFloat(document.getElementById('cad-preco').value),
        quantidade: parseInt(document.getElementById('cad-qtd').value),
        loja_id: usuarioLogado.loja_id // Garante o vínculo da loja no produto
    };

    if(id) await _supabase.from('produtos').update(p).eq('id', id);
    else await _supabase.from('produtos').insert([p]);

    fecharModalProduto();
    carregarEstoque();
}

// --- HISTÓRICO ---
async function carregarHistorico() {
    const { data } = await _supabase.from('historico_vendas')
        .select('*')
        .eq('loja_id', usuarioLogado.loja_id)
        .order('data_venda', { ascending: false });
        
    const tbody = document.getElementById('corpo-historico');
    tbody.innerHTML = "";
    data.forEach(v => {
        tbody.innerHTML += `<tr>
            <td>${new Date(v.data_venda).toLocaleString()}</td>
            <td>${v.cliente}</td>
            <td>${v.pagamento}</td>
            <td>R$ ${Number(v.total).toFixed(2)}</td>
            <td><button onclick="excluirVenda(${v.id})" style="background:#ff4d4d">Estornar</button></td>
        </tr>`;
    });
}

async function excluirVenda(id) {
    if(!confirm("Deseja estornar esta venda?")) return;
    
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

// --- UTILITÁRIOS ---
function abrirModalProduto() { document.getElementById('edit-id-produto').value=""; document.getElementById('modal-produto').style.display='flex'; }
function editarProduto(p) {
    document.getElementById('edit-id-produto').value = p.id;
    document.getElementById('cad-codigo').value = p.codigo_barras;
    document.getElementById('cad-tipo').value = p.tipo;
    document.getElementById('cad-preco').value = p.preco;
    document.getElementById('cad-qtd').value = p.quantidade;
    document.getElementById('modal-produto').style.display='flex';
}
function fecharModalProduto() { document.getElementById('modal-produto').style.display='none'; }

function abrirModalUsuario() { 
    document.getElementById('edit-id-usuario').value=""; 
    document.getElementById('user-login').value="";
    document.getElementById('user-senha').value="";
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
function verificarParcelas() { document.getElementById('campo-parcelas').style.display = (document.getElementById('venda-pagamento').value === "Cartão de Crédito") ? "block" : "none"; }
function atalhosTeclado(e) { if(e.key === "F9") finalizarVenda(); }

async function excluirUsuario(id) { if(confirm("Eliminar utilizador?")) { await _supabase.from('usuarios').delete().eq('id', id); carregarUsuarios(); } }
async function excluirProduto(id) { if(confirm("Eliminar produto?")) { await _supabase.from('produtos').delete().eq('id', id); carregarEstoque(); } }

function gerarPDF() { 
    const { jsPDF } = window.jspdf; 
    const doc = new jsPDF(); 
    doc.text("Vendas Gestão Nogueira", 10, 10); 
    doc.autoTable({ html: '#aba-historico table' }); 
    doc.save("vendas.pdf"); 
}
function gerarExcel() { 
    const wb = XLSX.utils.table_to_book(document.querySelector("#aba-historico table")); 
    XLSX.writeFile(wb, "vendas.xlsx"); 
}
