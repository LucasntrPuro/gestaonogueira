const SB_URL = 'https://btzfjrpbzigqsifbmjnb.supabase.co'; 
const SB_KEY = 'sb_publishable_aOC-9tDq5jpRyZM3swEmSA_2anmUryO'; 
const _supabase = supabase.createClient(SB_URL, SB_KEY);

let usuarioLogado = null;
let carrinho = [];

// --- EFEITO DE FUNDO (PARTÍCULAS) ---
if(typeof particlesJS !== 'undefined') {
    particlesJS("particles-js", { 
        "particles": { 
            "number": { "value": 60 }, 
            "color": { "value": "#d4af37" }, 
            "line_linked": { "color": "#d4af37" }, 
            "move": { "speed": 1.5 } 
        } 
    });
}

// --- LOGIN COM VERIFICAÇÃO DE BLOQUEIO E CARGA DE LOJA ---
async function fazerLogin() {
    const user = document.getElementById('user').value;
    const pass = document.getElementById('pass').value;
    
    const { data, error } = await _supabase
        .from('usuarios')
        .select('*, lojas(ativo, nome_loja)') 
        .eq('login', user)
        .eq('senha', pass)
        .single();
    
    if (error || !data) {
        return alert("Acesso Negado! Usuário ou senha incorretos.");
    }

    if (data.lojas && data.lojas.ativo === false) {
        return alert("SISTEMA BLOQUEADO: Pendência financeira detectada. Entre em contato com o administrador.");
    }

    if (!data.ativo) return alert("Seu usuário está desativado.");
    if (!data.loja_id) return alert("Erro: Usuário sem loja vinculada.");

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

// --- VENDAS COM CARIMBO DE LOJA ---
async function adicionarAoCarrinho() {
    const cod = document.getElementById('venda-codigo').value;
    const qtd = parseInt(document.getElementById('venda-qtd').value) || 1;
    
    const { data: p } = await _supabase.from('produtos').select('*').eq('codigo_barras', cod).single();
    
    if (!p) return alert("Produto não encontrado!");
    
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
    if(pgto === "Cartão de Crédito") pgto += ` (${document.getElementById('venda-parcelas').value}x)`;
    const totalT = document.getElementById('total-valor').innerText;

    const { error } = await _supabase.from('historico_vendas').insert([{
        loja_id: usuarioLogado.loja_id, // CARIMBO DE LOJA
        cliente: document.getElementById('venda-cliente').value || "Consumidor",
        total: parseFloat(totalT.replace('R$ ','').replace(',','.')),
        produtos: carrinho.map(c => `${c.qtd_venda}x ${c.tipo}`).join(", "),
        pagamento: pgto,
        data_venda: new Date().toLocaleString('sv-SE')
    }]);

    if(!error) {
        if(confirm("Venda realizada! Imprimir cupom?")) imprimirCupom(pgto, totalT);
        carrinho = []; 
        renderCarrinho();
        document.getElementById('venda-cliente').value = "";
    } else {
        alert("Erro ao salvar venda: " + error.message);
    }
}

// --- ESTOQUE COM CARIMBO DE LOJA ---
async function carregarEstoque() {
    const { data } = await _supabase.from('produtos').select('*').order('tipo');
    const tbody = document.getElementById('corpo-estoque');
    tbody.innerHTML = "";
    data?.forEach(p => {
        tbody.innerHTML += `<tr><td>${p.codigo_barras}</td><td>${p.tipo}</td><td>R$ ${p.preco.toFixed(2)}</td><td>${p.quantidade}</td>
        <td class="somente-gerente">
            <button onclick='prepararEdicaoProduto(${JSON.stringify(p)})'>✏️</button>
            <button onclick="excluirProduto(${p.id})">🗑️</button>
        </td></tr>`;
    });
    aplicarPermissoesVisuais();
}

async function salvarProduto() {
    const id = document.getElementById('edit-id-produto').value;
    const d = { 
        loja_id: usuarioLogado.loja_id, // CARIMBO DE LOJA
        codigo_barras: document.getElementById('cad-codigo').value, 
        tipo: document.getElementById('cad-tipo').value, 
        preco: parseFloat(document.getElementById('cad-preco').value), 
        quantidade: parseInt(document.getElementById('cad-qtd').value) 
    };
    
    if(id) await _supabase.from('produtos').update(d).eq('id', id); 
    else await _supabase.from('produtos').insert([d]);
    
    fecharModalProduto(); carregarEstoque();
}

// --- USUÁRIOS COM CARIMBO DE LOJA ---
async function carregarUsuarios() {
    const { data } = await _supabase.from('usuarios').select('*').order('login');
    const tbody = document.getElementById('corpo-usuarios');
    tbody.innerHTML = "";
    data?.forEach(u => {
        const cor = u.ativo ? '#2ecc71' : '#e74c3c';
        tbody.innerHTML += `<tr><td>${u.login}</td><td>${u.nivel}</td><td><span style="color:${cor}">●</span> ${u.ativo?'Ativo':'Inativo'}</td>
        <td><button onclick='prepararEdicaoUsuario(${JSON.stringify(u)})'>✏️</button><button onclick="excluirUsuario(${u.id})">🗑️</button></td></tr>`;
    });
}

async function salvarUsuario() {
    const id = document.getElementById('edit-id-usuario').value;
    const d = { 
        loja_id: usuarioLogado.loja_id, // CARIMBO DE LOJA
        login: document.getElementById('user-login').value, 
        senha: document.getElementById('user-senha').value, 
        nivel: document.getElementById('user-nivel').value, 
        ativo: document.getElementById('user-status').value === "true" 
    };
    if(id) await _supabase.from('usuarios').update(d).eq('id', id); 
    else await _supabase.from('usuarios').insert([d]);
    fecharModalUsuario(); carregarUsuarios();
}

// --- HISTÓRICO ---
async function carregarHistorico() {
    const ini = document.getElementById('filtro-inicio').value;
    const fim = document.getElementById('filtro-fim').value;
    let query = _supabase.from('historico_vendas').select('*').order('data_venda', {ascending: false});
    if(ini) query = query.gte('data_venda', `${ini}T00:00:00`);
    if(fim) query = query.lte('data_venda', `${fim}T23:59:59`);
    
    const { data } = await query;
    let soma = 0;
    const tbody = document.getElementById('corpo-historico');
    tbody.innerHTML = "";
    data?.forEach(v => {
        soma += v.total;
        tbody.innerHTML += `<tr><td>${new Date(v.data_venda).toLocaleDateString()}</td><td>${v.cliente}</td><td>${v.produtos}</td><td>${v.pagamento}</td><td>R$ ${v.total.toFixed(2)}</td><td><button class="somente-gerente" onclick="excluirVenda(${v.id})">🗑️</button></td></tr>`;
    });
    document.getElementById('total-historico').innerText = `R$ ${soma.toFixed(2).replace('.', ',')}`;
    aplicarPermissoesVisuais();
}

// --- IMPRESSÃO ---
function imprimirCupom(pgto, total) {
    const win = window.open('','','width=320,height=600');
    const agora = new Date().toLocaleString('pt-BR');
    const cliente = document.getElementById('venda-cliente').value || "Consumidor";
    const nomeLoja = usuarioLogado.lojas ? usuarioLogado.lojas.nome_loja : "GESTAO NOGUEIRA";
    
    win.document.write(`
        <html><body style="font-family:'Courier New',monospace; width:280px; padding:5px; font-size:12px;">
        <center>============================<br><b>${nomeLoja.toUpperCase()}</b><br>============================</center><br>
        DATA: ${agora}<br>CLIENTE: ${cliente.toUpperCase()}<br>PGTO: ${pgto}<br>
        ----------------------------<br>
        ${carrinho.map(i => `${i.qtd_venda}x ${i.tipo.substring(0,15)} R$ ${(i.preco*i.qtd_venda).toFixed(2)}`).join('<br>')}
        <br>----------------------------<br>
        <b>TOTAL GERAL: ${total}</b><br><br>
        <center>Obrigado pela preferência!</center>
        <script>window.onload=function(){window.print();window.close();};</script></body></html>
    `);
    win.document.close();
}

// --- FUNÇÕES AUXILIARES ---
function abrirModalEditarItem(idx) {
    const item = carrinho[idx];
    document.getElementById('edit-carrinho-index').value = idx;
    document.getElementById('edit-carrinho-nome').value = item.tipo;
    document.getElementById('edit-carrinho-qtd').value = item.qtd_venda;
    document.getElementById('edit-carrinho-preco').value = item.preco;
    document.getElementById('modal-editar-item').style.display = 'flex';
}
function salvarEdicaoCarrinho() {
    const idx = document.getElementById('edit-carrinho-index').value;
    carrinho[idx].qtd_venda = parseInt(document.getElementById('edit-carrinho-qtd').value);
    carrinho[idx].preco = parseFloat(document.getElementById('edit-carrinho-preco').value);
    document.getElementById('modal-editar-item').style.display = 'none';
    renderCarrinho();
}
function fecharModalCarrinho() { document.getElementById('modal-editar-item').style.display = 'none'; }
function prepararEdicaoProduto(p) { document.getElementById('edit-id-produto').value = p.id; document.getElementById('cad-codigo').value = p.codigo_barras; document.getElementById('cad-tipo').value = p.tipo; document.getElementById('cad-preco').value = p.preco; document.getElementById('cad-qtd').value = p.quantidade; document.getElementById('modal-produto').style.display='flex'; }
function prepararEdicaoUsuario(u) { document.getElementById('edit-id-usuario').value = u.id; document.getElementById('user-login').value = u.login; document.getElementById('user-senha').value = u.senha; document.getElementById('user-nivel').value = u.nivel; document.getElementById('user-status').value = u.ativo.toString(); document.getElementById('modal-usuario').style.display='flex'; }
function abrirModalProduto() { document.getElementById('edit-id-produto').value=""; document.getElementById('modal-produto').style.display='flex'; }
function abrirModalUsuario() { document.getElementById('edit-id-usuario').value=""; document.getElementById('modal-usuario').style.display='flex'; }
function fecharModalProduto() { document.getElementById('modal-produto').style.display='none'; }
function fecharModalUsuario() { document.getElementById('modal-usuario').style.display='none'; }
function removerItemCarrinho(i) { carrinho.splice(i,1); renderCarrinho(); }
function verificarParcelas() { document.getElementById('campo-parcelas').style.display = (document.getElementById('venda-pagamento').value === "Cartão de Crédito") ? "block" : "none"; }
async function excluirVenda(id) { if(confirm("Excluir?")) { await _supabase.from('historico_vendas').delete().eq('id', id); carregarHistorico(); } }
async function excluirUsuario(id) { if(confirm("Excluir?")) { await _supabase.from('usuarios').delete().eq('id', id); carregarUsuarios(); } }
async function excluirProduto(id) { if(confirm("Excluir?")) { await _supabase.from('produtos').delete().eq('id', id); carregarEstoque(); } }
