const SB_URL = 'https://btzfjrpbzigqsifbmjnb.supabase.co'; 
const SB_KEY = 'sb_publishable_aOC-9tDq5jpRyZM3swEmSA_2anmUryO'; 
const _supabase = supabase.createClient(SB_URL, SB_KEY);

// Variáveis de estado global
let usuarioLogado = null;
let carrinho = [];

// --- EFEITO PARTICULAS ---
if(typeof particlesJS !== 'undefined') {
    particlesJS("particles-js", { "particles": { "number": { "value": 60 }, "color": { "value": "#d4af37" }, "line_linked": { "color": "#d4af37" }, "move": { "speed": 1.5 } } });
}

// --- LOGIN (A CHAVE PARA O MULTI-TENANT) ---
async function fazerLogin() {
    const user = document.getElementById('user').value;
    const pass = document.getElementById('pass').value;

    if (!user || !pass) return alert("Preencha todos os campos!");

    // Busca o usuário e captura o loja_id vinculado a ele
    const { data, error } = await _supabase
        .from('usuarios')
        .select('*')
        .eq('login', user)
        .eq('senha', pass)
        .single();
    
    if (error || !data) return alert("Usuário ou senha incorretos!");
    if (!data.ativo) return alert("Usuário Inativo!");

    // Define o usuário logado globalmente
    usuarioLogado = data;

    // Interface
    document.getElementById('particles-js').style.display = 'none';
    document.getElementById('tela-login').style.display = 'none';
    document.getElementById('painel-admin').style.display = 'flex';
    document.getElementById('user-info').innerText = `Operador: ${data.login.toUpperCase()}`;
    
    atualizarPresenca(); 
    aplicarPermissoesVisuais();
    mostrarAba('vendas');
}

function mostrarAba(aba) {
    // Só permite mudar de aba se estiver logado
    if (!usuarioLogado) return;

    document.querySelectorAll('.aba').forEach(a => a.style.display = 'none');
    document.getElementById('aba-' + aba).style.display = 'block';
    
    if(aba === 'vendas') document.getElementById('venda-codigo').focus();
    if(aba === 'estoque') carregarEstoque();
    if(aba === 'historico') carregarHistorico();
    if(aba === 'usuarios') carregarUsuarios();
}

function aplicarPermissoesVisuais() {
    const isG = usuarioLogado.nivel === 'gerente';
    document.querySelectorAll('.somente-gerente').forEach(el => {
        el.style.setProperty('display', isG ? 'block' : 'none', 'important');
    });
}

// --- VENDAS ---
async function adicionarAoCarrinho() {
    const cod = document.getElementById('venda-codigo').value;
    const qtd = parseInt(document.getElementById('venda-qtd').value) || 1;
    
    // Filtro essencial: busca o produto apenas na loja do usuário logado
    const { data: p } = await _supabase
        .from('produtos')
        .select('*')
        .eq('codigo_barras', cod)
        .eq('loja_id', usuarioLogado.loja_id)
        .single();
    
    if (!p) return alert("Produto não encontrado nesta unidade!");
    if (p.quantidade < qtd) return alert("Estoque insuficiente! Disponível: " + p.quantidade);
    
    carrinho.push({ ...p, qtd_venda: qtd });
    renderCarrinho();
    document.getElementById('venda-codigo').value = "";
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
            <td>
                <button onclick="abrirModalEditarItem(${i})">✏️</button>
                <button onclick="removerItemCarrinho(${i})">❌</button>
            </td>
        </tr>`;
    });
    document.getElementById('total-valor').innerText = `R$ ${t.toFixed(2).replace('.',',')}`;
}

async function finalizarVenda() {
    if(!carrinho.length) return alert("Carrinho vazio!");
    let pgto = document.getElementById('venda-pagamento').value;
    if(pgto === "Cartão de Crédito") pgto += " (" + document.getElementById('venda-parcelas').value + "x)";
    const totalT = document.getElementById('total-valor').innerText;

    try {
        for (const item of carrinho) {
            const novaQtd = item.quantidade - item.qtd_venda;
            await _supabase.from('produtos').update({ quantidade: novaQtd }).eq('id', item.id);
        }

        const { error } = await _supabase.from('historico_vendas').insert([{
            cliente: document.getElementById('venda-cliente').value || "Consumidor",
            total: parseFloat(totalT.replace('R$ ','').replace(',','.')),
            produtos: carrinho.map(c => c.qtd_venda + "x " + c.tipo).join(", "),
            pagamento: pgto,
            data_venda: new Date().toLocaleString('sv-SE'),
            loja_id: usuarioLogado.loja_id 
        }]);

        if(!error) {
            if(confirm("Venda Finalizada! Imprimir cupom?")) imprimirCupom(pgto, totalT);
            carrinho = []; 
            renderCarrinho();
            document.getElementById('venda-cliente').value = "";
        } else { throw error; }
    } catch (e) { alert("Erro ao processar venda: " + e.message); }
}

// --- ESTOQUE ---
async function carregarEstoque() {
    const { data } = await _supabase
        .from('produtos')
        .select('*')
        .eq('loja_id', usuarioLogado.loja_id)
        .order('tipo');

    const tbody = document.getElementById('corpo-estoque');
    tbody.innerHTML = "";
    data?.forEach(p => {
        tbody.innerHTML += `<tr>
            <td>${p.codigo_barras}</td>
            <td>${p.tipo}</td>
            <td>R$ ${p.preco.toFixed(2)}</td>
            <td>${p.quantidade}</td>
            <td class="somente-gerente">
                <button onclick='prepararEdicaoProduto(${JSON.stringify(p)})'>✏️</button>
                <button onclick="excluirProduto(${p.id})">🗑️</button>
            </td>
        </tr>`;
    });
    aplicarPermissoesVisuais();
}

async function salvarProduto() {
    const id = document.getElementById('edit-id-produto').value;
    const d = { 
        codigo_barras: document.getElementById('cad-codigo').value, 
        tipo: document.getElementById('cad-tipo').value, 
        preco: parseFloat(document.getElementById('cad-preco').value), 
        quantidade: parseInt(document.getElementById('cad-qtd').value),
        loja_id: usuarioLogado.loja_id 
    };

    if(id) {
        await _supabase.from('produtos').update(d).eq('id', id).eq('loja_id', usuarioLogado.loja_id); 
    } else {
        await _supabase.from('produtos').insert([d]);
    }
    fecharModalProduto(); 
    carregarEstoque();
}

// --- HISTÓRICO ---
async function carregarHistorico() {
    const ini = document.getElementById('filtro-inicio').value;
    const fim = document.getElementById('filtro-fim').value;
    
    let query = _supabase.from('historico_vendas')
        .select('*')
        .eq('loja_id', usuarioLogado.loja_id)
        .order('data_venda', {ascending: false});

    if(ini) query = query.gte('data_venda', ini + "T00:00:00");
    if(fim) query = query.lte('data_venda', fim + "T23:59:59");

    const { data } = await query;
    let soma = 0;
    const tbody = document.getElementById('corpo-historico');
    tbody.innerHTML = "";
    
    data?.forEach(v => {
        soma += v.total;
        tbody.innerHTML += `<tr>
            <td>${new Date(v.data_venda).toLocaleDateString()}</td>
            <td>${v.cliente}</td>
            <td>${v.produtos}</td>
            <td>${v.pagamento}</td>
            <td>R$ ${v.total.toFixed(2)}</td>
            <td><button class="somente-gerente" onclick="excluirVenda(${v.id})">🗑️</button></td>
        </tr>`;
    });
    document.getElementById('total-historico').innerText = "R$ " + soma.toFixed(2).replace('.', ',');
    aplicarPermissoesVisuais();
}

// --- USUÁRIOS ---
async function carregarUsuarios() {
    const { data } = await _supabase
        .from('usuarios')
        .select('*')
        .eq('loja_id', usuarioLogado.loja_id)
        .order('login');

    const tbody = document.getElementById('corpo-usuarios');
    tbody.innerHTML = "";
    data?.forEach(u => {
        const cor = u.ativo ? '#2ecc71' : '#e74c3c';
        tbody.innerHTML += `<tr>
            <td>${u.login}</td>
            <td>${u.nivel}</td>
            <td><span style="color:${cor}">●</span> ${u.ativo?'Ativo':'Inativo'}</td>
            <td>
                <button onclick='prepararEdicaoUsuario(${JSON.stringify(u)})'>✏️</button>
                <button onclick="excluirUsuario(${u.id})">🗑️</button>
            </td>
        </tr>`;
    });
}

async function salvarUsuario() {
    const id = document.getElementById('edit-id-usuario').value;
    const d = { 
        login: document.getElementById('user-login').value, 
        senha: document.getElementById('user-senha').value, 
        nivel: document.getElementById('user-nivel').value, 
        ativo: document.getElementById('user-status').value === "true",
        loja_id: usuarioLogado.loja_id
    };

    if(id) {
        await _supabase.from('usuarios').update(d).eq('id', id).eq('loja_id', usuarioLogado.loja_id); 
    } else {
        await _supabase.from('usuarios').insert([d]);
    }
    fecharModalUsuario(); 
    carregarUsuarios();
}

// --- AUXILIARES ---
function abrirModalProduto() { 
    document.getElementById('edit-id-produto').value = ""; 
    document.getElementById('cad-codigo').value = "";
    document.getElementById('cad-tipo').value = "";
    document.getElementById('cad-preco').value = "";
    document.getElementById('cad-qtd').value = "";
    document.getElementById('modal-produto').style.display='flex'; 
}

function abrirModalUsuario() { 
    document.getElementById('edit-id-usuario').value = ""; 
    document.getElementById('user-login').value = "";
    document.getElementById('user-senha').value = "";
    document.getElementById('modal-usuario').style.display='flex'; 
}

function fecharModalProduto() { document.getElementById('modal-produto').style.display='none'; }
function fecharModalUsuario() { document.getElementById('modal-usuario').style.display='none'; }
function fecharModalCarrinho() { document.getElementById('modal-editar-item').style.display = 'none'; }

function prepararEdicaoProduto(p) { 
    document.getElementById('edit-id-produto').value = p.id; 
    document.getElementById('cad-codigo').value = p.codigo_barras; 
    document.getElementById('cad-tipo').value = p.tipo; 
    document.getElementById('cad-preco').value = p.preco; 
    document.getElementById('cad-qtd').value = p.quantidade; 
    document.getElementById('modal-produto').style.display='flex'; 
}

function prepararEdicaoUsuario(u) { 
    document.getElementById('edit-id-usuario').value = u.id; 
    document.getElementById('user-login').value = u.login; 
    document.getElementById('user-senha').value = u.senha; 
    document.getElementById('user-nivel').value = u.nivel; 
    document.getElementById('user-status').value = u.ativo.toString(); 
    document.getElementById('modal-usuario').style.display='flex'; 
}

function abrirModalEditarItem(index) {
    const item = carrinho[index];
    document.getElementById('edit-carrinho-index').value = index;
    document.getElementById('edit-carrinho-nome').value = item.tipo;
    document.getElementById('edit-carrinho-qtd').value = item.qtd_venda;
    document.getElementById('edit-carrinho-preco').value = item.preco;
    document.getElementById('modal-editar-item').style.display = 'flex';
}

function salvarEdicaoCarrinho() {
    const index = document.getElementById('edit-carrinho-index').value;
    const novaQtd = parseInt(document.getElementById('edit-carrinho-qtd').value);
    const novoPreco = parseFloat(document.getElementById('edit-carrinho-preco').value);

    if (novaQtd > 0 && !isNaN(novoPreco)) {
        carrinho[index].qtd_venda = novaQtd;
        carrinho[index].preco = novoPreco;
        fecharModalCarrinho();
        renderCarrinho();
    }
}

function removerItemCarrinho(i) { carrinho.splice(i,1); renderCarrinho(); }
function verificarParcelas() { document.getElementById('campo-parcelas').style.display = (document.getElementById('venda-pagamento').value === "Cartão de Crédito") ? "block" : "none"; }

// --- EXCLUSÕES ---
async function excluirVenda(id) { 
    if(confirm("Excluir esta venda e estornar produtos?")) { 
        const { data: v } = await _supabase.from('historico_vendas').select('*').eq('id', id).single();
        if (v && v.produtos) {
            const itens = v.produtos.split(', ');
            for (const item of itens) {
                const partes = item.split('x ');
                const qtd = parseInt(partes[0]);
                const nome = partes[1];
                const { data: p } = await _supabase.from('produtos').select('id, quantidade').eq('tipo', nome).eq('loja_id', usuarioLogado.loja_id).single();
                if (p) await _supabase.from('produtos').update({ quantidade: p.quantidade + qtd }).eq('id', p.id);
            }
        }
        await _supabase.from('historico_vendas').delete().eq('id', id).eq('loja_id', usuarioLogado.loja_id); 
        carregarHistorico(); 
    } 
}

async function excluirUsuario(id) { if(confirm("Excluir?")) { await _supabase.from('usuarios').delete().eq('id', id).eq('loja_id', usuarioLogado.loja_id); carregarUsuarios(); } }
async function excluirProduto(id) { if(confirm("Excluir?")) { await _supabase.from('produtos').delete().eq('id', id).eq('loja_id', usuarioLogado.loja_id); carregarEstoque(); } }

// --- PRESENÇA ---
async function atualizarPresenca() {
    if (usuarioLogado?.id) {
        await _supabase.from('usuarios').update({ ultima_atividade: new Date().toISOString() }).eq('id', usuarioLogado.id);
    }
}
setInterval(atualizarPresenca, 30000);

// Atalhos
window.onkeydown = (e) => { 
    if(e.key === "F1") mostrarAba('vendas'); 
    if(e.key === "F2") finalizarVenda(); 
};

// Funções de Impressão (Placeholder)
function imprimirCupom(pgto, total) {
    const win = window.open('','','width=320,height=600');
    const agora = new Date().toLocaleString('pt-BR');
    const cliente = document.getElementById('venda-cliente').value || "Consumidor";
    win.document.write(`<html><body style="font-family:monospace;width:280px;font-size:12px;"><center><b>SISTEMA G. NOGUEIRA</b></center><br>DATA: ${agora}<br>CLIENTE: ${cliente}<br>PGTO: ${pgto}<hr>${carrinho.map(i => i.qtd_venda + "x " + i.tipo + " - " + (i.preco*i.qtd_venda).toFixed(2)).join('<br>')}<hr><b>TOTAL: ${total}</b><script>window.onload=function(){window.print();window.close();};</script></body></html>`);
    win.document.close();
}
