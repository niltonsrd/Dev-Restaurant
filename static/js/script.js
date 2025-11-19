// =======================================
// script.js (versão final com entrega por DISTÂNCIA - CEP da loja em variável)
// =======================================

let cart = [];
let currentCategory = "Todos";
let currentDeliveryFee = 0; // taxa atual calculada

// =========================
// CONFIGURAÇÕES (edite aqui apenas o CEP da loja)
// =========================
const STORE_CEP = "41185-510"; // <-- coloque o CEP da sua loja aqui (formato 00000-000)
const TAXA_FIXA = 5.00;        // R$ 5,00 fixo
const PRECO_POR_KM = 2.00;     // R$ 2,00 por km

// =======================================
// ELEMENTOS DOM
// =======================================
const decisionModal = document.getElementById('decisionModal');
const continueShoppingBtn = document.getElementById('continueShoppingBtn');
const goToCartBtn = document.getElementById('goToCartBtn');
const sidebar = document.querySelector('.sidebar');
const cartList = document.getElementById("cartList");
const cartTotalContainer = document.querySelector('.cart-total');

// Elementos de Checkout
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

// Campos de endereço
const inputCEP = document.getElementById("inputCEP");
const customerStreet = document.getElementById("customerStreet");
const customerNumber = document.getElementById("customerNumber");
const customerReference = document.getElementById("customerReference");
const customerAddressInput = document.getElementById("customerAddress"); // hidden para enviar

const deliveryTaxInput = document.getElementById("deliveryTaxInput");

// =======================================
// UTILITÁRIAS
// =======================================
function formatCurrency(value) {
    return Number(value).toFixed(2).replace('.', ',');
}

// =======================================
// MODAL (mantido do seu script original)
// =======================================
function showDecisionModal() {
    if (!decisionModal) return;
    decisionModal.classList.remove('hidden');
    setTimeout(() => decisionModal.classList.add('visible'), 10);
}
function hideDecisionModal() {
    if (!decisionModal) return;
    decisionModal.classList.remove('visible');
    setTimeout(() => decisionModal.classList.add('hidden'), 300);
}

// =======================================
// PRODUTOS / CATALOGO (mantido, sem alterações lógicas)
// =======================================
function loadProducts() {
    fetch("/api/products")
        .then(r => r.json())
        .then((products) => {
            const catalog = document.getElementById("catalog");
            if (!catalog) return;
            catalog.innerHTML = "";

            const filterContainer = document.getElementById("filter-container");
            if (filterContainer) {
                filterContainer.innerHTML = "";

                const categories = ["Todos", ...new Set(products.map(p => p.category).filter(Boolean))];

                categories.forEach(cat => {
                    const btn = document.createElement("button");
                    btn.innerText = cat;
                    btn.className = "filter-btn";
                    if (cat === currentCategory) btn.classList.add("active");

                    btn.addEventListener("click", () => {
                        currentCategory = cat;
                        document.querySelectorAll(".filter-btn").forEach(b => b.classList.remove("active"));
                        btn.classList.add("active");
                        renderCatalog(products);
                    });

                    filterContainer.appendChild(btn);
                });
            }
            renderCatalog(products);
        })
        .catch(err => console.error("Erro ao carregar produtos:", err));
}

function renderCatalog(products) {
    const catalog = document.getElementById("catalog");
    if (!catalog) return;
    catalog.innerHTML = "";

    const filtered = currentCategory === "Todos"
        ? products
        : products.filter(p => p.category === currentCategory);

    if (filtered.length === 0) {
        catalog.innerHTML = "<p>Nenhum produto nessa categoria.</p>";
        return;
    }

    filtered.forEach((p) => {
        const card = document.createElement("article");
        card.className = "card";

        card.innerHTML = `
        <img src="/static/img/${p.image}" alt="${p.name}">
        <div class="card-content">
          <h3 class="card-name">${p.name}</h3>
          <p class="card-description">${p.description || ""}</p>
          <div class="card-footer">
            <p class="price">R$ ${formatCurrency(p.price)}</p>
            <div class="qty-add-container">
              <div class="qty-container">
                <button class="qty-btn minus">−</button>
                <input type="number" class="qty-input" value="1" min="1">
                <button class="qty-btn plus">+</button>
              </div>
              <button class="btn btn-primary add-btn">Adicionar</button>
            </div>
          </div>
        </div>
      `;

        catalog.appendChild(card);

        // Lógica de quantidade e Adicionar ao Carrinho
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
            addToCart(p.id, p.name, Number(p.price), p.image, qty);
            showDecisionModal();
            qtyInput.value = 1;
        });
    });
}

// =======================================
// CARRINHO (mantido)
// =======================================
function getCartSubtotal() {
    return cart.reduce((total, item) => total + (item.qty * item.price), 0);
}

function renderCart() {
    if (!cartList) return;
    cartList.innerHTML = "";

    if (cart.length === 0) {
        cartList.innerHTML = '<p style="color: var(--text-muted); text-align: center; padding: 20px;">O carrinho está vazio.</p>';
    }

    cart.forEach((item) => {
        const div = document.createElement("div");
        div.className = "cart-item";

        div.innerHTML = `
        <img class="item-thumb" src="/static/img/${item.image}">
        
        <div style="flex:1">
            <div><strong>${item.name}</strong></div>
            <div class="small muted">${item.qty} x R$ ${formatCurrency(item.price)}</div>
        </div>

        <div>
            <button class="btn btn-secondary" style="padding: 4px 8px; font-size: 14px; margin-right: 4px;" onclick="changeQty(${item.id}, 1)">+</button>
            <button class="btn btn-secondary" style="padding: 4px 8px; font-size: 14px;" onclick="changeQty(${item.id}, -1)">-</button>
        </div>
        `;
        cartList.appendChild(div);
    });

    updateSummaryDisplay();
    updateCheckoutButtonState();
}

function updateSummaryDisplay() {
    const subtotal = getCartSubtotal();
    const fee = currentDeliveryFee || 0;
    const totalFinal = subtotal + fee;

    if (!cartTotalContainer) return;

    // HTML mais rico com ícones SVG e classes para estilização
    cartTotalContainer.innerHTML = `
      <div class="totals-card" role="region" aria-label="Resumo do pedido">
        <div class="totals-row">
          <div class="totals-left">
            <svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4h10v2H7zM5 8h14v2H5zM3 12h18v2H3z" fill="currentColor"/></svg>
            <div>
              <div class="totals-title">Subtotal</div>
              <div class="totals-sub">Itens</div>
            </div>
          </div>
          <div class="totals-right">R$ <span class="amount" data-value="${subtotal}">${formatCurrency(subtotal)}</span></div>
        </div>

        <div class="totals-row">
          <div class="totals-left">
            <svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2a2 2 0 012 2v10l4 4H6l4-4V4a2 2 0 012-2z" fill="currentColor"/></svg>
            <div>
              <div class="totals-title">Entrega</div>
              <div class="totals-sub">Taxa estimada</div>
            </div>
          </div>
          <div class="totals-right">R$ <span class="amount" data-value="${fee}">${formatCurrency(fee)}</span></div>
        </div>

        <div class="totals-divider" aria-hidden="true"></div>

        <div class="totals-final" role="status" aria-live="polite">
          <div class="final-left">
            <div class="final-label">Total</div>
            <div class="final-sub">Inclui entrega</div>
          </div>
          <div class="final-value">R$ <span id="cartTotalAnimated" class="final-amount" data-value="${totalFinal}">${formatCurrency(totalFinal)}</span></div>
        </div>

        <div class="totals-hint">Pagamento e entrega serão confirmados no fechamento do pedido.</div>
      </div>
    `;

    // Atualiza o input hidden para envio
    if (deliveryTaxInput) deliveryTaxInput.value = fee.toFixed(2);

    // Atualiza texto do botão de checkout
    if (cart.length > 0) {
        btnCheckout.textContent = `Finalizar pedido (Total: R$ ${formatCurrency(totalFinal)})`;
    } else {
        btnCheckout.textContent = 'Finalizar pedido (WhatsApp)';
    }

    // Animações suaves dos valores (contagem)
    animateAmountElements();
    updateCheckoutButtonState();
}

/* Animate numeric values from previous to current for elements with .amount and #cartTotalAnimated */
function animateAmountElements(duration = 500) {
    const els = Array.from(document.querySelectorAll('.amount, .final-amount'));
    els.forEach(el => {
        const target = parseFloat(el.getAttribute('data-value')) || 0;
        const start = parseFloat(el.dataset.currentValue) || 0;
        el.dataset.currentValue = start; // ensure defined

        const startTime = performance.now();
        function step(now) {
            const t = Math.min(1, (now - startTime) / duration);
            const eased = easeOutCubic(t);
            const current = start + (target - start) * eased;
            // mostra formatado com vírgula
            el.textContent = formatCurrency(current);
            if (t < 1) requestAnimationFrame(step);
            else el.dataset.currentValue = target; // set final
        }
        requestAnimationFrame(step);
    });

    function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }
}


function addToCart(id, name, price, image, qty = 1) {
    const found = cart.find((i) => i.id === id);
    if (found) found.qty += qty;
    else cart.push({ id, name, price, qty, image });

    renderCart();
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
// CEP -> ENDEREÇO (VIACEP) e COORDS (NOMINATIM) + DISTÂNCIA REAL
// =======================================

/**
 * Busca dados do ViaCEP (retorna objeto com logradouro, bairro, localidade, uf)
 * @param {string} cep - formato 00000000 ou 00000-000
 */
async function fetchViaCEP(cep) {
    const cleanCep = (cep || "").replace(/\D/g, "");
    if (cleanCep.length !== 8) return null;

    try {
        const res = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
        const data = await res.json();
        if (data.erro) return null;
        return data; // tem logradouro, bairro, localidade, uf
    } catch (err) {
        console.error("Erro ViaCEP:", err);
        return null;
    }
}

/**
 * Converte um endereço (retornado pelo ViaCEP) para coordenadas usando Nominatim
 * Monta uma query amigável para o Nominatim a partir dos campos do ViaCEP
 * @param {object} viaData - resposta do ViaCEP
 * @returns { lat, lon } ou null
 */
async function coordsFromViaCEPData(viaData) {
    if (!viaData) return null;

    // monta a query (prioriza logradouro + localidade + uf)
    const queryParts = [];
    if (viaData.logradouro) queryParts.push(viaData.logradouro);
    if (viaData.bairro) queryParts.push(viaData.bairro);
    if (viaData.localidade) queryParts.push(viaData.localidade);
    if (viaData.uf) queryParts.push(viaData.uf);

    const q = encodeURIComponent(queryParts.join(", "));
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${q}&limit=1`;

    try {
        const res = await fetch(url, { headers: { "User-Agent": "DeliveryApp/1.0 (contato@example.com)" } });
        const json = await res.json();
        if (!json || json.length === 0) return null;
        return { lat: parseFloat(json[0].lat), lon: parseFloat(json[0].lon) };
    } catch (err) {
        console.error("Erro Nominatim:", err);
        return null;
    }
}

/**
 * Converte CEP => coords (via ViaCEP + Nominatim)
 * @param {string} cep
 * @returns { lat, lon } ou null
 */
async function cepToCoords(cep) {
    const via = await fetchViaCEP(cep);
    if (!via) return null;
    const coords = await coordsFromViaCEPData(via);
    return coords;
}

/**
 * Calcula distância (km) entre duas coordenadas (Haversine)
 */
function calcDistKm(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

/**
 * Calcula a taxa real por CEP da loja (STORE_CEP) -> CEP cliente
 * Atualiza currentDeliveryFee e o resumo
 */
async function calculateDeliveryFeeByCEP(cepCliente) {
    const cleanCliente = (cepCliente || "").replace(/\D/g, "");
    const cleanLoja = (STORE_CEP || "").replace(/\D/g, "");

    if (cleanCliente.length !== 8 || cleanLoja.length !== 8) {
        currentDeliveryFee = 0;
        updateSummaryDisplay();
        return;
    }

    // busca coords da loja e do cliente
    const [lojaCoords, clienteCoords] = await Promise.all([
        cepToCoords(cleanLoja),
        cepToCoords(cleanCliente)
    ]);

    if (!lojaCoords || !clienteCoords) {
        // Fallback: se não encontrar coords, zera frete e avisa no console
        console.warn("Não foi possível obter coordenadas da loja ou do cliente via Nominatim.");
        currentDeliveryFee = 0;
        updateSummaryDisplay();
        return;
    }

    const distanceKm = calcDistKm(lojaCoords.lat, lojaCoords.lon, clienteCoords.lat, clienteCoords.lon);

    const fee = TAXA_FIXA + (distanceKm * PRECO_POR_KM);
    currentDeliveryFee = parseFloat(fee.toFixed(2));

    console.log(`Distância (km): ${distanceKm.toFixed(2)} → Frete: R$ ${currentDeliveryFee.toFixed(2)}`);

    updateSummaryDisplay();
}

// =======================================
// Busca endereço + atualiza campos do formulário
// =======================================
async function fetchAddressByCEP() {
    const cep = (inputCEP && inputCEP.value) ? inputCEP.value : "";
    const cleanCep = cep.replace(/\D/g, '');

    if (cleanCep.length !== 8) {
        // limpa campos e reseta frete
        if (customerStreet) customerStreet.value = "";
        if (customerAddressInput) customerAddressInput.value = "";
        currentDeliveryFee = 0;
        updateSummaryDisplay();
        return;
    }

    try {
        const data = await fetchViaCEP(cleanCep);
        if (!data) {
            alert("CEP não encontrado. Por favor, digite um CEP válido.");
            if (customerStreet) customerStreet.value = "";
            currentDeliveryFee = 0;
            updateSummaryDisplay();
            return;
        }

        if (customerStreet) customerStreet.value = `${data.logradouro}, ${data.bairro}, ${data.localidade}/${data.uf}`;
        if (customerAddressInput) customerAddressInput.dataset.baseAddress = customerStreet ? customerStreet.value : "";

        // Calcula frete real via CEPs
        await calculateDeliveryFeeByCEP(cleanCep);

    } catch (err) {
        console.error("Erro ao buscar endereço:", err);
        if (customerStreet) customerStreet.value = "Erro ao buscar endereço.";
        currentDeliveryFee = 0;
        updateSummaryDisplay();
    }
}

// =======================================
// Concatena endereço completo (Rua + Nº + Ref) para envio
// =======================================
function concatenateAddress() {
    const streetBase = (customerAddressInput && customerAddressInput.dataset.baseAddress) ? customerAddressInput.dataset.baseAddress : "";
    const number = (customerNumber && customerNumber.value) ? customerNumber.value.trim() : "";
    const reference = (customerReference && customerReference.value) ? customerReference.value.trim() : "";

    let fullAddress = streetBase;
    if (number) fullAddress = `${fullAddress}, Nº ${number}`;
    if (reference) fullAddress = `${fullAddress} (Ref: ${reference})`;

    if (customerAddressInput) customerAddressInput.value = fullAddress.trim();
    updateCheckoutButtonState();
}

// Eventos de CEP: máscara, blur e keyup
if (inputCEP) {
    inputCEP.addEventListener("input", (e) => {
        let val = e.target.value.replace(/\D/g, '');
        if (val.length > 5) val = val.substring(0, 5) + '-' + val.substring(5, 8);
        e.target.value = val.substring(0, 9);
    });

    inputCEP.addEventListener("blur", fetchAddressByCEP);
    inputCEP.addEventListener("keyup", (e) => {
        if (e.target.value.replace(/\D/g, '').length === 8) {
            fetchAddressByCEP();
        }
    });
}

if (customerNumber) customerNumber.addEventListener("input", concatenateAddress);
if (customerReference) customerReference.addEventListener("input", concatenateAddress);

// =======================================
// Pagamento, QR, validações, modal (mantidos / ajustados onde necessário)
// =======================================
if (paymentSelect) {
    paymentSelect.addEventListener("change", () => {
        const method = paymentSelect.value;
        if (paymentCashBox) paymentCashBox.classList.add("hidden");
        if (paymentCardBox) paymentCardBox.classList.add("hidden");
        if (paymentPixBox) paymentPixBox.classList.add("hidden");

        if (method === "dinheiro" && paymentCashBox) paymentCashBox.classList.remove("hidden");
        if (method === "cartao" && paymentCardBox) paymentCardBox.classList.remove("hidden");
        if (method === "pix" && paymentPixBox) paymentPixBox.classList.remove("hidden");

        updateCheckoutButtonState();
    });
}

if (cashNeedChange) {
    cashNeedChange.addEventListener("change", () => {
        if (cashNeedChange.value === "sim" && cashAmount) {
            cashAmount.classList.remove("hidden");
        } else if (cashAmount) {
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

if (pixComprovante) pixComprovante.addEventListener("change", updateCheckoutButtonState);

if (continueShoppingBtn) continueShoppingBtn.addEventListener('click', hideDecisionModal);

if (goToCartBtn && sidebar) {
    goToCartBtn.addEventListener('click', () => {
        hideDecisionModal();
        sidebar.scrollIntoView({ behavior: 'smooth' });
    });
}

if (decisionModal) {
    decisionModal.addEventListener('click', (event) => {
        if (event.target.id === 'decisionModal') {
            hideDecisionModal();
        }
    });
}

// Habilitação do botão de checkout
function updateCheckoutButtonState() {
    const name = (document.getElementById("customerName") || { value: "" }).value.trim();
    const contact = (document.getElementById("customerContact") || { value: "" }).value.trim();

    const cep = (inputCEP || { value: "" }).value.replace(/\D/g, '');
    const address = (customerAddressInput || { value: "" }).value.trim();
    const street = (customerStreet || { value: "" }).value.trim();
    const number = (customerNumber || { value: "" }).value.trim();

    const method = paymentSelect ? paymentSelect.value : "";

    let isButtonEnabled = false;

    if (name && contact && cart.length > 0 && cep.length === 8 && street && number && address && currentDeliveryFee >= 0 && method) {
        isButtonEnabled = true;

        if (method === "dinheiro") {
            if (cashNeedChange && cashNeedChange.value === "sim") {
                const raw = (cashAmount.value || "").replace(/\D/g, "");
                const totalFinal = getCartSubtotal() + currentDeliveryFee;
                if (!raw || Number(raw) === 0 || (parseInt(raw) / 100) < totalFinal) {
                    isButtonEnabled = false;
                }
            }
        } else if (method === "pix") {
            if (pixComprovante && (!pixComprovante.files || pixComprovante.files.length === 0)) {
                isButtonEnabled = false;
            }
        }
    }

    if (btnCheckout) btnCheckout.disabled = !isButtonEnabled;
}

// =======================================
// GERAR QR CODE PIX (mantido)
// =======================================
if (generatePixBtn) {
    generatePixBtn.addEventListener("click", () => {
        const total = getCartSubtotal() + currentDeliveryFee;
        const chavePix = "71991118924";
        const recebedor = "Josenilton Santos da Cruz";
        const banco = "C6 Bank";

        const qrUrl =
            "https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=" +
            encodeURIComponent(`PIX: ${chavePix} - Valor: R$ ${formatCurrency(total)}`);

        if (pixQrPreview) pixQrPreview.classList.remove("hidden");

        if (pixQrPreview) pixQrPreview.innerHTML = `
        <img src="${qrUrl}" width="200" height="200" style="border-radius:8px;">
        <p style="font-size:12px;margin-top:6px;">Chave PIX:</p>
        <textarea readonly style="width:100%;height:60px;font-size:12px;">Chave: ${chavePix}
Banco: ${banco}
Recebedor: ${recebedor}</textarea>
        `;
    });
}

// =======================================
// FINALIZAR PEDIDO (AJUSTADO) (mantido)
// =======================================
if (btnCheckout) {
    btnCheckout.addEventListener("click", function () {
        if (btnCheckout.disabled) return alert("Preencha todos os campos obrigatórios e adicione itens ao carrinho!");

        const name = document.getElementById("customerName").value.trim();
        const address = customerAddressInput.value.trim();
        const contact = document.getElementById("customerContact").value.trim();
        const note = document.getElementById("customerNote").value.trim();
        const cepVal = (inputCEP || { value: "" }).value.trim();
        const bairroVal = (document.getElementById("customerBairro") || { value: "" }).value;

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

        if (payment === "dinheiro") {
            formData.append("troco_para", cashAmount.value.trim());
        }

        let comprovanteFile = null;
        if (payment === "pix") {
            comprovanteFile = pixComprovante.files[0];
            if (comprovanteFile) formData.append("pix_comprovante", comprovanteFile);
        }

        formData.append("cart", JSON.stringify(cart));

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

// =======================================
// RESET DO CHECKOUT (AJUSTADO)
// =======================================
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

// =======================================
// INICIALIZAÇÃO
// =======================================
document.addEventListener("DOMContentLoaded", () => {
    loadProducts();
    renderCart();
    updateCheckoutButtonState();
});

// =======================================
// Funções auxiliares faltantes (se necessário)
// =======================================

// Se em algum lugar do seu código o getCartSubtotal foi chamado por outro nome,
// você já tem getCartSubtotal definido acima. Mantive nomes originais.

