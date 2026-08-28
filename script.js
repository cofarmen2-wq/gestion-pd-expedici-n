const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyB7yRevFu4p_SLgUL-cWE_jjcgMqvU_FzyK1YJCmK3Agm3D1Atg7sEUSv0qmLKlHseNQ/exec";

const documentos = [];
let lectorQr = null;
let lectorQrIngreso = null; // Instancia de cámara para la vista ingresos
let documentoTransferPendiente = null;
let pausadoEscaneo = false;
let pausadoEscaneoIngreso = false;

const rutasPorTurno = {
  MAÑANA: ["Tunuyan-San Carlos", "La Paz", "San Martin-Beltran", "Tupungato", "San Martín", "Rivadavia-Junin", "Maipú", "Lavalle", "San José", "Lujan de Cuyo", "Benegas-L de Cuyo", "Benegas", "Ciudad Norte", "Dorrego", "Godoy Cruz-Ciudad", "Ciudad Oeste", "Villanueva", "Godoy Cruz", "Villanueva-Coquimbito", "Las Heras 1", "Las Heras 2", "Villa Hipodromo", "Ciudad Este"],
  TARDE: ["General Alvear", "Zona sur (Mañana: San Rafael 1; San Rafael 2)", "Tunuyan-San Carlos", "La Paz", "San Martin-Beltran", "Tupungato", "San Martín", "Rivadavia-Junin", "Maipú", "Lavalle", "San José", "Lujan de Cuyo", "Benegas-L de Cuyo", "Benegas", "Ciudad Norte", "Dorrego", "Godoy Cruz-Ciudad", "Ciudad Oeste", "Villanueva", "Godoy Cruz", "Villanueva-Coquimbito", "Las Heras 1", "Las Heras 2", "Villa Hipodromo", "Ciudad Este"],
  NOCHE: ["San Juan", "Zona sur (Noche: San Rafael 1; San Rafael 2; G. Alvear; Malargüe)", "SAN LUIS"],
  "FUERA DE TURNO": []
};

function mostrarLoading(mensaje = "Cargando...") {
  const overlay = document.getElementById("loadingOverlay");
  const text = document.getElementById("loadingText");
  if (text) text.textContent = mensaje;
  if (overlay) overlay.classList.remove("hidden");
}

function ocultarLoading() {
  const overlay = document.getElementById("loadingOverlay");
  if (overlay) overlay.classList.add("hidden");
}

// Detección automática de turnos basada en la hora local actual
function obtenerTurno(fecha = new Date()) {
  const minutos = fecha.getHours() * 60 + fecha.getMinutes();
  if (minutos >= 390 && minutos <= 720) return "MAÑANA";
  if (minutos >= 721 && minutos <= 1260) return "TARDE";
  if (minutos >= 1261 || minutos < 390) return "NOCHE";
  return "FUERA DE TURNO";
}

function actualizarRutas() {
  const selectorRuta = document.getElementById("ruta");
  const turno = obtenerTurno();
  const badge = document.getElementById("turnoBadge");
  
  if (badge) badge.textContent = `TURNO ${turno}`;
  if (!selectorRuta) return;

  selectorRuta.replaceChildren(new Option("Seleccione ruta...", "", true, true));
  selectorRuta.options[0].disabled = true;
  
  if (rutasPorTurno[turno]) {
    rutasPorTurno[turno].forEach(ruta => selectorRuta.add(new Option(ruta, ruta)));
  }
}

// Control seguro para cambiar de vista (Salidas / Ingresos) y apagar cámaras activas por seguridad
function cambiarVista(tipo) {
  const vSalida = document.getElementById("vistaSalida");
  const vIngreso = document.getElementById("vistaIngreso");
  const btnReg = document.getElementById("btnMenuRegistro");
  const btnRec = document.getElementById("btnMenuRecepcion");

  // Apagar cámara de salidas si se cambia de vista
  if (lectorQr) {
    lectorQr.stop().then(() => lectorQr.clear()).catch(() => {});
    lectorQr = null;
    document.getElementById("reader-container")?.classList.add("hidden");
    const btnCam = document.getElementById("btnToggleCamara");
    if (btnCam) btnCam.textContent = "📷 Iniciar Escáner QR";
  }

  // Apagar cámara de ingresos si se cambia de vista
  if (lectorQrIngreso) {
    lectorQrIngreso.stop().then(() => lectorQrIngreso.clear()).catch(() => {});
    lectorQrIngreso = null;
    document.getElementById("reader-container-ingreso")?.classList.add("hidden");
    const btnCamIng = document.getElementById("btnToggleCamaraIngreso");
    if (btnCamIng) btnCamIng.textContent = "📷 Iniciar Escáner QR (Ingresos)";
  }

  if (!vSalida || !vIngreso) return;

  if (tipo === 'salida') {
    vSalida.classList.remove("hidden");
    vIngreso.classList.add("hidden");
    if (btnReg) btnReg.style.backgroundColor = "#3b82f6";
    if (btnRec) btnRec.style.backgroundColor = "#64748b";
  } else {
    vSalida.classList.add("hidden");
    vIngreso.classList.remove("hidden");
    if (btnReg) btnReg.style.backgroundColor = "#64748b";
    if (btnRec) btnRec.style.backgroundColor = "#3b82f6";
    const inputIngreso = document.getElementById("inputCodigoIngreso");
    if (inputIngreso) setTimeout(() => inputIngreso.focus(), 100);
  }
}

function renderizarDocumentos() {
  const lista = document.getElementById("listaDocs");
  const count = document.getElementById("countDocs");
  if (!lista || !count) return;
  count.textContent = documentos.length;
  lista.replaceChildren();

  documentos.forEach((documento, indice) => {
    const item = document.createElement("li");
    item.className = "doc-item";
    const tagTransfer = documento.esTransfer ? " ⚠️ [TRANSFER]" : "";
    item.textContent = `${documento.codigoDoc} (${documento.tipoDoc})${tagTransfer}`;
    
    const eliminar = document.createElement("button");
    eliminar.type = "button";
    eliminar.className = "btn-close";
    eliminar.textContent = "✕";
    eliminar.addEventListener("click", () => { 
      documentos.splice(indice, 1); 
      renderizarDocumentos(); 
    });

    item.appendChild(eliminar);
    lista.appendChild(item);
  });
}

function agregarDocumento(codigoDoc) {
  if (pausadoEscaneo) return;
  const codigo = String(codigoDoc || "").trim();
  if (!codigo) return;

  // CONDICIÓN NUEVA: Verifica si el documento ya se encuentra cargado en el lote actual
  if (documentos.some(doc => doc.codigoDoc === codigo)) {
    alert(`El documento ${codigo} ya fue escaneado en este lote.`);
    
    // Limpia el input manual de inmediato para seguir escaneando
    const inputManual = document.getElementById("inputManualDoc");
    if (inputManual) {
      inputManual.value = "";
      inputManual.focus();
    }
    return;
  }

  pausadoEscaneo = true;
  setTimeout(() => { pausadoEscaneo = false; }, 300);

  const tipoDocInput = document.querySelector("input[name='tipoDoc']:checked");
  const tipoDoc = tipoDocInput ? tipoDocInput.value : "GUIA";
  const checkTransferElem = document.getElementById("checkEsTransfer");
  const esTransfer = checkTransferElem ? checkTransferElem.checked : false;

  const documento = { codigoDoc: codigo, tipoDoc: tipoDoc, esTransfer: esTransfer, transferChecklist: null };

  if (checkTransferElem) checkTransferElem.checked = false;

  if (documento.esTransfer) {
    documentoTransferPendiente = documento;
    const transferLabel = document.getElementById("transferDocLabel");
    if (transferLabel) transferLabel.textContent = `Documento: ${codigo}`;
    const modalTransfer = document.getElementById("modalTransfer");
    const modalBackdrop = document.getElementById("modalBackdrop");
    if (modalTransfer) modalTransfer.classList.remove("hidden");
    if (modalBackdrop) modalBackdrop.classList.remove("hidden");
    return;
  }

  documentos.push(documento);
  renderizarDocumentos();
  
  // Limpia el input manual tras cada carga exitosa
  const inputManual = document.getElementById("inputManualDoc");
  if (inputManual) {
    inputManual.value = "";
    inputManual.focus();
  }
}

function confirmarTransfer() {
  if (!documentoTransferPendiente) return;
  documentoTransferPendiente.transferChecklist = { 
    firmaSello: document.getElementById("chk1")?.value || "", 
    estadoCarga: document.getElementById("chk2")?.value || "", 
    precinto: document.getElementById("chk3")?.value || "" 
  };
  documentos.push(documentoTransferPendiente);
  documentoTransferPendiente = null;
  
  document.getElementById("modalTransfer")?.classList.add("hidden");
  document.getElementById("modalBackdrop")?.classList.add("hidden");
  renderizarDocumentos();
}

// Control de cámara para Salidas
function alternarCamara() {
  const contenedor = document.getElementById("reader-container");
  const boton = document.getElementById("btnToggleCamara");
  if (!contenedor || !boton) return;

  if (lectorQr) {
    lectorQr.stop().then(() => lectorQr.clear()).catch(() => {});
    lectorQr = null;
    contenedor.classList.add("hidden");
    boton.textContent = "📷 Iniciar Escáner QR";
    return;
  }
  if (typeof Html5Qrcode === "undefined") { 
    alert("Librería Html5Qrcode no encontrada."); 
    return; 
  }
  lectorQr = new Html5Qrcode("reader");
  contenedor.classList.remove("hidden");
  boton.textContent = "Detener Escáner QR";
  lectorQr.start(
    { facingMode: "environment" }, 
    { fps: 10, qrbox: 250 }, 
    codigo => agregarDocumento(codigo)
  ).catch(() => alert("No se pudo iniciar la cámara."));
}

// Control de cámara para Ingresos
function alternarCamaraIngreso() {
  const contenedor = document.getElementById("reader-container-ingreso");
  const boton = document.getElementById("btnToggleCamaraIngreso");
  if (!contenedor || !boton) return;

  if (lectorQrIngreso) {
    lectorQrIngreso.stop().then(() => lectorQrIngreso.clear()).catch(() => {});
    lectorQrIngreso = null;
    contenedor.classList.add("hidden");
    boton.textContent = "📷 Iniciar Escáner QR (Ingresos)";
    return;
  }
  if (typeof Html5Qrcode === "undefined") { 
    alert("Librería Html5Qrcode no encontrada."); 
    return; 
  }
  lectorQrIngreso = new Html5Qrcode("reader-ingreso");
  contenedor.classList.remove("hidden");
  boton.textContent = "Detener Escáner QR (Ingresos)";
  
  lectorQrIngreso.start(
    { facingMode: "environment" }, 
    { fps: 10, qrbox: 250 }, 
    codigo => {
      if (pausadoEscaneoIngreso) return;
      pausadoEscaneoIngreso = true;
      setTimeout(() => { pausadoEscaneoIngreso = false; }, 1500);

      // Al detectar por cámara en ingresos, enviamos directo al servidor
      const inputIngreso = document.getElementById("inputCodigoIngreso");
      if (inputIngreso) inputIngreso.value = codigo;
      enviarIngresoUnico(codigo);
    }
  ).catch(() => alert("No se pudo iniciar la cámara de ingresos."));
}

function guardarLote(evento) {
  evento.preventDefault();
  const operario = document.getElementById("operario")?.value;
  const ruta = document.getElementById("ruta")?.value;
  
  if (!operario || !ruta || !documentos.length) { 
    alert("Seleccione operario, ruta y escanee al menos un documento."); 
    return; 
  }

  const boton = document.getElementById("btnGuardar");
  if (boton) boton.disabled = true;
  mostrarLoading(`Registrando lote (${documentos.length} documentos)...`);

  const datosLote = { 
    accion: "guardarRegistros",
    operario: operario, 
    ruta: ruta, 
    turno: obtenerTurno(), 
    documentos: documentos 
  };

  fetch(SCRIPT_URL, {
    method: "POST",
    mode: "no-cors",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(datosLote)
  })
  .then(() => {
    ocultarLoading();
    alert("¡Lote registrado con éxito!");
    documentos.length = 0;
    renderizarDocumentos();
    document.getElementById("mainForm")?.reset();
    actualizarRutas();
    if (boton) boton.disabled = false;
  })
  .catch(error => {
    ocultarLoading();
    alert(`Error de conexión: ${error}`);
    if (boton) boton.disabled = false;
  });
}

function enviarIngresoUnico(codigo) {
  const codigoLimpio = String(codigo || "").trim();
  const msgDiv = document.getElementById("resultadoIngresoMsg");
  if (!codigoLimpio) return;

  mostrarLoading("Registrando ingreso...");

  fetch(SCRIPT_URL, {
    method: "POST",
    mode: "no-cors",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ accion: "registrarIngresoUnico", codigoDoc: codigoLimpio })
  })
  .then(() => {
    ocultarLoading();
    if (msgDiv) {
      msgDiv.style.color = "#4ade80";
      msgDiv.textContent = `¡Éxito! Documento ${codigoLimpio} registrado en ingresos.`;
    }
    const inputIngreso = document.getElementById("inputCodigoIngreso");
    if (inputIngreso) {
      inputIngreso.value = "";
      inputIngreso.focus();
    }
    setTimeout(() => { if (msgDiv) msgDiv.textContent = ""; }, 4000);
  })
  .catch(err => {
    ocultarLoading();
    if (msgDiv) {
      msgDiv.style.color = "#ef4444";
      msgDiv.textContent = `Error: ${err}`;
    }
  });
}

function renderizarHistorial(historial) {
  const contenedor = document.getElementById("historialContent");
  if (!contenedor) return;
  contenedor.replaceChildren();
  if (!historial || !historial.length) {
    contenedor.textContent = "Sin registros recientes.";
    return;
  }
  historial.forEach(registro => {
    const tarjeta = document.createElement("div");
    tarjeta.className = "history-card";
    tarjeta.textContent = `${registro.fechaHora} | ${registro.operario} | Doc: ${registro.doc} | Estado: ${registro.recepcion}`;
    contenedor.appendChild(tarjeta);
  });
}

function abrirHistorial() {
  document.getElementById("drawer")?.classList.remove("hidden");
  document.getElementById("drawerBackdrop")?.classList.remove("hidden");
  mostrarLoading("Cargando historial...");

  fetch(`${SCRIPT_URL}?accion=obtenerHistorialReciente`)
    .then(res => res.json())
    .then(historial => {
      ocultarLoading();
      renderizarHistorial(historial);
    })
    .catch(() => {
      ocultarLoading();
      const content = document.getElementById("historialContent");
      if (content) content.textContent = "No se pudo sincronizar el historial.";
    });
}

function cerrarHistorial() {
  document.getElementById("drawer")?.classList.add("hidden");
  document.getElementById("drawerBackdrop")?.classList.add("hidden");
}

document.addEventListener("DOMContentLoaded", () => {
  actualizarRutas();

  document.getElementById("btnToggleCamara")?.addEventListener("click", alternarCamara);
  document.getElementById("btnToggleCamaraIngreso")?.addEventListener("click", alternarCamaraIngreso);
  document.getElementById("mainForm")?.addEventListener("submit", guardarLote);
  document.getElementById("btnConfirmTransfer")?.addEventListener("click", confirmarTransfer);
  
  document.getElementById("btnOpenDrawer")?.addEventListener("click", abrirHistorial);
  document.getElementById("btnCloseDrawer")?.addEventListener("click", cerrarHistorial);
  document.getElementById("drawerBackdrop")?.addEventListener("click", cerrarHistorial);

  document.getElementById("inputCodigoIngreso")?.addEventListener("keypress", function(e) {
    if (e.key === "Enter") {
      e.preventDefault();
      enviarIngresoUnico(this.value);
    }
  });

  document.getElementById("btnEjecutarIngreso")?.addEventListener("click", function() {
    const input = document.getElementById("inputCodigoIngreso");
    if (input) enviarIngresoUnico(input.value);
  });

  const inputManualDoc = document.getElementById("inputManualDoc");
  if (inputManualDoc) {
    inputManualDoc.addEventListener("keypress", function(e) {
      if (e.key === "Enter") {
        e.preventDefault();
        agregarDocumento(this.value);
        this.value = "";
      }
    });
  }
});
