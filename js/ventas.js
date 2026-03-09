const ventaForm = document.querySelector("#ventaForm");
const ventaProducto = document.querySelector("#ventaProducto");
const ventaCantidad = document.querySelector("#ventaCantidad");
const ventaFeedback = document.querySelector("#ventaFeedback");
const ventasBody = document.querySelector("#ventasBody");
const ventasDiaCard = document.querySelector("#ventasDiaCard");
const ingresosDiaCard = document.querySelector("#ingresosDiaCard");

document.addEventListener("DOMContentLoaded", () => {
    cargarOpcionesProductos();
    renderVentas();
    renderCards();
});

ventaForm.addEventListener("submit", (event) => {
    event.preventDefault();

    const productoId = Number(ventaProducto.value);
    const cantidad = Number(ventaCantidad.value);

    try {
        const venta = window.InventoryApp.registrarVenta(productoId, cantidad);
        ventaFeedback.textContent = `Venta registrada: ${venta.cantidad} x ${venta.nombreProducto} por ${window.InventoryApp.formatoMoneda(venta.total)}.`;
        ventaForm.reset();
        ventaCantidad.value = "1";
        cargarOpcionesProductos();
        renderVentas();
        renderCards();
    } catch (error) {
        ventaFeedback.textContent = error.message;
    }
});

function cargarOpcionesProductos() {
    const productos = window.InventoryApp.cargarProductos();

    if (productos.length === 0) {
        ventaProducto.innerHTML = `<option value="">No hay productos</option>`;
        return;
    }

    ventaProducto.innerHTML = productos
        .map((producto) => {
            const disabled = producto.stock <= 0 ? "disabled" : "";
            return `<option value="${producto.id}" ${disabled}>${escapeHtml(producto.nombre)} | Stock: ${producto.stock}</option>`;
        })
        .join("");
}

function renderVentas() {
    const ventas = window.InventoryApp.cargarVentas();

    if (ventas.length === 0) {
        ventasBody.innerHTML = `<tr><td colspan="4" class="empty">Todavia no hay ventas registradas.</td></tr>`;
        return;
    }

    ventasBody.innerHTML = ventas
        .slice(0, 20)
        .map((venta) => {
            return `
                <tr>
                    <td>${window.InventoryApp.formatoFechaHora(venta.fecha)}</td>
                    <td>${escapeHtml(venta.nombreProducto)}</td>
                    <td>${venta.cantidad}</td>
                    <td>${window.InventoryApp.formatoMoneda(venta.total)}</td>
                </tr>
            `;
        })
        .join("");
}

function renderCards() {
    const resumen = window.InventoryApp.obtenerResumenHoy();
    ventasDiaCard.textContent = resumen.ventasDelDia;
    ingresosDiaCard.textContent = window.InventoryApp.formatoMoneda(resumen.ingresosDelDia);
}

function escapeHtml(value) {
    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll("\"", "&quot;")
        .replaceAll("'", "&#39;");
}
