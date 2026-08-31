const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyB7yRevFu4p_SlGUL-cWE_jjcgMvU_Fzyk1YJCMk3Agm3D1Atg7sEUSv0qmL1HsENq/exec";

let documentos = [];
let lectorQr = null;
let lectorQrIngreso = null;
let documentoTransferPendiente = null;
let procesandoEscaneo = false;

const rutasPorTurno = {
  MAÑANA: ["Tunuyan-San Carlos", "La Paz", "San Martin-Beltran", "Tupungato", "San Martín", "Rivadavia-Junin", "Maipú", "Lavalle", "San José", "Lujan de Cuyo", "Benegas-L de Cuyo", "Benegas", "Ciudad Norte", "Dorrego", "Godoy Cruz-Ciudad", "Ciudad Oeste", "Villanueva", "Godoy Cruz", "Villanueva-Coquimbito", "Las Heras 1", "Las Heras 2", "Villa Hipodromo", "Ciudad Este"],
  TARDE: ["General Alvear", "Zona sur (Mañana: San Rafael 1; San Rafael 2)", "Tunuyan-San Carlos", "La Paz", "San Martin-Beltran", "Tupungato", "San Martín", "Rivadavia-Junin", "Maipú", "Lavalle", "San José", "Lujan de Cuyo", "Benegas-L de Cuyo", "Benegas", "Ciudad Norte", "Dorrego", "Godoy Cruz-Ciudad", "Ciudad Oeste", "Villanueva", "Godoy Cruz", "Villanueva-Coquimbito", "Las Heras 1", "Las Heras 2", "Villa Hipodromo", "Ciudad Este"],
  NOCHE: ["San Juan", "Zona sur (Noche: San Rafael 1; San Rafael 2; G. Alvear; Malargüe)", "SAN LUIS"],
  "FUERA DE TURNO": []
};

document.addEventListener("DOMContentLoaded", () => {
  inicializarInterfaz();
  cargarHistorialReciente();

  // Listeners de formularios y botones
  document.getElementById("btnVistaLote")?.addEventListener("click", () => cambiarVista("lote"));
  document.getElementById("btnVistaIngreso")?.addEventListener("click", () => cambiarVista("ingreso"));
  document.getElementById("turnoSelect")?.addEventListener("change", actualizarRutasPorTurno);
  
  document.getElementById("mainForm")?.addEventListener("submit", (e) => {
    e.preventDefault();
    enviarLote();
  });

  document.getElementById("btnToggleCamara")?.addEventListener("click", () => {
    if (lectorQr) detenerEscannerSalida();
    else iniciarEscannerSalida();
  });

  document.getElementById("btnToggleCamaraIngreso")?.addEventListener("click", () => {
    if (lectorQrIngreso) detenerEscannerIngreso();
    else iniciarEscannerIngreso();
  });
});

// --- LÓGICA DE TURNO E INTERFAZ ---

function obtenerTurno(fecha = new Date()) {
  const minutos = fecha.getHours() * 60 + fecha.getMinutes();
  if (minutos >= 390 && minutos <= 720) return "MAÑANA";
  if (minutos >= 721 && minutos <= 1260) return "TARDE";
  if (minutos >= 1261) return "NOCHE";
  return "FUERA DE TURNO";
}

function inicializarInterfaz() {
  const turnoActual = obtenerTurno();
  const selectTurno = document.getElementById("turnoSelect");
  const badgeTurno = document.getElementById("turnoBadge") || document.getElementById("turnoTexto");

  if (selectTurno) {
    selectTurno.value = turnoActual;
    actualizarRutasPorTurno();
  }
  if (badgeTurno) {
    badgeTurno.textContent = `TURNO ${turnoActual}`;
  }
}

function cambiarVista(vista) {
  const secLote = document.getElementById("seccionLote");
  const secIngreso = document.getElementById("seccionIngreso");
  const btnLote = document.getElementById("btnVistaLote");
  const btnIngreso = document.getElementById("btnVistaIngreso");

  if (vista === "lote") {
    secLote?.classList.remove("hidden");
    secIngreso?.classList.add("hidden");
    btnLote?.classList.add("active");
    btnIngreso?.classList.remove("active");
    detenerEscannerIngreso();
  } else {
    secLote?.classList.add("hidden");
    secIngreso?.classList.remove("hidden");
    btnLote?.classList.remove("active");
    btnIngreso?.classList.add("active");
    detenerEscannerSalida();
    cargarHistorialReciente();
  }
}

function actualizarRutasPorTurno() {
  const selectTurno = document.getElementById("turnoSelect");
  const selectRuta = document.getElementById("rutaSelect") || document.getElementById("ruta");
  if (!selectRuta || !selectTurno) return;

  selectRuta.innerHTML = '<option value="" disabled selected>Seleccione ruta...</option>';
  const turno = selectTurno.value;
  const rutas = rutasPorTurno[turno] || [];
  
  rutas.forEach(ruta => {
    const opt = document.createElement("option");
    opt.value = ruta;
    opt.textContent = ruta;
    selectRuta.appendChild(opt);
  });
}

function mostrarLoading(mostrar, texto = "Procesando, por favor espere...") {
  const overlay = document.getElementById("loadingOverlay");
  const txt = document.getElementById("loadingText");
  if (txt) txt.textContent = texto;
  if (overlay) {
    if (mostrar) overlay.classList.remove("hidden");
    else overlay.classList.add("hidden");
  }
}

// --- ESCANEO Y GESTIÓN DE DOCUMENTOS ---

function agregarDocumentoManual() {
  const input = document.getElementById("codigoInput");
  if (!input) return;
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

  const tipoInput = document.querySelector("input[name='tipoDoc']:checked");
  const tipoDoc = tipoInput ? tipoInput.value : (codigo.toUpperCase().startsWith("F") ? "FACTURA" : "REMITO");
  const esTransferCheck = document.getElementById("checkEsTransfer") || document.getElementById("checkTransfer");
  const esTransfer = esTransferCheck?.checked || codigo.toUpperCase().includes("TR");

  const nuevoDoc = {
    codigoDoc: codigo,
    tipoDoc: tipoDoc,
    esTransfer: esTransfer,
    transferChecklist: null
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
  const lista = document.getElementById("listaDocumentos") || document.getElementById("listaDocs");
  const contador = document.getElementById("contadorDocs") || document.getElementById("countDocs");
  if (!lista) return;

  lista.replaceChildren();
  documentos.forEach((doc, index) => {
    const li = document.createElement("li");
    li.className = "doc-item";
    li.innerHTML = `
      <span><strong>${doc.codigoDoc}</strong> (${doc.tipoDoc}) ${doc.esTransfer ? '⭐ Transfer' : ''}</span>
      <button type="button" class="btn-close" style="background:none; border:none; color:#f87171; cursor:pointer;" onclick="eliminarDocumento(${index})">✕</button>
    `;
    lista.appendChild(li);
  });

  if (contador) contador.textContent = documentos.length;
}

function eliminarDocumento(index) {
  documentos.splice(index, 1);
  actualizarListaDocumentos();
}

// --- MODAL TRANSFERENCIA ---

function abrirModalTransferencia(codigo) {
  const modal = document.getElementById("modalTransfer");
  const label = document.getElementById("transferDocLabel") || document.getElementById("modalDocCode");
  if (modal) {
    if (label) label.textContent = `Documento: ${codigo}`;
    modal.classList.remove("hidden");
  }
}

function cerrarModalTransferencia(confirmado) {
  const modal = document.getElementById("modalTransfer");
  if (modal) modal.classList.add("hidden");

  if (confirmado && documentoTransferPendiente) {
    const chk1 = document.getElementById("chk1")?.value || "SI";
    const chk2 = document.getElementById("chk2")?.value || "OK";
    const chk3 = document.getElementById("chk3")?.value || "SI";

    documentoTransferPendiente.transferChecklist = { firmaSello: chk1, estadoCarga: chk2, precinto: chk3 };
    documentos.push(documentoTransferPendiente);
    actualizarListaDocumentos();
  }
  
  documentoTransferPendiente = null;
  const chk = document.getElementById("checkEsTransfer") || document.getElementById("checkTransfer");
  if (chk) chk.checked = false;
}

function confirmarTransfer() {
  cerrarModalTransferencia(true);
}

// --- PETICIONES HTTP / RED ---

async function enviarLote() {
  const operario = (document.getElementById("operarioInput") || document.getElementById("operario"))?.value.trim();
  const ruta = (document.getElementById("rutaSelect") || document.getElementById("ruta"))?.value;
  const turno = document.getElementById("turnoSelect")?.value || obtenerTurno();

  if (!operario) { alert("Seleccione el operario."); return; }
  if (!ruta) { alert("Seleccione la ruta."); return; }
  if (documentos.length === 0) { alert("Escanee al menos un documento."); return; }

  mostrarLoading(true, "Guardando lote en Google Sheets...");

  try {
    const response = await fetch(SCRIPT_URL, {
      method: "POST",
      body: JSON.stringify({ accion: "guardarRegistros", operario, ruta, turno, documentos })
    });
    const resultado = await response.json();
    mostrarLoading(false);

    if (resultado.status === "OK") {
      alert(`¡Lote guardado con éxito! Documentos registrados: ${resultado.count}`);
      documentos = [];
      actualizarListaDocumentos();
      cargarHistorialReciente();
    } else {
      alert("Error: " + (resultado.message || "No se pudo completar el registro"));
    }
  } catch (error) {
    mostrarLoading(false);
    alert("Error de conexión: " + error.toString());
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
      const campoIngreso = document.getElementById("codigoIngresoInput");
      if (campoIngreso) {
        campoIngreso.value = "";
        campoIngreso.focus();
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
    const contenedor = document.getElementById("historialRecienteLista") || document.getElementById("historialContent");
    if (!contenedor) return;

    contenedor.innerHTML = "";
    if (Array.isArray(historial) && historial.length > 0) {
      historial.forEach(item => {
        const div = document.createElement("div");
        div.className = "history-card";
        div.innerHTML = `
          <strong>Doc: ${item.doc || item.codigoDoc}</strong> | Ruta: ${item.ruta}<br>
          <small>Operario: ${item.operario} (${item.fechaHora || item.puestaDisposicion || ''})</small><br>
          <span style="color: ${item.recepcion === 'RECEPCIONADO' ? '#4ade80' : '#facc15'}">
            Estado: ${item.recepcion || 'Pendiente'}
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

// --- CAMARA Y LECTOR QR (Html5Qrcode) ---

function iniciarEscannerSalida() {
  const contenedor = document.getElementById("reader") || document.getElementById("reader-container");
  const boton = document.getElementById("btnToggleCamara");
  if (!contenedor) return;

  contenedor.classList.remove("hidden");
  if (boton) boton.textContent = "Detener Escáner QR";

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
    if (boton) boton.textContent = "📷 Iniciar Escáner QR";
  });
}

function detenerEscannerSalida() {
  if (lectorQr) {
    lectorQr.stop().then(() => {
      lectorQr.clear();
      lectorQr = null;
      const contenedor = document.getElementById("reader") || document.getElementById("reader-container");
      const boton = document.getElementById("btnToggleCamara");
      if (contenedor) contenedor.classList.add("hidden");
      if (boton) boton.textContent = "📷 Iniciar Escáner QR";
    }).catch(e => console.error(e));
  }
}

function iniciarEscannerIngreso() {
  const contenedor = document.getElementById("readerIngreso");
  const boton = document.getElementById("btnToggleCamaraIngreso");
  if (!contenedor) return;

  contenedor.classList.remove("hidden");
  if (boton) boton.textContent = "Detener Cámara Ingreso";

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
    if (boton) boton.textContent = "📷 Escanear Ingreso";
  });
}

function detenerEscannerIngreso() {
  if (lectorQrIngreso) {
    lectorQrIngreso.stop().then(() => {
      lectorQrIngreso.clear();
      lectorQrIngreso = null;
      const contenedor = document.getElementById("readerIngreso");
      const boton = document.getElementById("btnToggleCamaraIngreso");
      if (contenedor) contenedor.classList.add("hidden");
      if (boton) boton.textContent = "📷 Escanear Ingreso";
    }).catch(e => console.error(e));
  }
}

// --- DRAWER / HISTORIAL LATERAL ---

function abrirHistorial() {
  const drawer = document.getElementById("drawer");
  const backdrop = document.getElementById("drawerBackdrop");
  if (drawer && backdrop) {
    drawer.classList.remove("hidden");
    backdrop.classList.remove("hidden");
    cargarHistorialReciente();
  }
}

function cerrarHistorial() {
  const drawer = document.getElementById("drawer");
  const backdrop = document.getElementById("drawerBackdrop");
  if (drawer && backdrop) {
    drawer.classList.add("hidden");
    backdrop.classList.add("hidden");
  }
}
