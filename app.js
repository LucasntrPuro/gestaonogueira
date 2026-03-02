const SB_URL = 'https://btzfjrpbzigqsifbmjnb.supabase.co'; 
const SB_KEY = 'sb_publishable_aOC-9tDq5jpRyZM3swEmSA_2anmUryO'; 
const _supabase = supabase.createClient(SB_URL, SB_KEY);

let usuarioLogado = null;
let carrinho = [];

// --- LOGIN COM CAPTURA DE LOJA ---
async function fazerLogin() {
    const user = document.getElementById('user').value;
    const pass = document.getElementById('pass').value;
    
    const { data, error } = await _supabase
        .from('usuarios')
        .select('*, lojas(ativo, nome_loja)') 
        .eq('login', user)
        .eq('senha', pass)
        .single();
    
    if (error || !data) return alert("Usuário ou Senha incorretos!");
    if (data.lojas && data.lojas.ativo === false) return alert("SISTEMA BLOQUEADO: Pendência financeira.");
    if (!data.ativo) return alert("Usuário inativo!");

    // Guarda os dados cruciais na memória
    usuarioLogado = data;
    const nomeLoja = data.lojas ? data.lojas.nome_loja : "Gestão Nogueira";

    document.getElementById('particles-js').style.display = 'none';
    document.getElementById('tela-login').style.display = 'none';
    document.getElementById('painel-admin').style.display = 'flex';
    document.getElementById('user-info').innerHTML = `
        <b style="color:#d4af37">${nomeLoja.toUpperCase()}</b><br>
        Operador: ${data.login.toUpperCase()}
    `;
    
    aplicarPermissoesVisuais();
    mostrarAba('vendas');
}

// --- CONTROLE DE INTERFACE ---
function aplicarPermissoesVisuais() {
    const isG = usuarioLogado.nivel === 'gerente';
    document.querySelectorAll('.somente-gerente').forEach(el => el.style.display = isG ? 'block' : 'none');
}

function mostrarAba(aba) {
    document.querySelectorAll('.aba').forEach(a => a.style.display = 'none');
    document.getElementById('aba-' + aba).style.display = 'block';
    if(aba === 'vendas') document.getElementById('venda-codigo').focus();
    if(aba === 'estoque') carregarEstoque();
    if(aba === 'historico') carregarHistorico();
    if(aba === 'usuarios') carregarUsuarios();
}

// --- SISTEMA DE VENDAS ---
async function adicionarAoCarrinho() {
    const cod = document.getElementById('venda-codigo').value;
    const qtd = parseInt(document.getElementById('venda-qtd').value) || 1;
    
    const { data: p, error } = await _supabase.from('produtos').select('*').eq('codigo_barras', cod).single();
    
    if (error || !p) return alert("Produto não encontrado!");
    
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
            <td><button onclick="removerItemCarrinho(${i})">❌</button></td>
        </tr>`;
    });
    document.getElementById('total-valor').innerText = `R$ ${t.toFixed(2).replace('.',',')}`;
}

async function finalizarVenda() {
    if(!carrinho.length) return alert("Carrinho vazio!");
    
    let pgto = document.getElementById('venda-pagamento').value;
    const totalT = document.getElementById('total-valor').innerText;

    const { error } = await _supabase.from('historico_vendas').insert([{
        loja_id: usuarioLogado.loja_id, // CARIMBO AUTOMÁTICO
        cliente: document.getElementById('venda-cliente').value || "Consumidor",
        total: parseFloat(totalT.replace('R$ ','').replace(',','.')),
        produtos: carrinho.map(c => `${c.qtd_venda}x ${c.tipo}`).join(", "),
        pagamento: pgto,
        data_venda: new Date().toISOString()
    }]);

    if(!error) {
        alert("Venda realizada com sucesso!");
        imprimirCupom(pgto, totalT);
        carrinho = []; 
        renderCarrinho();
    } else {
        alert("Erro ao salvar venda: " + error.message);
    }
}

// --- GESTÃO DE ESTOQUE ---
async function carregarEstoque() {
    const { data, error } = await _supabase.from('produtos').select('*').order('tipo');
    if(error) return console.error(error);

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
}

async function salvarProduto() {
    const id = document.getElementById('edit-id-produto').value;
    const dados = { 
        loja_id: usuarioLogado.loja_id, // CARIMBO AUTOMÁTICO OBRIGATÓRIO
        codigo_barras: document.getElementById('cad-codigo').value, 
        tipo: document.getElementById('cad-tipo').value, 
        preco: parseFloat(document.getElementById('cad-preco').value), 
        quantidade: parseInt(document.getElementById('cad-qtd').value) 
    };
    
    let res;
    if(id) res = await _supabase.from('produtos').update(dados).eq('id', id);
    else res = await _supabase.from('produtos').insert([dados]);

    if(res.error) {
        alert("Erro ao gravar no banco: " + res.error.message);
    } else {
        fecharModalProduto();
        carregarEstoque();
    }
}

// --- GESTÃO DE USUÁRIOS ---
async function carregarUsuarios() {
    const { data } = await _supabase.from('usuarios').select('*').order('login');
    const tbody = document.getElementById('corpo-usuarios');
    tbody.innerHTML = "";
    data?.forEach(u => {
        tbody.innerHTML += `<tr>
            <td>${u.login}</td>
            <td>${u.nivel}</td>
            <td>${u.ativo ? 'Ativo' : 'Inativo'}</td>
            <td><button onclick='prepararEdicaoUsuario(${JSON.stringify(u)})'>✏️</button></td>
        </tr>`;
    });
}

async function salvarUsuario() {
    const id = document.getElementById('edit-id-usuario').value;
    const d = { 
        loja_id: usuarioLogado.loja_id, 
        login: document.getElementById('user-login').value, 
        senha: document.getElementById('user-senha').value, 
        nivel: document.getElementById('user-nivel').value, 
        ativo: document.getElementById('user-status').value === "true" 
    };
    if(id) await _supabase.from('usuarios').update(d).eq('id', id); 
    else await _supabase.from('usuarios').insert([d]);
    fecharModalUsuario(); carregarUsuarios();
}

// --- HISTÓRICO DE VENDAS ---
async function carregarHistorico() {
    const { data } = await _supabase.from('historico_vendas').select('*').order('data_venda', {ascending: false});
    const tbody = document.getElementById('corpo-historico');
    tbody.innerHTML = "";
    let soma = 0;
    data?.forEach(v => {
        soma += v.total;
        tbody.innerHTML += `<tr>
            <td>${new Date(v.data_venda).toLocaleDateString()}</td>
            <td>${v.cliente}</td>
            <td>${v.produtos}</td>
            <td>R$ ${v.total.toFixed(2)}</td>
        </tr>`;
    });
    document.getElementById('total-historico').innerText = `R$ ${soma.toFixed(2)}`;
}

// --- AUXILIARES E MODAIS ---
function prepararEdicaoProduto(p) {
    document.getElementById('edit-id-produto').value = p.id;
    document.getElementById('cad-codigo').value = p.codigo_barras;
    document.getElementById('cad-tipo').value = p.tipo;
    document.getElementById('cad-preco').value = p.preco;
    document.getElementById('cad-qtd').value = p.quantidade;
    document.getElementById('modal-produto').style.display = 'flex';
}

function abrirModalProduto() {
    document.getElementById('edit-id-produto').value = "";
    document.getElementById('modal-produto').style.display = 'flex';
}

function fecharModalProduto() { document.getElementById('modal-produto').style.display = 'none'; }
function fecharModalUsuario() { document.getElementById('modal-usuario').style.display = 'none'; }
function removerItemCarrinho(i) { carrinho.splice(i,1); renderCarrinho(); }

function imprimirCupom(pgto, total) {
    const win = window.open('','','width=320,height=600');
    win.document.write(`<html><body style="font-family:monospace;width:280px;">
        <center><b>${usuarioLogado.lojas?.nome_loja || 'LOJA'}</b><br>
        ----------------------------<br>
        TOTAL: ${total}<br>PGTO: ${pgto}<br>
        ----------------------------<br>
        OBRIGADO!</center>
        <script>window.onload=function(){window.print();window.close();};</script>
    </body></html>`);
    win.document.close();
}

async function excluirProduto(id) {
    if(confirm("Deseja excluir este produto?")) {
        await _supabase.from('produtos').delete().eq('id', id);
        carregarEstoque();
    }
}
