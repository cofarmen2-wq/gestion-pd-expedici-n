const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyB7yRevFu4p_SlGUL-cWE_jjcgMvU_Fzyk1YJCMk3Agm3D1Atg7sEUSv0qmL1HsENq/exec";

let documentos = [];
let lectorQr = null;
let lectorQrIngreso = null;
let documentoTransferPendiente = null;
let procesandoEscaneo = false;

const rutasPorTurno = {
  MAÑANA: ["Tunuyan-San Carlos", "La Paz", "San Martin-Beltran", "Tupungato", "San Martín", "Rivadavia-Junin", "Maipú", "Lavalle", "San José", "Lujan de Cuyo"],
  TARDE: ["General Alvear", "Zona sur (Mañana: San Rafael 1; San Rafael 2)", "Tunuyan-San Carlos", "La Paz", "San Martin-Beltran", "Tupungato", "San Martín", "Rivadavia-Junin", "Maipú", "Lavalle", "San José", "Lujan de Cuyo"],
  NOCHE: ["San Juan", "Zona sur (Noche: San Rafael 1; San Rafael 2; G. Alvear; Malargüe)", "SAN LUIS"],
  "FUERA DE TURNO": []
};

function mostrarLoading(mostrar, texto = "Procesando, por favor espere...") {
  const overlay = document.getElementById("loadingOverlay");
  const txt = document.getElementById("loadingText");
  if (txt) txt.textContent = texto;
  if (overlay) {
    if (mostrar) overlay.classList.remove("hidden");
    else overlay.classList.add("hidden");
  }
}

function obtenerTurno(fecha = new Date()) {
  const minutos = fecha.getHours() * 60 + fecha.getMinutes();
  if (minutos >= 390 && minutos <= 720) return "MAÑANA";
  if (minutos >= 721 && minutos <= 1260) return "TARDE";
  if (minutos >= 1261) return "NOCHE";
  return "FUERA DE TURNO";
}

document.addEventListener("DOMContentLoaded", () => {
  inicializarInterfaz();
  cargarHistorialReciente();
});

function inicializarInterfaz() {
  const turnoActual = obtenerTurno();
  const selectTurno = document.getElementById("turnoSelect");
  const badgeTurno = document.getElementById("turnoTexto");

  if (selectTurno) {
    selectTurno.value = turnoActual;
    actualizarRutasPorTurno();
  }
  if (badgeTurno) {
    badgeTurno.textContent = turnoActual;
  }
}

function cambiarVista(vista) {
  const secLote = document.getElementById("seccionLote");
  const secIngreso = document.getElementById("seccionIngreso");
  const btnLote = document.getElementById("btnVistaLote");
  const btnIngreso = document.getElementById("btnVistaIngreso");

  if (vista === "lote") {
    secLote.classList.remove("hidden");
    secIngreso.classList.add("hidden");
    btnLote.classList.add("active");
    btnIngreso.classList.remove("active");
    if (lectorQrIngreso) detenerEscannerIngreso();
  } else {
    secLote.classList.add("hidden");
    secIngreso.classList.remove("hidden");
    btnLote.classList.remove("active");
    btnIngreso.classList.add("active");
    if (lectorQr) detenerEscannerSalida();
    cargarHistorialReciente();
  }
}

function actualizarRutasPorTurno() {
  const turno = document.getElementById("turnoSelect").value;
  const selectRuta = document.getElementById("rutaSelect");
  if (!selectRuta) return;

  selectRuta.innerHTML = '<option value="">Seleccione ruta...</option>';
  const rutas = rutasPorTurno[turno] || [];
  
  rutas.forEach(ruta => {
    const opt = document.createElement("option");
    opt.value = ruta;
    opt.textContent = ruta;
    selectRuta.appendChild(opt);
  });
}

function agregarDocumentoManual() {
  const input = document.getElementById("codigoInput");
  const codigo = input.value.trim();
  if (!codigo) return;

  procesarCodigoEscaneado(codigo);
  input.value = "";
  input.focus();
}

function procesarCodigoEscaneado(codigo) {
  if (procesandoEscaneo) return;
  procesandoEscaneo = true;
  setTimeout(() => { procesandoEscaneo = false; }, 400);

  if (documentos.some(d => d.codigoDoc === codigo)) {
    alert(`El documento ${codigo} ya se encuentra en la lista actual.`);
    return;
  }

  const tipoDoc = codigo.toUpperCase().startsWith("F") ? "FACTURA" : "REMITO";
  const esTransfer = document.getElementById("checkTransfer")?.checked || codigo.toUpperCase().includes("TR");

  const nuevoDoc = {
    codigoDoc: codigo,
    tipoDoc: tipoDoc,
    esTransfer: esTransfer
  };

  if (esTransfer) {
    documentoTransferPendiente = nuevoDoc;
    abrirModalTransferencia(codigo);
  } else {
    documentos.push(nuevoDoc);
    actualizarListaDocumentos();
  }
}

function actualizarListaDocumentos() {
  const lista = document.getElementById("listaDocumentos");
  const contador = document.getElementById("contadorDocs");
  if (!lista) return;

  lista.innerHTML = "";
  documentos.forEach((doc, index) => {
    const li = document.createElement("li");
    li.className = "doc-item";
    li.innerHTML = `
      <span><strong>${doc.codigoDoc}</strong> (${doc.tipoDoc}) ${doc.esTransfer ? '⭐ Transfer' : ''}</span>
      <button onclick="eliminarDocumento(${index})" style="background:none; border:none; color:#f87171; cursor:pointer;">❌</button>
    `;
    lista.appendChild(li);
  });

  if (contador) contador.textContent = documentos.length;
}

function eliminarDocumento(index) {
  documentos.splice(index, 1);
  actualizarListaDocumentos();
}

function abrirModalTransferencia(codigo) {
  const modal = document.getElementById("modalTransfer");
  const span = document.getElementById("modalDocCode");
  if (modal && span) {
    span.textContent = codigo;
    modal.classList.remove("hidden");
  }
}

function cerrarModalTransferencia(confirmado) {
  const modal = document.getElementById("modalTransfer");
  if (modal) modal.classList.add("hidden");

  if (confirmado && documentoTransferPendiente) {
    const origen = document.getElementById("transOrigen")?.value || "CD";
    const destino = document.getElementById("transDestino")?.value || "Sucursal";
    documentoTransferPendiente.esTransfer = true;
    documentoTransferPendiente.transferChecklist = { origen, destino };
    
    documentos.push(documentoTransferPendiente);
    actualizarListaDocumentos();
  }
  documentoTransferPendiente = null;
  document.getElementById("checkTransfer").checked = false;
}

async function enviarLote() {
  const operario = document.getElementById("operarioInput")?.value.trim();
  const ruta = document.getElementById("rutaSelect")?.value;
  const turno = document.getElementById("turnoSelect")?.value;

  if (!operario) { alert("Por favor seleccione el operario."); return; }
  if (!ruta) { alert("Por favor seleccione una ruta."); return; }
  if (documentos.length === 0) { alert("Debe escanear al menos un documento."); return; }

  mostrarLoading(true, "Guardando lote en Google Sheets...");

  try {
    const response = await fetch(SCRIPT_URL, {
      method: "POST",
      body: JSON.stringify({ accion: "guardarRegistros", operario, ruta, turno, documentos })
    });
    const resultado = await response.json();
    mostrarLoading(false);

    if (resultado.status === "OK") {
      alert(`¡Lote guardado con éxito! Registrados: ${resultado.count}`);
      documentos = [];
      actualizarListaDocumentos();
      cargarHistorialReciente();
    } else {
      alert("Error: " + (resultado.message || "Desconocido"));
    }
  } catch (error) {
    mostrarLoading(false);
    alert("Error de red: " + error.toString());
  }
}

async function registrarIngresoUnitario(codigoOverride = null) {
  const input = codigoOverride || document.getElementById("codigoIngresoInput")?.value.trim();
  if (!input) return;

  mostrarLoading(true, `Registrando ingreso para ${input}...`);

  try {
    const response = await fetch(SCRIPT_URL, {
      method: "POST",
      body: JSON.stringify({ accion: "registrarIngresoUnico", codigoDoc: input })
    });
    const resultado = await response.json();
    mostrarLoading(false);

    if (resultado.status === "OK") {
      alert(resultado.message);
      if (document.getElementById("codigoIngresoInput")) {
        document.getElementById("codigoIngresoInput").value = "";
        document.getElementById("codigoIngresoInput").focus();
      }
      cargarHistorialReciente();
    } else {
      alert(resultado.message || "No se pudo registrar.");
    }
  } catch (error) {
    mostrarLoading(false);
    alert("Error de red: " + error.toString());
  }
}

async function cargarHistorialReciente() {
  try {
    const response = await fetch(`${SCRIPT_URL}?accion=obtenerHistorialReciente`);
    const historial = await response.json();
    const contenedor = document.getElementById("historialRecienteLista");
    if (!contenedor) return;

    contenedor.innerHTML = "";
    if (Array.isArray(historial) && historial.length > 0) {
      historial.forEach(item => {
        const div = document.createElement("div");
        div.className = "history-card";
        div.innerHTML = `
          <strong>Doc: ${item.doc}</strong> | Ruta: ${item.ruta}<br>
          <small>Operario: ${item.operario} (${item.fechaHora})</small><br>
          <span style="color: ${item.recepcion === 'RECEPCIONADO' ? '#4ade80' : '#facc15'}">
            Estado: ${item.recepcion}
          </span>
        `;
        contenedor.appendChild(div);
      });
    } else {
      contenedor.innerHTML = "<p style='color:#94a3b8; text-align:center;'>Sin registros recientes.</p>";
    }
  } catch (e) {
    console.error("Error cargando historial", e);
  }
}

function iniciarEscannerSalida() {
  const contenedor = document.getElementById("reader");
  if (!contenedor) return;
  contenedor.classList.remove("hidden");

  lectorQr = new Html5Qrcode("reader");
  lectorQr.start(
    { facingMode: "environment" },
    { fps: 10, qrbox: 250 },
    (decodedText) => {
      procesarCodigoEscaneado(decodedText);
      detenerEscannerSalida();
    },
    () => {}
  ).catch(err => {
    alert("Error al iniciar cámara: " + err);
    contenedor.classList.add("hidden");
  });
}

function detenerEscannerSalida() {
  if (lectorQr) {
    lectorQr.stop().then(() => {
      lectorQr.clear();
      lectorQr = null;
      document.getElementById("reader")?.classList.add("hidden");
    }).catch(e => console.error(e));
  }
}

function iniciarEscannerIngreso() {
  const contenedor = document.getElementById("readerIngreso");
  if (!contenedor) return;
  contenedor.classList.remove("hidden");

  lectorQrIngreso = new Html5Qrcode("readerIngreso");
  lectorQrIngreso.start(
    { facingMode: "environment" },
    { fps: 10, qrbox: 250 },
    (decodedText) => {
      detenerEscannerIngreso();
      registrarIngresoUnitario(decodedText.trim());
    },
    () => {}
  ).catch(err => {
    alert("Error al iniciar cámara de ingreso: " + err);
    contenedor.classList.add("hidden");
  });
}

function detenerEscannerIngreso() {
  if (lectorQrIngreso) {
    lectorQrIngreso.stop().then(() => {
      lectorQrIngreso.clear();
      lectorQrIngreso = null;
      document.getElementById("readerIngreso")?.classList.add("hidden");
    }).catch(e => console.error(e));
  }
}

function abrirHistorial() {
  alert("Panel de historial y reportes disponible próximamente.");
}
