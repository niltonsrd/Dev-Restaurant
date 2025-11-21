/* ---------- TAB CONTROLE ---------- */
const tabs = document.querySelectorAll(".tab");

function openTab(name) {
    // 1. Alterna a classe 'active' na aba clicada
    tabs.forEach((t) => t.classList.toggle("active", t.dataset.tab === name));

    // 2. Controla a exibição das seções
    document.getElementById("produtos").style.display =
        name === "produtos" ? "block" : "none";
    document.getElementById("vendas").style.display =
        name === "vendas" ? "block" : "none";
    document.getElementById("relatorios").style.display = // <--- NOVO
        name === "relatorios" ? "block" : "none";
    document.getElementById("config").style.display =
        name === "config" ? "block" : "none";

    // 3. Executa funções específicas da aba
    if (name === "vendas") loadVendas();

    // 4. Dispara o evento de mudança de aba (para notificar o admin_relatorios.js) // <--- NOVO
    const event = new CustomEvent('tabChange', { detail: { tabName: name } });
    document.dispatchEvent(event);
}

tabs.forEach((t) => t.addEventListener("click", () => openTab(t.dataset.tab)));

/* ---------- EDIT PRODUTO ---------- */
function openEdit(id, name, price, category, description) {
    document.getElementById("modalEdit").style.display = "flex";
    document.getElementById("editName").value = name;
    document.getElementById("editPrice").value = price;
    document.getElementById("editCategory").value = category;
    document.getElementById("editDescription").value = description;
    document.getElementById("editForm").action = "/admin/edit/" + id;
}

function closeEdit() {
    document.getElementById("modalEdit").style.display = "none";
}

/* ---------- VENDAS (fetch) ---------- */
async function loadVendas() {
    const qCliente = document
        .getElementById("searchCliente")
        .value.trim()
        .toLowerCase();
    const dateFrom = document.getElementById("dateFrom").value;
    const dateTo = document.getElementById("dateTo").value;
    const statusFilter = document.getElementById("filterStatus").value;

    const res = await fetch("/admin/api/vendas");
    if (!res.ok) {
        alert("Erro ao carregar vendas");
        return;
    }
    let data = await res.json();

    // filtros simples (cliente/id/status/data)
    data = data.filter((v) => {
        if (qCliente) {
            const s = (
                String(v.nome_cliente || v.cliente || "") +
                " " +
                String(v.id)
            ).toLowerCase();
            if (!s.includes(qCliente)) return false;
        }
        if (
            statusFilter &&
            String(v.status || "").toLowerCase() !== statusFilter.toLowerCase()
        )
            return false;
        if (dateFrom) {
            const d = new Date(v.data);
            if (d < new Date(dateFrom + "T00:00:00")) return false;
        }
        if (dateTo) {
            const d = new Date(v.data);
            if (d > new Date(dateTo + "T23:59:59")) return false;
        }
        return true;
    });

    const tbody = document.getElementById("vendasBody");
    tbody.innerHTML = "";
    data.forEach((v) => {
        const tr = document.createElement("tr");
        const status = (v.status || "pendente").toLowerCase();
        let pillClass = "status-pendente";
        if (status === "concluido" || status === "concluído")
            pillClass = "status-concluido";
        if (status === "entrega" || status === "saiu para entrega")
            pillClass = "status-entrega";
        tr.innerHTML = `
            <td>${v.id}</td>
            <td>${v.nome_cliente || v.cliente || "—"}</td>
            <td>R$ ${parseFloat(v.total || 0).toFixed(2)}</td>
            <td>${v.forma_pagamento || "—"}</td>
            <td>${new Date(v.data).toLocaleString()}</td>
            <td><span class="status-pill ${pillClass}">${status}</span></td>
            <td>
                <button class="btn ghost" onclick="viewVenda(${v.id})">Ver</button>
                <button class="btn" onclick="downloadNota(${v.id})">Nota</button>
                <button class="btn btn-danger" onclick="deleteVenda(${
                    v.id
                })">Remover</button>
            </td>
        `;
        tbody.appendChild(tr);
    });

    // resumo rápido
    document.getElementById("resumo24").innerText =
        data.length + " vendas listadas";
}

/* ---------- Detalhes da venda e ações ---------- */
async function viewVenda(id) {
    // abrir modal e buscar itens
    document.getElementById("modalVenda").style.display = "flex";
    document.getElementById("vendaIdTitle").innerText = "#" + id;

    // busca itens (produtos)
    const resItens = await fetch(`/admin/vendas/${id}/itens`);
    let itens = [];
    if (!resItens.ok) {
        document.getElementById("vendaItems").innerText = "Erro ao carregar itens";
    } else {
        itens = await resItens.json();
    }

    const list = document.getElementById("vendaItems");
    list.innerHTML = "";

    // calcula subtotal
    let subtotal = 0;
    itens.forEach((it) => {
        const row = document.createElement("div");
        row.className = "row";
        const nome = it.produto_nome || "ID " + it.produto_id;
        const qtd = Number(it.quantidade || 0);
        const preco = Number(it.preco_unitario || 0);
        const totalItem = qtd * preco;
        subtotal += totalItem;

        row.innerHTML = `<div>${qtd}x ${nome}</div><div>R$ ${preco.toFixed(
            2
        )}</div>`;
        list.appendChild(row);
    });

    // buscar info da venda (já retorna bairro e delivery_fee se ajustado no backend)
    const all = await (await fetch("/admin/api/vendas")).json();
    const venda = all.find((x) => x.id === id) || {};

    // entrega/taxa (fallback 0)
    const deliveryFee = parseFloat(venda.delivery_fee || venda.tax || 0) || 0;
    const totalFinal = subtotal + deliveryFee;

    // montar texto de info com bairro e taxa
    const tel = venda.telefone || venda.contato || "—";
    const end = venda.endereco || "—";
    const pagamento = venda.forma_pagamento || "—";

    // mostrar info: cliente, telefone, endereço, bairro, subtotal, taxa e total
    document.getElementById("vendaInfo").innerText = `Cliente: ${
        venda.nome_cliente || venda.cliente || "—"
    } • Tel: ${tel} • End.: ${end}`;

    // adicionar resumo de totais logo abaixo (ou substitua vendaItems por novo bloco)
    // vamos criar/atualizar um bloco de totais no modal (se já existir, usamos; se não, criamos)
    let totalsEl = document.getElementById("vendaTotals");
    if (!totalsEl) {
        totalsEl = document.createElement("div");
        totalsEl.id = "vendaTotals";
        totalsEl.style.marginTop = "8px";
        totalsEl.style.fontWeight = "700";
        totalsEl.style.textAlign = "right";
        document.getElementById("modalVendaInner").appendChild(totalsEl);
    }
    totalsEl.innerHTML = `
        Subtotal: R$ ${subtotal.toFixed(2)}<br/>
        Taxa de entrega: R$ ${deliveryFee.toFixed(2)}<br/>
        <span style="font-size:15px">Total: R$ ${totalFinal.toFixed(2)}</span>
    `;

    // configurar botões
    document.getElementById("btnDownloadNota").onclick = () => downloadNota(id);
    document.getElementById("btnMarcar").onclick = () => marcarConcluido(id);
}

function closeVendaModal() {
    document.getElementById("modalVenda").style.display = "none";
}

/* ---------- Baixar nota PDF (rota já existente) ---------- */
function downloadNota(id) {
    // abre em nova aba para baixar (rota: /admin/vendas/<id>/nota)
    window.open(`/admin/vendas/${id}/nota`, "_blank");
}

/* ---------- Marcar como concluído (chama rota que vamos adicionar) ---------- */
async function marcarConcluido(id) {
    try {
        const res = await fetch(`/admin/vendas/${id}/status`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: "concluido" }),
        });
        if (!res.ok) throw new Error("Falha");
        alert("Venda marcada como concluída");
        loadVendas();
        closeVendaModal();
    } catch (e) {
        alert("Erro ao marcar: " + e.message);
    }
}

/* ---------- Deletar venda ---------- */
async function deleteVenda(id) {
    if (!confirm("Remover venda ID " + id + " ?")) return;
    try {
        const res = await fetch(`/admin/vendas/${id}`, { method: "DELETE" });
        if (!res.ok) throw new Error("Falha ao remover");
        alert("Removido");
        loadVendas();
    } catch (e) {
        alert("Erro: " + e.message);
    }
}

/* ---------- Quick search do sidebar ---------- */
function quickSearch() {
    const q = document.getElementById("quickSearch").value.trim().toLowerCase();
    document.getElementById("searchCliente").value = q;
    openTab("vendas");
    loadVendas();
}

/* ---------- Config (placeholder) ---------- */
function saveConfig() {
    alert("Configurações salvas (placeholder).");
}

/* --------------------------------------------- */
/* ---------- SISTEMA DE NOTIFICAÇÃO ----------- */
/* --------------------------------------------- */

// Variável global para rastrear o último pedido notificado (corrigida a inicialização)
// ⚠️ ATENÇÃO: Declarada aqui, mas inicializada corretamente dentro de syncInitialId()
let ultimoPedidoNotificado = 0; 

let faviconOriginal = "/static/favicon.ico";
let faviconTimer = null;


// ====================================================
// FUNÇÃO CRUCIAL DE SINCRONIZAÇÃO (CORREÇÃO DE NaN)
// ====================================================
function syncInitialId() {
    // Último pedido existente no banco (injetado via Jinja/Python)
    const ultimoBanco = parseInt("{{ max_id | default(0) }}");
    
    // Carrega o último ID notificado pelo navegador
    let ultimoNotificado = parseInt(localStorage.getItem("ultimoPedido")) || 0;

    if (isNaN(ultimoNotificado)) {
        ultimoNotificado = 0;
    }
    
    // Sincroniza a variável global (que é usada no polling)
    // Se o ID do banco for maior que o ID no localStorage, definimos o valor do banco.
    // Isso evita que o alerta dispare para pedidos antigos após o admin ser aberto.
    if (ultimoNotificado < ultimoBanco) {
        window.ultimoPedidoNotificado = ultimoBanco; 
        localStorage.setItem("ultimoPedido", ultimoBanco);
    } else {
        window.ultimoPedidoNotificado = ultimoNotificado;
    }
}


/* ---- 🔔 Push Notification ---- */
async function pedirPermissaoPush() {
    if (Notification.permission !== "granted") {
        await Notification.requestPermission();
    }
}

/* ---- 🔥 Exibe Modal (Redireciona para aba Vendas) ---- */
function abrirVendasPorModal() {
    document.getElementById("modalNovoPedido").style.display = "none";
    openTab("vendas");
    loadVendas();
    pararBlinkAba();
}

/* ---- 🔔 Notificação do navegador ---- */
function enviarPush(pedido_id) {
    if (Notification.permission === "granted") {
        new Notification("📦 Novo Pedido!", {
            body: `Pedido #${pedido_id} acabou de chegar.`,
            icon: "/static/logo.png",
        });
    }
}

/* ---- 💡 Favicon piscando ---- */
function piscarFavicon() {
    const link = document.querySelector("link[rel='icon']");
    let bright = false;

    faviconTimer = setInterval(() => {
        link.style.filter = bright ? "brightness(1)" : "brightness(2.6)";
        bright = !bright;
    }, 600);
}

function pararBlinkFavicon() {
    clearInterval(faviconTimer);
    const link = document.querySelector("link[rel='icon']");
    if (link) link.style.filter = "brightness(1)";
}

/* ---- 🎯 Aba piscando ---- */
function piscarAba() {
    const tabVendas = document.querySelector("[data-tab='vendas']");
    if (tabVendas) tabVendas.classList.add("notification-blink");
}

function pararBlinkAba() {
    const tabVendas = document.querySelector("[data-tab='vendas']");
    if (tabVendas) tabVendas.classList.remove("notification-blink");
    pararBlinkFavicon();
}

/* ---- 🔥 Alerta flutuante ---- */
function mostrarAlertaNovoPedido(id) {
    const box = document.getElementById("newOrderAlert");
    
    // Adicionei uma checagem de segurança, caso o elemento HTML não exista
    if (!box) {
        console.error("Elemento #newOrderAlert não encontrado!");
        return;
    }
    
    box.innerText = `🔔 Novo pedido recebido! (#${id})`;
    box.style.display = "block";

    const audio = new Audio("/static/alert.mp3");
    audio.volume = 1.0;
    audio.play().catch(() => {});

    box.onclick = () => {
        abrirVendasPorModal();
        box.style.display = "none";
    };

    setTimeout(() => {
        box.style.display = "none";
    }, 15000);
}

/* ---- 🧨 Exibir Modal ---- */
function mostrarModal(id) {
    document.getElementById(
        "pedidoModalTexto"
    ).innerText = `O pedido #${id} acabou de chegar.`;
    document.getElementById("modalNovoPedido").style.display = "flex";
}

/* ---- 🔄 Checagem com Backend ---- */
async function checarNovosPedidos() {
    try {
        // Usa a variável global sincronizada
        const res = await fetch(
            `/admin/api/novos-pedidos?ultimo=${window.ultimoPedidoNotificado}`
        );
        const data = await res.json();
        
        // Console log para debug
        // console.log(`Polling: Admin JS enviou: ${window.ultimoPedidoNotificado} | Retorno API:`, data);


        if (data.novo) {
            // 1. Atualiza o ID global e no localStorage
            window.ultimoPedidoNotificado = data.pedido_id;
            localStorage.setItem("ultimoPedido", data.pedido_id);

            // 2. Dispara todas as notificações
            mostrarAlertaNovoPedido(data.pedido_id);
            mostrarModal(data.pedido_id);
            enviarPush(data.pedido_id);

            piscarAba();
            piscarFavicon();

            // 3. Atualiza a lista de vendas se a aba "vendas" estiver ativa
            if (document.querySelector(".tab.active").dataset.tab === "vendas") {
                loadVendas();
                pararBlinkAba();
            }
        }
    } catch (e) {
        console.warn("Erro ao verificar novos pedidos:", e);
    }
}


// ====================================================
// INICIALIZAÇÃO CORRETA (BLOCO init)
// ====================================================
(function init() {
    // 1. SINCRONIZAÇÃO: Resolve o problema do 'NaN' e o disparo falso na primeira carga.
    syncInitialId();

    // 2. Mantém aba Produtos visível por padrão
    openTab("produtos");
    
    // 3. Permissão de Push (com atraso)
    setTimeout(pedirPermissaoPush, 2000);

    // 4. Inicia o Polling (Com pequeno atraso e repetição)
    setTimeout(() => {
        checarNovosPedidos(); 
        setInterval(checarNovosPedidos, 4000);
    }, 500);

})();