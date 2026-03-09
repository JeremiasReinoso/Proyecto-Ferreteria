const els = {
    productsGrid: document.querySelector("#productsGrid"),
    summary: document.querySelector("#summary"),
    searchInput: document.querySelector("#searchInput"),
    addProductBtn: document.querySelector("#addProductBtn"),
    productDialog: document.querySelector("#productDialog"),
    cancelDialogBtn: document.querySelector("#cancelDialogBtn"),
    productForm: document.querySelector("#productForm"),
    dialogTitle: document.querySelector("#dialogTitle"),
    productId: document.querySelector("#productId"),
    productName: document.querySelector("#productName"),
    productCategory: document.querySelector("#productCategory"),
    productPrice: document.querySelector("#productPrice"),
    productStock: document.querySelector("#productStock"),
    backendStatus: document.querySelector("#backendStatus")
};

let products = [];
let searchText = "";
let lowStockLimit = 10;

init();

els.searchInput.addEventListener("input", async (event) => {
    searchText = event.target.value.trim();
    await loadProducts();
});

els.addProductBtn.addEventListener("click", () => openDialog());

els.cancelDialogBtn.addEventListener("click", () => els.productDialog.close());

els.productForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const payload = {
        name: els.productName.value.trim(),
        category: els.productCategory.value.trim(),
        price: Number(els.productPrice.value),
        stock: Number(els.productStock.value)
    };

    if (!payload.name || !payload.category || payload.price <= 0 || payload.stock < 0) {
        alert("Completa todos los campos con valores validos.");
        return;
    }

    const id = els.productId.value;

    try {
        if (id) {
            await apiFetch(`/api/products/${id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });
        } else {
            await apiFetch("/api/products", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });
        }

        els.productDialog.close();
        await refreshData();
    } catch (error) {
        alert(error.message);
    }
});

els.productsGrid.addEventListener("click", async (event) => {
    const actionTarget = event.target.closest("button[data-action]");
    if (!actionTarget) return;

    const { id, action } = actionTarget.dataset;

    try {
        if (action === "sell") {
            await apiFetch(`/api/products/${id}/sell`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ quantity: 1 })
            });
        }

        if (action === "edit") {
            const product = products.find((item) => item.id === id);
            if (!product) return;
            openDialog(product);
            return;
        }

        if (action === "delete") {
            const product = products.find((item) => item.id === id);
            if (!product) return;

            const confirmed = confirm(`Eliminar "${product.name}" del inventario?`);
            if (!confirmed) return;

            await apiFetch(`/api/products/${id}`, { method: "DELETE" });
        }

        await refreshData();
    } catch (error) {
        alert(error.message);
    }
});

async function init() {
    try {
        const config = await apiFetch("/api/config");
        lowStockLimit = config.lowStockLimit || 10;

        els.backendStatus.textContent = config.emailEnabled
            ? `Notificaciones por correo activas. Umbral de stock bajo: ${lowStockLimit}.`
            : `Notificaciones por correo desactivadas en el servidor. Configura SMTP para alertas (umbral: ${lowStockLimit}).`;

        await refreshData();
    } catch (error) {
        els.backendStatus.textContent = `No se pudo conectar al backend: ${error.message}`;
    }
}

async function refreshData() {
    await Promise.all([loadProducts(), renderSummary()]);
}

async function loadProducts() {
    const query = searchText ? `?search=${encodeURIComponent(searchText)}` : "";
    products = await apiFetch(`/api/products${query}`);
    renderProducts();
}

async function renderSummary() {
    const data = await apiFetch("/api/summary");
    els.summary.innerHTML = `
        <article class="kpi"><small>Productos</small><strong>${data.totalProducts}</strong></article>
        <article class="kpi"><small>Unidades en stock</small><strong>${data.totalStock}</strong></article>
        <article class="kpi"><small>Stock bajo (<=${lowStockLimit})</small><strong>${data.lowStock}</strong></article>
        <article class="kpi"><small>Sin stock</small><strong>${data.outOfStock}</strong></article>
        <article class="kpi"><small>Total vendidos</small><strong>${data.soldTotal}</strong></article>
    `;
}

function renderProducts() {
    if (products.length === 0) {
        els.productsGrid.innerHTML = "<p>No hay productos para mostrar.</p>";
        return;
    }

    els.productsGrid.innerHTML = products.map(productCardTemplate).join("");
}

function productCardTemplate(product) {
    const stockState = getStockState(product.stock);

    return `
        <article class="product-card">
            <h3>${escapeHtml(product.name)}</h3>
            <p class="meta">${escapeHtml(product.category)}</p>
            <span class="badge ${stockState.className}">${stockState.label}</span>
            <p><strong>Stock:</strong> ${product.stock}</p>
            <p><strong>Precio:</strong> ${formatCurrency(product.price)}</p>
            <p><strong>Vendidos:</strong> ${product.sold}</p>
            <div class="card-actions">
                <button class="btn ${product.stock === 0 ? "btn-danger" : ""}" data-action="sell" data-id="${product.id}" ${product.stock === 0 ? "disabled" : ""}>
                    Vender 1
                </button>
                <button class="btn btn-ghost" data-action="edit" data-id="${product.id}">Editar</button>
                <button class="btn btn-warning" data-action="delete" data-id="${product.id}">Eliminar</button>
            </div>
        </article>
    `;
}

function openDialog(product = null) {
    if (product) {
        els.dialogTitle.textContent = "Editar producto";
        els.productId.value = product.id;
        els.productName.value = product.name;
        els.productCategory.value = product.category;
        els.productPrice.value = String(product.price);
        els.productStock.value = String(product.stock);
    } else {
        els.dialogTitle.textContent = "Nuevo producto";
        els.productForm.reset();
        els.productId.value = "";
    }

    els.productDialog.showModal();
}

function getStockState(stock) {
    if (stock === 0) return { className: "out", label: "Agotado" };
    if (stock <= lowStockLimit) return { className: "low", label: "Stock bajo" };
    return { className: "ok", label: "Disponible" };
}

async function apiFetch(url, options = {}) {
    const response = await fetch(url, options);
    if (response.status === 204) return null;

    const contentType = response.headers.get("content-type") || "";
    const data = contentType.includes("application/json") ? await response.json() : null;

    if (!response.ok) {
        throw new Error(data?.error || "Error en la solicitud.");
    }

    return data;
}

function formatCurrency(value) {
    return new Intl.NumberFormat("es-AR", {
        style: "currency",
        currency: "ARS",
        maximumFractionDigits: 0
    }).format(value);
}

function escapeHtml(value) {
    return value
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll("\"", "&quot;")
        .replaceAll("'", "&#39;");
}
