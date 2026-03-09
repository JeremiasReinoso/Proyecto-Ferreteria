const inventarioBody = document.querySelector("#inventarioBody");
const searchInput = document.querySelector("#searchInput");
const btnNuevo = document.querySelector("#btnNuevo");

let filtro = "";

document.addEventListener("DOMContentLoaded", renderInventario);

searchInput.addEventListener("input", () => {
    filtro = searchInput.value.trim().toLowerCase();
    renderInventario();
});

btnNuevo.addEventListener("click", () => {
    const nombre = prompt("Nombre del producto:");
    if (!nombre) return;

    const precio = Number(prompt("Precio del producto (ARS):"));
    const stock = Number(prompt("Stock inicial:"));

    if (!Number.isFinite(precio) || precio <= 0 || !Number.isInteger(stock) || stock < 0) {
        alert("Datos invalidos. Intenta nuevamente.");
        return;
    }

    window.InventoryApp.crearProducto({ nombre, precio, stock });
    renderInventario();
});

inventarioBody.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-action]");
    if (!button) return;

    const id = Number(button.dataset.id);
    const action = button.dataset.action;
    const productos = window.InventoryApp.cargarProductos();
    const producto = productos.find((item) => item.id === id);
    if (!producto) return;

    if (action === "edit") {
        const nombre = prompt("Editar nombre:", producto.nombre);
        if (!nombre) return;

        const precio = Number(prompt("Editar precio:", String(producto.precio)));
        const stock = Number(prompt("Editar stock:", String(producto.stock)));

        if (!Number.isFinite(precio) || precio <= 0 || !Number.isInteger(stock) || stock < 0) {
            alert("Datos invalidos. Intenta nuevamente.");
            return;
        }

        window.InventoryApp.actualizarProducto({ id, nombre: nombre.trim(), precio, stock });
    }

    if (action === "delete") {
        const ok = confirm(`Eliminar "${producto.nombre}" del inventario?`);
        if (!ok) return;
        window.InventoryApp.eliminarProducto(id);
    }

    renderInventario();
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
            return `
                <tr>
                    <td>${escapeHtml(producto.nombre)}</td>
                    <td>${window.InventoryApp.formatoMoneda(producto.precio)}</td>
                    <td>${producto.stock}</td>
                    <td><span class="estado ${estado.clase}"><i class="${estado.icono}"></i>${estado.texto}</span></td>
                    <td>
                        <div class="acciones">
                            <button class="btn small ghost" data-action="edit" data-id="${producto.id}">
                                <i class="fa-solid fa-pen"></i> Editar
                            </button>
                            <button class="btn small danger" data-action="delete" data-id="${producto.id}">
                                <i class="fa-solid fa-trash"></i> Eliminar
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        })
        .join("");
}

function escapeHtml(value) {
    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll("\"", "&quot;")
        .replaceAll("'", "&#39;");
}
