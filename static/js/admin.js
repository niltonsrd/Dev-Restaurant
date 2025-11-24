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
/* ----------------------------------------------
   DETALHES DA VENDA (Modal)
---------------------------------------------- */
async function viewVenda(id) {
    document.getElementById("modalVenda").style.display = "flex";
    document.getElementById("vendaIdTitle").innerText = "#" + id;

    const list = document.getElementById("vendaItems");
    list.innerHTML = "";

    // 🔥 Buscar itens
    const res = await fetch(`/admin/vendas/${id}/itens`);
    const itens = res.ok ? await res.json() : [];

    let subtotal = 0;

    itens.forEach((it) => {
        const row = document.createElement("div");
        row.className = "row";

        let nome =
            it.product_name ||
            it.nome_produto ||
            "Produto";

        const qtd = Number(it.quantidade || 0);
        const preco = Number(it.preco_unitario || 0);
        const totalItem = qtd * preco;
        subtotal += totalItem;

        // 🔥 Converter opções
        const opts = it.options || {};

        // 🔥 Montar detalhes igual ao carrinho / nota fiscal
        let detalhes = "";

        // tamanho
        if (opts.size && opts.size.name) {
            const sp = Number(opts.size.extra_price || 0);
            detalhes += ` • Tamanho: ${opts.size.name}`;
            if (sp > 0) detalhes += ` (+R$ ${sp.toFixed(2)})`;
        }

        // ingredientes
        if (Array.isArray(opts.ingredients) && opts.ingredients.length > 0) {
            const listIng = opts.ingredients.map(i => i.name).join(", ");
            detalhes += ` • Sabores: ${listIng}`;
        }

        // extras
        if (Array.isArray(opts.extras) && opts.extras.length > 0) {
            const exList = opts.extras
                .map(e => `${e.name} (+R$ ${Number(e.price).toFixed(2)})`)
                .join(", ");
            detalhes += ` • Adicionais: ${exList}`;
        }

        row.innerHTML = `
            <div>
                <b>${qtd}x ${nome}</b>
                <div class="small muted">${detalhes}</div>
            </div>
            <div>R$ ${preco.toFixed(2)}</div>
        `;

        list.appendChild(row);
    });

    // 🔥 Buscar informações extras da venda
    const vendRes = await fetch("/admin/api/vendas");
    const allVendas = vendRes.ok ? await vendRes.json() : [];
    const venda = allVendas.find(v => v.id === id) || {};

    const deliveryFee = parseFloat(venda.delivery_fee || 0);
    const totalFinal = subtotal + deliveryFee;

    // Exibir info
    document.getElementById("vendaInfo").innerText =
        `Cliente: ${venda.nome_cliente || "—"} • Tel: ${venda.telefone || "—"} • End.: ${venda.endereco || "—"}`;

    // Totais
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

    // Ações
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

      // mostra/oculta opções custom quando checkbox marcado
      const cb = document.getElementById("customizableCB");
      const customOptions = document.getElementById("customOptions");
      if (cb)
        cb.addEventListener("change", (e) => {
          if (e.target.checked) customOptions.style.display = "block";
          else customOptions.style.display = "none";
        });
      function hideCustomOptions() {
        if (cb) {
          cb.checked = false;
          customOptions.style.display = "none";
        }
      }

      // Adiciona campos dinâmicos
      function addSizeField(name = "", extra = "") {
        const div = document.createElement("div");
        div.className = "section-inline";
        div.innerHTML = `\
          <input type="text" name="sizes_name[]" placeholder="Tamanho (Ex: Média)" value="${name}">\
          <input type="number" name="sizes_extra[]" step="0.01" placeholder="Preço adicional" value="${extra}">\
          <button type="button" class="mini-btn" onclick="this.parentElement.remove()">Remover</button>`;
        document.getElementById("sizesContainer").appendChild(div);
      }

      function addIngredientField(name = "") {
        const div = document.createElement("div");
        div.className = "section-inline";
        div.innerHTML = `\
          <input type="text" name="ingredients_name[]" placeholder="Ingrediente (Ex: Queijo)" value="${name}">\
          <button type="button" class="mini-btn" onclick="this.parentElement.remove()">Remover</button>`;
        document.getElementById("ingredientsContainer").appendChild(div);
      }

      function addExtraField(name = "", price = "") {
        const div = document.createElement("div");
        div.className = "section-inline";
        div.innerHTML = `\
          <input type="text" name="extras_name[]" placeholder="Adicional (Ex: Bacon)" value="${name}">\
          <input type="number" name="extras_price[]" step="0.01" placeholder="Preço" value="${price}">\
          <button type="button" class="mini-btn" onclick="this.parentElement.remove()">Remover</button>`;
        document.getElementById("extrasContainer").appendChild(div);
      }

/* ---------- GERENCIADOR COMPLETO (CORRIGIDO) ---------- */

async function openVariations(id) {
    document.getElementById("modalVariations").style.display = "flex";
    document.getElementById("varProductId").innerText = id;

    document.getElementById("listSizes").innerHTML = "Carregando...";
    document.getElementById("listIngredients").innerHTML = "Carregando...";
    document.getElementById("listExtras").innerHTML = "Carregando...";

    await loadAllVariations(id);
}

function closeVariations() {
    document.getElementById("modalVariations").style.display = "none";
}


async function loadAllVariations(id) {
    const res = await fetch(`/admin/api/product/${id}/full_details`);
    const data = await res.json();

    renderListSizes(data.sizes);
    renderListIngredients(data.ingredients);
    renderListExtras(data.extras);
}


/* ====== Tamanhos ====== */

function renderListSizes(items) {
    const div = document.getElementById("listSizes");
    div.innerHTML = "";

    items.forEach(item => {
        const row = document.createElement("div");
        row.className = "item-row";

        row.innerHTML = `
            <span>${item.name} — <strong>R$ ${item.extra_price.toFixed(2)}</strong></span>
            <button class="btn btn-danger btn-small" onclick="deleteVariation('size', ${item.id})">x</button>
        `;

        div.appendChild(row);
    });
}

/* ====== Ingredientes ====== */

function renderListIngredients(items) {
    const div = document.getElementById("listIngredients");
    div.innerHTML = "";

    items.forEach(item => {
        const row = document.createElement("div");
        row.className = "item-row";

        row.innerHTML = `
            <span>${item.name}</span>
            <button class="btn btn-danger btn-small" onclick="deleteVariation('ingredient', ${item.id})">x</button>
        `;
        div.appendChild(row);
    });
}


/* ====== Extras ====== */

function renderListExtras(items) {
    const div = document.getElementById("listExtras");
    div.innerHTML = "";

    items.forEach(item => {
        const row = document.createElement("div");
        row.className = "item-row";

        row.innerHTML = `
            <span>${item.name} — <strong>R$ ${item.price.toFixed(2)}</strong></span>
            <button class="btn btn-danger btn-small" onclick="deleteVariation('extra', ${item.id})">x</button>
        `;
        div.appendChild(row);
    });
}


/* ====== ADICIONAR ====== */
async function addVariation(type) {
    const prodId = document.getElementById("varProductId").innerText;
    let url = "";
    let body = {};

    if (type === "size") {
        const name = document.getElementById("inSizeName").value.trim();
        const price = parseFloat(document.getElementById("inSizePrice").value || 0);

        if (!name) return;

        url = `/admin/api/product/${prodId}/sizes`;
        body = { nome: name, preco: price };
    }

    if (type === "ingredient") {
        const name = document.getElementById("inIngName").value.trim();
        if (!name) return;

        url = `/admin/api/product/${prodId}/ingredient`;
        body = { nome: name };
    }

    if (type === "extra") {
        const name = document.getElementById("inExtraName").value.trim();
        const price = parseFloat(document.getElementById("inExtraPrice").value || 0);
        if (!name) return;

        url = `/admin/api/product/${prodId}/extra`;
        body = { nome: name, price: price };
    }

    await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
    });

    // Limpa inputs
    document.querySelectorAll(".input-group input").forEach(el => el.value = "");

    loadAllVariations(prodId);
}


/* ====== REMOVER ====== */
async function deleteVariation(type, idItem) {
    if (!confirm("Confirmar remoção?")) return;

    const prodId = document.getElementById("varProductId").innerText;

    let url = "";
    if (type === "size") url = `/admin/api/size/${idItem}`;
    if (type === "ingredient") url = `/admin/api/ingredient/${idItem}`;
    if (type === "extra") url = `/admin/api/extra/${idItem}`;

    await fetch(url, { method: "DELETE" });

    loadAllVariations(prodId);
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