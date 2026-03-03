const SB_URL = 'https://btzfjrpbzigqsifbmjnb.supabase.co'; 
const SB_KEY = 'sb_publishable_aOC-9tDq5jpRyZM3swEmSA_2anmUryO'; 
const _supabase = supabase.createClient(SB_URL, SB_KEY);

let usuarioLogado = null;
let carrinho = [];

// --- EFEITO PARTICULAS ---
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
    document.getElementById('user-info').innerHTML = `Operador: <b>${data.login.toUpperCase()}</b> | Nível: ${data.nivel}`;
    
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

// --- PDV / VENDAS ---
async function adicionarAoCarrinho() {
    const cod = document.getElementById('venda-codigo').value;
    const qtd = parseInt(document.getElementById('venda-qtd').value) || 1;
    if(!cod) return;

    const { data: p, error } = await _supabase.from('produtos').select('*').eq('codigo_barras', cod).single();
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
            <td><button onclick="removerItemCarrinho(${i})">❌</button></td>
        </tr>`;
    });
    document.getElementById('total-valor').innerText = `R$ ${total.toFixed(2)}`;
}

async function finalizarVenda() {
    if(carrinho.length === 0) return alert("Carrinho vazio!");
    const total = carrinho.reduce((acc, cur) => acc + (cur.preco * cur.qtd_venda), 0);
    const cliente = document.getElementById('venda-cliente').value || "Consumidor Final";
    const pagamento = document.getElementById('venda-pagamento').value;

    const novaVenda = {
        data: new Date().toISOString(),
        cliente,
        total,
        pagamento,
        operador: usuarioLogado.login,
        itens: carrinho
    };

    const { error } = await _supabase.from('historico_vendas').insert([novaVenda]);
    if(error) return alert("Erro ao salvar venda");

    for(const item of carrinho) {
        const novaQtd = item.qtd - item.qtd_venda;
        await _supabase.from('produtos').update({ qtd: novaQtd }).eq('id', item.id);
    }

    alert("Venda Finalizada!");
    carrinho = [];
    renderCarrinho();
    document.getElementById('venda-cliente').value = "";
}

// --- ESTOQUE ---
async function carregarEstoque() {
    const { data, error } = await _supabase.from('produtos').select('*').order('tipo');
    const tbody = document.getElementById('corpo-estoque');
    tbody.innerHTML = "";
    data.forEach(p => {
        tbody.innerHTML += `<tr>
            <td>${p.codigo_barras}</td>
            <td>${p.tipo}</td>
            <td>R$ ${p.preco.toFixed(2)}</td>
            <td>${p.qtd}</td>
            <td class="somente-gerente">
                <button onclick='editarProduto(${JSON.stringify(p)})'>✏️</button>
                <button onclick="excluirProduto(${p.id})">🗑️</button>
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
        qtd: parseInt(document.getElementById('cad-qtd').value)
    };

    if(id) await _supabase.from('produtos').update(p).eq('id', id);
    else await _supabase.from('produtos').insert([p]);

    fecharModalProduto();
    carregarEstoque();
}

// --- HISTÓRICO E EXCLUSÃO COM RETORNO DE ESTOQUE ---
async function carregarHistorico() {
    const { data, error } = await _supabase.from('historico_vendas').select('*').order('data', { ascending: false });
    const tbody = document.querySelector("#aba-historico tbody");
    tbody.innerHTML = "";
    data.forEach(v => {
        const dataF = new Date(v.data).toLocaleString();
        tbody.innerHTML += `<tr>
            <td>${dataF}</td>
            <td>${v.cliente}</td>
            <td>${v.pagamento}</td>
            <td>R$ ${v.total.toFixed(2)}</td>
            <td><button onclick="excluirVenda(${v.id})" style="background:#ff4d4d">Excluir</button></td>
        </tr>`;
    });
}

async function excluirVenda(id) {
    if (confirm("Tem a certeza que deseja excluir esta venda? O estoque dos itens será devolvido automaticamente.")) {
        try {
            // 1. Procurar os dados da venda para saber o que devolver
            const { data: venda, error: errVenda } = await _supabase
                .from('historico_vendas')
                .select('itens')
                .eq('id', id)
                .single();

            if (errVenda) throw errVenda;

            // 2. Devolver cada item ao estoque
            for (const item of venda.itens) {
                const { data: prodAtual } = await _supabase
                    .from('produtos')
                    .select('qtd')
                    .eq('codigo_barras', item.codigo_barras)
                    .single();

                if (prodAtual) {
                    const novaQtd = Number(prodAtual.qtd) + Number(item.qtd_venda);
                    await _supabase
                        .from('produtos')
                        .update({ qtd: novaQtd })
                        .eq('codigo_barras', item.codigo_barras);
                }
            }

            // 3. Apagar a venda do histórico
            await _supabase.from('historico_vendas').delete().eq('id', id);
            
            alert("Venda estornada e estoque atualizado!");
            carregarHistorico();
            carregarEstoque();
        } catch (e) {
            console.error(e);
            alert("Erro ao processar o estorno.");
        }
    }
}

// --- USUÁRIOS ---
async function carregarUsuarios() {
    const { data } = await _supabase.from('usuarios').select('*');
    const tbody = document.getElementById('corpo-usuarios');
    tbody.innerHTML = "";
    data.forEach(u => {
        tbody.innerHTML += `<tr>
            <td>${u.login}</td>
            <td>${u.nivel}</td>
            <td>${u.ativo ? 'Sim' : 'Não'}</td>
            <td><button onclick="excluirUsuario(${u.id})">🗑️</button></td>
        </tr>`;
    });
}

async function salvarUsuario() {
    const u = {
        login: document.getElementById('user-login').value,
        senha: document.getElementById('user-senha').value,
        nivel: document.getElementById('user-nivel').value,
        ativo: document.getElementById('user-status').value === 'true'
    };
    await _supabase.from('usuarios').insert([u]);
    fecharModalUsuario();
    carregarUsuarios();
}

// --- AUXILIARES E MODAIS ---
function atalhosTeclado(e) {
    if(e.key === "F9") finalizarVenda();
    if(e.key === "Enter" && document.activeElement.id === "venda-codigo") adicionarAoCarrinho();
}

function abrirModalProduto() { 
    document.getElementById('edit-id-produto').value=""; 
    document.getElementById('modal-produto').style.display='flex'; 
}

function editarProduto(p) {
    document.getElementById('edit-id-produto').value = p.id;
    document.getElementById('cad-codigo').value = p.codigo_barras;
    document.getElementById('cad-tipo').value = p.tipo;
    document.getElementById('cad-preco').value = p.preco;
    document.getElementById('cad-qtd').value = p.qtd;
    document.getElementById('modal-produto').style.display='flex';
}

function fecharModalProduto() { document.getElementById('modal-produto').style.display='none'; }
function fecharModalUsuario() { document.getElementById('modal-usuario').style.display='none'; }
function removerItemCarrinho(i) { carrinho.splice(i,1); renderCarrinho(); }
function verificarParcelas() { document.getElementById('campo-parcelas').style.display = (document.getElementById('venda-pagamento').value === "Cartão de Crédito") ? "block" : "none"; }

async function excluirUsuario(id) { if(confirm("Excluir?")) { await _supabase.from('usuarios').delete().eq('id', id); carregarUsuarios(); } }
async function excluirProduto(id) { if(confirm("Excluir?")) { await _supabase.from('produtos').delete().eq('id', id); carregarEstoque(); } }

// --- EXPORTAÇÃO ---
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
