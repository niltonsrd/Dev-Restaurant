// =======================================
//  script.js (versão corrigida e completa)
// =======================================

let cart = [];

function loadProducts() {
  fetch("/api/products")
    .then((r) => r.json())
    .then((products) => {
      const catalog = document.getElementById("catalog");
      catalog.innerHTML = "";

      products.forEach((p) => {
        const card = document.createElement("article");
        card.className = "card";

        card.innerHTML = `
          <img src="/static/img/${p.image}" alt="${p.name}">
          <div class="card-body">
            <div class="card-title">
              <div>
                <strong>${p.name}</strong>
                <div class="small muted">${p.description || ""}</div>
              </div>
              <div class="price">R$ ${Number(p.price).toFixed(2)}</div>
            </div>

            <div class="card-actions">
              <button class="btn btn-primary"
                onclick='addToCart(${p.id}, "${p.name.replace(/"/g, '\\"')}", ${p.price}, "${p.image}")'>
                Adicionar
              </button>
            </div>
          </div>
        `;

        catalog.appendChild(card);
      });
    });
}

function addToCart(id, name, price, image) {
  const found = cart.find((i) => i.id === id);
  if (found) found.qty++;
  else cart.push({ id, name, price, qty: 1, image });

  renderCart();
}

function renderCart() {
  const list = document.getElementById("cartList");
  list.innerHTML = "";

  let total = 0;

  cart.forEach((item) => {
    const div = document.createElement("div");
    div.className = "cart-item";

    div.innerHTML = `
      <img class="item-thumb" src="/static/img/${item.image}">
      
      <div style="flex:1">
        <div><strong>${item.name}</strong></div>
        <div class="small muted">${item.qty} x R$ ${item.price.toFixed(2)}</div>
      </div>

      <div>
        <button onclick="changeQty(${item.id}, 1)">➕</button>
        <button onclick="changeQty(${item.id}, -1)">➖</button>
        <button onclick="removeFromCart(${item.id})">Remover</button>
      </div>
    `;

    list.appendChild(div);

    total += item.qty * item.price;
  });

  // Atualiza subtotal (usado pelo cálculo de entrega)
  document.getElementById("cartTotal").textContent = `R$ ${total.toFixed(2)}`;
  document.getElementById("cartTotal").dataset.subtotal = total.toFixed(2);

  updateCheckoutButtonState();
}

function changeQty(id, delta) {
  const item = cart.find((i) => i.id === id);
  if (!item) return;

  item.qty += delta;
  if (item.qty <= 0) removeFromCart(id);

  renderCart();
}

function removeFromCart(id) {
  cart = cart.filter((i) => i.id !== id);
  renderCart();
}

// =======================================
//  PAGAMENTO — ELEMENTOS DOM
// =======================================

const paymentSelect = document.getElementById("paymentMethod");
const paymentCashBox = document.getElementById("paymentCashBox");
const paymentCardBox = document.getElementById("paymentCardBox");
const paymentPixBox = document.getElementById("paymentPixBox");

const cashNeedChange = document.getElementById("cashNeedChange");
const cashAmount = document.getElementById("cashAmount");

const pixComprovante = document.getElementById("pixComprovante");
const generatePixBtn = document.getElementById("generatePixBtn");
const pixQrPreview = document.getElementById("pixQrPreview");

const btnCheckout = document.getElementById("btnCheckout");

const bairroSelect = document.getElementById("customerBairro");
const deliveryDisplay = document.getElementById("deliveryFee");

let deliveryFees = {};

// esconder painéis inicialmente
if (paymentCashBox) paymentCashBox.classList.add("hidden");
if (paymentCardBox) paymentCardBox.classList.add("hidden");
if (paymentPixBox) paymentPixBox.classList.add("hidden");

btnCheckout.disabled = true;

// =======================================
//  Função que centraliza quando o Checkout deve estar habilitado
// =======================================
function updateCheckoutButtonState() {
  const name = (document.getElementById("customerName") || { value: "" }).value.trim();
  const address = (document.getElementById("customerAddress") || { value: "" }).value.trim();
  const bairro = (bairroSelect || { value: "" }).value;
  const method = paymentSelect ? paymentSelect.value : "";

  // básico: precisa de cliente, endereço e itens no carrinho
  if (!name || !address || cart.length === 0 || !bairro || !method) {
    btnCheckout.disabled = true;
    return;
  }

  // condições específicas por método
  if (method === "dinheiro") {
    // se precisa de troco, exige valor; se NÃO precisa, ok
    if (cashNeedChange && cashNeedChange.value === "sim") {
      const raw = (cashAmount.value || "").replace(/\D/g, "");
      if (!raw || Number(raw) === 0) {
        btnCheckout.disabled = true;
        return;
      }
    }
    // tudo ok para dinheiro
    btnCheckout.disabled = false;
    return;
  }

  if (method === "pix") {
    // exigir comprovante quando o campo existir
    if (pixComprovante && pixComprovante.files && pixComprovante.files.length > 0) {
      btnCheckout.disabled = false;
    } else {
      btnCheckout.disabled = true;
    }
    return;
  }

  if (method === "cartao") {
    // cartão não precisa de campos adicionais no frontend (aqui)
    btnCheckout.disabled = false;
    return;
  }

  // fallback
  btnCheckout.disabled = true;
}

// =======================================
//  Eventos: seleção de pagamento
// =======================================
if (paymentSelect) {
  paymentSelect.addEventListener("change", () => {
    const method = paymentSelect.value;

    paymentCashBox.classList.add("hidden");
    paymentCardBox.classList.add("hidden");
    paymentPixBox.classList.add("hidden");

    if (method === "dinheiro") paymentCashBox.classList.remove("hidden");
    if (method === "cartao") paymentCardBox.classList.remove("hidden");
    if (method === "pix") paymentPixBox.classList.remove("hidden");

    // atualizar estado do botão
    updateCheckoutButtonState();
  });
}

// Mostrar/ocultar campo troco
if (cashNeedChange) {
  cashNeedChange.addEventListener("change", () => {
    if (cashNeedChange.value === "sim") {
      cashAmount.classList.remove("hidden");
    } else {
      cashAmount.classList.add("hidden");
      cashAmount.value = "";
    }
    updateCheckoutButtonState();
  });
}

// Formatar campo Troco para quanto em moeda BRL
if (cashAmount) {
  cashAmount.addEventListener("input", () => {
    let raw = cashAmount.value.replace(/\D/g, "");
    if (raw.length === 0) {
      cashAmount.value = "";
      updateCheckoutButtonState();
      return;
    }
    raw = (parseInt(raw) / 100).toFixed(2);
    cashAmount.value = "R$ " + raw.replace(".", ",");
    updateCheckoutButtonState();
  });
}

// liberar botão ao enviar comprovante PIX
if (pixComprovante) {
  pixComprovante.addEventListener("change", () => {
    updateCheckoutButtonState();
  });
}

// =======================================
// GERAR QR CODE PIX (USANDO PAYLOAD REAL - exemplo)
// =======================================
if (generatePixBtn) {
  generatePixBtn.addEventListener("click", () => {
    const chavePix = "71991118924";
    const recebedor = "Josenilton Santos da Cruz";
    const banco = "C6 Bank";

    const qrUrl =
      "https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=" +
      encodeURIComponent(chavePix);

    pixQrPreview.classList.remove("hidden");

    pixQrPreview.innerHTML = `
      <img src="${qrUrl}" width="200" height="200" style="border-radius:8px;">
      <p style="font-size:12px;margin-top:6px;">Chave PIX:</p>
      <textarea readonly style="width:100%;height:60px;font-size:12px;">Chave: ${chavePix}
Banco: ${banco}
Recebedor: ${recebedor}</textarea>
    `;
  });
}

// =======================================
// TAXAS DE ENTREGA (popula select bairro)
// =======================================
fetch("/api/delivery-fees")
  .then(r => r.json())
  .then(taxas => {
    deliveryFees = taxas;
    if (!bairroSelect) return;
    bairroSelect.innerHTML = '<option value="">Selecione o bairro</option>';
    for (const [bairro, valor] of Object.entries(taxas)) {
      const option = document.createElement("option");
      option.value = bairro;
      option.textContent = `${bairro} — R$ ${valor.toFixed(2)}`;
      option.dataset.fee = valor;
      bairroSelect.appendChild(option);
    }
  });

// Atualizar taxa de entrega e total quando bairro muda
if (bairroSelect) {
  bairroSelect.addEventListener("change", () => {
    const fee = Number(bairroSelect.selectedOptions[0].dataset.fee || 0);
    deliveryDisplay.textContent = `Entrega: R$ ${fee.toFixed(2)}`;

    // Atualizar total no carrinho
    const cartTotal = parseFloat(document.getElementById("cartTotal").dataset.subtotal || 0);
    const totalFinal = cartTotal + fee;
    document.getElementById("cartTotal").textContent = `R$ ${totalFinal.toFixed(2)}`;

    updateCheckoutButtonState();
  });
}

// =======================================
//  RESET DO CHECKOUT (limpa tudo)
// =======================================
function resetCheckout() {
  // limpar dados do cliente
  const maybe = (id) => document.getElementById(id) || { value: "" };
  maybe("customerName").value = "";
  maybe("customerAddress").value = "";
  maybe("customerContact").value = "";
  maybe("customerNote").value = "";
  maybe("cashAmount").value = "";

  // resetar troca
  if (cashNeedChange) {
    cashNeedChange.value = "nao";
  }
  if (cashAmount) {
    cashAmount.classList.add("hidden");
    cashAmount.value = "";
  }

  // resetar comprovante PIX
  if (pixComprovante) pixComprovante.value = "";
  if (pixQrPreview) {
    pixQrPreview.classList.add("hidden");
    pixQrPreview.innerHTML = "";
  }

  // resetar método de pagamento
  if (paymentSelect) paymentSelect.value = "";
  if (paymentCashBox) paymentCashBox.classList.add("hidden");
  if (paymentCardBox) paymentCardBox.classList.add("hidden");
  if (paymentPixBox) paymentPixBox.classList.add("hidden");

  // resetar bairro
  if (bairroSelect) bairroSelect.value = "";
  if (deliveryDisplay) deliveryDisplay.textContent = "Entrega: R$ 0,00";

  // RESETAR O CARRINHO (esvazia array original e atualiza UI)
  cart.length = 0;
  renderCart();

  // resetar totais
  const ct = document.getElementById("cartTotal");
  if (ct) {
    ct.dataset.subtotal = "0.00";
    ct.textContent = "R$ 0.00";
  }

  // desabilitar botão
  if (btnCheckout) btnCheckout.disabled = true;
}

// =======================================
//  FINALIZAR PEDIDO (envia para /api/checkout)
// =======================================
if (btnCheckout) {
  btnCheckout.addEventListener("click", function () {
    const name = document.getElementById("customerName").value.trim();
    const address = document.getElementById("customerAddress").value.trim();
    const contact = document.getElementById("customerContact").value.trim();
    const note = document.getElementById("customerNote").value.trim();
    const bairroVal = (bairroSelect || { value: "" }).value;
    const deliveryFee = Number((bairroSelect && bairroSelect.selectedOptions[0].dataset.fee) || 0);
    const payment = paymentSelect ? paymentSelect.value : "";

    if (!name || !address) return alert("Preencha nome e endereço!");
    if (cart.length === 0) return alert("Seu carrinho está vazio!");
    if (!bairroVal) return alert("Selecione o bairro!");
    if (!payment) return alert("Selecione o método de pagamento!");

    let comprovanteFile = null;

    if (payment === "pix") {
      if (!pixComprovante.files || !pixComprovante.files[0]) {
        alert("Envie o comprovante PIX.");
        return;
      }
      comprovanteFile = pixComprovante.files[0];
    }

    const formData = new FormData();
    formData.append("customer_name", name);
    formData.append("customer_address", address);
    formData.append("customer_contact", contact);
    formData.append("customer_note", note);
    formData.append("bairro", bairroVal);
    formData.append("delivery_tax", deliveryFee);
    formData.append("payment_method", payment);

    if (payment === "dinheiro") {
      formData.append("troco_para", cashAmount.value.trim());
    }

    if (comprovanteFile) {
      formData.append("pix_comprovante", comprovanteFile);
    }

    formData.append("cart", JSON.stringify(cart));

    // Desabilitar para evitar múltiplos clicks
    btnCheckout.disabled = true;

    fetch("/api/checkout", { method: "POST", body: formData })
      .then(async (r) => {
        const json = await r.json().catch(() => ({ ok: false }));
        if (r.ok && json.ok && json.whatsapp_url) {
          // Abre o whatsapp e logo em seguida reseta o checkout/carrinho
          window.open(json.whatsapp_url, "_blank");

          // pequena pausa opcional (sem bloquear) para garantir que a aba abra antes do reset visual
          setTimeout(() => {
            resetCheckout();
          }, 250);
        } else {
          alert("Erro ao gerar pedido: " + (json.error || "erro desconhecido"));
          updateCheckoutButtonState();
        }
      })
      .catch((err) => {
        console.error("Erro fetch /api/checkout:", err);
        alert("Erro ao enviar pedido. Veja o console.");
        updateCheckoutButtonState();
      });
  });
}

// Inicializar
loadProducts();
renderCart();
updateCheckoutButtonState();
