const fechaEl = document.querySelector("#fecha");
const horaEl = document.querySelector("#hora");
const comprobanteEl = document.querySelector("#comprobante");
const itemsEl = document.querySelector("#items");
const totalEl = document.querySelector("#total");
const btnImprimir = document.querySelector("#btn-imprimir");

const formatearMoneda = (valor) =>
  new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 0,
  }).format(valor);

const cargarFechaHora = () => {
  const ahora = new Date();
  fechaEl.textContent = ahora.toLocaleDateString("es-AR");
  horaEl.textContent = ahora.toLocaleTimeString("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
  });
};

const generarComprobante = () => {
  comprobanteEl.textContent = `#${Date.now().toString().slice(-8)}`;
};

const cargarProductos = () => {
  try {
    const raw = localStorage.getItem("ventaActual");
    const data = JSON.parse(raw);
    if (!Array.isArray(data)) return [];
    return data;
  } catch (error) {
    console.warn("[factura] No se pudo leer ventaActual", error);
    return [];
  }
};

const renderizarProductos = () => {
  const productos = cargarProductos();
  let totalGeneral = 0;
  itemsEl.innerHTML = "";

  if (productos.length === 0) {
    itemsEl.innerHTML = `
      <tr>
        <td colspan="3" class="col-center">No hay productos cargados.</td>
      </tr>
    `;
    totalEl.textContent = formatearMoneda(0);
    return;
  }

  productos.forEach((producto) => {
    const total = Number(producto.total ?? 0);
    totalGeneral += total;

    const fila = document.createElement("tr");
    fila.innerHTML = `
      <td>${producto.nombre}</td>
      <td class="col-center">${producto.cantidad}</td>
      <td class="col-right">${formatearMoneda(total)}</td>
    `;
    itemsEl.appendChild(fila);
  });

  totalEl.textContent = formatearMoneda(totalGeneral);
};

btnImprimir.addEventListener("click", () => {
  window.print();
});

// Inicialización
cargarFechaHora();
generarComprobante();
renderizarProductos();

// Actualiza la hora cada minuto para mantenerla precisa
setInterval(cargarFechaHora, 60000);
