const historialBody = document.querySelector("#historialBody");
const mesSelect = document.querySelector("#mesSelect");
const anioSelect = document.querySelector("#anioSelect");
const totalMesCard = document.querySelector("#totalMesCard");
const cantidadVentasCard = document.querySelector("#cantidadVentasCard");
const productoTopCard = document.querySelector("#productoTopCard");
const ventasChartCanvas = document.querySelector("#ventasChart");

const meses = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
];

let chartInstance = null;

document.addEventListener("DOMContentLoaded", () => {
    try {
        if (!historialBody || !mesSelect || !anioSelect) {
            console.warn("[historial] Faltan elementos en el DOM.");
            return;
        }
        if (!window.InventoryApp) {
            console.error("[historial] InventoryApp no esta disponible.");
            return;
        }
        if (typeof Chart === "undefined") {
            console.warn("[historial] Chart.js no esta disponible.");
            return;
        }
        console.log("[historial] DOM listo");
        inicializarFiltros();
        renderHistorial();

        mesSelect.addEventListener("change", renderHistorial);
        anioSelect.addEventListener("change", renderHistorial);
    } catch (error) {
        console.error("[historial] Error inicializando", error);
    }
});

// Actualiza la vista si se registran ventas desde otra pestana.
window.addEventListener("storage", (event) => {
    if (event.key === "ferreteria_ventas_v2") {
        inicializarFiltros();
        renderHistorial();
    }
});

window.addEventListener("ventasActualizadas", () => {
    inicializarFiltros();
    renderHistorial();
});

function inicializarFiltros() {
    const ventas = window.InventoryApp.cargarVentas();
    const hoy = new Date();
    const anioActual = hoy.getFullYear();
    const mesActual = hoy.getMonth();

    const anios = Array.from(new Set(ventas.map((venta) => new Date(venta.timestamp).getFullYear())));
    if (!anios.includes(anioActual)) anios.push(anioActual);
    anios.sort((a, b) => b - a);

    mesSelect.innerHTML = meses
        .map((mes, index) => `<option value="${index}">${mes}</option>`)
        .join("");

    anioSelect.innerHTML = anios
        .map((anio) => `<option value="${anio}">${anio}</option>`)
        .join("");

    mesSelect.value = String(mesActual);
    anioSelect.value = String(anioActual);
}

function renderHistorial() {
    const mes = Number(mesSelect.value);
    const anio = Number(anioSelect.value);
    const ventasFiltradas = filtrarVentasPorMes(anio, mes);

    renderTabla(ventasFiltradas);
    renderEstadisticas(ventasFiltradas);
    renderGraficoMensual(anio, mes);
}

function filtrarVentasPorMes(anio, mes) {
    return window.InventoryApp.cargarVentas().filter((venta) => {
        const fecha = new Date(venta.timestamp);
        return fecha.getFullYear() === anio && fecha.getMonth() === mes;
    });
}

function renderTabla(ventas) {
    if (ventas.length === 0) {
        historialBody.innerHTML = `<tr><td colspan="5" class="empty">No hay ventas para este periodo.</td></tr>`;
        return;
    }

    historialBody.innerHTML = ventas
        .slice()
        .sort((a, b) => new Date(b.fecha) - new Date(a.fecha))
        .map((venta) => {
            const total = venta.total ?? (venta.cantidad * venta.precio);
            return `
                <tr>
                    <td>${escapeHtml(venta.producto)}</td>
                    <td>${venta.cantidad}</td>
                    <td>${window.InventoryApp.formatoMoneda(venta.precio)}</td>
                    <td>${window.InventoryApp.formatoMoneda(total)}</td>
                    <td>${window.InventoryApp.formatoFechaHora(new Date(venta.timestamp).toISOString())}</td>
                </tr>
            `;
        })
        .join("");
}

function renderEstadisticas(ventas) {
    // Total facturado en el periodo seleccionado.
    const totalVendido = ventas.reduce((sum, venta) => sum + (venta.total ?? (venta.cantidad * venta.precio)), 0);
    // Cantidad de operaciones de venta del periodo.
    const cantidadTotal = ventas.length;

    const acumuladoPorProducto = ventas.reduce((acc, venta) => {
        acc[venta.producto] = (acc[venta.producto] || 0) + venta.cantidad;
        return acc;
    }, {});

    const productoTop = Object.entries(acumuladoPorProducto).sort((a, b) => b[1] - a[1])[0];

    totalMesCard.textContent = window.InventoryApp.formatoMoneda(totalVendido);
    cantidadVentasCard.textContent = String(cantidadTotal);
    productoTopCard.textContent = productoTop ? `${productoTop[0]} (${productoTop[1]})` : "-";
}

function renderGraficoMensual(anioSeleccionado, mesSeleccionado) {
    const labels = meses;
    const dataPorMes = new Array(12).fill(0);
    const ventas = window.InventoryApp.cargarVentas();

    // Suma ingresos por cada mes del anio seleccionado.
    ventas.forEach((venta) => {
        const fecha = new Date(venta.timestamp);
        if (fecha.getFullYear() !== anioSeleccionado) return;
        const mes = fecha.getMonth();
        dataPorMes[mes] += venta.total ?? (venta.cantidad * venta.precio);
    });

    const colorBarras = labels.map((_, index) => (
        index === mesSeleccionado ? "rgba(16, 185, 129, 0.85)" : "rgba(59, 130, 246, 0.75)"
    ));

    if (chartInstance) chartInstance.destroy();

    chartInstance = new Chart(ventasChartCanvas, {
        type: "bar",
        data: {
            labels,
            datasets: [{
                label: `Ventas totales por mes (${anioSeleccionado})`,
                data: dataPorMes,
                borderColor: "#3b82f6",
                backgroundColor: colorBarras,
                borderRadius: 8,
                borderSkipped: false
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { labels: { color: "#c9d3e7" } }
            },
            scales: {
                x: { ticks: { color: "#9ca7bb" }, grid: { color: "rgba(255,255,255,0.06)" } },
                y: { ticks: { color: "#9ca7bb" }, grid: { color: "rgba(255,255,255,0.06)" } }
            }
        }
    });
}

function escapeHtml(value) {
    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll("\"", "&quot;")
        .replaceAll("'", "&#39;");
}
