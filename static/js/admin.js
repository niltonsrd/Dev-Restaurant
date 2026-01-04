/* ---------- TAB CONTROLE ---------- */
const tabs = document.querySelectorAll(".tab");

/* ---------- STATUS VALIDOS ---------- */
const STATUS_VALIDOS = [
  "pendente",
  "recebido",
  "preparando",
  "saiu_entrega",
  "concluido",
  "cancelado",
];

// ===============================
// 📜 LOGS DO SISTEMA
// ===============================
async function loadLogs() {
  const tbody = document.getElementById("logsBody");
  const cards = document.getElementById("logsCards");

  if (!tbody || !cards) return;

  // Reset
  tbody.innerHTML = `
    <tr>
      <td colspan="6" class="muted">Carregando logs...</td>
    </tr>
  `;
  cards.innerHTML = "";

  try {
    const res = await fetch("/admin/api/logs");
    if (!res.ok) throw new Error("Erro ao buscar logs");

    const logs = await res.json();

    if (!logs.length) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" class="muted">Nenhum log registrado.</td>
        </tr>
      `;
      cards.innerHTML = `<div class="muted">Nenhum log registrado.</div>`;
      return;
    }

    // ==========================
    // DESKTOP (TABELA)
    // ==========================
    tbody.innerHTML = "";

    logs.forEach((l) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${new Date(l.data).toLocaleString("pt-BR")}</td>
        <td>${l.tipo}</td>
        <td>${l.acao}</td>
        <td>${l.pedido_id ?? "-"}</td>
        <td>${l.descricao}</td>
        <td>${l.usuario ?? "-"}</td>
      `;
      tbody.appendChild(tr);
    });

    // ==========================
    // MOBILE (CARDS)
    // ==========================
    cards.innerHTML = "";

    logs.forEach((l) => {
      const card = document.createElement("div");
      card.className = "log-card";

      card.innerHTML = `
        <div class="log-grid">

          <div class="log-item">
            <span class="log-label">Pedido Nº</span>
            <span class="log-value">${l.pedido_id ?? "-"}</span>
          </div>

          <div class="log-item">
            <span class="log-label">Data</span>
            <span class="log-value">
              ${new Date(l.data).toLocaleString("pt-BR")}
            </span>
          </div>

          <div class="log-item">
            <span class="log-label">Tipo</span>
            <span class="log-value">${l.tipo}</span>
          </div>

          <div class="log-item">
            <span class="log-label">Ação</span>
            <span class="log-value">${l.acao}</span>
          </div>

          <div class="log-item full">
            <span class="log-label">Descrição</span>
            <span class="log-value">${l.descricao}</span>
          </div>

          <div class="log-item">
            <span class="log-label">Usuário</span>
            <span class="log-value">${l.usuario ?? "-"}</span>
          </div>

        </div>
      `;

      cards.appendChild(card);
    });

  } catch (e) {
    console.error(e);
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="error">Erro ao carregar logs</td>
      </tr>
    `;
    cards.innerHTML = `<div class="error">Erro ao carregar logs</div>`;
  }
}




let pedidoStatusPendente = null;
let novoStatusPendente = null;

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
  document.getElementById("promocoes").style.display =
    name === "promocoes" ? "block" : "none";
  document.getElementById("logs").style.display =
    name === "logs" ? "block" : "none";  

  // 3. Executa funções específicas da aba
  if (name === "vendas") loadVendas();
  if (name === "promocoes") {
    carregarProdutosPromocao();
    carregarPromocoes();
  }
  if (name === "logs") loadLogs();


  // 4. Dispara o evento de mudança de aba (para notificar o admin_relatorios.js) // <--- NOVO
  const event = new CustomEvent("tabChange", { detail: { tabName: name } });
  document.dispatchEvent(event);
}

function baixarRelatorioExcel() {
  const periodo =
    document.querySelector(".btn.active")?.dataset.periodo || "diario";
  window.location.href = `/admin/relatorio/excel?periodo=${periodo}`;
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
    showError("Erro ao carregar vendas");
    return;
  }

  let data = await res.json();

  // ---------- FILTROS ----------
  data = data.filter((v) => {
    if (qCliente) {
      const s = (
        String(v.nome_cliente || "") +
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

  // ---------- RENDER ----------
  data.forEach((v) => {
    const tr = document.createElement("tr");
    const status = (v.status || "pendente").toLowerCase();

    // Classe do status
    let pillClass = "status-pendente";
    if (status === "concluido" || status === "concluído")
      pillClass = "status-concluido";
    if (status === "entrega" || status === "saiu para entrega")
      pillClass = "status-entrega";

    // 🔥 PAGAMENTO + PIX PENDENTE
    let pagamentoLabel = v.forma_pagamento || "—";

    if (v.pix_pendente) {
      pagamentoLabel += ' <span class="badge-pendente">PIX PENDENTE</span>';
    }

    if (v.pix_enviado) {
      pagamentoLabel += ' <span class="badge-ok">PIX ENVIADO</span>';
    } 

    tr.innerHTML = `
      <td data-label="ID">${v.id}</td>
      <td data-label="Cliente">${v.nome_cliente || "—"}</td>
      <td data-label="Total">R$ ${parseFloat(v.total || 0).toFixed(2)}</td>
      <td data-label="Pagamento">${pagamentoLabel}</td>
      <td data-label="Data">${new Date(v.data).toLocaleString()}</td>
      <td data-label="Status">
        <select class="status-select ${pillClass}" data-id="${
      v.id
    }" style="width:100%">
          ${STATUS_VALIDOS.map(
            (s) => `
              <option value="${s}" ${s === status ? "selected" : ""}>
                ${s.replace("_", " ").toUpperCase()}
              </option>`
          ).join("")}
        </select>
      </td>
      <td class="acoes-venda">
        <button class="btn ghost mini-btn" onclick="viewVenda(${
          v.id
        })">Ver</button>
        <button class="btn mini-btn" onclick="downloadNota(${
          v.id
        })">Nota</button>
        <button class="btn mini-btn" onclick="salvarStatus(${
          v.id
        })">Atualizar</button>
        <button class="btn btn-danger mini-btn" onclick="deleteVenda(${
          v.id
        })">Excluir</button>
      </td>
    `;

    tbody.appendChild(tr);
  });

  document.getElementById("resumo24").innerText =
    data.length + " vendas listadas";
}


async function salvarStatus(id) {
  const select = document.querySelector(`.status-select[data-id="${id}"]`);

  if (!select) {
    showError("Status não encontrado");
    return;
  }

  const novoStatus = select.value;

  // 🔥 RECEBIDO → modal de tempo
  if (novoStatus === "recebido") {
    abrirModalTempo(id, novoStatus);
    return;
  }

  // 🔔 OUTROS STATUS → modal de confirmação
  pedidoConfirmacaoId = id;
  statusConfirmacaoPendente = novoStatus;

  mostrarConfirmacao(
    `Tem certeza que deseja alterar o status para "<b>${novoStatus.replace(
      "_",
      " "
    )}</b>"?`
  );
}

async function confirmarAlteracaoStatus() {
  if (!pedidoConfirmacaoId || !statusConfirmacaoPendente) return;

  fecharModalConfirmacao();

  try {
    const res = await fetch(`/admin/vendas/${pedidoConfirmacaoId}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: statusConfirmacaoPendente,
      }),
    });

    const data = await res.json();

    if (!res.ok || !data.success) {
      throw new Error(data.message || "Erro ao atualizar status");
    }

    // WhatsApp automático (vem do Flask)
    if (data.notificar && data.mensagem && data.telefone) {
      abrirWhatsApp(data.telefone, data.mensagem);
    }

    loadVendas();
  } catch (e) {
    showError(e.message);
  } finally {
    pedidoConfirmacaoId = null;
    statusConfirmacaoPendente = null;
  }
}

// ===============================
// MODAL CONFIRMAÇÃO DE STATUS
// ===============================

let pedidoConfirmacaoId = null;
let statusConfirmacaoPendente = null;

function mostrarConfirmacao(texto) {
  document.getElementById("textoConfirmacao").innerText = texto;
  document.getElementById("modalConfirmacao").style.display = "flex";
}

function fecharModalConfirmacao() {
  document.getElementById("modalConfirmacao").style.display = "none";
  pedidoConfirmacaoId = null;
  statusConfirmacaoPendente = null;
}

async function confirmarAlteracaoStatus() {
  if (!pedidoConfirmacaoId || !statusConfirmacaoPendente) {
    fecharModalConfirmacao();
    return;
  }

  try {
    const res = await fetch(`/admin/vendas/${pedidoConfirmacaoId}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: statusConfirmacaoPendente,
      }),
    });

    const data = await res.json();

    if (!res.ok || !data.success) {
      throw new Error(data.message || "Erro ao atualizar status");
    }

    // WhatsApp automático
    if (data.notificar && data.mensagem && data.telefone) {
      abrirWhatsApp(data.telefone, data.mensagem);
    }

    fecharModalConfirmacao();
    loadVendas();
  } catch (e) {
    showError(e.message);
  }
}

// ===============================
// MENSAGENS PADRÃO WHATSAPP
// ===============================

function abrirWhatsApp(telefone, mensagem) {
  if (!telefone || !mensagem) return;

  const tel = telefone.replace(/\D/g, "");

  // encoding correto + URL correta
  const texto = encodeURIComponent(mensagem);

  const url = `https://api.whatsapp.com/send?phone=55${tel}&text=${texto}`;

  window.open(url, "_blank");
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

  // 🔥 Buscar itens do pedido
  const res = await fetch(`/admin/vendas/${id}/itens`);
  const itens = res.ok ? await res.json() : [];

  let subtotal = 0;

  itens.forEach((it) => {
    const row = document.createElement("div");
    row.className = "row";

    const nome = it.product_name || it.nome_produto || "Produto";
    const qtd = Number(it.quantidade || 1);

    // 🔥 PREÇO BASE REAL (promo já aplicada)
    const precoBase = Number(it.preco_unitario || 0);

    // 🔥 opções
    let opts = it.options || {};
    if (typeof opts === "string") {
      try {
        opts = JSON.parse(opts);
      } catch {
        opts = {};
      }
    }

    // 🔥 calcular adicionais
    let adicionais = 0;

    if (opts.size && opts.size.extra_price) {
      adicionais += Number(opts.size.extra_price || 0);
    }

    if (Array.isArray(opts.extras)) {
      opts.extras.forEach((e) => {
        adicionais += Number(e.price || 0);
      });
    }

    // 🔥 PREÇO FINAL UNITÁRIO
    const precoFinal = precoBase + adicionais;

    // 🔥 TOTAL DO ITEM
    const totalItem = precoFinal * qtd;
    subtotal += totalItem;

    // 🔥 montar descrição
    let detalhes = "";

    if (opts.size && opts.size.name) {
      detalhes += ` • Tamanho: ${opts.size.name}`;
      if (Number(opts.size.extra_price) > 0) {
        detalhes += ` (+R$ ${Number(opts.size.extra_price).toFixed(2)})`;
      }
    }

    if (Array.isArray(opts.ingredients) && opts.ingredients.length > 0) {
      const listIng = opts.ingredients.map((i) => i.name).join(", ");
      detalhes += ` • Sabores: ${listIng}`;
    }

    if (Array.isArray(opts.extras) && opts.extras.length > 0) {
      const exList = opts.extras
        .map((e) => `${e.name} (+R$ ${Number(e.price).toFixed(2)})`)
        .join(", ");
      detalhes += ` • Adicionais: ${exList}`;
    }

    row.innerHTML = `
      <div>
        <b>${qtd}x ${nome}</b>
        <div class="small muted">${detalhes}</div>
      </div>
      <div style="text-align:right">
        <div class="small muted">Base: R$ ${precoBase.toFixed(2)}</div>
        <div><b>Total Item: R$ ${precoFinal.toFixed(2)}</b></div>
      </div>
    `;

    list.appendChild(row);
  });

  // 🔥 Buscar dados gerais da venda
  const vendRes = await fetch("/admin/api/vendas");
  const allVendas = vendRes.ok ? await vendRes.json() : [];
  const venda = allVendas.find((v) => v.id === id) || {};
  const comprovanteBox = document.getElementById("pixComprovanteBox");

  if (comprovanteBox) {
    comprovanteBox.innerHTML = "";
    comprovanteBox.style.display = "none";

    // Só faz sentido mostrar algo se o pagamento for PIX
    if (venda.forma_pagamento === "pix") {
      comprovanteBox.style.display = "block";

      // 1️⃣ PIX pendente (não tem comprovante)
      if (!venda.pix_comprovante) {
        comprovanteBox.innerHTML = `
        <div class="pix-status pendente">
          ⚠️ PIX pendente de pagamento
        </div>
      `;
      }

      // 2️⃣ PIX confirmado no balcão
      else if (venda.pix_comprovante === "PIX_CONFIRMADO_NO_BALCAO") {
        comprovanteBox.innerHTML = `
        <div class="pix-status ok">
          ✅ PIX confirmado no balcão
        </div>
      `;
      }

      // 3️⃣ PIX com comprovante (imagem real)
      else if (venda.pix_comprovante.startsWith("/static/")) {
        comprovanteBox.innerHTML = `
        <h4>Comprovante PIX</h4>
        <a href="${venda.pix_comprovante}" target="_blank">
          <img 
            src="${venda.pix_comprovante}"
            alt="Comprovante PIX"
            class="pix-preview"
          >
        </a>
      `;
      }
    }
  }



  const deliveryFee = Number(venda.delivery_fee || 0);
  const totalFinal = subtotal + deliveryFee;

  // 🔥 Info do cliente
  document.getElementById("vendaInfo").innerText = `Cliente: ${
    venda.nome_cliente || "—"
  } • Tel: ${venda.telefone || "—"} • End.: ${venda.endereco || "—"}`;

  // 🔥 Totais
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

  // 🔥 Ações
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

async function marcarConcluido(id) {
  try {
    const res = await fetch(`/admin/vendas/${id}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "concluido" }),
    });

    const data = await res.json();

    if (!data.success) {
      throw new Error(data.message || "Falha ao atualizar status");
    }

    console.log("Status atualizado:", data);

    showSuccess("Venda marcada como concluída");
    loadVendas();
    closeVendaModal();
  } catch (e) {
    showError("Erro ao marcar: " + e.message);
  }
}

/* ---------- Deletar venda ---------- */
async function deleteVenda(id) {
  if (!confirm("Remover venda ID " + id + " ?")) return;
  try {
    const res = await fetch(`/admin/vendas/${id}`, { method: "DELETE" });
    if (!res.ok) throw new Error("Falha ao remover");
    showSuccess("Removido");
    loadVendas();
  } catch (e) {
    showError("Erro: " + e.message);
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
  showSuccess("Configurações salvas (placeholder).");
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

let pedidoAtual = null;

function abrirModalTempo(pedidoId, status) {
  pedidoStatusPendente = pedidoId;
  novoStatusPendente = status;

  const input = document.getElementById("inputTempoPreparo");
  const modal = document.getElementById("modalTempoPreparo");

  if (!input || !modal) {
    showError("Erro: modal de tempo não encontrado no HTML");
    return;
  }

  input.value = "";
  modal.style.display = "flex";
}

function fecharModalTempo() {
  document.getElementById("modalTempoPreparo").style.display = "none";
  pedidoAtual = null;
}

async function confirmarTempoPreparo() {
  const input = document.getElementById("inputTempoPreparo");

  if (!input) {
    showError("Erro: input de tempo não encontrado");
    return;
  }

  const tempo = input.value;

  if (!tempo || tempo <= 0) {
    showError("Informe um tempo válido");
    return;
  }

  // fecha modal
  document.getElementById("modalTempoPreparo").style.display = "none";

  try {
    const res = await fetch(`/admin/vendas/${pedidoStatusPendente}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: "recebido",
        tempo_preparo: tempo,
      }),
    });

    const data = await res.json();

    if (!res.ok || !data.success) {
      throw new Error(data.message || "Erro ao atualizar pedido");
    }

    // WhatsApp automático (mensagem vem do Flask)
    if (data.notificar === true && data.mensagem && data.telefone) {
      abrirWhatsApp(data.telefone, data.mensagem);
    }

    // confirmação visual
    document.getElementById("textoConfirmacao").innerText =
      "Status atualizado e cliente notificado";
    document.getElementById("modalConfirmacao").style.display = "flex";

    loadVendas();
  } catch (e) {
    showError(e.message);
  }
}

function mostrarConfirmacao(texto) {
  document.getElementById("textoConfirmacao").innerHTML = texto;
  document.getElementById("modalConfirmacao").style.display = "flex";
}

function fecharModalConfirmacao() {
  document.getElementById("modalConfirmacao").style.display = "none";
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

  items.forEach((item) => {
    const row = document.createElement("div");
    row.className = "item-row";

    row.innerHTML = `
            <span>${item.name} — <strong>R$ ${item.extra_price.toFixed(
      2
    )}</strong></span>
            <button class="btn btn-danger btn-small" onclick="deleteVariation('size', ${
              item.id
            })">x</button>
        `;

    div.appendChild(row);
  });
}

/* ====== Ingredientes ====== */

function renderListIngredients(items) {
  const div = document.getElementById("listIngredients");
  div.innerHTML = "";

  items.forEach((item) => {
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

  items.forEach((item) => {
    const row = document.createElement("div");
    row.className = "item-row";

    row.innerHTML = `
            <span>${item.name} — <strong>R$ ${item.price.toFixed(
      2
    )}</strong></span>
            <button class="btn btn-danger btn-small" onclick="deleteVariation('extra', ${
              item.id
            })">x</button>
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
    const price = parseFloat(
      document.getElementById("inExtraPrice").value || 0
    );
    if (!name) return;

    url = `/admin/api/product/${prodId}/extra`;
    body = { nome: name, price: price };
  }

  await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  // Limpa inputs
  document
    .querySelectorAll(".input-group input")
    .forEach((el) => (el.value = ""));

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

/* ================= PROMOÇÕES ================= */

async function carregarProdutosPromocao(selectId = "produtosSelect") {
  const select = document.getElementById(selectId);
  if (!select) return;

  select.innerHTML = "";

  try {
    const res = await fetch("/api/products");
    const produtos = await res.json();

    produtos.forEach((p) => {
      const option = document.createElement("option");
      option.value = p.id;
      option.textContent = `${p.name} — R$ ${Number(p.price).toFixed(2)}`;
      select.appendChild(option);
    });
  } catch (e) {
    console.error(e);
    select.innerHTML = "<option>Erro ao carregar produtos</option>";
  }
}



/* ---------- SALVAR PROMOÇÃO ---------- */

const formPromocao = document.getElementById("formPromocao");

if (formPromocao) {
  formPromocao.addEventListener("submit", async (e) => {
    e.preventDefault();

    const formData = new FormData(formPromocao);

    const payload = {
      nome: formData.get("nome"),
      tipo_desconto: formData.get("tipo_desconto"),
      valor_desconto: parseFloat(formData.get("valor_desconto")),
      data_inicio: formData.get("data_inicio"),
      data_fim: formData.get("data_fim"),
      produtos: formData.getAll("produtos[]").map(Number),
    };

    if (!payload.produtos.length) {
      showError("Selecione pelo menos um produto");
      return;
    }

    try {
      const res = await fetch("/admin/api/promocoes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.message || "Erro ao criar promoção");
      }

      showSuccess("Promoção criada com sucesso!");
      formPromocao.reset();

    } catch (e) {
      showError("Erro: " + e.message);
    }
  });
}

async function carregarPromocoes() {
  const container = document.getElementById("lista-promocoes");

  try {
    const res = await fetch("/admin/api/promocoes");
    const promocoes = await res.json();

    if (!promocoes.length) {
      container.innerHTML = "<p class='muted'>Nenhuma promoção criada.</p>";
      return;
    }

    container.innerHTML = "";

    promocoes.forEach((p) => {
      const agora = new Date();
      const fim = new Date(p.data_fim);
      const expirada = fim < agora;

      container.innerHTML += `
    <div class="promocao-card">

      <div class="promocao-info">

        <span class="promocao-status ${
          expirada
            ? "status-expirada"
            : p.ativo
            ? "status-ativa"
            : "status-inativa"
        }">

          ${expirada ? "ENCERRADA" : p.ativo ? "ATIVA" : "PAUSADA"}

        </span>

        <h4>${p.nome}</h4>

        <small>
          ${
            p.tipo_desconto === "percentual"
              ? p.valor_desconto + "% OFF"
              : "R$ " + p.valor_desconto + " OFF"
          }
          • ${p.total_produtos} produto(s)
        </small>

        <small>
          ⏱ ${formatarData(p.data_inicio)} → ${formatarData(p.data_fim)}
        </small>
      </div>

      <div class="promocao-actions">

        <button
          title="Ativar / Pausar"
          onclick="togglePromocao(${p.id}, ${p.ativo}, '${p.data_fim}')"
        >
          ⏯️
        </button>

        <button onclick="editarPromocao(${p.id})">✏️</button>

        <button onclick="excluirPromocao(${p.id})">🗑️</button>

      </div>

    </div>
  `;
    });
  } catch (e) {
    container.innerHTML = "<p class='muted'>Erro ao carregar promoções.</p>";
    console.error(e);
  }
}


function formatarData(data) {
  return new Date(data.replace(" ", "T")).toLocaleString("pt-BR");
}

async function togglePromocao(id, ativoAtual, dataFim) {
  const agora = new Date();
  const fim = new Date(dataFim);

  // 👉 Se já passou do tempo, não deixa pausar/ativar — abre o modal de edição
  if (fim < agora) {
    showError("Essa promoção já encerrou. Defina um novo período.");
    editarPromocao(id); // 🔥 abre o modal existente
    return;
  }

  // 👉 Caso contrário, segue o comportamento normal
  const ok = await showConfirm(
    ativoAtual
      ? "Deseja pausar esta promoção?"
      : "Deseja ativar esta promoção?"
  );
  if (!ok) return;

  try {
    const res = await fetch(`/admin/api/promocoes/${id}/toggle`, {
      method: "POST",
    });

    const data = await res.json();

    if (!res.ok || !data.success) {
      throw new Error(data.message || "Erro ao alterar promoção");
    }

    carregarPromocoes();
  } catch (e) {
    showError("Erro: " + e.message);
  }
}


async function excluirPromocao(id) {
  const ok = await showConfirm("Tem certeza que deseja excluir esta promoção?");
  if (!ok) return;

  try {
    const res = await fetch(`/admin/api/promocoes/${id}`, {
      method: "DELETE",
    });

    const data = await res.json();

    if (!res.ok || !data.success) {
      throw new Error(data.message || "Erro ao excluir promoção");
    }

    carregarPromocoes();
  } catch (e) {
    showError("Erro: " + e.message);
  }
}

async function editarPromocao(id) {
  try {
    const res = await fetch(`/admin/api/promocoes/${id}`);
    if (!res.ok) throw new Error();

    const data = await res.json();
    const form = document.getElementById("formEditarPromocao");

    // campos básicos
    form.querySelector('[name="id"]').value = data.id;
    form.querySelector('[name="nome"]').value = data.nome;
    form.querySelector('[name="tipo_desconto"]').value = data.tipo_desconto;
    form.querySelector('[name="valor_desconto"]').value = data.valor_desconto;

    form.querySelector('[name="data_inicio"]').value = data.data_inicio
      .replace(" ", "T")
      .slice(0, 16);

    form.querySelector('[name="data_fim"]').value = data.data_fim
      .replace(" ", "T")
      .slice(0, 16);

    // carregar produtos NO SELECT CORRETO
    await carregarProdutosPromocao("editarProdutosSelect");

    const select = document.getElementById("editarProdutosSelect");

    [...select.options].forEach((opt) => {
      opt.selected = data.produtos.includes(Number(opt.value));
    });

    document.getElementById("modalEditarPromocao").style.display = "flex";
  } catch (e) {
    showError("Erro ao carregar promoção");
  }
}
document
  .getElementById("formEditarPromocao")
  .addEventListener("submit", async (e) => {
    e.preventDefault();

    const form = e.target;
    const id = form.querySelector('[name="id"]').value;

    const select = document.getElementById("editarProdutosSelect");

    const payload = {
      nome: form.querySelector('[name="nome"]').value,
      tipo_desconto: form.querySelector('[name="tipo_desconto"]').value,
      valor_desconto: Number(
        form.querySelector('[name="valor_desconto"]').value
      ),
      data_inicio: form.querySelector('[name="data_inicio"]').value,
      data_fim: form.querySelector('[name="data_fim"]').value,
      produtos: [...select.selectedOptions].map((o) => Number(o.value)),
    };

    try {
      const res = await fetch(`/admin/api/promocoes/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!data.success) throw new Error();

      fecharModalEditar();
      carregarPromocoes();
    } catch {
      showError("Erro ao salvar promoção");
    }
  });

function fecharModalEditar() {
  document.getElementById("modalEditarPromocao").style.display = "none";
}

function showModal(title, message, buttons = []) {
  const overlay = document.getElementById("modalOverlay");
  const modalTitle = document.getElementById("modalTitle");
  const modalMessage = document.getElementById("modalMessage");
  const modalButtons = document.getElementById("modalButtons");

  modalTitle.textContent = title;
  modalMessage.textContent = message;

  modalButtons.innerHTML = "";
  buttons.forEach((btn) => modalButtons.appendChild(btn));

  overlay.style.display = "flex";
}

function closeModal() {
  document.getElementById("modalOverlay").style.display = "none";
}

function showConfirm(message) {
  return new Promise((resolve) => {
    const yes = document.createElement("button");
    yes.className = "btn-confirm";
    yes.textContent = "Confirmar";
    yes.onclick = () => {
      closeModal();
      resolve(true);
    };

    const no = document.createElement("button");
    no.className = "btn-cancel";
    no.textContent = "Cancelar";
    no.onclick = () => {
      closeModal();
      resolve(false);
    };

    showModal("Confirmação", message, [yes, no]);
  });
}

function showError(message) {
  const ok = document.createElement("button");
  ok.className = "btn-error";
  ok.textContent = "Fechar";
  ok.onclick = closeModal;

  showModal("Erro", message, [ok]);
}

function showSuccess(message) {
  const ok = document.createElement("button");
  ok.className = "btn-ok";
  ok.textContent = "Ok";
  ok.onclick = closeModal;

  showModal("Sucesso", message, [ok]);
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
