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

function abrirTicketVenta(venta) {
    const ventana = window.open("", "_blank", "width=420,height=640");
    if (!ventana) {
        console.warn("El navegador bloqueo la ventana del ticket.");
        return;
    }

    const fechaHora = window.InventoryApp.formatoFechaHora(new Date(venta.timestamp).toISOString());
    const contenido = `
        <!DOCTYPE html>
        <html lang="es">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Ticket de venta</title>
            <style>
                body {
                    font-family: "Manrope", sans-serif;
                    background: #f3f4f6;
                    margin: 0;
                    padding: 24px;
                    color: #111827;
                }
                .ticket {
                    background: #ffffff;
                    border: 1px dashed #c7cbd3;
                    border-radius: 16px;
                    padding: 20px;
                    max-width: 360px;
                    margin: 0 auto;
                    box-shadow: 0 12px 24px rgba(15, 23, 42, 0.12);
                }
                .ticket h2 {
                    margin: 0 0 6px;
                    font-size: 1.2rem;
                }
                .ticket small {
                    color: #6b7280;
                }
                .line {
                    margin: 14px 0;
                    border-bottom: 1px dashed #d1d5db;
                }
                .row {
                    display: flex;
                    justify-content: space-between;
                    margin-bottom: 8px;
                    font-size: 0.95rem;
                }
                .total {
                    font-size: 1.1rem;
                    font-weight: 700;
                }
                .print-btn {
                    width: 100%;
                    margin-top: 16px;
                    padding: 10px 14px;
                    border: 0;
                    border-radius: 10px;
                    background: #2563eb;
                    color: #fff;
                    font-weight: 700;
                    cursor: pointer;
                }
                @media print {
                    body { background: #fff; padding: 0; }
                    .print-btn { display: none; }
                    .ticket { box-shadow: none; border: 0; }
                }
            </style>
        </head>
        <body>
            <div class="ticket">
                <h2>Ticket de venta</h2>
                <small>${fechaHora}</small>
                <div class="line"></div>
                <div class="row"><span>Producto</span><strong>${escapeHtml(venta.producto)}</strong></div>
                <div class="row"><span>Cantidad</span><strong>${venta.cantidad}</strong></div>
                <div class="row"><span>Precio unitario</span><strong>${window.InventoryApp.formatoMoneda(venta.precio)}</strong></div>
                <div class="row total"><span>TOTAL PAGADO</span><strong>${window.InventoryApp.formatoMoneda(venta.total)}</strong></div>
                <button class="print-btn" onclick="window.print()">Imprimir ticket</button>
            </div>
        </body>
        </html>
    `;

    ventana.document.open();
    ventana.document.write(contenido);
    ventana.document.close();
}
