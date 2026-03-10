const STORAGE_PRODUCTOS = "ferreteria_productos_v2";
const STORAGE_VENTAS = "ferreteria_ventas_v2";
const LIMITE_STOCK_BAJO = 10;
const TOAST_DURATION_MS = 4000;
const TOAST_COOLDOWN_MS = 12000;

// Evita spam de la misma alerta para el mismo producto en un corto periodo.
const ultimaNotificacionPorProducto = new Map();

const productosIniciales = [
    { nombre: "Martillo de acero", cantidad: 22, precio: 12500 },
    { nombre: "Destornillador Phillips", cantidad: 14, precio: 6400 },
    { nombre: "Bolsa de cemento 50kg", cantidad: 9, precio: 9800 },
    { nombre: "Llave francesa 10", cantidad: 4, precio: 8700 }
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
    mostrarNotificacionStock,
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
        if (!Array.isArray(list)) return [];
        return list.map(normalizarProducto).filter(Boolean);
    } catch {
        return [];
    }
}

function guardarProductos(productos) {
    localStorage.setItem(STORAGE_PRODUCTOS, JSON.stringify(productos.map(normalizarProducto).filter(Boolean)));
}

function cargarVentas() {
    const raw = localStorage.getItem(STORAGE_VENTAS);
    try {
        const list = JSON.parse(raw);
        if (!Array.isArray(list)) return [];
        return list.map(normalizarVenta).filter(Boolean);
    } catch {
        return [];
    }
}

function guardarVentas(ventas) {
    localStorage.setItem(STORAGE_VENTAS, JSON.stringify(ventas));
}

function obtenerEstadoStock(producto) {
    if (producto.cantidad <= LIMITE_STOCK_BAJO) {
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

function actualizarProducto(productoActualizado, nombreOriginal = productoActualizado.nombre) {
    const nombreDestino = String(nombreOriginal || "").trim().toLowerCase();
    const productos = cargarProductos().map((item) => {
        if (item.nombre.toLowerCase() !== nombreDestino) return item;
        return normalizarProducto(productoActualizado);
    });
    guardarProductos(productos);
    if (productoActualizado.cantidad <= LIMITE_STOCK_BAJO) {
        mostrarNotificacionStock(productoActualizado);
    }
}

function eliminarProducto(nombreProducto) {
    const nombreBuscado = String(nombreProducto || "").trim().toLowerCase();
    const productos = cargarProductos().filter((item) => item.nombre.toLowerCase() !== nombreBuscado);
    guardarProductos(productos);
}

function crearProducto(data) {
    const nuevo = normalizarProducto(data);
    const productos = cargarProductos();
    productos.push(nuevo);
    guardarProductos(productos);
    if (nuevo.cantidad <= LIMITE_STOCK_BAJO) {
        mostrarNotificacionStock(nuevo);
    }
    return nuevo;
}

function registrarVenta(nombreProducto, cantidad) {
    const nombreBuscado = String(nombreProducto || "").trim().toLowerCase();
    const productos = cargarProductos();
    const ventas = cargarVentas();
    const producto = productos.find((item) => item.nombre.toLowerCase() === nombreBuscado);

    if (!producto) throw new Error("Producto no encontrado.");
    if (!Number.isInteger(cantidad) || cantidad <= 0) {
        throw new Error("La cantidad debe ser mayor a 0.");
    }
    if (producto.cantidad < cantidad) {
        throw new Error("No hay stock suficiente.");
    }

    producto.cantidad -= cantidad;
    if (producto.cantidad <= LIMITE_STOCK_BAJO) {
        enviarAlertaStock(producto);
    }

    const venta = {
        id: Date.now(),
        producto: producto.nombre,
        cantidad,
        precio: producto.precio,
        fecha: new Date().toISOString()
    };

    guardarProductos(productos);
    ventas.unshift(venta);
    guardarVentas(ventas);
    window.dispatchEvent(new CustomEvent("ventasActualizadas", { detail: venta }));
    return venta;
}

function obtenerResumenHoy() {
    const productos = cargarProductos();
    const ventas = cargarVentas();
    const hoy = new Date().toISOString().slice(0, 10);

    const ventasHoy = ventas.filter((venta) => venta.fecha.slice(0, 10) === hoy);
    const ventasDelDia = ventasHoy.reduce((acc, venta) => acc + venta.cantidad, 0);
    const ingresosDelDia = ventasHoy.reduce((acc, venta) => acc + venta.precio * venta.cantidad, 0);
    const stockBajo = productos.filter((item) => item.cantidad <= LIMITE_STOCK_BAJO).length;

    return {
        totalProductos: productos.length,
        stockBajo,
        ventasDelDia,
        ingresosDelDia,
        alertas: productos.filter((item) => item.cantidad <= LIMITE_STOCK_BAJO)
    };
}

function enviarAlertaStock(producto) {
    const mensaje = `[SIMULACION EMAIL] Alerta: ${producto.nombre} tiene stock bajo (${producto.cantidad} unidades).`;
    console.warn(mensaje);
    mostrarNotificacionStock(producto);
}

function mostrarNotificacionStock(producto) {
    if (!producto || producto.cantidad > LIMITE_STOCK_BAJO) return;

    const key = producto.nombre.toLowerCase();
    const ahora = Date.now();
    const ultima = ultimaNotificacionPorProducto.get(key) || 0;
    if (ahora - ultima < TOAST_COOLDOWN_MS) return;
    ultimaNotificacionPorProducto.set(key, ahora);

    const container = getToastContainer();
    const toast = document.createElement("article");
    toast.className = "toast";
    toast.setAttribute("role", "status");
    toast.innerHTML = `
        <i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i>
        <p>\u26A0 Stock bajo: ${escapeHtml(producto.nombre)} (${producto.cantidad} unidades)</p>
    `;

    container.appendChild(toast);

    requestAnimationFrame(() => {
        toast.classList.add("show");
    });

    setTimeout(() => {
        toast.classList.remove("show");
        toast.classList.add("hide");
        setTimeout(() => {
            toast.remove();
        }, 350);
    }, TOAST_DURATION_MS);
}

function getToastContainer() {
    let container = document.querySelector("#toastContainer");
    if (container) return container;

    container = document.createElement("div");
    container.id = "toastContainer";
    container.className = "toast-container";
    container.setAttribute("aria-live", "polite");
    container.setAttribute("aria-atomic", "true");
    document.body.appendChild(container);
    return container;
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
                    <td>${producto.cantidad}</td>
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

function normalizarProducto(producto) {
    if (!producto || typeof producto !== "object") return null;

    const nombre = String(producto.nombre || "").trim();
    const cantidad = Number(producto.cantidad ?? producto.stock);
    const precio = Number(producto.precio);

    if (!nombre || !Number.isInteger(cantidad) || cantidad < 0 || !Number.isFinite(precio) || precio <= 0) {
        return null;
    }

    return {
        nombre,
        cantidad,
        precio
    };
}

function normalizarVenta(venta) {
    if (!venta || typeof venta !== "object") return null;

    const producto = String(venta.producto || venta.nombreProducto || "").trim();
    const cantidad = Number(venta.cantidad);
    const precio = Number(venta.precio ?? venta.precioUnitario);
    const fecha = String(venta.fecha || new Date().toISOString());
    const id = Number(venta.id || Date.now());

    if (!producto || !Number.isFinite(cantidad) || !Number.isFinite(precio)) return null;

    return {
        id,
        producto,
        cantidad,
        precio,
        fecha
    };
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
