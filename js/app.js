const STORAGE_PRODUCTOS = "ferreteria_productos_v2";
const STORAGE_VENTAS = "ferreteria_ventas_v2";
const LIMITE_STOCK_BAJO = 10;

const productosIniciales = [
    { id: 1, nombre: "Martillo de acero", precio: 12500, stock: 22 },
    { id: 2, nombre: "Destornillador Phillips", precio: 6400, stock: 14 },
    { id: 3, nombre: "Bolsa de cemento 50kg", precio: 9800, stock: 9 },
    { id: 4, nombre: "Llave francesa 10", precio: 8700, stock: 4 }
];

if (!localStorage.getItem(STORAGE_PRODUCTOS)) {
    guardarProductos(productosIniciales);
}
if (!localStorage.getItem(STORAGE_VENTAS)) {
    guardarVentas([]);
}

window.InventoryApp = {
    LIMITE_STOCK_BAJO,
    cargarProductos,
    guardarProductos,
    cargarVentas,
    guardarVentas,
    obtenerEstadoStock,
    actualizarProducto,
    eliminarProducto,
    crearProducto,
    registrarVenta,
    obtenerResumenHoy,
    enviarAlertaStock,
    formatoMoneda,
    formatoFechaHora
};

document.addEventListener("DOMContentLoaded", () => {
    setFechaActual();
    iniciarDashboardSiExiste();
});

function cargarProductos() {
    const raw = localStorage.getItem(STORAGE_PRODUCTOS);
    try {
        const list = JSON.parse(raw);
        return Array.isArray(list) ? list : [];
    } catch {
        return [];
    }
}

function guardarProductos(productos) {
    localStorage.setItem(STORAGE_PRODUCTOS, JSON.stringify(productos));
}

function cargarVentas() {
    const raw = localStorage.getItem(STORAGE_VENTAS);
    try {
        const list = JSON.parse(raw);
        return Array.isArray(list) ? list : [];
    } catch {
        return [];
    }
}

function guardarVentas(ventas) {
    localStorage.setItem(STORAGE_VENTAS, JSON.stringify(ventas));
}

function obtenerEstadoStock(producto) {
    if (producto.stock <= LIMITE_STOCK_BAJO) {
        return {
            clase: "low",
            icono: "fa-solid fa-triangle-exclamation",
            texto: "Stock bajo"
        };
    }
    return {
        clase: "ok",
        icono: "fa-solid fa-circle-check",
        texto: "Normal"
    };
}

function actualizarProducto(productoActualizado) {
    const productos = cargarProductos().map((item) => {
        if (item.id !== productoActualizado.id) return item;
        return productoActualizado;
    });
    guardarProductos(productos);
}

function eliminarProducto(id) {
    const productos = cargarProductos().filter((item) => item.id !== id);
    guardarProductos(productos);
}

function crearProducto(data) {
    const productos = cargarProductos();
    const nextId = productos.length ? Math.max(...productos.map((p) => p.id)) + 1 : 1;

    const nuevo = {
        id: nextId,
        nombre: data.nombre.trim(),
        precio: Number(data.precio),
        stock: Number(data.stock)
    };

    productos.push(nuevo);
    guardarProductos(productos);
    return nuevo;
}

function registrarVenta(productoId, cantidad) {
    const productos = cargarProductos();
    const ventas = cargarVentas();
    const producto = productos.find((item) => item.id === Number(productoId));

    if (!producto) throw new Error("Producto no encontrado.");
    if (!Number.isInteger(cantidad) || cantidad <= 0) {
        throw new Error("La cantidad debe ser mayor a 0.");
    }
    if (producto.stock < cantidad) {
        throw new Error("No hay stock suficiente.");
    }

    producto.stock -= cantidad;
    if (producto.stock <= LIMITE_STOCK_BAJO) {
        enviarAlertaStock(producto);
    }

    const venta = {
        id: Date.now(),
        productoId: producto.id,
        nombreProducto: producto.nombre,
        cantidad,
        precioUnitario: producto.precio,
        total: producto.precio * cantidad,
        fecha: new Date().toISOString()
    };

    ventas.unshift(venta);
    guardarProductos(productos);
    guardarVentas(ventas);
    return venta;
}

function obtenerResumenHoy() {
    const productos = cargarProductos();
    const ventas = cargarVentas();
    const hoy = new Date().toISOString().slice(0, 10);

    const ventasHoy = ventas.filter((venta) => venta.fecha.slice(0, 10) === hoy);
    const ventasDelDia = ventasHoy.reduce((acc, venta) => acc + venta.cantidad, 0);
    const ingresosDelDia = ventasHoy.reduce((acc, venta) => acc + venta.total, 0);
    const stockBajo = productos.filter((item) => item.stock <= LIMITE_STOCK_BAJO).length;

    return {
        totalProductos: productos.length,
        stockBajo,
        ventasDelDia,
        ingresosDelDia,
        alertas: productos.filter((item) => item.stock <= LIMITE_STOCK_BAJO)
    };
}

function enviarAlertaStock(producto) {
    const mensaje = `[SIMULACION EMAIL] Alerta: ${producto.nombre} tiene stock bajo (${producto.stock} unidades).`;
    console.warn(mensaje);
}

function iniciarDashboardSiExiste() {
    const totalEl = document.querySelector("#kpiTotalProductos");
    if (!totalEl) return;

    const resumen = obtenerResumenHoy();
    const alertasBody = document.querySelector("#alertasBody");

    totalEl.textContent = resumen.totalProductos;
    document.querySelector("#kpiStockBajo").textContent = resumen.stockBajo;
    document.querySelector("#kpiVentasDia").textContent = resumen.ventasDelDia;
    document.querySelector("#kpiIngresosDia").textContent = formatoMoneda(resumen.ingresosDelDia);

    if (resumen.alertas.length === 0) {
        alertasBody.innerHTML = `<tr><td colspan="3" class="empty">No hay productos con stock bajo.</td></tr>`;
        return;
    }

    alertasBody.innerHTML = resumen.alertas
        .map((producto) => {
            const estado = obtenerEstadoStock(producto);
            return `
                <tr>
                    <td>${escapeHtml(producto.nombre)}</td>
                    <td>${producto.stock}</td>
                    <td><span class="estado ${estado.clase}"><i class="${estado.icono}"></i>${estado.texto}</span></td>
                </tr>
            `;
        })
        .join("");
}

function formatoMoneda(valor) {
    return new Intl.NumberFormat("es-AR", {
        style: "currency",
        currency: "ARS",
        maximumFractionDigits: 0
    }).format(valor);
}

function formatoFechaHora(fechaIso) {
    return new Intl.DateTimeFormat("es-AR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
    }).format(new Date(fechaIso));
}

function setFechaActual() {
    const el = document.querySelector("#fechaActual");
    if (!el) return;
    const fecha = new Intl.DateTimeFormat("es-AR", {
        weekday: "long",
        day: "2-digit",
        month: "long",
        year: "numeric"
    }).format(new Date());
    el.textContent = fecha;
}

function escapeHtml(value) {
    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll("\"", "&quot;")
        .replaceAll("'", "&#39;");
}
