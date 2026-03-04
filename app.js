const SB_URL = 'https://btzfjrpbzigqsifbmjnb.supabase.co'; 
const SB_KEY = 'sb_publishable_aOC-9tDq5jpRyZM3swEmSA_2anmUryO'; 
const _supabase = supabase.createClient(SB_URL, SB_KEY);

// ID fixo da Isadora Nogueira Store para garantir o vínculo
const LOJA_ID_ATUAL = '8777a06a-e35f-4c3a-b94d-e8c155a1899f';

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
    const { data, error } = await _supabase.from('usuarios').select('*').eq('login', user).eq('senha', pass).eq('loja_id', LOJA_ID_ATUAL).single();
    
    if (error || !data) return alert("Acesso Negado!");
    if (!data.ativo) return alert("Usuário Inativo!");

    usuarioLogado = data;
    document.getElementById('particles-js').style.display = 'none';
    document.getElementById('tela-login').style.display = 'none';
    document.getElementById('painel-admin').style.display = 'flex';
    document.getElementById('user-info').innerText = `Operador: ${data.login.toUpperCase()}`;
    
    // Inicia a atualização de presença assim que logar
    atualizarPresenca(); 
    
    aplicarPermissoesVisuais();
    mostrarAba('vendas');
}

function mostrarAba(aba) {
    document.querySelectorAll('.aba').forEach(a => a.style.display = 'none');
    document.getElementById('aba-' + aba).style.display = 'block';
    if(aba === 'vendas') document.getElementById('venda-codigo').focus();
    if(aba === 'estoque') carregarEstoque();
    if(aba === 'historico') carregarHistorico();
    if(aba === 'usuarios') carregarUsuarios();
}

function aplicarPermissoesVisuais() {
    const isG = usuarioLogado.nivel === 'gerente';
    document.querySelectorAll('.somente-gerente').forEach(el => el.style.display = isG ? 'block' : 'none');
}

// --- VENDAS ---
async function adicionarAoCarrinho() {
    const cod = document.getElementById('venda-codigo').value;
    const qtd = parseInt(document.getElementById('venda-qtd').value) || 1;
    const { data: p } = await _supabase.from('produtos').select('*').eq('codigo_barras', cod).eq('loja_id', LOJA_ID_ATUAL).single();
    
    if (!p) return alert("Produto não cadastrado!");
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
        tbody.innerHTML += `<tr><td>${item.tipo}</td><td>${item.qtd_venda}</td><td>R$ ${item.preco.toFixed(2)}</td><td>R$ ${sub.toFixed(2)}</td>
        <td><button onclick="abrirModalEditarItem(${i})">✏️</button><button onclick="removerItemCarrinho(${i})">❌</button></td></tr>`;
    });
    document.getElementById('total-valor').innerText = `R$ ${t.toFixed(2).replace('.',',')}`;
}

async function finalizarVenda() {
    if(!carrinho.length) return alert("Carrinho vazio!");
    let pgto = document.getElementById('venda-pagamento').value;
    if(pgto === "Cartão de Crédito") pgto += " (" + document.getElementById('venda-parcelas').value + "x)";
    const totalT = document.getElementById('total-valor').innerText;

    try {
        // BAIXA DE ESTOQUE
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
            loja_id: LOJA_ID_ATUAL 
        }]);

        if(!error) {
            if(confirm("Venda Finalizada! Imprimir cupom?")) imprimirCupom(pgto, totalT);
            carrinho = []; renderCarrinho();
            document.getElementById('venda-cliente').value = "";
        } else { throw error; }
    } catch (e) { alert("Erro ao processar venda: " + e.message); }
}

function imprimirCupom(pgto, total) {
    const win = window.open('','','width=320,height=600');
    const agora = new Date().toLocaleString('pt-BR');
    const cliente = document.getElementById('venda-cliente').value || "Consumidor";
    win.document.write(`<html><body style="font-family:'Courier New',monospace; width:280px; padding:5px; font-size:12px;"><center>============================<br><b>ISADORA NOGUEIRA STORE</b><br>============================</center><br>DATA: ${agora}<br>CLIENTE: ${cliente.toUpperCase()}<br>PGTO: ${pgto}<br>----------------------------<br>${carrinho.map(i => i.qtd_venda + "x " + i.tipo.substring(0,15) + "... R$ " + (i.preco*i.qtd_venda).toFixed(2)).join('<br>')}<br>----------------------------<br><b>TOTAL GERAL: ${total}</b><br><br><center>Obrigado pela preferência!</center><script>window.onload=function(){window.print();window.close();};</script></body></html>`);
    win.document.close();
}
// 1. Abre o modal e preenche os campos com os dados atuais
function abrirModalEditarItem(index) {
    const item = carrinho[index];
    
    // Armazena o índice no campo oculto para saber quem estamos editando
    document.getElementById('edit-carrinho-index').value = index;
    
    // Preenche os campos do modal
    document.getElementById('edit-carrinho-nome').value = item.tipo; // Apenas visual
    document.getElementById('edit-carrinho-qtd').value = item.qtd_venda;
    document.getElementById('edit-carrinho-preco').value = item.preco;
    
    // Mostra o modal
    document.getElementById('modal-editar-item').style.display = 'flex';
}

// 2. Fecha o modal de edição do carrinho
function fecharModalCarrinho() {
    document.getElementById('modal-editar-item').style.display = 'none';
}

// 3. Salva a nova Quantidade e o novo Valor (O que você pediu)
function salvarEdicaoCarrinho() {
    // Pega o índice que salvamos ao abrir
    const index = document.getElementById('edit-carrinho-index').value;
    
    // Pega os novos valores digitados
    const novaQtd = parseInt(document.getElementById('edit-carrinho-qtd').value);
    const novoPreco = parseFloat(document.getElementById('edit-carrinho-preco').value);

    // Validação básica
    if (novaQtd > 0 && !isNaN(novoPreco)) {
        // Atualiza apenas Quantidade e Preço no carrinho
        carrinho[index].qtd_venda = novaQtd;
        carrinho[index].preco = novoPreco;
        
        // Fecha o modal e atualiza a tabela na tela
        fecharModalCarrinho();
        renderCarrinho();
    } else {
        alert("Por favor, insira valores válidos!");
    }
}
// --- ESTOQUE E USUÁRIOS ---
async function carregarEstoque() {
    const { data } = await _supabase.from('produtos').select('*').eq('loja_id', LOJA_ID_ATUAL).order('tipo');
    const tbody = document.getElementById('corpo-estoque');
    tbody.innerHTML = "";
    data?.forEach(p => {
        tbody.innerHTML += `<tr><td>${p.codigo_barras}</td><td>${p.tipo}</td><td>R$ ${p.preco.toFixed(2)}</td><td>${p.quantidade}</td>
        <td class="somente-gerente"><button onclick='prepararEdicaoProduto(${JSON.stringify(p)})'>✏️</button><button onclick="excluirProduto(${p.id})">🗑️</button></td></tr>`;
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
        loja_id: LOJA_ID_ATUAL 
    };
    if(id) await _supabase.from('produtos').update(d).eq('id', id).eq('loja_id', LOJA_ID_ATUAL); 
    else await _supabase.from('produtos').insert([d]);
    fecharModalProduto(); carregarEstoque();
}

async function carregarHistorico() {
    const ini = document.getElementById('filtro-inicio').value;
    const fim = document.getElementById('filtro-fim').value;
    let query = _supabase.from('historico_vendas').select('*').eq('loja_id', LOJA_ID_ATUAL).order('data_venda', {ascending: false});
    if(ini) query = query.gte('data_venda', ini + "T00:00:00");
    if(fim) query = query.lte('data_venda', fim + "T23:59:59");
    const { data } = await query;
    let soma = 0;
    const tbody = document.getElementById('corpo-historico');
    tbody.innerHTML = "";
    data?.forEach(v => {
        soma += v.total;
        tbody.innerHTML += `<tr><td>${new Date(v.data_venda).toLocaleDateString()}</td><td>${v.cliente}</td><td>${v.produtos}</td><td>${v.pagamento}</td><td>R$ ${v.total.toFixed(2)}</td><td><button class="somente-gerente" onclick="excluirVenda(${v.id})">🗑️</button></td></tr>`;
    });
    document.getElementById('total-historico').innerText = "R$ " + soma.toFixed(2).replace('.', ',');
    aplicarPermissoesVisuais();
}

async function carregarUsuarios() {
    const { data } = await _supabase.from('usuarios').select('*').eq('loja_id', LOJA_ID_ATUAL).order('login');
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
        login: document.getElementById('user-login').value, 
        senha: document.getElementById('user-senha').value, 
        nivel: document.getElementById('user-nivel').value, 
        ativo: document.getElementById('user-status').value === "true",
        loja_id: LOJA_ID_ATUAL
    };
    if(id) await _supabase.from('usuarios').update(d).eq('id', id).eq('loja_id', LOJA_ID_ATUAL); 
    else await _supabase.from('usuarios').insert([d]);
    fecharModalUsuario(); carregarUsuarios();
}

// --- AUXILIARES E MODAIS (CORREÇÃO AQUI) ---
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

function prepararEdicaoProduto(p) { document.getElementById('edit-id-produto').value = p.id; document.getElementById('cad-codigo').value = p.codigo_barras; document.getElementById('cad-tipo').value = p.tipo; document.getElementById('cad-preco').value = p.preco; document.getElementById('cad-qtd').value = p.quantidade; document.getElementById('modal-produto').style.display='flex'; }
function prepararEdicaoUsuario(u) { document.getElementById('edit-id-usuario').value = u.id; document.getElementById('user-login').value = u.login; document.getElementById('user-senha').value = u.senha; document.getElementById('user-nivel').value = u.nivel; document.getElementById('user-status').value = u.ativo.toString(); document.getElementById('modal-usuario').style.display='flex'; }
function fecharModalProduto() { document.getElementById('modal-produto').style.display='none'; }
function fecharModalUsuario() { document.getElementById('modal-usuario').style.display='none'; }
function removerItemCarrinho(i) { carrinho.splice(i,1); renderCarrinho(); }
function verificarParcelas() { document.getElementById('campo-parcelas').style.display = (document.getElementById('venda-pagamento').value === "Cartão de Crédito") ? "block" : "none"; }

// --- EXCLUSÕES COM ESTORNO ---
async function excluirVenda(id) { 
    if(confirm("Excluir esta venda e estornar produtos ao estoque?")) { 
        try {
            const { data: v } = await _supabase.from('historico_vendas').select('*').eq('id', id).single();
            if (v && v.produtos) {
                const itens = v.produtos.split(', ');
                for (const item of itens) {
                    const partes = item.split('x ');
                    if (partes.length === 2) {
                        const qtd = parseInt(partes[0]);
                        const nome = partes[1].trim();
                        const { data: p } = await _supabase.from('produtos').select('id, quantidade').eq('tipo', nome).eq('loja_id', LOJA_ID_ATUAL).single();
                        if (p) await _supabase.from('produtos').update({ quantidade: p.quantidade + qtd }).eq('id', p.id);
                    }
                }
            }
            await _supabase.from('historico_vendas').delete().eq('id', id).eq('loja_id', LOJA_ID_ATUAL); 
            await carregarHistorico(); 
        } catch (e) { alert("Erro ao excluir: " + e.message); }
    } 
}

async function excluirUsuario(id) { if(confirm("Excluir?")) { await _supabase.from('usuarios').delete().eq('id', id).eq('loja_id', LOJA_ID_ATUAL); carregarUsuarios(); } }
async function excluirProduto(id) { if(confirm("Excluir?")) { await _supabase.from('produtos').delete().eq('id', id).eq('loja_id', LOJA_ID_ATUAL); carregarEstoque(); } }

// --- MONITORAMENTO DE PRESENÇA (HEARTBEAT) ---
async function atualizarPresenca() {
    if (usuarioLogado && usuarioLogado.id) {
        await _supabase
            .from('usuarios')
            .update({ ultima_atividade: new Date().toISOString() })
            .eq('id', usuarioLogado.id);
    }
}

// Atualiza a cada 30 segundos
setInterval(atualizarPresenca, 30000);

// Atalhos e Eventos
function atalhosTeclado(e) { if(e.key === "F1") mostrarAba('vendas'); if(e.key === "F2") finalizarVenda(); }
window.onkeydown = atalhosTeclado;
