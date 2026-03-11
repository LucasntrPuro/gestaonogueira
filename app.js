const SB_URL = 'https://btzfjrpbzigqsifbmjnb.supabase.co'; 
const SB_KEY = 'sb_publishable_aOC-9tDq5jpRyZM3swEmSA_2anmUryO'; 
const _supabase = supabase.createClient(SB_URL, SB_KEY);

let usuarioLogado = null;
let carrinho = [];

// --- 1. INTERFACE E INICIALIZAÇÃO ---
window.addEventListener('load', () => {
    if(typeof particlesJS !== 'undefined') {
        particlesJS("particles-js", { "particles": { "number": { "value": 60 }, "color": { "value": "#d4af37" }, "line_linked": { "color": "#d4af37" }, "move": { "speed": 1.5 } } });
    }
});

function mostrarAba(aba) {
    if (!usuarioLogado) return;
    document.querySelectorAll('.aba').forEach(a => a.style.display = 'none');
    document.getElementById('aba-' + aba).style.display = 'block';
    if(aba === 'vendas') document.getElementById('venda-codigo').focus();
    if(aba === 'estoque') carregarEstoque();
    if(aba === 'historico') carregarHistorico();
    if(aba === 'usuarios') carregarUsuarios();
}

// --- 2. LOGIN ---
async function fazerLogin() {
    const user = document.getElementById('user').value;
    const pass = document.getElementById('pass').value;
    if (!user || !pass) return alert("Preencha todos os campos!");

    const { data, error } = await _supabase.from('usuarios').select('*').eq('login', user).eq('senha', pass).maybeSingle();
    if (error || !data) return alert("Usuário ou senha incorretos!");
    if (!data.ativo) return alert("Usuário Inativo!");

    usuarioLogado = data;
    document.getElementById('particles-js').style.display = 'none';
    document.getElementById('tela-login').style.display = 'none';
    document.getElementById('painel-admin').style.display = 'flex';
    document.getElementById('user-info').innerText = `Operador: ${data.login.toUpperCase()}`;
    
    aplicarPermissoesVisuais();
    mostrarAba('vendas');
    setInterval(atualizarPresenca, 30000);
}

// --- 3. PDV / VENDAS ---
async function adicionarAoCarrinho() {
    const cod = document.getElementById('venda-codigo').value;
    const qtd = parseInt(document.getElementById('venda-qtd').value) || 1;
    const { data: p } = await _supabase.from('produtos').select('*').eq('codigo_barras', cod).eq('loja_id', usuarioLogado.loja_id).maybeSingle();
    
    if (!p) return alert("Produto não encontrado!");
    if (p.quantidade < qtd) return alert("Estoque insuficiente!");

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
            <td>
                <button onclick="abrirModalEditarItem(${i})">✏️</button>
                <button onclick="removerItemCarrinho(${i})">❌</button>
            </td>
        </tr>`;
    });
    document.getElementById('total-valor').innerText = `R$ ${total.toFixed(2).replace('.',',')}`;
}

function removerItemCarrinho(index) {
    carrinho.splice(index, 1);
    renderCarrinho();
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
    carrinho[index].qtd_venda = parseInt(document.getElementById('edit-carrinho-qtd').value);
    carrinho[index].preco = parseFloat(document.getElementById('edit-carrinho-preco').value);
    document.getElementById('modal-editar-item').style.display = 'none';
    renderCarrinho();
}

async function finalizarVenda() {
    if(!carrinho.length) return alert("Carrinho vazio!");
    let pgto = document.getElementById('venda-pagamento').value;
    if(pgto === "Cartão de Crédito") pgto += ` (${document.getElementById('venda-parcelas').value}x)`;
    const totalVenda = parseFloat(document.getElementById('total-valor').innerText.replace('R$ ','').replace(',','.'));

    try {
        for (const item of carrinho) {
            await _supabase.from('produtos').update({ quantidade: item.quantidade - item.qtd_venda }).eq('id', item.id);
        }
        await _supabase.from('historico_vendas').insert([{
            cliente: document.getElementById('venda-cliente').value || "Consumidor",
            total: totalVenda,
            produtos: carrinho.map(c => `${c.qtd_venda}x ${c.tipo}`).join(", "),
            pagamento: pgto,
            loja_id: usuarioLogado.loja_id,
            data_venda: new Date().toISOString()
        }]);
        
        // --- ADICIONADO: Impressão de Cupom ---
        if(confirm("Venda Finalizada! Deseja imprimir o cupom?")) {
            imprimirCupom(pgto, document.getElementById('total-valor').innerText);
        }
        
        carrinho = []; renderCarrinho();
    } catch (e) { alert("Erro ao finalizar: " + e.message); }
}

// Função de Impressão (Nova)
function imprimirCupom(pgto, total) {
    const win = window.open('', '', 'width=300,height=500');
    const agora = new Date().toLocaleString('pt-BR');
    const cliente = document.getElementById('venda-cliente').value || "Consumidor";
    
    let itensCupom = carrinho.map(i => `${i.qtd_venda}x ${i.tipo} - R$ ${(i.preco * i.qtd_venda).toFixed(2)}`).join('<br>');
    
    win.document.write(`
        <html><body style="font-family: monospace; width: 260px;">
        <center><h3>GESTÃO NOGUEIRA</h3></center>
        <p>Data: ${agora}<br>Cliente: ${cliente}</p><hr>
        ${itensCupom}
        <hr><p><b>TOTAL: ${total}</b><br>Pgto: ${pgto}</p>
        <script>window.print(); window.close();</script>
        </body></html>
    `);
    win.document.close();
}

// --- 4. ESTOQUE E PRODUTOS ---
function abrirModalProduto() {
    document.getElementById('edit-id-produto').value = "";
    document.getElementById('cad-codigo').value = "";
    document.getElementById('cad-tipo').value = "";
    document.getElementById('cad-preco').value = "";
    document.getElementById('cad-qtd').value = "";
    document.getElementById('modal-produto').style.display = 'flex';
}

function prepararEdicaoProduto(p) {
    document.getElementById('edit-id-produto').value = p.id;
    document.getElementById('cad-codigo').value = p.codigo_barras;
    document.getElementById('cad-tipo').value = p.tipo;
    document.getElementById('cad-preco').value = p.preco;
    document.getElementById('cad-qtd').value = p.quantidade;
    document.getElementById('modal-produto').style.display = 'flex';
}

async function salvarProduto() {
    const id = document.getElementById('edit-id-produto').value;
    const dados = {
        codigo_barras: document.getElementById('cad-codigo').value,
        tipo: document.getElementById('cad-tipo').value,
        preco: parseFloat(document.getElementById('cad-preco').value),
        quantidade: parseInt(document.getElementById('cad-qtd').value),
        loja_id: usuarioLogado.loja_id
    };
    if (id) await _supabase.from('produtos').update(dados).eq('id', id);
    else await _supabase.from('produtos').insert([dados]);
    document.getElementById('modal-produto').style.display = 'none';
    carregarEstoque();
}

async function carregarEstoque() {
    const { data } = await _supabase.from('produtos').select('*').eq('loja_id', usuarioLogado.loja_id).order('tipo');
    const tbody = document.getElementById('corpo-estoque');
    tbody.innerHTML = "";
    data?.forEach(p => {
        tbody.innerHTML += `<tr><td>${p.codigo_barras}</td><td>${p.tipo}</td><td>R$ ${p.preco.toFixed(2)}</td><td>${p.quantidade}</td><td class="somente-gerente"><button onclick='prepararEdicaoProduto(${JSON.stringify(p)})'>✏️</button><button onclick="excluirProduto(${p.id})">🗑️</button></td></tr>`;
    });
    aplicarPermissoesVisuais();
}

// --- 5. USUÁRIOS ---
function abrirModalUsuario() {
    document.getElementById('edit-id-usuario').value = "";
    document.getElementById('user-login').value = "";
    document.getElementById('user-senha').value = "";
    document.getElementById('user-nivel').value = "operador";
    document.getElementById('user-status').value = "true";
    document.getElementById('modal-usuario').style.display = 'flex';
}

function prepararEdicaoUsuario(u) {
    document.getElementById('edit-id-usuario').value = u.id;
    document.getElementById('user-login').value = u.login;
    document.getElementById('user-senha').value = u.senha;
    document.getElementById('user-nivel').value = u.nivel;
    document.getElementById('user-status').value = u.ativo.toString();
    document.getElementById('modal-usuario').style.display = 'flex';
}

async function salvarUsuario() {
    const id = document.getElementById('edit-id-usuario').value;
    const dados = {
        login: document.getElementById('user-login').value,
        senha: document.getElementById('user-senha').value,
        nivel: document.getElementById('user-nivel').value,
        ativo: document.getElementById('user-status').value === "true",
        loja_id: usuarioLogado.loja_id
    };
    if (id) await _supabase.from('usuarios').update(dados).eq('id', id);
    else await _supabase.from('usuarios').insert([dados]);
    document.getElementById('modal-usuario').style.display = 'none';
    carregarUsuarios();
}

async function carregarUsuarios() {
    const { data } = await _supabase.from('usuarios').select('*').eq('loja_id', usuarioLogado.loja_id);
    const tbody = document.getElementById('corpo-usuarios');
    tbody.innerHTML = "";
    data?.forEach(u => {
        tbody.innerHTML += `<tr><td>${u.login}</td><td>${u.nivel}</td><td>${u.ativo?'Ativo':'Inativo'}</td><td><button onclick='prepararEdicaoUsuario(${JSON.stringify(u)})'>✏️</button><button onclick="excluirUsuario(${u.id})">🗑️</button></td></tr>`;
    });
}

// --- 6. HISTÓRICO E ESTORNO ---
async function carregarHistorico() {
    const { data } = await _supabase.from('historico_vendas').select('*').eq('loja_id', usuarioLogado.loja_id).order('data_venda', {ascending: false});
    const tbody = document.getElementById('corpo-historico');
    let soma = 0;
    tbody.innerHTML = "";
    data?.forEach(v => {
        soma += v.total;
        tbody.innerHTML += `<tr><td>${new Date(v.data_venda).toLocaleDateString()}</td><td>${v.cliente}</td><td>${v.produtos}</td><td>${v.pagamento}</td><td>R$ ${v.total.toFixed(2)}</td><td><button class="somente-gerente" onclick="excluirVenda(${v.id})">🗑️ Estornar</button></td></tr>`;
    });
    document.getElementById('total-historico').innerText = "R$ " + soma.toFixed(2).replace('.', ',');
    aplicarPermissoesVisuais();
}

async function excluirVenda(id) {
    if(!confirm("Estornar venda e devolver ao estoque?")) return;
    const { data: v } = await _supabase.from('historico_vendas').select('*').eq('id', id).single();
    if (v && v.produtos) {
        const itens = v.produtos.split(', ');
        for (const item of itens) {
            const [qtd, ...nomeArr] = item.split('x ');
            const nome = nomeArr.join('x ');
            const { data: p } = await _supabase.from('produtos').select('id, quantidade').eq('tipo', nome).eq('loja_id', usuarioLogado.loja_id).maybeSingle();
            if (p) await _supabase.from('produtos').update({ quantidade: p.quantidade + parseInt(qtd) }).eq('id', p.id);
        }
    }
    await _supabase.from('historico_vendas').delete().eq('id', id);
    carregarHistorico();
}

// --- 7. EXPORTAÇÃO ---
function gerarPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.text("Relatório de Vendas - G. Nogueira", 14, 15);
    const rows = [];
    document.querySelectorAll("#corpo-historico tr").forEach(row => {
        const rowData = [];
        row.querySelectorAll("td").forEach((cell, i) => { if(i < 5) rowData.push(cell.innerText); });
        rows.push(rowData);
    });
    doc.autoTable({ head: [['Data', 'Cliente', 'Produtos', 'Pgto', 'Total']], body: rows, startY: 25 });
    doc.save("relatorio.pdf");
}

function gerarExcel() {
    const table = document.querySelector("#aba-historico table").cloneNode(true);
    table.querySelectorAll("button").forEach(b => b.remove());
    const wb = XLSX.utils.table_to_book(table);
    XLSX.writeFile(wb, "vendas.xlsx");
}

// --- 8. AUXILIARES ---
function fecharModalProduto() { document.getElementById('modal-produto').style.display = 'none'; }
function fecharModalUsuario() { document.getElementById('modal-usuario').style.display = 'none'; }
function fecharModalCarrinho() { document.getElementById('modal-editar-item').style.display = 'none'; }
function verificarParcelas() { const pgto = document.getElementById('venda-pagamento').value; document.getElementById('campo-parcelas').style.display = (pgto === "Cartão de Crédito") ? "block" : "none"; }
function aplicarPermissoesVisuais() { const isG = usuarioLogado.nivel === 'gerente'; document.querySelectorAll('.somente-gerente').forEach(el => el.style.display = isG ? 'table-cell' : 'none'); }
async function excluirUsuario(id) { if(confirm("Excluir?")) { await _supabase.from('usuarios').delete().eq('id', id); carregarUsuarios(); } }
async function excluirProduto(id) { if(confirm("Excluir?")) { await _supabase.from('produtos').delete().eq('id', id); carregarEstoque(); } }
async function atualizarPresenca() { if(usuarioLogado) await _supabase.from('usuarios').update({ ultima_atividade: new Date().toISOString() }).eq('id', usuarioLogado.id); }
