const ventaForm = document.querySelector("#ventaForm");
const ventaProducto = document.querySelector("#ventaProducto");
const ventaCantidad = document.querySelector("#ventaCantidad");
const ventaFeedback = document.querySelector("#ventaFeedback");
const ventasBody = document.querySelector("#ventasBody");
const ventasDiaCard = document.querySelector("#ventasDiaCard");
const ingresosDiaCard = document.querySelector("#ingresosDiaCard");
const ticketModal = document.querySelector("#ticketModal");
const ticketContent = document.querySelector("#ticketContent");
const closeTicketBtn = document.querySelector("#closeTicketBtn");
const printTicketBtn = document.querySelector("#printTicketBtn");

document.addEventListener("DOMContentLoaded", () => {
    try {
        if (!ventaForm || !ventaProducto || !ventaCantidad || !ventasBody) {
            console.warn("[ventas] Faltan elementos en el DOM.");
            return;
        }
        console.log("[ventas] DOM listo");
        cargarOpcionesProductos();
        renderVentas();
        renderCards();

        ventaForm.addEventListener("submit", handleSubmit);
        if (closeTicketBtn) closeTicketBtn.addEventListener("click", closeTicketModal);
        if (ticketModal) {
            ticketModal.addEventListener("click", (event) => {
                if (event.target === ticketModal) closeTicketModal();
            });
        }
        if (printTicketBtn) printTicketBtn.addEventListener("click", () => window.print());
    } catch (error) {
        console.error("[ventas] Error inicializando", error);
    }
});

function handleSubmit(event) {
    event.preventDefault();

    const productoId = Number(ventaProducto.value);
    const cantidad = Number(ventaCantidad.value);

    try {
        const venta = window.InventoryApp.registrarVenta(productoId, cantidad);
        ventaFeedback.textContent = `Venta registrada: ${venta.cantidad} x ${venta.producto} por ${window.InventoryApp.formatoMoneda(venta.total)}.`;
        ventaForm.reset();
        ventaCantidad.value = "1";
        cargarOpcionesProductos();
        renderVentas();
        renderCards();
        abrirTicketVenta(venta);
    } catch (error) {
        ventaFeedback.textContent = error.message;
    }
}

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
    const ventas = window.InventoryApp.cargarVentas()
        .filter((venta) => Date.now() - venta.timestamp < 86400000);

    if (ventas.length === 0) {
        ventasBody.innerHTML = `<tr><td colspan="4" class="empty">Todavia no hay ventas registradas.</td></tr>`;
        return;
    }

    ventasBody.innerHTML = ventas
        .slice(0, 20)
        .map((venta) => {
            return `
                <tr>
                    <td>${window.InventoryApp.formatoFechaHora(new Date(venta.timestamp).toISOString())}</td>
                    <td>${escapeHtml(venta.producto)}</td>
                    <td>${venta.cantidad}</td>
                    <td>${window.InventoryApp.formatoMoneda(venta.total)}</td>
                </tr>
            `;
        })
        .join("");
}

function renderCards() {
    const resumen = window.InventoryApp.obtenerResumenHoy();
    if (ventasDiaCard) ventasDiaCard.textContent = resumen.ventasDelDia;
    if (ingresosDiaCard) ingresosDiaCard.textContent = window.InventoryApp.formatoMoneda(resumen.ingresosDelDia);
}

function escapeHtml(value) {
    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll("\"", "&quot;")
        .replaceAll("'", "&#39;");
}

function abrirTicketVenta(venta) {
    if (!ticketModal || !ticketContent) {
        console.warn("[ventas] No se encontro el modal del ticket.");
        return;
    }

    const fechaHora = window.InventoryApp.formatoFechaHora(new Date(venta.timestamp).toISOString());
    ticketContent.innerHTML = `
        <div class="ticket-print">
            <h3>Ticket de venta</h3>
            <small>${fechaHora}</small>
            <div class="ticket-line"></div>
            <div class="ticket-row"><span>Producto</span><strong>${escapeHtml(venta.producto)}</strong></div>
            <div class="ticket-row"><span>Cantidad</span><strong>${venta.cantidad}</strong></div>
            <div class="ticket-row"><span>Precio unitario</span><strong>${window.InventoryApp.formatoMoneda(venta.precio)}</strong></div>
            <div class="ticket-row ticket-total"><span>TOTAL PAGADO</span><strong>${window.InventoryApp.formatoMoneda(venta.total)}</strong></div>
        </div>
    `;

    ticketModal.classList.add("show");
    ticketModal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
}

function closeTicketModal() {
    ticketModal.classList.remove("show");
    ticketModal.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
}
