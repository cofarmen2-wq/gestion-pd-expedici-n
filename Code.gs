const ID_HOJA_PRINCIPAL = "1P3o496L1TWRfYOOLrF0EZJp_jIxEY_o7TLFLMXRuvbg";
const ID_HOJA_EGRESO = "1LnB7Mjzl0Mfl26WuPAj4lpexibDGIwCy_VNBENt5wlc";

function doGet() {
  return HtmlService.createTemplateFromFile("Index").evaluate().setTitle("Gestión de Mercadería - Puesta a Disposición").addMetaTag("viewport", "width=device-width, initial-scale=1.0");
}

function include(nombreArchivo) {
  return HtmlService.createHtmlOutputFromFile(nombreArchivo).getContent();
}

function obtenerFechaSalidaExterna(codigoDocumento) {
  try {
    const hoja = SpreadsheetApp.openById(ID_HOJA_EGRESO).getSheetByName("Respuestas de formulario 1");
    if (!hoja) return "";
    const datos = hoja.getDataRange().getValues();
    const hoy = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd");
    for (let indice = datos.length - 1; indice >= 1; indice--) {
      const fecha = datos[indice][0];
      if (fecha instanceof Date && String(datos[indice][1]).trim() === String(codigoDocumento).trim() && Utilities.formatDate(fecha, Session.getScriptTimeZone(), "yyyy-MM-dd") === hoy) return Utilities.formatDate(fecha, Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss");
    }
  } catch (error) {
    console.error(error);
  }
  return "";
}

function guardarRegistros(datosFormulario) {
  const hoja = SpreadsheetApp.openById(ID_HOJA_PRINCIPAL).getSheetByName("Hoja 1") || SpreadsheetApp.openById(ID_HOJA_PRINCIPAL).getSheets()[0];
  const fechaRegistro = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss");
  datosFormulario.documentos.forEach(documento => {
    const fechaSalida = obtenerFechaSalidaExterna(documento.codigoDoc);
    const esIngreso = documento.tipoDoc === "INGRESO";
    hoja.appendRow([fechaRegistro, datosFormulario.operario, datosFormulario.ruta, datosFormulario.turno, documento.codigoDoc, documento.tipoDoc, documento.esTransfer ? "SI" : "NO", documento.transferChecklist ? JSON.stringify(documento.transferChecklist) : "-", fechaSalida || "PENDIENTE", esIngreso ? fechaRegistro : "", esIngreso ? "RECEPCIONADO" : "PENDIENTE"]);
  });
  return { status: "OK", count: datosFormulario.documentos.length };
}

function obtenerHistorialReciente() {
  const hoja = SpreadsheetApp.openById(ID_HOJA_PRINCIPAL).getSheetByName("Hoja 1") || SpreadsheetApp.openById(ID_HOJA_PRINCIPAL).getSheets()[0];
  const datos = hoja.getDataRange().getValues();
  const historial = [];
  for (let indice = datos.length - 1; indice >= Math.max(1, datos.length - 20); indice--) historial.push({ fechaHora: datos[indice][0], operario: datos[indice][1], ruta: datos[indice][2], puestaDisposicion: datos[indice][8], recepcion: datos[indice][9] });
  return historial;
}

function verificarAlertasYReporte() {
  const hoja = SpreadsheetApp.openById(ID_HOJA_PRINCIPAL).getSheetByName("Hoja 1") || SpreadsheetApp.openById(ID_HOJA_PRINCIPAL).getSheets()[0];
  const datos = hoja.getDataRange().getValues();
  const ahora = new Date();
  const pendientes = [];
  for (let indice = 1; indice < datos.length; indice++) {
    const fechaBase = new Date(datos[indice][8] && datos[indice][8] !== "PENDIENTE" ? datos[indice][8] : datos[indice][0]);
    if (datos[indice][10] === "PENDIENTE" && ahora - fechaBase >= 48 * 60 * 60 * 1000) pendientes.push(datos[indice][4]);
  }
  return { pendientes48Horas: pendientes };
}

function generarReporteMensual(anio, mes) {
  const hoja = SpreadsheetApp.openById(ID_HOJA_PRINCIPAL).getSheetByName("Hoja 1") || SpreadsheetApp.openById(ID_HOJA_PRINCIPAL).getSheets()[0];
  const datos = hoja.getDataRange().getValues();
  const duraciones = [];
  datos.slice(1).forEach(fila => {
    const salida = new Date(fila[8]);
    const recepcion = new Date(fila[9]);
    if (!isNaN(salida) && !isNaN(recepcion) && salida.getFullYear() === Number(anio) && salida.getMonth() + 1 === Number(mes)) duraciones.push(recepcion - salida);
  });
  const promedioHoras = duraciones.length ? duraciones.reduce((total, valor) => total + valor, 0) / duraciones.length / 3600000 : 0;
  return { anio: Number(anio), mes: Number(mes), registros: duraciones.length, promedioHoras };
}
