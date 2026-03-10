const STORAGE_PRODUCTOS = "ferreteria_productos_v2";
const STORAGE_VENTAS = "ferreteria_ventas_v2";
const LIMITE_STOCK_BAJO = 10;
const TOAST_DURATION_MS = 4000;
const TOAST_COOLDOWN_MS = 12000;
// Evita spam de la misma alerta para el mismo producto en un corto periodo.
const ultimaNotificacionPorProducto = new Map();

const productosIniciales = [
    { id: 1, nombre: "Martillo de acero", categoria: "Herramientas", codigo: "MAR-001", precio: 12500, stock: 22 },
    { id: 2, nombre: "Destornillador Phillips", categoria: "Herramientas", codigo: "DES-002", precio: 6400, stock: 14 },
    { id: 3, nombre: "Bolsa de cemento 50kg", categoria: "Construccion", codigo: "CEM-050", precio: 9800, stock: 9 },
    { id: 4, nombre: "Llave francesa 10", categoria: "Herramientas", codigo: "LLA-010", precio: 8700, stock: 4 }
];

console.log("[app] Script cargado");

window.addEventListener("error", (event) => {
    console.error("[app] Error global", event.error || event.message);
});

window.addEventListener("unhandledrejection", (event) => {
    console.error("[app] Promesa rechazada", event.reason);
});

if (!safeGetItem(STORAGE_PRODUCTOS)) {
    guardarProductos(productosIniciales);
}
if (!safeGetItem(STORAGE_VENTAS)) {
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
    try {
        console.log("[app] DOM listo");
        setFechaActual();
        iniciarDashboardSiExiste();
    } catch (error) {
        console.error("[app] Error inicializando", error);
    }
});

function cargarProductos() {
    const raw = safeGetItem(STORAGE_PRODUCTOS);
    try {
        const list = JSON.parse(raw);
        if (!Array.isArray(list)) return [];
        const normalizados = list.map(normalizarProducto).filter(Boolean);
        if (normalizados.length !== list.length || normalizados.some((p, i) => p.id !== list[i]?.id)) {
            guardarProductos(normalizados);
        }
        return normalizados;
    } catch {
        return [];
    }
}

function guardarProductos(productos) {
    safeSetItem(STORAGE_PRODUCTOS, JSON.stringify(productos.map(normalizarProducto).filter(Boolean)));
}

function cargarVentas() {
    const raw = safeGetItem(STORAGE_VENTAS);
    try {
        const list = JSON.parse(raw);
        if (!Array.isArray(list)) return [];
        return list.map(normalizarVenta).filter(Boolean);
    } catch {
        return [];
    }
}

function guardarVentas(ventas) {
    safeSetItem(STORAGE_VENTAS, JSON.stringify(ventas));
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
        return {
            ...item,
            ...productoActualizado,
            categoria: (productoActualizado.categoria ?? item.categoria ?? "General").trim(),
            codigo: (productoActualizado.codigo ?? item.codigo ?? "").trim()
        };
    });
    guardarProductos(productos);
    if (productoActualizado.stock <= LIMITE_STOCK_BAJO) {
        mostrarNotificacionStock(productoActualizado);
    }
}

function eliminarProducto(id) {
    const productos = cargarProductos().filter((item) => item.id !== id);
    guardarProductos(productos);
}

function crearProducto(data) {
    const productos = cargarProductos();
    const nextId = productos.length ? Math.max(...productos.map((p) => p.id)) + 1 : Date.now();

    const nuevo = normalizarProducto({
        id: nextId,
        nombre: data.nombre,
        categoria: data.categoria,
        codigo: data.codigo,
        precio: data.precio,
        stock: data.stock
    });

    productos.push(nuevo);
    guardarProductos(productos);
    if (nuevo.stock <= LIMITE_STOCK_BAJO) {
        mostrarNotificacionStock(nuevo);
    }
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

    const timestamp = Date.now();
    const fechaIso = new Date(timestamp).toISOString();
    const venta = {
        id: timestamp,
        producto: producto.nombre,
        cantidad,
        precio: producto.precio,
        total: producto.precio * cantidad,
        fecha: fechaIso.slice(0, 10),
        timestamp
    };

    ventas.unshift(venta);
    guardarProductos(productos);
    guardarVentas(ventas);
    // Permite refrescar modulos abiertos en la misma pestana.
    window.dispatchEvent(new CustomEvent("ventasActualizadas", { detail: venta }));
    return venta;
}

function obtenerResumenHoy() {
    const productos = cargarProductos();
    const ventas = cargarVentas();
    const ventasDelDia = filtrarVentasDiaComercial(ventas);
    const cantidadVentas = ventasDelDia.length;
    const ingresosDelDia = ventasDelDia.reduce((acc, venta) => acc + venta.total, 0);
    const stockBajo = productos.filter((item) => item.stock <= LIMITE_STOCK_BAJO).length;

    return {
        totalProductos: productos.length,
        stockBajo,
        ventasDelDia: cantidadVentas,
        ingresosDelDia,
        alertas: productos.filter((item) => item.stock <= LIMITE_STOCK_BAJO)
    };
}

function enviarAlertaStock(producto) {
    const mensaje = `[SIMULACION EMAIL] Alerta: ${producto.nombre} tiene stock bajo (${producto.stock} unidades).`;
    console.warn(mensaje);
    mostrarNotificacionStock(producto);
}

function mostrarNotificacionStock(producto) {
    if (!producto || producto.stock > LIMITE_STOCK_BAJO) return;

    const ahora = Date.now();
    const ultima = ultimaNotificacionPorProducto.get(producto.id) || 0;
    if (ahora - ultima < TOAST_COOLDOWN_MS) return;
    ultimaNotificacionPorProducto.set(producto.id, ahora);

    const container = getToastContainer();
    const toast = document.createElement("article");
    toast.className = "toast";
    toast.setAttribute("role", "status");
    toast.innerHTML = `
        <i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i>
        <p>\u26A0 Stock bajo: ${escapeHtml(producto.nombre)} (${producto.stock} unidades)</p>
    `;

    container.appendChild(toast);

    requestAnimationFrame(() => {
        toast.classList.add("show");
    });

    // Cierra automaticamente el toast con animacion de salida.
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
                    <td>${producto.stock}</td>
                    <td><span class="estado ${estado.clase}"><i class="${estado.icono}"></i>${estado.texto}</span></td>
                </tr>
            `;
        })
        .join("");
}

function safeGetItem(key) {
    try {
        return localStorage.getItem(key);
    } catch (error) {
        console.error(`[app] No se pudo leer localStorage: ${key}`, error);
        return null;
    }
}

function safeSetItem(key, value) {
    try {
        localStorage.setItem(key, value);
    } catch (error) {
        console.error(`[app] No se pudo guardar localStorage: ${key}`, error);
    }
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

function normalizarVenta(venta) {
    if (!venta || typeof venta !== "object") return null;

    const producto = String(venta.producto || venta.nombreProducto || "").trim();
    const cantidad = Number(venta.cantidad);
    const precio = Number(venta.precio ?? venta.precioUnitario);
    const fecha = String(venta.fecha || new Date().toISOString().slice(0, 10));
    const timestamp = Number(venta.timestamp || Date.parse(venta.fecha) || Date.now());
    const total = Number(venta.total ?? (precio * cantidad));
    const id = Number(venta.id || timestamp || Date.now());

    if (!producto || !Number.isFinite(cantidad) || !Number.isFinite(precio) || !Number.isFinite(total)) return null;

    return {
        id,
        producto,
        cantidad,
        precio,
        total,
        fecha,
        timestamp
    };
}

function normalizarProducto(producto) {
    if (!producto || typeof producto !== "object") return null;
    const id = Number(producto.id || Date.now());
    const nombre = String(producto.nombre || "").trim();
    const categoria = String(producto.categoria || "General").trim();
    const codigo = String(producto.codigo || "").trim();
    const precio = Number(producto.precio);
    const stock = Number(producto.stock);

    if (!nombre || !Number.isFinite(precio) || precio <= 0 || !Number.isInteger(stock) || stock < 0) {
        return null;
    }

    return {
        id,
        nombre,
        categoria,
        codigo,
        precio,
        stock
    };
}

function filtrarVentasDiaComercial(ventas) {
    const ahora = new Date();
    const inicioDiaComercial = new Date();
    inicioDiaComercial.setHours(6, 0, 0, 0);

    // Si aun no son las 06:00, el dia comercial arranca en las 06:00 del dia anterior.
    if (ahora < inicioDiaComercial) {
        inicioDiaComercial.setDate(inicioDiaComercial.getDate() - 1);
    }

    const inicioTimestamp = inicioDiaComercial.getTime();
    return ventas.filter((venta) => venta.timestamp >= inicioTimestamp);
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
