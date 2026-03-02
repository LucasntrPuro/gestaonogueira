const SB_URL = 'https://btzfjrpbzigqsifbmjnb.supabase.co'; 
const SB_KEY = 'sb_publishable_aOC-9tDq5jpRyZM3swEmSA_2anmUryO'; 
const _supabase = supabase.createClient(SB_URL, SB_KEY);

let usuarioLogado = null;
let carrinho = [];

// --- ANIMAÇÃO DE FUNDO ---
window.onload = function() {
    if(typeof particlesJS !== 'undefined') {
        particlesJS("particles-js", {
            "particles": {
                "number": { "value": 80 },
                "color": { "value": "#d4af37" },
                "line_linked": { "enable": true, "color": "#d4af37" },
                "move": { "enable": true, "speed": 2 }
            }
        });
    }
};

// --- LOGIN ---
async function fazerLogin() {
    const user = document.getElementById('user').value;
    const pass = document.getElementById('pass').value;
    const { data, error } = await _supabase.from('usuarios').select('*, lojas(ativo, nome_loja)').eq('login', user).eq('senha', pass).single();
    
    if (error || !data) return alert("Usuário ou Senha incorretos!");
    if (data.lojas && data.lojas.ativo === false) return alert("SISTEMA BLOQUEADO!");

    usuarioLogado = data;
    document.getElementById('particles-js').style.display = 'none';
    document.getElementById('tela-login').style.display = 'none';
    document.getElementById('painel-admin').style.display = 'flex';
    document.getElementById('user-info').innerHTML = `<b style="color:#d4af37">${data.lojas?.nome_loja.toUpperCase()}</b><br>Operador: ${data.login.toUpperCase()}`;
    
    aplicarPermissoesVisuais();
    mostrarAba('vendas');
}

// --- VENDAS (PDV) ---
function verificarParcelas() {
    const pgto = document.getElementById('venda-pagamento').value;
    document.getElementById('campo-parcelas').style.display = (pgto === "Cartão de Crédito") ? "block" : "none";
}

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
    tbody.innerHTML = ""; let t = 0;
    carrinho.forEach((item, i) => {
        const sub = item.preco * item.qtd_venda; t += sub;
        tbody.innerHTML += `<tr><td>${item.tipo}</td><td>${item.qtd_venda}</td><td>R$ ${item.preco.toFixed(2)}</td><td>R$ ${sub.toFixed(2)}</td>
        <td><button onclick="abrirModalEditarItem(${i})">✏️</button><button onclick="removerItemCarrinho(${i})">❌</button></td></tr>`;
    });
    document.getElementById('total-valor').innerText = `R$ ${t.toFixed(2).replace('.',',')}`;
}

// --- ESTOQUE E USUÁRIOS ---
async function carregarEstoque() {
    const { data } = await _supabase.from('produtos').select('*').order('tipo');
    const tbody = document.getElementById('corpo-estoque');
    tbody.innerHTML = "";
    data?.forEach(p => {
        tbody.innerHTML += `<tr><td>${p.codigo_barras}</td><td>${p.tipo}</td><td>R$ ${p.preco.toFixed(2)}</td><td>${p.quantidade}</td><td class="somente-gerente"><button onclick='prepararEdicaoProduto(${JSON.stringify(p)})'>✏️</button><button onclick="excluirProduto(${p.id})">🗑️</button></td></tr>`;
    });
}

async function salvarProduto() {
    const id = document.getElementById('edit-id-produto').value;
    const d = { loja_id: usuarioLogado.loja_id, codigo_barras: document.getElementById('cad-codigo').value, tipo: document.getElementById('cad-tipo').value, preco: parseFloat(document.getElementById('cad-preco').value), quantidade: parseInt(document.getElementById('cad-qtd').value) };
    if(id) await _supabase.from('produtos').update(d).eq('id', id); else await _supabase.from('produtos').insert([d]);
    fecharModalProduto(); carregarEstoque();
}

async function finalizarVenda() {
    if(!carrinho.length) return alert("Vazio!");
    let pgto = document.getElementById('venda-pagamento').value;
    const totalT = document.getElementById('total-valor').innerText;
    const { error } = await _supabase.from('historico_vendas').insert([{
        loja_id: usuarioLogado.loja_id, cliente: document.getElementById('venda-cliente').value || "Consumidor",
        total: parseFloat(totalT.replace('R$ ','').replace(',','.')), produtos: carrinho.map(c => `${c.qtd_venda}x ${c.tipo}`).join(", "),
        pagamento: pgto, data_venda: new Date().toISOString()
    }]);
    if(!error) { imprimirCupom(pgto, totalT); carrinho = []; renderCarrinho(); }
}

function imprimirCupom(pgto, total) {
    const win = window.open('','','width=320');
    win.document.write(`<html><body style="font-family:monospace;width:280px;"><center><b>${usuarioLogado.lojas.nome_loja.toUpperCase()}</b><br>----------------------------<br>TOTAL: ${total}<br>PGTO: ${pgto}<br>----------------------------</center><script>window.onload=function(){window.print();window.close();};</script></body></html>`);
}

// --- AUXILIARES ---
function mostrarAba(aba) {
    document.querySelectorAll('.aba').forEach(a => a.style.display = 'none');
    document.getElementById('aba-' + aba).style.display = 'block';
    if(aba === 'estoque') carregarEstoque();
    if(aba === 'historico') carregarHistorico();
    if(aba === 'usuarios') carregarUsuarios();
}

function aplicarPermissoesVisuais() {
    const isG = usuarioLogado.nivel === 'gerente';
    document.querySelectorAll('.somente-gerente').forEach(el => el.style.display = isG ? 'block' : 'none');
}

// ... (Outras funções de modal e carregar permanecem as mesmas das versões funcionais anteriores)
