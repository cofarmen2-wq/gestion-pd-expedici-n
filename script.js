const documentos = [];
let lectorQr = null;
let procesandoEscaneo = false;
let modoVista = "SALIDA";
let loteLoadingTimer = null;
const OPERARIOS_CACHE_KEY = "operariosCache";
const ULTIMO_OPERARIO_KEY = "ultimoOperario";
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxyTNx8YSY3ry1cg3k78ldOHtNLFdFfJwNXHuj_ng8bNEVxUch8tzecdPrwV3UHFkngDg/exec";

const rutasPorTurno = {
  MAÑANA: ["Tunuyan-San Carlos", "La Paz", "San Martin-Beltran", "Tupungato", "San Martín", "Rivadavia-Junin", "Maipú", "Lavalle", "San José", "Lujan de Cuyo", "Benegas-L de Cuyo", "Benegas", "Ciudad Norte", "Dorrego", "Godoy Cruz-Ciudad", "Ciudad Oeste", "Villanueva", "Godoy Cruz", "Villanueva-Coquimbito", "Las Heras 1", "Las Heras 2", "Villa Hipodromo", "Ciudad Este"],
  TARDE: ["General Alvear", "Zona sur (Mañana: San Rafael 1; San Rafael 2)", "Tunuyan-San Carlos", "La Paz", "San Martin-Beltran", "Tupungato", "San Martín", "Rivadavia-Junin", "Maipú", "Lavalle", "San José", "Lujan de Cuyo", "Benegas-L de Cuyo", "Benegas", "Ciudad Norte", "Dorrego", "Godoy Cruz-Ciudad", "Ciudad Oeste", "Villanueva", "Godoy Cruz", "Villanueva-Coquimbito", "Las Heras 1", "Las Heras 2", "Villa Hipodromo", "Ciudad Este"],
  NOCHE: ["San Juan", "Zona sur (Noche: San Rafael 1; San Rafael 2; G. Alvear; Malargüe)", "SAN LUIS"],
  "FUERA DE TURNO": []
};

function obtenerTurno(fecha = new Date()) {
  const hora = fecha.getHours();
  if (hora >= 18 || hora < 6) return "NOCHE";
  if (hora >= 6 && hora < 14) return "MAÑANA";
  if (hora >= 14 && hora < 18) return "TARDE";
  return "FUERA DE TURNO";
}

function leerOperariosCache() {
  try {
    const valor = localStorage.getItem(OPERARIOS_CACHE_KEY);
    if (!valor) return [];
    const cache = JSON.parse(valor);
    return Array.isArray(cache) ? cache.filter(Boolean) : [];
  } catch (error) {
    return [];
  }
}

function guardarOperarioEnCache() {
  const operarioActual = document.getElementById("operario")?.value || document.getElementById("operarioIngreso")?.value || "";
  if (!operarioActual) return;
  const cache = leerOperariosCache();
  const listaActualizada = [...new Set([operarioActual, ...cache])].slice(0, 20);
  localStorage.setItem(OPERARIOS_CACHE_KEY, JSON.stringify(listaActualizada));
  localStorage.setItem(ULTIMO_OPERARIO_KEY, operarioActual);
}

function cargarOperariosDesdeCache() {
  const operariosBase = ["Operario 1", "Operario 2", "Operario 3", "Operario 4"];
  const operarios = [...new Set([...leerOperariosCache(), ...operariosBase])];
  const datalist = document.getElementById("operariosLista");
  if (datalist) {
    datalist.replaceChildren();
    operarios.forEach(operario => {
      const opcion = document.createElement("option");
      opcion.value = operario;
      datalist.appendChild(opcion);
    });
  }

  const ultimoOperario = localStorage.getItem(ULTIMO_OPERARIO_KEY);
  ["operario", "operarioIngreso"].forEach(id => {
    const input = document.getElementById(id);
    if (input && ultimoOperario) {
      input.value = ultimoOperario;
    }
  });
}

function mostrarCargaLote(mensaje = "Cargando datos") {
  const contenedor = document.getElementById("loadingBarContainer");
  const texto = document.getElementById("loadingBarText");
  const porcentaje = document.getElementById("loadingBarPercent");
  if (!contenedor || !texto || !porcentaje) return;

  contenedor.classList.remove("hidden");
  texto.textContent = "Cargando datos";
  porcentaje.textContent = mensaje === "Cargando datos" ? "procesando lote..." : mensaje;

  if (loteLoadingTimer) clearInterval(loteLoadingTimer);
  loteLoadingTimer = setTimeout(() => {
    texto.textContent = "Cargando datos";
    porcentaje.textContent = "procesando lote...";
  }, 120);
}

function ocultarCargaLote() {
  const contenedor = document.getElementById("loadingBarContainer");
  const texto = document.getElementById("loadingBarText");
  const porcentaje = document.getElementById("loadingBarPercent");

  if (loteLoadingTimer) {
    clearInterval(loteLoadingTimer);
    loteLoadingTimer = null;
  }

  if (texto) texto.textContent = "Proceso finalizado";
  if (porcentaje) porcentaje.textContent = "datos actualizados";

  if (contenedor) {
    setTimeout(() => {
      contenedor.classList.add("hidden");
      if (texto) texto.textContent = "Cargando datos";
      if (porcentaje) porcentaje.textContent = "procesando lote...";
    }, 900);
  }
}

function obtenerCantidad(idCampo) {
  const valor = Number.parseInt(document.getElementById(idCampo)?.value || "0", 10);
  return Number.isFinite(valor) ? Math.max(0, valor) : 0;
}

function setModoVista(nuevoModo) {
  modoVista = nuevoModo;
  const salida = document.getElementById("vistaSalida");
  const ingreso = document.getElementById("vistaIngreso");
  const operarioSalida = document.getElementById("operario");
  const operarioIngreso = document.getElementById("operarioIngreso");
  const transferCheck = document.getElementById("checkEsTransfer");
  const botones = document.querySelectorAll(".view-switch");

  if (salida) salida.classList.toggle("hidden", nuevoModo !== "SALIDA");
  if (ingreso) ingreso.classList.toggle("hidden", nuevoModo !== "INGRESO");

  if (transferCheck) {
    transferCheck.checked = nuevoModo === "SALIDA" ? transferCheck.checked : false;
    transferCheck.closest(".transfer-toggle")?.classList.toggle("hidden", nuevoModo !== "SALIDA");
  }

  if (operarioSalida) operarioSalida.required = nuevoModo === "SALIDA";
  if (operarioIngreso) operarioIngreso.required = nuevoModo === "INGRESO";

  botones.forEach(boton => {
    const activo = boton.dataset.vista === nuevoModo;
    boton.classList.toggle("active", activo);
    boton.setAttribute("aria-pressed", String(activo));
  });
}

function actualizarRutas() {
  const selectorRuta = document.getElementById("ruta");
  if (!selectorRuta) return;
  const turno = obtenerTurno();
  const rutasDelTurno = rutasPorTurno[turno] && rutasPorTurno[turno].length ? rutasPorTurno[turno] : rutasPorTurno.NOCHE;
  const turnoMostrado = rutasDelTurno ? turno : "NOCHE";

  const badge = document.getElementById("turnoBadge");
  if (badge) badge.textContent = `TURNO ${turnoMostrado}`;

  selectorRuta.replaceChildren(new Option("Seleccione ruta...", "", true, true));
  selectorRuta.options[0].disabled = true;

  if (rutasDelTurno) {
    rutasDelTurno.forEach(ruta => selectorRuta.add(new Option(ruta, ruta)));
  }
}

function renderizarDocumentos() {
  const lista = document.getElementById("listaDocs");
  const total = document.getElementById("countDocs");
  if (!lista || !total) return;
  total.textContent = documentos.length;
  lista.replaceChildren();
  documentos.forEach((documento, indice) => {
    const item = document.createElement("li");
    item.className = "doc-item";
    item.textContent = `${documento.codigoDoc} - ${documento.tipoDoc}${documento.esTransfer ? " - TRANSFER" : ""}`;
    const eliminar = document.createElement("button");
    eliminar.type = "button";
    eliminar.className = "btn-close";
    eliminar.textContent = "✕";
    eliminar.addEventListener("click", () => { documentos.splice(indice, 1); renderizarDocumentos(); });
    item.appendChild(eliminar);
    lista.appendChild(item);
  });
}

function limpiarFormulario() {
  documentos.length = 0;
  renderizarDocumentos();

  const form = document.getElementById("mainForm");
  if (form) form.reset();

  ["operario", "operarioIngreso", "ruta", "cantidadCubetas", "cantidadCadenasFrio", "cantidadBultos"].forEach(id => {
    const campo = document.getElementById(id);
    if (!campo) return;

    if (id === "ruta") {
      campo.value = "";
      return;
    }

    if (id.includes("cantidad")) {
      campo.value = "0";
      return;
    }

    campo.value = "";
  });

  const transferencia = document.getElementById("checkEsTransfer");
  if (transferencia) transferencia.checked = false;

  const ruta = document.getElementById("ruta");
  if (ruta) {
    actualizarRutas();
    ruta.value = "";
  }

  procesandoEscaneo = false;
}

function agregarDocumento(codigoDoc) {
  const codigo = String(codigoDoc || "").trim();
  if (procesandoEscaneo || !codigo || documentos.some(documento => documento.codigoDoc === codigo)) return;

  const esTransfer = modoVista === "SALIDA" && document.getElementById("checkEsTransfer").checked;
  const documento = {
    codigoDoc: codigo,
    tipoDoc: modoVista === "INGRESO" ? "INGRESO" : "SALIDA",
    esTransfer,
    transferChecklist: null
  };

  registrarDocumento(documento);
}

function registrarDocumento(documento) {
  const operario = modoVista === "INGRESO"
    ? (document.getElementById("operarioIngreso")?.value || document.getElementById("operario")?.value || "")
    : (document.getElementById("operario")?.value || "");
  const ruta = document.getElementById("ruta")?.value || "";
  const cantidades = {
    cubetas: obtenerCantidad("cantidadCubetas"),
    cadenasFrio: obtenerCantidad("cantidadCadenasFrio"),
    bultos: obtenerCantidad("cantidadBultos")
  };

  if (!operario) {
    alert("Ingrese el operario antes de escanear.");
    return;
  }

  if (modoVista === "SALIDA" && !ruta) {
    alert("Seleccione la ruta antes de escanear.");
    return;
  }

  const codigoDoc = String(documento.codigoDoc || "").trim();
  if (!codigoDoc) {
    alert("El documento no tiene código válido.");
    return;
  }

  if (documentos.some(doc => String(doc.codigoDoc || "").trim() === codigoDoc)) {
    alert(`El documento ${codigoDoc} ya existe en la base de datos.`);
    return;
  }

  guardarOperarioEnCache();
  mostrarCargaLote("Cargando lote...");
  procesandoEscaneo = true;
  const documentoFinal = { ...documento, ...cantidades };
  const registro = { operario, ruta, turno: obtenerTurno(), documento: documentoFinal };

  fetch(SCRIPT_URL, {
    method: "POST",
    mode: "cors",
    headers: {
      "Content-Type": "text/plain;charset=utf-8",
    },
    body: JSON.stringify({ accion: "registrarDocumento", datos: registro })
  })
  .then(response => response.json())
  .then(data => {
    const status = data && data.status;
    if (status === "OK" || status === "success" || status === "SUCCESS") {
      documentos.push(documentoFinal);
      renderizarDocumentos();
    } else {
      alert(data && data.message ? data.message : "Error en el servidor.");
    }
  })
  .catch(error => {
    alert(`No se pudo registrar el documento: ${error.message || error}`);
  })
  .finally(() => {
    ocultarCargaLote();
    procesandoEscaneo = false;
  });
}

function alternarCamara() {
  const contenedor = document.getElementById("reader-container");
  const boton = document.getElementById("btnToggleCamara");
  if (lectorQr) {
    lectorQr.stop().then(() => lectorQr.clear()).catch(() => {});
    lectorQr = null;
    contenedor.classList.add("hidden");
    boton.textContent = "📷 Iniciar Escáner QR";
    return;
  }
  if (typeof Html5Qrcode === "undefined") { alert("No se pudo cargar el escáner QR."); return; }
  lectorQr = new Html5Qrcode("reader");
  contenedor.classList.remove("hidden");
  boton.textContent = "Detener Escáner QR";
  lectorQr.start({ facingMode: "environment" }, { fps: 10, qrbox: 250 }, codigo => agregarDocumento(codigo)).catch(() => alert("No se pudo acceder a la cámara."));
}

function guardarLote(evento) {
  evento.preventDefault();
  const operario = modoVista === "INGRESO"
    ? (document.getElementById("operarioIngreso")?.value || document.getElementById("operario")?.value || "")
    : (document.getElementById("operario")?.value || "");
  const ruta = document.getElementById("ruta")?.value || "";

  if (!operario) {
    alert("Complete el operario antes de finalizar.");
    return;
  }

  if (modoVista === "SALIDA" && !ruta) {
    alert("Seleccione la ruta antes de finalizar.");
    return;
  }

  if (!documentos.length) {
    alert("Escanee al menos un documento.");
    return;
  }

  mostrarCargaLote("Finalizando lote...");
  setTimeout(() => {
    ocultarCargaLote();
    const totalRegistrados = documentos.length;
    limpiarFormulario();
    alert(`Se registraron ${totalRegistrados} documento(s) durante el turno.`);
  }, 400);
}

function renderizarHistorial(historial) {
  const contenedor = document.getElementById("historialContent");
  contenedor.replaceChildren();
  if (!historial || !historial.length) {
    contenedor.textContent = "Sin registros recientes.";
    return;
  }
  historial.forEach(registro => {
    const tarjeta = document.createElement("div");
    tarjeta.className = "history-card";
    tarjeta.textContent = `${registro.operario} | ${registro.ruta} | Puesta: ${registro.puestaDisposicion || "-"} | Recepción: ${registro.recepcion || "Pendiente"}`;
    contenedor.appendChild(tarjeta);
  });
}

function abrirHistorial() {
  document.getElementById("drawer").classList.remove("hidden");
  document.getElementById("drawerBackdrop").classList.remove("hidden");

  fetch(`${SCRIPT_URL}?accion=obtenerHistorialReciente`)
    .then(response => response.json())
    .then(historial => {
      renderizarHistorial(historial);
    })
    .catch(() => {
      document.getElementById("historialContent").textContent = "No se pudo cargar el historial.";
    });
}

function cerrarHistorial() {
  document.getElementById("drawer").classList.add("hidden");
  document.getElementById("drawerBackdrop").classList.add("hidden");
}

document.addEventListener("DOMContentLoaded", () => {
  cargarOperariosDesdeCache();
  actualizarRutas();
  setModoVista("SALIDA");

  document.getElementById("btnToggleCamara").addEventListener("click", alternarCamara);
  document.getElementById("mainForm").addEventListener("submit", guardarLote);
  document.getElementById("btnOpenDrawer").addEventListener("click", abrirHistorial);
  document.getElementById("btnCloseDrawer").addEventListener("click", cerrarHistorial);
  document.getElementById("drawerBackdrop").addEventListener("click", cerrarHistorial);
  document.querySelectorAll(".view-switch").forEach(boton => {
    boton.addEventListener("click", () => setModoVista(boton.dataset.vista));
  });
});
