// IMPORTAR FIREBASE (Versión 10.7.1)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, doc, updateDoc, arrayUnion, query, where, orderBy } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// CONFIGURACIÓN (Tu config)
const firebaseConfig = {
  apiKey: "AIzaSyDdzCiachuhbE9jATz-TesPI2vUVIJrHjM",
  authDomain: "sistemadegestion-7400d.firebaseapp.com",
  projectId: "sistemadegestion-7400d",
  storageBucket: "sistemadegestion-7400d.appspot.com",
  messagingSenderId: "709030283072",
  appId: "1:709030283072:web:5997837b36a448e9515ca5"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// ESTADO GLOBAL
let currentUser = null;
let currentSignId = null; // ID de solicitud a firmar

// --- CLOUDINARY (Subida de archivos) ---
async function uploadFile(file) {
  const url = "https://api.cloudinary.com/v1_1/df79cjklp/upload";
  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", "fci_documentos");
  try {
    const res = await fetch(url, { method: "POST", body: formData });
    const data = await res.json();
    return data.secure_url;
  } catch (e) {
    console.error("Error subida:", e);
    return null;
  }
}

// --- SISTEMA DE NOTIFICACIONES ---
const btnNotif = document.getElementById("btnNotif");

btnNotif.onclick = () => {
  if (!("Notification" in window)) {
    alert("Este navegador no soporta notificaciones de escritorio");
  } else if (Notification.permission === "granted") {
    new Notification("Sistema SGC", { body: "Las notificaciones ya están activas." });
  } else if (Notification.permission !== "denied") {
    Notification.requestPermission().then(permission => {
      if (permission === "granted") {
        new Notification("Sistema SGC", { body: "¡Notificaciones activadas!" });
      }
    });
  }
};

function sendSystemNotification(title, body) {
  if (Notification.permission === "granted") {
    new Notification(title, { body, icon: 'https://cdn-icons-png.flaticon.com/512/1042/1042390.png' });
  }
  // Aquí podríamos añadir lógica para guardar en base de datos una colección "Notificaciones"
}

// --- AUTENTICACIÓN Y ROLES ---
document.getElementById("btnLogin").onclick = async () => {
  const u = document.getElementById("loginUser").value;
  const p = document.getElementById("loginPass").value;

  // 1. Admin Hardcoded (Backup)
  if (u === "Admin" && p === "1130") {
    loginSuccess({ usuario: "Admin", role: "admin" });
    return;
  }

  // 2. Buscar en Firebase
  const q = query(collection(db, "Usuarios"), where("usuario", "==", u), where("pass", "==", p));
  const snapshot = await getDocs(q);

  if (!snapshot.empty) {
    loginSuccess(snapshot.docs[0].data());
  } else {
    document.getElementById("loginMsg").innerText = "Credenciales inválidas";
  }
};

function loginSuccess(user) {
  currentUser = user;
  document.getElementById("loginScreen").classList.add("hide");
  document.getElementById("dashboard").classList.remove("hide");
  
  document.getElementById("userLogged").innerText = user.usuario;
  document.getElementById("userRoleDisplay").innerText = user.role.toUpperCase();

  // Mostrar elementos solo para admin
  const adminElements = document.querySelectorAll(".admin-only");
  adminElements.forEach(el => el.style.display = user.role === 'admin' ? 'block' : 'none');

  loadDashboardData();
}

document.getElementById("btnLogout").onclick = () => location.reload();

// --- GESTIÓN DOCUMENTAL ---

// UI Toggle
window.toggleForm = (id) => {
  document.getElementById(id).classList.toggle("hide");
};

// Toggle fecha ultima versión
document.getElementById("solAccion").onchange = (e) => {
  const isMod = e.target.value === "Modificación";
  const dateInput = document.getElementById("solLastDate");
  dateInput.disabled = !isMod;
  if(!isMod) dateInput.value = "";
};

// Crear Solicitud
window.crearSolicitud = async () => {
  const title = document.getElementById("solTitle").value;
  const tipo = document.getElementById("solTipo").value;
  const accion = document.getElementById("solAccion").value;
  const version = document.getElementById("solVersion").value;
  const lastDate = document.getElementById("solLastDate").value; // ISO Date string
  const desc = document.getElementById("solDesc").value;
  const fileInput = document.getElementById("solFile").files[0];

  if (!title || !tipo || !accion) return alert("Complete los campos obligatorios");

  let fileUrl = "#";
  if (fileInput) {
    fileUrl = await uploadFile(fileInput);
  }

  const newDoc = {
    title, tipo, accion, version, desc, fileUrl,
    ultimaFechaVersion: lastDate || "N/A",
    estado: "Pendiente",
    createdBy: currentUser.usuario,
    createdAt: new Date().toISOString(),
    historial: [{ 
      accion: "Solicitud Creada", 
      user: currentUser.usuario, 
      fecha: new Date().toISOString() 
    }]
  };

  await addDoc(collection(db, "Solicitudes"), newDoc);
  
  // Notificar
  sendSystemNotification("Nueva Solicitud ISO", `${currentUser.usuario} ha solicitado ${accion} de ${title}`);
  
  toggleForm('solFormContainer');
  loadDashboardData();
};

// Cargar Datos
async function loadDashboardData() {
  const list = document.getElementById("solList");
  const historial = document.getElementById("historialList");
  list.innerHTML = "";
  historial.innerHTML = "";

  // Query básica (mejorar con índices compuestos luego)
  const q = query(collection(db, "Solicitudes"), orderBy("createdAt", "desc"));
  const snapshot = await getDocs(q);

  let stats = { total: 0, pending: 0, approved: 0 };

  snapshot.forEach(docu => {
    const data = docu.data();
    
    // Filtrado de seguridad visual (El admin ve todo, usuario solo lo suyo)
    if (currentUser.role !== 'admin' && data.createdBy !== currentUser.usuario) return;

    // Stats
    stats.total++;
    if (data.estado === "Pendiente") stats.pending++;
    if (data.estado === "Aprobado") stats.approved++;

    // Render Lista Documentos
    const div = document.createElement("div");
    div.className = "item";
    div.innerHTML = `
      <div>
        <strong>${data.title}</strong> <span class="badge ${data.estado}">${data.estado}</span>
        <br>
        <small>${data.tipo} v${data.version} | ${data.accion} | Última Ver: ${data.ultimaFechaVersion}</small>
      </div>
      <div>
        ${data.fileUrl !== '#' ? `<a href="${data.fileUrl}" target="_blank" class="btn-text">Ver Doc</a>` : ''}
        
        ${currentUser.role === 'admin' && data.estado === 'Pendiente' ? 
          `<button class="btn-primary" onclick="abrirFirma('${docu.id}')">Aprobar</button>
           <button class="btn-outline" style="color:red; border-color:red" onclick="rechazar('${docu.id}')">Rechazar</button>` 
          : ''}
      </div>
    `;
    list.appendChild(div);

    // Render Historial (Audit Trail)
    historial.innerHTML += `
      <div class="historial-item" style="padding: 10px; border-bottom: 1px solid #eee;">
        <small>${new Date(data.createdAt).toLocaleDateString()}</small><br>
        <b>${data.accion}</b> - ${data.title} (${data.createdBy})
      </div>
    `;
  });

  // Update Stats UI
  document.getElementById("statTotal").innerText = stats.total;
  document.getElementById("statPendientes").innerText = stats.pending;
  document.getElementById("statAprobados").innerText = stats.approved;
}

// --- LÓGICA DE FIRMA ELECTRÓNICA (CANVAS) ---
const modalFirma = document.getElementById("modalFirma");
const canvas = document.getElementById("signaturePad");
const ctx = canvas.getContext("2d");
let drawing = false;

// Eventos de dibujo (Mouse y Touch)
const startDraw = (e) => { drawing = true; ctx.beginPath(); ctx.moveTo(getPosition(e).x, getPosition(e).y); };
const endDraw = () => { drawing = false; };
const draw = (e) => {
  if (!drawing) return;
  e.preventDefault();
  ctx.lineTo(getPosition(e).x, getPosition(e).y);
  ctx.stroke();
};

function getPosition(e) {
  const rect = canvas.getBoundingClientRect();
  const clientX = e.touches ? e.touches[0].clientX : e.clientX;
  const clientY = e.touches ? e.touches[0].clientY : e.clientY;
  return { x: clientX - rect.left, y: clientY - rect.top };
}

canvas.addEventListener("mousedown", startDraw);
canvas.addEventListener("mouseup", endDraw);
canvas.addEventListener("mousemove", draw);
canvas.addEventListener("touchstart", startDraw);
canvas.addEventListener("touchend", endDraw);
canvas.addEventListener("touchmove", draw);

document.getElementById("btnClearSign").onclick = () => ctx.clearRect(0, 0, canvas.width, canvas.height);
window.closeModalFirma = () => modalFirma.classList.add("hide");

// Abrir Modal
window.abrirFirma = (id) => {
  currentSignId = id;
  ctx.clearRect(0, 0, canvas.width, canvas.height); // Limpiar canvas previo
  modalFirma.classList.remove("hide");
};

// Confirmar Firma y Aprobar
document.getElementById("btnConfirmSign").onclick = async () => {
  if (!currentSignId) return;
  
  // Convertir firma a imagen Base64
  const firmaImg = canvas.toDataURL("image/png");

  const ref = doc(db, "Solicitudes", currentSignId);
  await updateDoc(ref, {
    estado: "Aprobado",
    firmaAdmin: firmaImg, // Guardamos la firma visual
    fechaAprobacion: new Date().toISOString(),
    historial: arrayUnion({
      accion: "Aprobado y Firmado",
      user: currentUser.usuario,
      fecha: new Date().toISOString()
    })
  });

  sendSystemNotification("Documento Aprobado", "El documento ha sido firmado y aprobado por la administración.");
  closeModalFirma();
  loadDashboardData();
};

window.rechazar = async (id) => {
  if(!confirm("¿Rechazar solicitud?")) return;
  const ref = doc(db, "Solicitudes", id);
  await updateDoc(ref, {
    estado: "Rechazado",
    historial: arrayUnion({ accion: "Rechazado", user: currentUser.usuario, fecha: new Date().toISOString() })
  });
  loadDashboardData();
};

// Pestañas
document.querySelectorAll(".tabBtn").forEach(btn => {
  btn.onclick = () => {
    document.querySelectorAll(".tabBtn").forEach(b => b.classList.remove("active"));
    document.querySelectorAll(".tabContent").forEach(c => c.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById(btn.dataset.tab).classList.add("active");
  }
});
