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
    inicializarFiltros();
    renderHistorial();
});

mesSelect.addEventListener("change", renderHistorial);
anioSelect.addEventListener("change", renderHistorial);

// Actualiza la vista si se registran ventas desde otra pestana.
window.addEventListener("storage", (event) => {
    if (event.key === "ferreteria_ventas_v2") {
        inicializarFiltros();
        renderHistorial();
    }
});

function inicializarFiltros() {
    const ventas = window.InventoryApp.cargarVentas();
    const hoy = new Date();
    const anioActual = hoy.getFullYear();
    const mesActual = hoy.getMonth();

    const anios = Array.from(new Set(ventas.map((venta) => new Date(venta.fecha).getFullYear())));
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
    renderGrafico(ventasFiltradas, anio, mes);
}

function filtrarVentasPorMes(anio, mes) {
    return window.InventoryApp.cargarVentas().filter((venta) => {
        const fecha = new Date(venta.fecha);
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
            const total = venta.cantidad * venta.precio;
            return `
                <tr>
                    <td>${escapeHtml(venta.producto)}</td>
                    <td>${venta.cantidad}</td>
                    <td>${window.InventoryApp.formatoMoneda(venta.precio)}</td>
                    <td>${window.InventoryApp.formatoMoneda(total)}</td>
                    <td>${window.InventoryApp.formatoFechaHora(venta.fecha)}</td>
                </tr>
            `;
        })
        .join("");
}

function renderEstadisticas(ventas) {
    // Total facturado en el periodo seleccionado.
    const totalVendido = ventas.reduce((sum, venta) => sum + venta.cantidad * venta.precio, 0);
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

function renderGrafico(ventas, anio, mes) {
    const diasMes = new Date(anio, mes + 1, 0).getDate();
    const labels = Array.from({ length: diasMes }, (_, i) => String(i + 1));
    const dataPorDia = new Array(diasMes).fill(0);

    // Agrupa el total vendido por cada dia del mes.
    ventas.forEach((venta) => {
        const fecha = new Date(venta.fecha);
        const dia = fecha.getDate() - 1;
        dataPorDia[dia] += venta.cantidad * venta.precio;
    });

    if (chartInstance) chartInstance.destroy();

    chartInstance = new Chart(ventasChartCanvas, {
        type: "line",
        data: {
            labels,
            datasets: [{
                label: "Ventas por dia (ARS)",
                data: dataPorDia,
                borderColor: "#3b82f6",
                backgroundColor: "rgba(59, 130, 246, 0.2)",
                fill: true,
                tension: 0.32,
                pointRadius: 3
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
