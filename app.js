const SB_URL = 'https://btzfjrpbzigqsifbmjnb.supabase.co'; 
const SB_KEY = 'sb_publishable_aOC-9tDq5jpRyZM3swEmSA_2anmUryO'; 
const _supabase = supabase.createClient(SB_URL, SB_KEY);

let usuarioLogado = null;
let carrinho = [];

// ANIMAÇÃO
window.onload = () => {
    if(typeof particlesJS !== 'undefined') {
        particlesJS("particles-js", { "particles": { "number": { "value": 80 }, "color": { "value": "#d4af37" }, "line_linked": { "color": "#d4af37" }, "move": { "speed": 2 } } });
    }
};

// LOGIN
async function fazerLogin() {
    const u = document.getElementById('user').value;
    const p = document.getElementById('pass').value;
    const { data, error } = await _supabase.from('usuarios').select('*, lojas(ativo, nome_loja)').eq('login', u).eq('senha', p).single();
    if(error || !data) return alert("Erro no login!");
    if(data.lojas?.ativo === false) return alert("Bloqueado!");
    usuarioLogado = data;
    document.getElementById('particles-js').style.display = 'none';
    document.getElementById('tela-login').style.display = 'none';
    document.getElementById('painel-admin').style.display = 'flex';
    document.getElementById('user-info').innerHTML = `<b>${data.lojas?.nome_loja}</b><br>${data.login}`;
    aplicarPermissoesVisuais(); mostrarAba('vendas');
}

// VENDAS
function verificarParcelas() { document.getElementById('campo-parcelas').style.display = (document.getElementById('venda-pagamento').value === "Cartão de Crédito") ? "block" : "none"; }
async function adicionarAoCarrinho() {
    const cod = document.getElementById('venda-codigo').value;
    const { data: p } = await _supabase.from('produtos').select('*').eq('codigo_barras', cod).single();
    if(!p) return alert("Não encontrado!");
    carrinho.push({...p, qtd_venda: parseInt(document.getElementById('venda-qtd').value) || 1});
    renderCarrinho();
}
function renderCarrinho() {
    const b = document.getElementById('corpo-carrinho'); b.innerHTML = ""; let t = 0;
    carrinho.forEach((item, i) => {
        let sub = item.preco * item.qtd_venda; t += sub;
        b.innerHTML += `<tr><td>${item.tipo}</td><td>${item.qtd_venda}</td><td>R$ ${item.preco.toFixed(2)}</td><td>R$ ${sub.toFixed(2)}</td>
        <td><button onclick="abrirModalEditarItem(${i})">✏️</button><button onclick="carrinho.splice(${i},1);renderCarrinho()">❌</button></td></tr>`;
    });
    document.getElementById('total-valor').innerText = `R$ ${t.toFixed(2)}`;
}

// EDITAR ITEM VENDAS
function abrirModalEditarItem(i) {
    document.getElementById('edit-carrinho-index').value = i;
    document.getElementById('edit-carrinho-nome').value = carrinho[i].tipo;
    document.getElementById('edit-carrinho-qtd').value = carrinho[i].qtd_venda;
    document.getElementById('edit-carrinho-preco').value = carrinho[i].preco;
    document.getElementById('modal-editar-item').style.display = 'flex';
}
function salvarEdicaoCarrinho() {
    const i = document.getElementById('edit-carrinho-index').value;
    carrinho[i].qtd_venda = parseInt(document.getElementById('edit-carrinho-qtd').value);
    carrinho[i].preco = parseFloat(document.getElementById('edit-carrinho-preco').value);
    fecharModalCarrinho(); renderCarrinho();
}
function fecharModalCarrinho() { document.getElementById('modal-editar-item').style.display = 'none'; }

// FINALIZAR E CUPOM
async function finalizarVenda() {
    let pgt = document.getElementById('venda-pagamento').value;
    const tot = document.getElementById('total-valor').innerText;
    const { error } = await _supabase.from('historico_vendas').insert([{
        loja_id: usuarioLogado.loja_id, cliente: document.getElementById('venda-cliente').value || "Consumidor",
        total: parseFloat(tot.replace('R$ ','')), produtos: carrinho.map(c => `${c.qtd_venda}x ${c.tipo}`).join(", "),
        pagamento: pgt, data_venda: new Date().toISOString()
    }]);
    if(!error) { imprimirCupom(pgt, tot); carrinho = []; renderCarrinho(); }
}

function imprimirCupom(p, t) {
    const w = window.open('','','width=300');
    w.document.write(`<html><body style="font-family:monospace">
        <center>==== ${usuarioLogado.lojas.nome_loja} ====<br>------------------<br>
        ${carrinho.map(i => `${i.qtd_venda}x ${i.tipo} R$ ${i.preco}`).join('<br>')}
        <br>------------------<br>TOTAL: ${t}<br>PGTO: ${p}</center>
        <script>window.onload=()=>{window.print();window.close();}</script></body></html>`);
}

// RESTANTE (ESTOQUE/USUARIOS)
function mostrarAba(a) { document.querySelectorAll('.aba').forEach(x => x.style.display = 'none'); document.getElementById('aba-'+a).style.display = 'block'; if(a==='estoque') carregarEstoque(); if(a==='usuarios') carregarUsuarios(); if(a==='historico') carregarHistorico(); }
function aplicarPermissoesVisuais() { document.querySelectorAll('.somente-gerente').forEach(e => e.style.display = usuarioLogado.nivel==='gerente' ? 'block' : 'none'); }
async function carregarEstoque() { 
    const { data } = await _supabase.from('produtos').select('*').order('tipo');
    const b = document.getElementById('corpo-estoque'); b.innerHTML = "";
    data?.forEach(p => b.innerHTML += `<tr><td>${p.codigo_barras}</td><td>${p.tipo}</td><td>${p.preco}</td><td>${p.quantidade}</td><td><button onclick='prepararEdicaoProduto(${JSON.stringify(p)})'>✏️</button><button onclick="excluirProduto(${p.id})">🗑️</button></td></tr>`);
}
async function salvarProduto() {
    const id = document.getElementById('edit-id-produto').value;
    const d = { loja_id: usuarioLogado.loja_id, codigo_barras: document.getElementById('cad-codigo').value, tipo: document.getElementById('cad-tipo').value, preco: document.getElementById('cad-preco').value, quantidade: document.getElementById('cad-qtd').value };
    if(id) await _supabase.from('produtos').update(d).eq('id', id); else await _supabase.from('produtos').insert([d]);
    fecharModalProduto(); carregarEstoque();
}
function abrirModalProduto() { document.getElementById('edit-id-produto').value=""; document.getElementById('modal-produto').style.display='flex'; }
function fecharModalProduto() { document.getElementById('modal-produto').style.display='none'; }
function prepararEdicaoProduto(p) { document.getElementById('edit-id-produto').value = p.id; document.getElementById('cad-codigo').value = p.codigo_barras; document.getElementById('cad-tipo').value = p.tipo; document.getElementById('cad-preco').value = p.preco; document.getElementById('cad-qtd').value = p.quantidade; document.getElementById('modal-produto').style.display = 'flex'; }
async function excluirProduto(id) { if(confirm("Excluir?")) { await _supabase.from('produtos').delete().eq('id', id); carregarEstoque(); } }

// USUARIOS
async function carregarUsuarios() {
    const { data } = await _supabase.from('usuarios').select('*');
    const b = document.getElementById('corpo-usuarios'); b.innerHTML = "";
    data?.forEach(u => b.innerHTML += `<tr><td>${u.login}</td><td>${u.nivel}</td><td>${u.ativo?'Ativo':'Inativo'}</td><td><button onclick='prepararEdicaoUsuario(${JSON.stringify(u)})'>✏️</button><button onclick="excluirUsuario(${u.id})">🗑️</button></td></tr>`);
}
async function salvarUsuario() {
    const id = document.getElementById('edit-id-usuario').value;
    const d = { loja_id: usuarioLogado.loja_id, login: document.getElementById('user-login').value, senha: document.getElementById('user-senha').value, nivel: document.getElementById('user-nivel').value, ativo: document.getElementById('user-status').value === "true" };
    if(id) await _supabase.from('usuarios').update(d).eq('id', id); else await _supabase.from('usuarios').insert([d]);
    fecharModalUsuario(); carregarUsuarios();
}
function abrirModalUsuario() { document.getElementById('edit-id-usuario').value=""; document.getElementById('modal-usuario').style.display='flex'; }
function fecharModalUsuario() { document.getElementById('modal-usuario').style.display='none'; }
function prepararEdicaoUsuario(u) { document.getElementById('edit-id-usuario').value = u.id; document.getElementById('user-login').value = u.login; document.getElementById('user-senha').value = u.senha; document.getElementById('user-nivel').value = u.nivel; document.getElementById('user-status').value = u.ativo.toString(); document.getElementById('modal-usuario').style.display = 'flex'; }
async function excluirUsuario(id) { if(confirm("Excluir?")) { await _supabase.from('usuarios').delete().eq('id', id); carregarUsuarios(); } }

// HISTORICO
async function carregarHistorico() {
    const { data } = await _supabase.from('historico_vendas').select('*').order('data_venda', {ascending: false});
    const b = document.getElementById('corpo-historico'); b.innerHTML = ""; let s = 0;
    data?.forEach(v => { s += v.total; b.innerHTML += `<tr><td>${new Date(v.data_venda).toLocaleDateString()}</td><td>${v.cliente}</td><td>${v.produtos}</td><td>R$ ${v.total.toFixed(2)}</td><td><button onclick="excluirVenda(${v.id})">🗑️</button></td></tr>`; });
    document.getElementById('total-historico').innerText = `R$ ${s.toFixed(2)}`;
}
async function excluirVenda(id) { if(confirm("Excluir?")) { await _supabase.from('historico_vendas').delete().eq('id', id); carregarHistorico(); } }
