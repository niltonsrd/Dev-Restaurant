// script.js — versão com suporte a itens personalizáveis (tamanhos, ingredientes, extras)
// Mantém CEP->frete, carrinho, checkout, QR Pix, animações, etc.

// ---------------------------
// Estado
// ---------------------------
let cart = [];
let currentCategory = "Todos";
let currentDeliveryFee = 0;

// Store config (edite o CEP da loja)
const STORE_CEP = "41185-510";
const TAXA_FIXA = 5.0;
const TAXA_MAXIMA = 25.00; // você escolhe
const PRECO_POR_KM = 2.0;

// ---------------------------
// DOM refs
// ---------------------------
const decisionModal = document.getElementById("decisionModal");
const continueShoppingBtn = document.getElementById("continueShoppingBtn");
const goToCartBtn = document.getElementById("goToCartBtn");
const sidebar = document.querySelector(".sidebar");
const cartList = document.getElementById("cartList");
const cartTotalContainer = document.querySelector(".cart-total");

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

const inputCEP = document.getElementById("inputCEP");
const customerStreet = document.getElementById("customerStreet");
const customerNumber = document.getElementById("customerNumber");
const customerReference = document.getElementById("customerReference");
const customerAddressInput = document.getElementById("customerAddress");

const deliveryTaxInput = document.getElementById("deliveryTaxInput");

// Modal / Config DOM
const configureModal = document.getElementById("configureModal");
const configProductTitle = document.getElementById("configProductTitle");
const configBasePrice = document.getElementById("configBasePrice");
const configOptionsContainer = document.getElementById(
  "configOptionsContainer"
);
const configQtyInput = document.getElementById("configQtyInput");
const configAddBtn = document.getElementById("configAddBtn");
const configFinalPrice = document.getElementById("configFinalPrice");

// ---------------------------
// Utilitárias
// ---------------------------
function formatCurrency(value) {
  return Number(value || 0)
    .toFixed(2)
    .replace(".", ",");
}

function toNumber(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function uid(prefix = "") {
  return (
    prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
  );
}

// ---------------------------
// Modal decision (já existente)
// ---------------------------
function showDecisionModal() {
  if (!decisionModal) return;
  decisionModal.classList.remove("hidden");
  setTimeout(() => decisionModal.classList.add("visible"), 10);
}
function hideDecisionModal() {
  if (!decisionModal) return;
  decisionModal.classList.remove("visible");
  setTimeout(() => decisionModal.classList.add("hidden"), 300);
}

if (continueShoppingBtn)
  continueShoppingBtn.addEventListener("click", hideDecisionModal);
if (goToCartBtn && sidebar) {
  goToCartBtn.addEventListener("click", () => {
    hideDecisionModal();
    sidebar.scrollIntoView({ behavior: "smooth" });
  });
}
if (decisionModal) {
  decisionModal.addEventListener("click", (event) => {
    if (event.target.id === "decisionModal") hideDecisionModal();
  });
}

// ---------------------------
// Produtos / Catálogo
// ---------------------------
async function loadProducts() {
  try {
    const res = await fetch("/api/products");
    const products = await res.json();
    renderCatalog(products || []);
    renderFilters(products || []);
  } catch (err) {
    console.error("Erro ao carregar produtos:", err);
    const catalog = document.getElementById("catalog");
    if (catalog) catalog.innerHTML = "<p>Erro ao carregar produtos.</p>";
  }
}

function renderFilters(products) {
  const filterContainer = document.getElementById("filter-container");
  if (!filterContainer) return;
  filterContainer.innerHTML = "";
  const categories = [
    "Todos",
    ...new Set(products.map((p) => p.category).filter(Boolean)),
  ];
  categories.forEach((cat) => {
    const btn = document.createElement("button");
    btn.innerText = cat;
    btn.className = "filter-btn";
    if (cat === currentCategory) btn.classList.add("active");
    btn.addEventListener("click", () => {
      currentCategory = cat;
      document
        .querySelectorAll(".filter-btn")
        .forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      loadProducts(); // reload will render with currentCategory
    });
    filterContainer.appendChild(btn);
  });
}

async function renderCatalog(products) {
  const catalog = document.getElementById("catalog");
  if (!catalog) return;
  catalog.innerHTML = "";

  const filtered =
    currentCategory === "Todos"
      ? products
      : products.filter((p) => p.category === currentCategory);

  if (filtered.length === 0) {
    catalog.innerHTML = "<p>Nenhum produto nessa categoria.</p>";
    return;
  }

  filtered.forEach((p) => {
    const customizable = Number(p.customizable) === 1;

    const card = document.createElement("article");
    card.className = "card";

    // BOTÕES DINÂMICOS
    let buttonArea = "";

    if (customizable) {
      buttonArea = `
                <button class="btn ghost custom-btn">Personalizar</button>
            `;
    } else {
      buttonArea = `
                <div class="qty-container">
                    <button class="qty-btn minus">−</button>
                    <input type="number" class="qty-input" value="1" min="1">
                    <button class="qty-btn plus">+</button>
                </div>
                <button class="btn btn-primary add-btn">Adicionar</button>
            `;
    }

    // CARD HTML FINAL
    card.innerHTML = `
            <img src="/static/img/${p.image}" alt="${
      p.name
    }" onerror="this.src='/static/img/default.png'">
            <div class="card-content">
              <h3 class="card-name">${p.name}</h3>
              <p class="card-description">${p.description || ""}</p>

              <div class="card-footer">
                <p class="price">R$ ${formatCurrency(p.price)}</p>

                <div class="qty-add-container">
                    ${buttonArea}
                </div>
              </div>
            </div>
        `;
    catalog.appendChild(card);

    // BOTÕES - APENAS SE NÃO FOR PERSONALIZÁVEL
    if (!customizable) {
      const qtyInput = card.querySelector(".qty-input");
      const minusBtn = card.querySelector(".qty-btn.minus");
      const plusBtn = card.querySelector(".qty-btn.plus");
      const addBtn = card.querySelector(".add-btn");

      minusBtn.addEventListener("click", () => {
        let val = parseInt(qtyInput.value) || 1;
        if (val > 1) qtyInput.value = val - 1;
      });

      plusBtn.addEventListener("click", () => {
        let val = parseInt(qtyInput.value) || 1;
        qtyInput.value = val + 1;
      });

      addBtn.addEventListener("click", () => {
        const qty = parseInt(qtyInput.value) || 1;
        addToCartSimple(p.id, p.name, Number(p.price), p.image, qty);
        showDecisionModal();
        qtyInput.value = 1;
      });
    }

    // BOTÃO PERSONALIZAR
    const customBtn = card.querySelector(".custom-btn");
    if (customBtn) {
      customBtn.addEventListener("click", () => {
        openConfigureModal(p.id, p.name, Number(p.price), 1, p.image);
      });
    }
  });
}

// ---------------------------
// Carrinho
// ---------------------------
function getCartSubtotal() {
  return cart.reduce(
    (total, item) => total + item.qty * toNumber(item.unit_price),
    0
  );
}

function renderCart() {
  if (!cartList) return;
  cartList.innerHTML = "";

  if (cart.length === 0) {
    cartList.innerHTML =
      '<p style="color: var(--text-muted); text-align: center; padding: 20px;">O carrinho está vazio.</p>';
    updateSummaryDisplay();
    updateCheckoutButtonState();
    return;
  }

  cart.forEach((item) => {
    const div = document.createElement("div");
    div.className = "cart-item";

    // 🔥 Construção do resumo das opções
    let optionsSummary = buildCartOptionsSummary(item);

    // 🔥 CORREÇÃO IMPORTANTE → NÃO mostrar {} nunca
    if (
      !optionsSummary || 
      optionsSummary.trim() === "" || 
      !item.options ||
      (typeof item.options === "object" && Object.keys(item.options).length === 0)
    ) {
      optionsSummary = ""; // não mostra nada
    }

    div.innerHTML = `
        <img class="item-thumb" src="/static/img/${item.image}"
             onerror="this.src='/static/img/default.png'">

        <div style="flex:1; min-width: 0;">
            <div><strong>${item.name}</strong></div>

            ${
              optionsSummary
                ? `<div class="small muted">${optionsSummary}</div>`
                : ""
            }

            <div class="small muted">${item.qty} x R$ ${formatCurrency(
              item.unit_price || item.price || 0
            )}</div>
        </div>

        <div style="display:flex;flex-direction:column;gap:6px;">
            <div style="display:flex; gap:6px">
                <button class="btn btn-secondary" style="padding: 4px 8px"
                        onclick="changeQty('${item._uid}', 1)">+</button>

                <button class="btn btn-secondary" style="padding: 4px 8px"
                        onclick="changeQty('${item._uid}', -1)">-</button>
            </div>

            <button class="btn btn-danger"
                    style="padding:6px 8px; font-size:12px"
                    onclick="removeFromCart('${item._uid}')">
                Remover
            </button>
        </div>
    `;

    cartList.appendChild(div);
  });

  updateSummaryDisplay();
  updateCheckoutButtonState();
}


function buildCartOptionsSummary(item) {
  if (!item.options) return "";

  const opts = item.options;
  const parts = [];

  if (opts.size?.name) {
    parts.push(`Tamanho: ${opts.size.name}`);
  }

  if (opts.ingredients?.length) {
    parts.push(
      "Sabores: " + opts.ingredients.map(i => i.name).join(", ")
    );
  }

  if (opts.extras?.length) {
    parts.push(
      "Adicionais: " +
        opts.extras
          .map(e => `${e.name} (+R$ ${formatCurrency(e.price)})`)
          .join(", ")
    );
  }

  return parts.join(" • ");
}


function updateSummaryDisplay() {
  const subtotal = getCartSubtotal();
  const fee = currentDeliveryFee || 0;
  const totalFinal = subtotal + fee;

  if (!cartTotalContainer) return;
  cartTotalContainer.innerHTML = `
      <div class="totals-card" role="region" aria-label="Resumo do pedido">
        <div class="totals-row">
          <div class="totals-left">
            <div>
              <div class="totals-title">Subtotal</div>
              <div class="totals-sub">Itens</div>
            </div>
          </div>
          <div class="totals-right">R$ <span class="amount" data-value="${subtotal}">${formatCurrency(
    subtotal
  )}</span></div>
        </div>
        <div class="totals-row">
          <div class="totals-left">
            <div>
              <div class="totals-title">Entrega</div>
              <div class="totals-sub">Taxa estimada</div>
            </div>
          </div>
          <div class="totals-right">R$ <span class="amount" data-value="${fee}">${formatCurrency(
    fee
  )}</span></div>
        </div>
        <div class="totals-divider" aria-hidden="true"></div>
        <div class="totals-final" role="status" aria-live="polite">
          <div class="final-left">
            <div class="final-label">Total</div>
            <div class="final-sub">Inclui entrega</div>
          </div>
          <div class="final-value">R$ <span id="cartTotalAnimated" class="final-amount" data-value="${totalFinal}">${formatCurrency(
    totalFinal
  )}</span></div>
        </div>
        <div class="totals-hint">Pagamento e entrega serão confirmados no fechamento do pedido.</div>
      </div>
    `;

  if (deliveryTaxInput) deliveryTaxInput.value = fee.toFixed(2);

  if (cart.length > 0) {
    btnCheckout.textContent = `Finalizar pedido (Total: R$ ${formatCurrency(
      totalFinal
    )})`;
  } else {
    btnCheckout.textContent = "Finalizar pedido (WhatsApp)";
  }

  animateAmountElements();
  updateCheckoutButtonState();
}

function animateAmountElements(duration = 500) {
  const els = Array.from(document.querySelectorAll(".amount, .final-amount"));
  els.forEach((el) => {
    const target = parseFloat(el.getAttribute("data-value")) || 0;
    const start = parseFloat(el.dataset.currentValue) || 0;
    el.dataset.currentValue = start;
    const startTime = performance.now();
    function step(now) {
      const t = Math.min(1, (now - startTime) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const current = start + (target - start) * eased;
      el.textContent = formatCurrency(current);
      if (t < 1) requestAnimationFrame(step);
      else el.dataset.currentValue = target;
    }
    requestAnimationFrame(step);
  });
}

function addToCartSimple(id, name, price, image, qty = 1) {
  // If product already present without options, try to merge by product id & no options
  const found = cart.find(
    (i) =>
      i.product_id === id && (!i.options || Object.keys(i.options).length === 0)
  );
  if (found) {
    found.qty += qty;
  } else {
    cart.push({
      _uid: uid("c_"),
      product_id: id,
      name,
      unit_price: price,
      qty,
      image: image || "default.png",
      options: {},
    });
  }
  renderCart();
}

function changeQty(_uid, delta) {
  const item = cart.find((i) => i._uid === _uid);
  if (!item) return;
  item.qty += delta;
  if (item.qty <= 0) {
    removeFromCart(_uid);
    return;
  }
  renderCart();
}

function removeFromCart(_uid) {
  cart = cart.filter((i) => i._uid !== _uid);
  renderCart();
}

// ---------------------------
// CEP / Frete (ViaCEP + Nominatim + distância Haversine)
// ---------------------------
// ---------------------------
// CEP Multi-API (BrasilAPI → AwesomeAPI → APICEP)
// ---------------------------
async function fetchCEP(cleanCep) {
  cleanCep = (cleanCep || "").replace(/\D/g, "");
  if (cleanCep.length !== 8) return null;

  // 1. BrasilAPI
  try {
    const r1 = await fetch(`https://brasilapi.com.br/api/cep/v1/${cleanCep}`);
    if (r1.ok) {
      const d = await r1.json();
      return {
        logradouro: d.street || "",
        bairro: d.neighborhood || "",
        localidade: d.city || "",
        uf: d.state || ""
      };
    }
  } catch (e) {}

  // 2. AwesomeAPI
  try {
    const r2 = await fetch(`https://cep.awesomeapi.com.br/json/${cleanCep}`);
    if (r2.ok) {
      const d = await r2.json();
      return {
        logradouro: d.address || "",
        bairro: d.district || "",
        localidade: d.city || "",
        uf: d.state || ""
      };
    }
  } catch (e) {}

  // 3. APICEP
  try {
    const r3 = await fetch(`https://ws.apicep.com/cep/${cleanCep}.json`);
    const d = await r3.json();
    if (!d.error) {
      return {
        logradouro: d.address || "",
        bairro: d.district || "",
        localidade: d.city || "",
        uf: d.state || ""
      };
    }
  } catch (e) {}

  return null;
}


async function coordsFromCEPData(viaData) {
  if (!viaData) return null;
  const queryParts = [];
  if (viaData.logradouro) queryParts.push(viaData.logradouro);
  if (viaData.bairro) queryParts.push(viaData.bairro);
  if (viaData.localidade) queryParts.push(viaData.localidade);
  if (viaData.uf) queryParts.push(viaData.uf);
  const q = encodeURIComponent(queryParts.join(", "));
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${q}&limit=1`;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "DeliveryApp/1.0 (contato@example.com)" },
    });
    const json = await res.json();
    if (!json || json.length === 0) return null;
    return { lat: parseFloat(json[0].lat), lon: parseFloat(json[0].lon) };
  } catch (err) {
    console.error("Erro Nominatim:", err);
    return null;
  }
}

async function cepToCoords(cep) {
  const clean = (cep || "").replace(/\D/g, "");

  // Buscar dados do CEP usando MULTI-API
  const data = await fetchCEP(clean);
  if (!data) return null;

  // Converter endereço em coordenadas via Nominatim
  const coords = await coordsFromCEPData(data);

  return coords;
}


function calcDistKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

async function calculateDeliveryFeeByCEP(cepCliente) {
  const cleanCliente = (cepCliente || "").replace(/\D/g, "");
  const cleanLoja = (STORE_CEP || "").replace(/\D/g, "");

  if (cleanCliente.length !== 8 || cleanLoja.length !== 8) {
    currentDeliveryFee = 0;
    updateSummaryDisplay();
    return;
  }

  const [lojaCoords, clienteCoords] = await Promise.all([
    cepToCoords(cleanLoja),
    cepToCoords(cleanCliente),
  ]);
if (!lojaCoords || !clienteCoords) {
    alert("Não foi possível obter coordenadas. Aplicando taxa máxima.");
    currentDeliveryFee = TAXA_MAXIMA;
    updateSummaryDisplay();
    return;
}

function showCepWarning(msg = "") {
  const modal = document.getElementById("cepWarningModal");
  const text = document.getElementById("cepWarningText");
  if (text && msg) text.textContent = msg;
  modal.classList.remove("hidden");
  setTimeout(() => modal.classList.add("visible"), 10);
}

function closeCepWarning() {
  const modal = document.getElementById("cepWarningModal");
  modal.classList.remove("visible");
  setTimeout(() => modal.classList.add("hidden"), 200);
}


  const distanceKm = calcDistKm(
    lojaCoords.lat,
    lojaCoords.lon,
    clienteCoords.lat,
    clienteCoords.lon
  );
  const fee = TAXA_FIXA + distanceKm * PRECO_POR_KM;
  currentDeliveryFee = parseFloat(fee.toFixed(2));
  console.log(
    `Distância (km): ${distanceKm.toFixed(
      2
    )} → Frete: R$ ${currentDeliveryFee.toFixed(2)}`
  );
  updateSummaryDisplay();
}

async function fetchAddressByCEP() {
  const cep = inputCEP && inputCEP.value ? inputCEP.value : "";
  const cleanCep = cep.replace(/\D/g, "");

  if (cleanCep.length !== 8) {
    if (customerStreet) customerStreet.value = "";
    currentDeliveryFee = 0;
    updateSummaryDisplay();
    return;
  }

  try {
    const data = await fetchCEP(cleanCep);

    if (!data) {
      alert("CEP não encontrado em nenhuma base. Digite um CEP válido.");
      if (customerStreet) customerStreet.value = "";
      currentDeliveryFee = 0;
      updateSummaryDisplay();
      return;
    }

    const fullStreet = `${data.logradouro}, ${data.bairro}, ${data.localidade}/${data.uf}`;

    if (customerStreet) customerStreet.value = fullStreet;

    if (customerAddressInput)
      customerAddressInput.dataset.baseAddress = fullStreet;

    // mantém cálculo de taxa
    await calculateDeliveryFeeByCEP(cleanCep);

  } catch (err) {
    console.error("Erro ao buscar CEP:", err);
    if (customerStreet) customerStreet.value = "Erro ao buscar CEP.";
    currentDeliveryFee = 0;
    updateSummaryDisplay();
  }
}


function concatenateAddress() {
  const streetBase =
    customerAddressInput && customerAddressInput.dataset.baseAddress
      ? customerAddressInput.dataset.baseAddress
      : "";
  const number =
    customerNumber && customerNumber.value ? customerNumber.value.trim() : "";
  const reference =
    customerReference && customerReference.value
      ? customerReference.value.trim()
      : "";
  let fullAddress = streetBase;
  if (number) fullAddress = `${fullAddress}, Nº ${number}`;
  if (reference) fullAddress = `${fullAddress} (Ref: ${reference})`;
  if (customerAddressInput) customerAddressInput.value = fullAddress.trim();
  updateCheckoutButtonState();
}

if (inputCEP) {
  inputCEP.addEventListener("input", (e) => {
    let val = e.target.value.replace(/\D/g, "");
    if (val.length > 5) val = val.substring(0, 5) + "-" + val.substring(5, 8);
    e.target.value = val.substring(0, 9);
  });
  //inputCEP.addEventListener("blur", fetchAddressByCEP);
  inputCEP.addEventListener("keyup", (e) => {
    if (e.target.value.replace(/\D/g, "").length === 8) fetchAddressByCEP();
  });
}

if (customerNumber)
  customerNumber.addEventListener("input", concatenateAddress);
if (customerReference)
  customerReference.addEventListener("input", concatenateAddress);

// ---------------------------
// Pagamento / Pix / validações
// ---------------------------
if (paymentSelect) {
  paymentSelect.addEventListener("change", () => {
    const method = paymentSelect.value;
    if (paymentCashBox) paymentCashBox.classList.add("hidden");
    if (paymentCardBox) paymentCardBox.classList.add("hidden");
    if (paymentPixBox) paymentPixBox.classList.add("hidden");
    if (method === "dinheiro" && paymentCashBox)
      paymentCashBox.classList.remove("hidden");
    if (method === "cartao" && paymentCardBox)
      paymentCardBox.classList.remove("hidden");
    if (method === "pix" && paymentPixBox)
      paymentPixBox.classList.remove("hidden");
    updateCheckoutButtonState();
  });
}

if (cashNeedChange) {
  cashNeedChange.addEventListener("change", () => {
    if (cashNeedChange.value === "sim" && cashAmount)
      cashAmount.classList.remove("hidden");
    else if (cashAmount) {
      cashAmount.classList.add("hidden");
      cashAmount.value = "";
    }
    updateCheckoutButtonState();
  });
}

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

if (pixComprovante)
  pixComprovante.addEventListener("change", updateCheckoutButtonState);

if (generatePixBtn) {
  generatePixBtn.addEventListener("click", () => {
    const total = getCartSubtotal() + currentDeliveryFee;
    const chavePix = "71991118924";
    const recebedor = "Seu Restaurante";
    const banco = "Banco Exemplo";
    const qrUrl =
      "https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=" +
      encodeURIComponent(
        `PIX: ${chavePix} - Valor: R$ ${formatCurrency(total)}`
      );
    if (pixQrPreview) pixQrPreview.classList.remove("hidden");
    if (pixQrPreview)
      pixQrPreview.innerHTML = `
            <img src="${qrUrl}" width="200" height="200" style="border-radius:8px;">
            <p style="font-size:12px;margin-top:6px;">Chave PIX:</p>
            <textarea readonly style="width:100%;height:60px;font-size:12px;">Chave: ${chavePix}
Banco: ${banco}
Recebedor: ${recebedor}</textarea>
        `;
  });
}

// ---------------------------
// Checkout (envia para /api/checkout)
// ---------------------------
if (btnCheckout) {
  btnCheckout.addEventListener("click", function () {
    if (btnCheckout.disabled)
      return alert(
        "Preencha todos os campos obrigatórios e adicione itens ao carrinho!"
      );
    const name = document.getElementById("customerName").value.trim();
    const address = customerAddressInput.value.trim();
    const contact = document.getElementById("customerContact").value.trim();
    const note = document.getElementById("customerNote").value.trim();
    const cepVal = (inputCEP || { value: "" }).value.trim();
    const bairroVal = (
      document.getElementById("customerBairro") || { value: "" }
    ).value;
    const deliveryFee = currentDeliveryFee;
    const subtotal = getCartSubtotal();
    const totalFinal = subtotal + deliveryFee;
    const payment = paymentSelect ? paymentSelect.value : "";

    const formData = new FormData();
    formData.append("customer_name", name);
    formData.append("customer_address", address);
    formData.append("customer_contact", contact);
    formData.append("customer_note", note);
    formData.append("cep", cepVal);
    formData.append("bairro", bairroVal);
    formData.append("delivery_tax", deliveryFee.toFixed(2));
    formData.append("subtotal", subtotal.toFixed(2));
    formData.append("total_final", totalFinal.toFixed(2));
    formData.append("payment_method", payment);

    if (payment === "dinheiro")
      formData.append("troco_para", cashAmount.value.trim());

    if (payment === "pix") {
      const comprovanteFile = pixComprovante.files[0];
      if (comprovanteFile) formData.append("pix_comprovante", comprovanteFile);
    }

    // serializa o carrinho com as informações necessárias
        const cartForServer = cart.map((i) => ({
          id: i.product_id,
          name: i.name,
          qty: i.qty,
          unit_price: Number(i.unit_price).toFixed(2),
          base_price: Number(i.base_price).toFixed(2),
          options: i.options || {},
        }));

    formData.append("cart", JSON.stringify(cartForServer));

    btnCheckout.disabled = true;

    fetch("/api/checkout", { method: "POST", body: formData })
      .then(async (r) => {
        const json = await r.json().catch(() => ({ ok: false }));
        if (r.ok && json.ok && json.whatsapp_url) {
          window.open(json.whatsapp_url, "_blank");
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

function resetCheckout() {
  const maybe = (id) => document.getElementById(id) || { value: "" };
  maybe("customerName").value = "";
  maybe("customerContact").value = "";
  maybe("customerNote").value = "";
  maybe("cashAmount").value = "";
  maybe("inputCEP").value = "";
  maybe("customerStreet").value = "";
  maybe("customerNumber").value = "";
  maybe("customerReference").value = "";
  if (customerAddressInput) customerAddressInput.value = "";
  if (cashNeedChange) cashNeedChange.value = "nao";
  if (cashAmount) {
    cashAmount.classList.add("hidden");
    cashAmount.value = "";
  }
  if (pixComprovante) pixComprovante.value = "";
  if (pixQrPreview) {
    pixQrPreview.classList.add("hidden");
    pixQrPreview.innerHTML = "";
  }
  if (paymentSelect) paymentSelect.value = "";
  if (paymentCashBox) paymentCashBox.classList.add("hidden");
  if (paymentCardBox) paymentCardBox.classList.add("hidden");
  if (paymentPixBox) paymentPixBox.classList.add("hidden");
  currentDeliveryFee = 0;
  cart.length = 0;
  renderCart();
}

function updateCheckoutButtonState() {
  const name = (
    document.getElementById("customerName") || { value: "" }
  ).value.trim();
  const contact = (
    document.getElementById("customerContact") || { value: "" }
  ).value.trim();
  const cep = (inputCEP || { value: "" }).value.replace(/\D/g, "");
  const address = (customerAddressInput || { value: "" }).value.trim();
  const street = (customerStreet || { value: "" }).value.trim();
  const number = (customerNumber || { value: "" }).value.trim();
  const method = paymentSelect ? paymentSelect.value : "";
  let isButtonEnabled = false;
  if (
    name &&
    contact &&
    cart.length > 0 &&
    cep.length === 8 &&
    street &&
    number &&
    address &&
    currentDeliveryFee >= 0 &&
    method
  ) {
    isButtonEnabled = true;
    if (method === "dinheiro") {
      if (cashNeedChange && cashNeedChange.value === "sim") {
        const raw = (cashAmount.value || "").replace(/\D/g, "");
        const totalFinal = getCartSubtotal() + currentDeliveryFee;
        if (!raw || Number(raw) === 0 || parseInt(raw) / 100 < totalFinal)
          isButtonEnabled = false;
      }
    } else if (method === "pix") {
      if (
        pixComprovante &&
        (!pixComprovante.files || pixComprovante.files.length === 0)
      )
        isButtonEnabled = false;
    }
  }
  if (btnCheckout) btnCheckout.disabled = !isButtonEnabled;
}

// ---------------------------
// Customization modal handling
// ---------------------------
let configuringProductContext = null; // holds { product_id, base_price, name, image, details }

function openConfigureModal(product_id, name, base_price, qty = 1, image = "") {

  configuringProductContext = {
    product_id: product_id,     // ✔ CORRIGIDO
    name: name,                 // ✔ CORRIGIDO
    base_price: base_price,     // ✔ CORRIGIDO
    image: image || "default.png",
    details: { sizes: [], ingredients: [], extras: [] }
  };

  if (!configureModal) return;

  configProductTitle.textContent = `Configurando: ${name}`;
  configBasePrice.textContent = `R$ ${formatCurrency(base_price)}`;
  configQtyInput.value = qty || 1;
  configOptionsContainer.innerHTML = "<p>Carregando opções...</p>";
  configAddBtn.disabled = true;

  updateFinalPrice();

  fetchProductOptions(product_id)
    .then((details) => {
      configuringProductContext.details = details || {
        sizes: [],
        ingredients: [],
        extras: [],
      };
      renderConfigOptions();
      updateFinalPrice();
    })
    .catch(() => {
      configuringProductContext.details = {
        sizes: [],
        ingredients: [],
        extras: [],
      };
      renderConfigOptions();
      updateFinalPrice();
    });

  configureModal.classList.remove("hidden");
  setTimeout(() => configureModal.classList.add("visible"), 8);
}


function closeConfigureModal() {
  if (!configureModal) return;
  configureModal.classList.remove("visible");
  setTimeout(() => configureModal.classList.add("hidden"), 220);
  configuringProductContext = null;
}

// tenta várias rotas para obter opções do produto
async function fetchProductOptions(product_id) {
  // 1) rota pública hipotética /api/product/<id>/details
  const tryUrls = [
    `/api/product/${product_id}/details`,
    `/admin/api/product/${product_id}/full_details`,
    `/admin/api/product/${product_id}/sizes`,
  ];
  for (let url of tryUrls) {
    try {
      const res = await fetch(url, { credentials: "same-origin" });
      if (!res.ok) {
        // se 404/403 continue para próxima
        continue;
      }
      const json = await res.json();
      // Normaliza a resposta em { sizes: [{id,nome,extra_price?}], ingredients: [{id,name,price?}], extras: [{id,name,price?}] }
      return normalizeProductDetails(json);
    } catch (e) {
      console.warn("fetch error", url, e);
      continue;
    }
  }
  return { sizes: [], ingredients: [], extras: [] };
}

function normalizeProductDetails(raw) {
  // várias formas possíveis:
  // - { sizes: [...], ingredients: [...], extras: [...] }
  // - sizes endpoint: [{id, nome}] or [{id, name}] or [{id, size_name, extra_price}]
  // - admin full_details earlier used: sizes [{id,name}], ingredients maybe ids array -> adapt
  const details = { sizes: [], ingredients: [], extras: [] };
  if (!raw) return details;

  // If raw is array -> treat as sizes list
  if (Array.isArray(raw)) {
    // assume sizes fallback
    details.sizes = raw.map((r) => ({
      id: r.id,
      name: r.nome || r.name || r.size_name,
      extra_price: toNumber(r.extra_price || r.price || 0),
    }));
    return details;
  }

  // If raw contains keys
  if (raw.sizes)
    details.sizes = (raw.sizes || []).map((r) => ({
      id: r.id,
      name: r.nome || r.name || r.size_name,
      extra_price: toNumber(r.extra_price || r.extra || r.price || 0),
    }));
  if (raw.ingredients)
    details.ingredients = (raw.ingredients || []).map((r) => ({
      id: r.id,
      name: r.name || r.nome,
      price: toNumber(r.price || 0),
    }));
  if (raw.extras)
    details.extras = (raw.extras || []).map((r) => ({
      id: r.id,
      name: r.name || r.nome,
      price: toNumber(r.price || r.extra_price || 0),
    }));

  // Some admin endpoints may return product_ingredients rows with only ingredient_id: []
  if (
    !details.ingredients.length &&
    Array.isArray(raw) &&
    raw.length > 0 &&
    raw[0].ingredient_id
  ) {
    details.ingredients = raw.map((r) => ({
      id: r.ingredient_id,
      name: r.ingredient_name || `Ingrediente ${r.ingredient_id}`,
      price: toNumber(r.price || 0),
    }));
  }

  // If admin returned arrays named differently
  if (raw.product_ingredients) {
    details.ingredients = raw.product_ingredients.map((r) => ({
      id: r.id || r.ingredient_id,
      name: r.name || r.ingredient_name || r.nome,
      price: toNumber(r.price || 0),
    }));
  }
  if (raw.product_extras) {
    details.extras = raw.product_extras.map((r) => ({
      id: r.id,
      name: r.name,
      price: toNumber(r.price || 0),
    }));
  }

  // Ensure defaults
  details.sizes = details.sizes || [];
  details.ingredients = details.ingredients || [];
  details.extras = details.extras || [];
  return details;
}

// ---------------------------
// Renderização e seleção de opções (delegation + robust)
// ---------------------------
function renderConfigOptions() {
  const details = configuringProductContext.details || {
    sizes: [],
    ingredients: [],
    extras: [],
  };
  configOptionsContainer.innerHTML = "";

  // ============ TAMANHOS ============
  if (details.sizes?.length) {
    configOptionsContainer.insertAdjacentHTML(
      "beforeend",
      `<div class="section-title">Tamanhos</div>`
    );
    details.sizes.forEach((size) => {
      const card = document.createElement("div");
      card.className = "option-card";
      card.dataset.type = "size";
      card.dataset.id = size.id;
      card.dataset.price = size.extra_price || 0;

      card.innerHTML = `
                <div class="option-title">${size.name}</div>
                ${
                  size.extra_price > 0
                    ? `<div class="option-extra">+ R$ ${formatCurrency(
                        size.extra_price
                      )}</div>`
                    : `<div class="option-extra"></div>`
                }
            `;
      configOptionsContainer.appendChild(card);
    });
  }

  // ============ INGREDIENTES ============
  if (details.ingredients?.length) {
    configOptionsContainer.insertAdjacentHTML(
      "beforeend",
      `<div class="section-title">Sabores</div>`
    );
    details.ingredients.forEach((ing) => {
      const card = document.createElement("div");
      card.className = "option-card";
      card.dataset.type = "ingredient";
      card.dataset.id = ing.id;

      card.innerHTML = `
                <div class="option-title">${ing.name}</div>
                <div class="switch" aria-hidden="true"></div>
            `;
      configOptionsContainer.appendChild(card);
    });
  }

  // ============ EXTRAS ============
  if (details.extras?.length) {
    configOptionsContainer.insertAdjacentHTML(
      "beforeend",
      `<div class="section-title">Adicionais</div>`
    );
    details.extras.forEach((extra) => {
      const card = document.createElement("div");
      card.className = "option-card";
      card.dataset.type = "extra";
      card.dataset.id = extra.id;
      card.dataset.price = extra.price || 0;

      card.innerHTML = `
                <div class="option-title">${extra.name}</div>
                <div class="option-extra">+ R$ ${formatCurrency(
                  extra.price
                )}</div>
                <div class="switch" aria-hidden="true"></div>
            `;
      configOptionsContainer.appendChild(card);
    });
  }

  // Ativa o delegation listener (uma vez): remove se já havia para evitar duplicatas
  if (configOptionsContainer._delegationBound) {
    configOptionsContainer.removeEventListener(
      "click",
      configOptionsContainer._delegationBound
    );
  }
  const handler = (e) => {
    // ignora clicks fora de cards
    const card = e.target.closest(".option-card");
    if (!card || !configOptionsContainer.contains(card)) return;

    const type = card.dataset.type;
    if (type === "size") {
      // seleção única: desmarca todos e marca o selecionado
      configOptionsContainer
        .querySelectorAll('.option-card[data-type="size"].selected')
        .forEach((c) => c.classList.remove("selected"));
      card.classList.add("selected");

      // salva seleção no contexto (útil se precisar)
      configuringProductContext.selectedSize = {
        id: card.dataset.id,
        price: Number(card.dataset.price || 0),
      };

      // habilita adicionar (se tiver qty)
      configAddBtn.disabled = false;
      updateFinalPrice();
    } else if (type === "ingredient") {
    // INGREDIENTE — SELEÇÃO ÚNICA
    configOptionsContainer
        .querySelectorAll('.option-card[data-type="ingredient"].selected')
        .forEach(c => c.classList.remove("selected"));

    card.classList.add("selected");
    updateFinalPrice();
}
else if (type === "extra") {
    // EXTRAS — múltipla escolha normal
    card.classList.toggle("selected");
    updateFinalPrice();
    }
  };
  configOptionsContainer.addEventListener("click", handler);
  configOptionsContainer._delegationBound = handler;

  // Inicializa preço/estado
  updateFinalPrice();
}

// ---------------------------
// Quantidade modal helpers
// ---------------------------
function modalChangeQty(delta) {
  let v = parseInt(configQtyInput.value) || 1;
  v = Math.max(1, v + delta);
  configQtyInput.value = v;
  updateFinalPrice();
}

// ---------------------------
// Cálculo final (mantido, compatível com estrutura de cards)
// ---------------------------
function updateFinalPrice() {
  if (!configuringProductContext) return;

  let price = Number(configuringProductContext.base_price) || 0;

  // SIZE (selecionado)
  const sizeCard = configOptionsContainer.querySelector(
    '.option-card[data-type="size"].selected'
  );
  let sizeObj = null;
  if (sizeCard) {
    price += Number(sizeCard.dataset.price || 0);
    sizeObj = {
      id: sizeCard.dataset.id,
      name: sizeCard.querySelector(".option-title")
        ? sizeCard.querySelector(".option-title").textContent.trim()
        : "",
      extra_price: Number(sizeCard.dataset.price || 0),
    };
  }

  // INGREDIENTS (selecionados)
  const ingredientCards = Array.from(
    configOptionsContainer.querySelectorAll(
      '.option-card[data-type="ingredient"].selected'
    )
  );
  const ingredients = ingredientCards.map((card) => ({
    id: card.dataset.id,
    name: card.querySelector(".option-title")
      ? card.querySelector(".option-title").textContent.trim()
      : "",
    price: 0,
  }));

  // EXTRAS (selecionados)
  const extraCards = Array.from(
    configOptionsContainer.querySelectorAll(
      '.option-card[data-type="extra"].selected'
    )
  );
  const extras = extraCards.map((card) => ({
    id: card.dataset.id,
    name: card.querySelector(".option-title")
      ? card.querySelector(".option-title").textContent.trim()
      : "",
    price: Number(card.dataset.price || 0),
  }));
  extras.forEach((e) => (price += e.price));

  const qty = Number(configQtyInput.value) || 1;
  const final = price * qty;

  if (configFinalPrice)
    configFinalPrice.textContent = `R$ ${formatCurrency(final)}`;

  // store temporary computed options for adding
  configuringProductContext._computed = {
    unit_price: price,
    final_price: final,
    qty,
    size: sizeObj,
    ingredients,
    extras,
  };

  // enable add button only if qty >=1
  if (configAddBtn) configAddBtn.disabled = qty < 1;
}

// ---------------------------
// Ao clicar em Adicionar no modal: cria item montado no carrinho
// ---------------------------
if (configAddBtn) {
    configAddBtn.addEventListener("click", () => {
        if (!configuringProductContext) return;

        const ctx = configuringProductContext;
        const comp = ctx._computed || {};

        const unitPrice = Number(comp.unit_price || ctx.base_price || 0);
        const qty = Number(comp.qty) || 1;

        const options = {
            size: comp.size || null,
            ingredients: comp.ingredients || [],
            extras: comp.extras || []
        };

        cart.push({
            _uid: uid("c_"),
            product_id: ctx.product_id,           // correto agora
            name: ctx.name,
            
            unit_price: unitPrice,                // preço final da unidade
            base_price: ctx.base_price,           // preço original
            
            qty,
            image: ctx.image || "default.png",
            options: options
        });

        renderCart();
        closeConfigureModal();
        showDecisionModal();
    });
}



// ---------------------------
// Inicialização
// ---------------------------
document.addEventListener("DOMContentLoaded", () => {
  loadProducts();
  renderCart();
  updateCheckoutButtonState();
});

// ---------------------------
// Expose small helpers to global (para HTML inline handlers usados no template)
// ---------------------------
window.openConfigureModal = openConfigureModal;
window.closeConfigureModal = closeConfigureModal;
window.updateFinalPrice = updateFinalPrice;
window.configQtyInput = configQtyInput;
