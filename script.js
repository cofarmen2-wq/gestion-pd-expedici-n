const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyB7yRevFu4p_SLgUL-cWE_jjcgMqvU_FzyK1YJCmK3Agm3D1Atg7sEUSv0qmLKlHseNQ/exec";
const documentos = [];
let lectorQr = null;
let lectorQrIngreso = null; 
let documentoTransferPendiente = null;
let pausadoEscaneo = false;
let pausadoEscaneoIngreso = false;

const rutasPorTurno = {
  MAÑANA: ["Tunuyan-San Carlos", "La Paz", "San Martin-Beltran", "Tupungato", "San Martín", "Rivadavia-Junin", "Maipú", "Lavalle", "San José", "Lujan de Cuyo", "Benegas-L de Cuyo", "Benegas", "Ciudad Norte", "Dorrego", "Godoy Cruz-Ciudad", "Ciudad Oeste", "Villanueva", "Godoy Cruz", "Villanueva-Coquimbito", "Las Heras 1", "Las Heras 2", "Villa Hipodromo", "Ciudad Este"], 
  TARDE: ["General Alvear", "Zona sur (Mañana: San Rafael 1; San Rafael 2)", "Tunuyan-San Carlos", "La Paz", "San Martin-Beltran", "Tupungato", "San Martín", "Rivadavia-Junin", "Maipú", "Lavalle", "San José", "Lujan de Cuyo", "Benegas-L de Cuyo", "Benegas", "Ciudad Norte", "Dorrego", "Godoy Cruz-Ciudad", "Ciudad Oeste", "Villanueva", "Godoy Cruz", "Villanueva-Coquimbito", "Las Heras 1", "Las Heras 2", "Villa Hipodromo", "Ciudad Este"], 
  NOCHE: ["San Juan", "Zona sur (Noche: San Rafael 1; San Rafael 2; G. Alvear; Malargüe)", "SAN LUIS"], 
  FUERA DE TURNO: ["Tunuyan-San Carlos", "La Paz", "San Martin-Beltran", "Tupungato", "San Martín", "Rivadavia-Junin", "Maipú", "Lavalle", "San José", "Lujan de Cuyo", "Benegas-L de Cuyo", "Benegas", "Ciudad Norte", "Dorrego", "Godoy Cruz-Ciudad", "Ciudad Oeste", "Villanueva", "Godoy Cruz", "Villanueva-Coquimbito", "Las Heras 1", "Las Heras 2", "Villa Hipodromo", "Ciudad Este", "San Juan", "SAN LUIS", "General Alvear"] 
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
  
  selectorRuta.innerHTML = '<option value="" disabled selected>Seleccione ruta...</option>';
  
  const listaRutas = rutasPorTurno[turno] || rutasPorTurno["FUERA DE TURNO"];
  if (listaRutas) {
    listaRutas.forEach(ruta => {
      const opt = document.createElement("option");
      opt.value = ruta;
      opt.textContent = ruta;
      selectorRuta.appendChild(opt);
    }); 
  } 
}

function cambiarVista(tipo) {
  const vSalida = document.getElementById("vistaSalida"); 
  const vIngreso = document.getElementById("vistaIngreso"); 
  const btnReg = document.getElementById("btnMenuRegistro"); 
  const btnRec = document.getElementById("btnMenuRecepcion"); 

  if (lectorQr) {
    lectorQr.stop().then(() => lectorQr.clear()).catch(() => {}); 
    lectorQr = null; 
    document.getElementById("reader-container")?.classList.add("hidden"); 
    const btnCam = document.getElementById("btnToggleCamara"); 
    if (btnCam) btnCam.textContent = "📷 Iniciar Escáner QR"; 
  } 

  if (lectorQrIngreso) {
    lectorQrIngreso.stop().then(() => lectorQrIngreso.clear()).catch(() => {}); 
    lectorQrIngreso = null; 
    document.getElementById("reader-container-ingreso")?.classList.add("hidden"); 
    const btnCamIng = document.getElementById("btnToggleCamaraIngreso"); 
    if (btnCamIng) btnCamIng.textContent = "📷 Iniciar Escáner QR (Ingreso)"; 
  } 

  if (!vSalida || !vIngreso) return; 

  if (tipo === 'salida') {
    vSalida.classList.remove("hidden"); 
    vIngreso.classList.add("hidden"); 
    if (btnReg) btnReg.style.backgroundColor = "#0284c7"; 
    if (btnRec) btnRec.style.backgroundColor = "#334155"; 
  } else {
    vSalida.classList.add("hidden"); 
    vIngreso.classList.remove("hidden"); 
    if (btnRec) btnRec.style.backgroundColor = "#0284c7"; 
    if (btnReg) btnReg.style.backgroundColor = "#334155"; 
  }
}

function toggleCamara() {
  const container = document.getElementById("reader-container");
  const btn = document.getElementById("btnToggleCamara");
  if (!container || !btn) return;

  if (lectorQr) {
    lectorQr.stop().then(() => {
      lectorQr.clear();
      lectorQr = null;
      container.classList.add("hidden");
      btn.textContent = "📷 Iniciar Escáner QR";
    }).catch(() => {});
    return;
  }

  container.classList.remove("hidden");
  btn.textContent = "Detener Cámara";
  lectorQr = new Html5Qrcode("reader");
  lectorQr.start(
    { facingMode: "environment" },
    { fps: 10, qrbox: { width: 250, height: 250 } },
    (decodedText) => { agregarDocumento(decodedText); },
    () => {}
  ).catch(() => {
    container.classList.add("hidden");
    btn.textContent = "📷 Iniciar Escáner QR";
    alert("No se pudo acceder a la cámara.");
    lectorQr = null;
  });
}

function toggleCamaraIngreso() {
  const container = document.getElementById("reader-container-ingreso");
  const btn = document.getElementById("btnToggleCamaraIngreso");
  if (!container || !btn) return;

  if (lectorQrIngreso) {
    lectorQrIngreso.stop().then(() => {
      lectorQrIngreso.clear();
      lectorQrIngreso = null;
      container.classList.add("hidden");
      btn.textContent = "📷 Iniciar Escáner QR (Ingreso)";
    }).catch(() => {});
    return;
  }

  container.classList.remove("hidden");
  btn.textContent = "Detener Cámara";
  lectorQrIngreso = new Html5Qrcode("reader-ingreso");
  lectorQrIngreso.start(
    { facingMode: "environment" },
    { fps: 10, qrbox: { width: 250, height: 250 } },
    (decodedText) => {
      const input = document.getElementById("inputCodigoIngreso");
      if (input) input.value = decodedText;
      enviarIngresoUnico(decodedText);
    },
    () => {}
  ).catch(() => {
    container.classList.add("hidden");
    btn.textContent = "📷 Iniciar Escáner QR (Ingreso)";
    alert("No se pudo acceder a la cámara.");
    lectorQrIngreso = null;
  });
}

function agregarDocumento(codigoDoc) {
  if (pausadoEscaneo) return;
  const codigo = String(codigoDoc || "").trim();
  if (!codigo) return;

  if (documentos.some(doc => doc.codigoDoc === codigo)) {
    alert(`El documento ${codigo} ya fue escaneado en este lote.`);
    const inputManual = document.getElementById("inputManualDoc");
    if (inputManual) { inputManual.value = ""; inputManual.focus(); }
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
    document.getElementById("modalTransfer")?.classList.remove("hidden");
    document.getElementById("modalBackdrop")?.classList.remove("hidden");
    return;
  }

  documentos.push(documento);
  renderizarDocumentos();
  
  const inputManual = document.getElementById("inputManualDoc");
  if (inputManual) { inputManual.value = ""; inputManual.focus(); }
}

function confirmarTransfer() {
  if (!documentoTransferPendiente) return;
  documentoTransferPendiente.transferChecklist = {
    factura: document.getElementById("checkFactura")?.value || "OK",
    troquel: document.getElementById("checkTroquel")?.value || "OK",
    temperatura: document.getElementById("checkTemperatura")?.value || "OK"
  };
  documentos.push(documentoTransferPendiente);
  documentoTransferPendiente = null;
  cerrarModalTransfer();
  renderizarDocumentos();
  const inputManual = document.getElementById("inputManualDoc");
  if (inputManual) { inputManual.value = ""; inputManual.focus(); }
}

function cerrarModalTransfer() {
  document.getElementById("modalTransfer")?.classList.add("hidden");
  document.getElementById("modalBackdrop")?.classList.add("hidden");
  documentoTransferPendiente = null;
}

function renderizarDocumentos() {
  const lista = document.getElementById("listaDocumentos");
  const contador = document.getElementById("contadorDocumentos");
  if (contador) contador.textContent = documentos.length;
  if (!lista) return;

  lista.replaceChildren();
  documentos.forEach((doc, index) => {
    const li = document.createElement("li");
    li.className = "doc-item";

    const spanInfo = document.createElement("span");
    let texto = `${index + 1}. [${doc.tipoDoc}] ${doc.codigoDoc}`;
    if (doc.esTransfer) texto += " (TRANSFER)";
    spanInfo.textContent = texto;

    const btnDel = document.createElement("button");
    btnDel.className = "btn-close";
    btnDel.textContent = "✕";
    btnDel.onclick = () => { documentos.splice(index, 1); renderizarDocumentos(); };

    li.appendChild(spanInfo);
    li.appendChild(btnDel);
    lista.appendChild(li);
  });
}

function enviarLote() {
  const operario = document.getElementById("operario")?.value.trim();
  const ruta = document.getElementById("ruta")?.value;
  const turno = obtenerTurno();

  if (!operario) { alert("Debe ingresar el nombre del operario."); return; }
  if (!ruta) { alert("Debe seleccionar una ruta."); return; }
  if (documentos.length === 0) { alert("Debe escanear al menos un documento."); return; }

  mostrarLoading("Guardando lote de documentos...");

  const payload = {
    accion: "guardarRegistros",
    operario: operario,
    ruta: ruta,
    turno: turno,
    documentos: documentos
  };

  fetch(SCRIPT_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(payload)
  })
  .then(res => res.json())
  .then(response => {
    ocultarLoading();
    if (response && response.status === "OK") {
      alert(`¡Lote guardado con éxito! Se registraron ${response.count} documentos.`);
      documentos.length = 0;
      renderizarDocumentos();
      const inputManual = document.getElementById("inputManualDoc");
      if (inputManual) inputManual.value = "";
    } else {
      alert("Error al guardar: " + (response?.message || "Desconocido"));
    }
  })
  .catch(err => {
    ocultarLoading();
    alert("Error de conexión al guardar el lote.");
  });
}

function enviarIngresoUnico(codigo) {
  const codigoLimpio = String(codigo || "").trim();
  const msgDiv = document.getElementById("resultadoIngresoMsg");
  if (!codigoLimpio) return;

  mostrarLoading("Verificando documento...");

  fetch(SCRIPT_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ accion: "registrarIngresoUnico", codigoDoc: codigoLimpio })
  })
  .then(res => res.json())
  .then(response => {
    ocultarLoading();
    
    if (msgDiv) {
      if (response && response.status === "ERROR") {
        msgDiv.style.color = "#ef4444";
        msgDiv.textContent = response.message;
      } else {
        msgDiv.style.color = "#22c55e";
        msgDiv.textContent = response.message || `¡Éxito! Documento registrado correctamente.`;
      }
    }

    if (response && response.status === "ERROR") {
      alert(response.message);
    }
    
    const inputIngreso = document.getElementById("inputCodigoIngreso");
    if (inputIngreso) {
      inputIngreso.value = "";
      inputIngreso.focus();
    }
  })
  .catch(err => {
    ocultarLoading();
    if (msgDiv) {
      msgDiv.style.color = "#ef4444";
      msgDiv.textContent = `Error de conexión con el servidor.`;
    }
    alert("Error de conexión al verificar el documento.");
  });
}

function abrirHistorialDrawer() {
  document.getElementById("historialDrawer")?.style.setProperty("right", "0");
  document.getElementById("drawerBackdrop")?.classList.remove("hidden");
  
  const body = document.getElementById("drawerBody");
  if (body) body.innerHTML = '<p style="color: #94a3b8; text-align: center; font-size: 0.9rem;">Cargando historial...</p>';

  fetch(`${SCRIPT_URL}?accion=obtenerHistorialReciente`)
    .then(res => res.json())
    .then(data => {
      if (!body) return;
      body.replaceChildren();

      if (Array.isArray(data) && data.length > 0) {
        data.forEach(item => {
          const card = document.createElement("div");
          card.className = "history-card";
          card.innerHTML = `<strong>${item.doc}</strong><br><span style="color: #94a3b8;">${item.fechaHora} - ${item.recepcion}</span>`;
          body.appendChild(card);
        });
      } else {
        body.innerHTML = '<p style="color: #94a3b8; text-align: center; font-size: 0.9rem;">No hay registros recientes.</p>';
      }
    })
    .catch(() => {
      if (body) body.innerHTML = '<p style="color: #ef4444; text-align: center; font-size: 0.9rem;">Error al cargar historial.</p>';
    });
}

function cerrarHistorialDrawer() {
  document.getElementById("historialDrawer")?.style.setProperty("right", "-350px");
  document.getElementById("drawerBackdrop")?.classList.add("hidden");
}

document.addEventListener("DOMContentLoaded", () => {
  actualizarRutas();

  const inputManual = document.getElementById("inputManualDoc");
  if (inputManual) {
    inputManual.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        agregarDocumento(inputManual.value);
      }
    });
  }

  const inputIngreso = document.getElementById("inputCodigoIngreso");
  if (inputIngreso) {
    inputIngreso.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        enviarIngresoUnico(inputIngreso.value);
      }
    });
  }
});
