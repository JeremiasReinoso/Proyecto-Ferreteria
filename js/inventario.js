const inventarioBody = document.querySelector("#inventarioBody");
const searchInput = document.querySelector("#searchInput");
const btnNuevo = document.querySelector("#btnNuevo");

const productModal = document.querySelector("#productModal");
const closeModalBtn = document.querySelector("#closeModalBtn");
const cancelModalBtn = document.querySelector("#cancelModalBtn");
const productForm = document.querySelector("#productForm");
const modalTitle = document.querySelector("#modalTitle");

const modalProductId = document.querySelector("#modalProductId");
const modalNombre = document.querySelector("#modalNombre");
const modalCategoria = document.querySelector("#modalCategoria");
const modalPrecio = document.querySelector("#modalPrecio");
const modalStock = document.querySelector("#modalStock");
const modalCodigo = document.querySelector("#modalCodigo");
const generateCodeBtn = document.querySelector("#generateCodeBtn");

let filtro = "";

document.addEventListener("DOMContentLoaded", () => {
    try {
        if (!inventarioBody || !searchInput || !btnNuevo || !productModal || !productForm) {
            console.warn("[inventario] Faltan elementos en el DOM.");
            return;
        }
        if (!window.InventoryApp) {
            console.error("[inventario] InventoryApp no esta disponible.");
            return;
        }
        console.log("[inventario] DOM listo");
        renderInventario();

        searchInput.addEventListener("input", () => {
            filtro = searchInput.value.trim().toLowerCase();
            renderInventario();
        });

        btnNuevo.addEventListener("click", () => {
            openProductModal();
        });

        if (generateCodeBtn) {
            generateCodeBtn.addEventListener("click", () => {
                modalCodigo.value = generarCodigoProducto();
            });
        }

        if (closeModalBtn) closeModalBtn.addEventListener("click", closeProductModal);
        if (cancelModalBtn) cancelModalBtn.addEventListener("click", closeProductModal);

        productModal.addEventListener("click", (event) => {
            if (event.target === productModal) {
                closeProductModal();
            }
        });

        document.addEventListener("keydown", (event) => {
            if (event.key === "Escape" && productModal.classList.contains("show")) {
                closeProductModal();
            }
        });

        productForm.addEventListener("submit", handleSubmit);
    } catch (error) {
        console.error("[inventario] Error inicializando", error);
    }
});

document.addEventListener("click", (event) => {
    const editarBtn = event.target.closest(".btn-editar");
    if (editarBtn) {
        const id = Number(editarBtn.dataset.id);
        if (Number.isNaN(id)) {
            console.warn("[inventario] data-id invalido en btn-editar", editarBtn);
            return;
        }
        console.log("Editar producto", id);
        editarProducto(id);
        return;
    }

    const borrarBtn = event.target.closest(".btn-borrar");
    if (borrarBtn) {
        const id = Number(borrarBtn.dataset.id);
        if (Number.isNaN(id)) {
            console.warn("[inventario] data-id invalido en btn-borrar", borrarBtn);
            return;
        }
        console.log("Borrar producto", id);
        borrarProducto(id);
    }
});

function handleSubmit(event) {
    event.preventDefault();

    const payload = {
        id: modalProductId.value ? Number(modalProductId.value) : null,
        nombre: modalNombre.value.trim(),
        categoria: modalCategoria.value.trim(),
        precio: Number(modalPrecio.value),
        stock: Number(modalStock.value),
        codigo: modalCodigo.value.trim()
    };

    if (!payload.nombre || !payload.categoria) {
        alert("Nombre y categoria son obligatorios.");
        return;
    }
    if (!Number.isFinite(payload.precio) || payload.precio <= 0) {
        alert("El precio debe ser mayor a 0.");
        return;
    }
    if (!Number.isInteger(payload.stock) || payload.stock < 0) {
        alert("La cantidad en stock debe ser un numero entero mayor o igual a 0.");
        return;
    }

    // Si hay id, editamos; si no, creamos un producto nuevo.
    if (payload.id) {
        try {
            window.InventoryApp.actualizarProducto(payload);
        } catch (error) {
            console.error("[inventario] Error al actualizar", error);
            return;
        }
    } else {
        try {
            window.InventoryApp.crearProducto(payload);
        } catch (error) {
            console.error("[inventario] Error al crear", error);
            return;
        }
    }

    closeProductModal();
    renderInventario();
}

function renderInventario() {
    const productos = window.InventoryApp
        .cargarProductos()
        .filter((item) => {
            const texto = `${item.nombre} ${item.categoria || ""} ${item.codigo || ""}`.toLowerCase();
            return texto.includes(filtro);
        });

    if (productos.length === 0) {
        inventarioBody.innerHTML = `<tr><td colspan="7" class="empty">No hay productos para mostrar.</td></tr>`;
        return;
    }

    inventarioBody.innerHTML = productos
        .map((producto) => {
            const estado = window.InventoryApp.obtenerEstadoStock(producto);
            return `
                <tr>
                    <td>${escapeHtml(producto.nombre)}</td>
                    <td>${escapeHtml(producto.categoria || "General")}</td>
                    <td>${escapeHtml(producto.codigo || "-")}</td>
                    <td>${window.InventoryApp.formatoMoneda(producto.precio)}</td>
                    <td>${producto.stock}</td>
                    <td><span class="estado ${estado.clase}"><i class="${estado.icono}"></i>${estado.texto}</span></td>
                    <td>
                        <div class="acciones">
                            <button class="btn small ghost btn-editar" data-id="${producto.id}">
                                <i class="fa-solid fa-pen"></i> Editar
                            </button>
                            <button class="btn small danger btn-borrar" data-id="${producto.id}">
                                <i class="fa-solid fa-trash"></i> Eliminar
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        })
        .join("");
}

function openProductModal(producto = null) {
    // El mismo modal sirve para alta y edicion.
    if (producto) {
        modalTitle.textContent = "Editar producto";
        modalProductId.value = String(producto.id);
        modalNombre.value = producto.nombre;
        modalCategoria.value = producto.categoria || "General";
        modalPrecio.value = String(producto.precio);
        modalStock.value = String(producto.stock);
        modalCodigo.value = producto.codigo || "";
    } else {
        modalTitle.textContent = "Agregar producto";
        productForm.reset();
        modalProductId.value = "";
        modalCategoria.value = "General";
    }

    productModal.classList.add("show");
    productModal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
    modalNombre.focus();
}

function closeProductModal() {
    productModal.classList.remove("show");
    productModal.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
}

function editarProducto(id) {
    const productos = window.InventoryApp.cargarProductos();
    const producto = productos.find((item) => item.id === id);
    if (!producto) return;
    openProductModal(producto);
}

function borrarProducto(id) {
    const productos = window.InventoryApp.cargarProductos();
    const producto = productos.find((item) => item.id === id);
    if (!producto) return;

    const ok = confirm(`Eliminar "${producto.nombre}" del inventario?`);
    if (!ok) return;
    try {
        window.InventoryApp.eliminarProducto(id);
    } catch (error) {
        console.error("[inventario] Error al eliminar", error);
        return;
    }
    renderInventario();
}

function generarCodigoProducto() {
    const productos = window.InventoryApp.cargarProductos();

    // Busca codigos existentes con formato PROD-000X para calcular el siguiente correlativo.
    const ultimoNumero = productos.reduce((maximo, producto) => {
        const match = String(producto.codigo || "").match(/^PROD-(\d{4})$/);
        if (!match) return maximo;
        return Math.max(maximo, Number(match[1]));
    }, 0);

    const siguienteNumero = ultimoNumero + 1;
    const codigo = `PROD-${String(siguienteNumero).padStart(4, "0")}`;
    return codigo;
}

function escapeHtml(value) {
    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll("\"", "&quot;")
        .replaceAll("'", "&#39;");
}
