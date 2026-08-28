const documentos = [];
let lectorQr = null;
let documentoTransferPendiente = null;
let procesandoEscaneo = false;

const rutasPorTurno = {
  MAÑANA: ["Tunuyan-San Carlos", "La Paz", "San Martin-Beltran", "Tupungato", "San Martín", "Rivadavia-Junin", "Maipú", "Lavalle", "San José", "Lujan de Cuyo", "Benegas-L de Cuyo", "Benegas", "Ciudad Norte", "Dorrego", "Godoy Cruz-Ciudad", "Ciudad Oeste", "Villanueva", "Godoy Cruz", "Villanueva-Coquimbito", "Las Heras 1", "Las Heras 2", "Villa Hipodromo", "Ciudad Este"],
  TARDE: ["General Alvear", "Zona sur (Mañana: San Rafael 1; San Rafael 2)", "Tunuyan-San Carlos", "La Paz", "San Martin-Beltran", "Tupungato", "San Martín", "Rivadavia-Junin", "Maipú", "Lavalle", "San José", "Lujan de Cuyo", "Benegas-L de Cuyo", "Benegas", "Ciudad Norte", "Dorrego", "Godoy Cruz-Ciudad", "Ciudad Oeste", "Villanueva", "Godoy Cruz", "Villanueva-Coquimbito", "Las Heras 1", "Las Heras 2", "Villa Hipodromo", "Ciudad Este"],
  NOCHE: ["San Juan", "Zona sur (Noche: San Rafael 1; San Rafael 2; G. Alvear; Malargüe)", "SAN LUIS"],
  "FUERA DE TURNO": []
};

function obtenerTurno(fecha = new Date()) {
  const minutos = fecha.getHours() * 60 + fecha.getMinutes();
  if (minutos >= 390 && minutos <= 720) return "MAÑANA";
  if (minutos >= 721 && minutos <= 1260) return "TARDE";
  if (minutos >= 1261) return "NOCHE";
  return "FUERA DE TURNO";
}

function actualizarRutas() {
  const selectorRuta = document.getElementById("ruta");
  const turno = obtenerTurno();
  document.getElementById("turnoBadge").textContent = `TURNO ${turno}`;
  selectorRuta.replaceChildren(new Option("Seleccione ruta...", "", true, true));
  selectorRuta.options[0].disabled = true;
  
  if (rutasPorTurno[turno]) {
    rutasPorTurno[turno].forEach(ruta => selectorRuta.add(new Option(ruta, ruta)));
  }
}

function renderizarDocumentos() {
  const lista = document.getElementById("listaDocs");
  document.getElementById("countDocs").textContent = documentos.length;
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

function agregarDocumento(codigoDoc) {
  const codigo = String(codigoDoc || "").trim();
  if (procesandoEscaneo || !codigo || documentos.some(documento => documento.codigoDoc === codigo) || documentoTransferPendiente) return;
  const documento = { 
    codigoDoc: codigo, 
    tipoDoc: document.querySelector("input[name='tipoDoc']:checked").value, 
    esTransfer: document.getElementById("checkEsTransfer").checked, 
    transferChecklist: null 
  };
  if (documento.esTransfer) {
    documentoTransferPendiente = documento;
    document.getElementById("transferDocLabel").textContent = `Documento: ${codigo}`;
    document.getElementById("modalTransfer").classList.remove("hidden");
    return;
  }
  registrarDocumento(documento);
}

function registrarDocumento(documento) {
  const operario = document.getElementById("operario").value;
  const ruta = document.getElementById("ruta").value;
  if (!operario || !ruta) {
    alert("Seleccione el operario y la ruta antes de escanear.");
    return;
  }
  procesandoEscaneo = true;
  const registro = { operario, ruta, turno: obtenerTurno(), documento };
  const registrado = () => {
    documentos.push(documento);
    renderizarDocumentos();
    procesandoEscaneo = false;
  };
  const fallido = error => {
    alert(`No se pudo registrar el documento: ${error.message || error}`);
    procesandoEscaneo = false;
  };
  if (typeof google !== "undefined" && google.script && google.script.run) {
    google.script.run.withSuccessHandler(registrado).withFailureHandler(fallido).registrarDocumento(registro);
  } else {
    setTimeout(registrado, 0);
  }
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
  const operario = document.getElementById("operario").value;
  const ruta = document.getElementById("ruta").value;
  if (!operario || !ruta) { alert("Seleccione operario y ruta."); return; }
  if (!documentos.length) { alert("Escanee al menos un documento."); return; }
  alert(`Se registraron ${documentos.length} documento(s) durante el turno.`);
}

function confirmarTransfer() {
  if (!documentoTransferPendiente) return;
  documentoTransferPendiente.transferChecklist = { 
    firmaSello: document.getElementById("chk1").value, 
    estadoCarga: document.getElementById("chk2").value, 
    precinto: document.getElementById("chk3").value 
  };
  const documento = documentoTransferPendiente;
  documentoTransferPendiente = null;
  document.getElementById("modalTransfer").classList.add("hidden");
  registrarDocumento(documento);
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
  
  if (typeof google !== "undefined" && google.script && google.script.run) {
    google.script.run.withSuccessHandler(renderizarHistorial).withFailureHandler(() => {
      document.getElementById("historialContent").textContent = "No se pudo cargar el historial.";
    }).obtenerHistorialReciente();
  } else {
    // Datos de demostración en GitHub Pages
    renderizarHistorial([
      { operario: "Operario 1", ruta: "Maipú", puestaDisposicion: "2026-08-27 09:00:00", recepcion: "RECEPCIONADO" }
    ]);
  }
}

function cerrarHistorial() {
  document.getElementById("drawer").classList.add("hidden");
  document.getElementById("drawerBackdrop").classList.add("hidden");
}

document.addEventListener("DOMContentLoaded", () => {
  actualizarRutas();
  document.getElementById("btnToggleCamara").addEventListener("click", alternarCamara);
  document.getElementById("mainForm").addEventListener("submit", guardarLote);
  document.getElementById("btnConfirmTransfer").addEventListener("click", confirmarTransfer);
  document.getElementById("btnOpenDrawer").addEventListener("click", abrirHistorial);
  document.getElementById("btnCloseDrawer").addEventListener("click", cerrarHistorial);
  document.getElementById("drawerBackdrop").addEventListener("click", cerrarHistorial);
});
