const inventarioBody = document.querySelector("#inventarioBody");
const searchInput = document.querySelector("#searchInput");
const btnNuevo = document.querySelector("#btnNuevo");

const productModal = document.querySelector("#productModal");
const closeModalBtn = document.querySelector("#closeModalBtn");
const cancelModalBtn = document.querySelector("#cancelModalBtn");
const productForm = document.querySelector("#productForm");
const modalTitle = document.querySelector("#modalTitle");

const modalOriginalNombre = document.querySelector("#modalOriginalNombre");
const modalNombre = document.querySelector("#modalNombre");
const modalPrecio = document.querySelector("#modalPrecio");
const modalCantidad = document.querySelector("#modalCantidad");

let filtro = "";

document.addEventListener("DOMContentLoaded", renderInventario);

searchInput.addEventListener("input", () => {
    filtro = searchInput.value.trim().toLowerCase();
    renderInventario();
});

btnNuevo.addEventListener("click", () => {
    openProductModal();
});

closeModalBtn.addEventListener("click", closeProductModal);
cancelModalBtn.addEventListener("click", closeProductModal);

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

productForm.addEventListener("submit", (event) => {
    event.preventDefault();

    const payload = {
        nombre: modalNombre.value.trim(),
        precio: Number(modalPrecio.value),
        cantidad: Number(modalCantidad.value)
    };

    if (!payload.nombre) {
        alert("El nombre del producto es obligatorio.");
        return;
    }
    if (!Number.isFinite(payload.precio) || payload.precio <= 0) {
        alert("El precio debe ser mayor a 0.");
        return;
    }
    if (!Number.isInteger(payload.cantidad) || payload.cantidad < 0) {
        alert("La cantidad debe ser un numero entero mayor o igual a 0.");
        return;
    }

    const productos = window.InventoryApp.cargarProductos();
    const nombreOriginal = modalOriginalNombre.value.trim();
    const nombreNormalizado = payload.nombre.toLowerCase();
    const nombreOriginalNormalizado = nombreOriginal.toLowerCase();
    const duplicado = productos.some((producto) => (
        producto.nombre.toLowerCase() === nombreNormalizado &&
        producto.nombre.toLowerCase() !== nombreOriginalNormalizado
    ));

    if (duplicado) {
        alert("Ya existe un producto con ese nombre. Usa un nombre unico.");
        return;
    }

    // El nombre es la clave unica del producto para alta, edicion y ventas.
    if (nombreOriginal) {
        window.InventoryApp.actualizarProducto(payload, nombreOriginal);
    } else {
        window.InventoryApp.crearProducto(payload);
    }

    closeProductModal();
    renderInventario();
});

inventarioBody.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-action]");
    if (!button) return;

    const nombre = decodeURIComponent(button.dataset.nombre || "");
    const action = button.dataset.action;
    const productos = window.InventoryApp.cargarProductos();
    const producto = productos.find((item) => item.nombre === nombre);
    if (!producto) return;

    if (action === "edit") {
        openProductModal(producto);
        return;
    }

    if (action === "delete") {
        const ok = confirm(`Eliminar "${producto.nombre}" del inventario?`);
        if (!ok) return;
        window.InventoryApp.eliminarProducto(producto.nombre);
        renderInventario();
    }
});

function renderInventario() {
    const productos = window.InventoryApp
        .cargarProductos()
        .filter((item) => item.nombre.toLowerCase().includes(filtro));

    if (productos.length === 0) {
        inventarioBody.innerHTML = `<tr><td colspan="5" class="empty">No hay productos para mostrar.</td></tr>`;
        return;
    }

    inventarioBody.innerHTML = productos
        .map((producto) => {
            const estado = window.InventoryApp.obtenerEstadoStock(producto);
            const nombreData = encodeURIComponent(producto.nombre);
            return `
                <tr>
                    <td>${escapeHtml(producto.nombre)}</td>
                    <td>${window.InventoryApp.formatoMoneda(producto.precio)}</td>
                    <td>${producto.cantidad}</td>
                    <td><span class="estado ${estado.clase}"><i class="${estado.icono}"></i>${estado.texto}</span></td>
                    <td>
                        <div class="acciones">
                            <button class="btn small ghost" data-action="edit" data-nombre="${nombreData}">
                                <i class="fa-solid fa-pen"></i> Editar
                            </button>
                            <button class="btn small danger" data-action="delete" data-nombre="${nombreData}">
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
    if (producto) {
        modalTitle.textContent = "Editar producto";
        modalOriginalNombre.value = producto.nombre;
        modalNombre.value = producto.nombre;
        modalPrecio.value = String(producto.precio);
        modalCantidad.value = String(producto.cantidad);
    } else {
        modalTitle.textContent = "Agregar producto";
        productForm.reset();
        modalOriginalNombre.value = "";
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

function escapeHtml(value) {
    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll("\"", "&quot;")
        .replaceAll("'", "&#39;");
}
