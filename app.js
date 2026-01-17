import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, doc, updateDoc, arrayUnion, query, where, orderBy, onSnapshot } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// --- CONFIGURACIÓN FIREBASE ---
const firebaseConfig = {
  apiKey: "AIzaSyDdzCiachuhbE9jATz-TesPI2vUVIJrHjM", // Tu API Key
  authDomain: "sistemadegestion-7400d.firebaseapp.com",
  projectId: "sistemadegestion-7400d",
  storageBucket: "sistemadegestion-7400d.appspot.com",
  messagingSenderId: "709030283072",
  appId: "1:709030283072:web:5997837b36a448e9515ca5"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// --- ESTADO Y UI HELPERS ---
let currentUser = null;
let currentSignId = null;
let allDocs = []; // Para búsqueda local

const showLoader = (show) => document.getElementById("globalLoader").classList.toggle("hide", !show);
const notify = (msg, type = 'info') => {
    let color = type === 'success' ? '#10b981' : (type === 'error' ? '#ef4444' : '#2563eb');
    Toastify({ text: msg, duration: 3000, backgroundColor: color, gravity: "bottom", position: "right" }).showToast();
};

// --- AUTHENTICATION ---
document.getElementById("btnLogin").onclick = async () => {
    const u = document.getElementById("loginUser").value;
    const p = document.getElementById("loginPass").value;
    
    if(!u || !p) return notify("Ingrese credenciales", "error");
    showLoader(true);

    try {
        let userFound = null;
        // Check Hardcoded Admin first
        if(u === "Admin" && p === "1130") userFound = { usuario: "Admin", role: "admin" };
        else {
            const q = query(collection(db, "Usuarios"), where("usuario", "==", u), where("pass", "==", p));
            const snap = await getDocs(q);
            if(!snap.empty) userFound = snap.docs[0].data();
        }

        if(userFound) {
            currentUser = userFound;
            initDashboard();
        } else {
            notify("Credenciales incorrectas", "error");
        }
    } catch (e) {
        console.error(e);
        notify("Error de conexión", "error");
    } finally {
        showLoader(false);
    }
};

document.getElementById("btnLogout").onclick = () => window.location.reload();

function initDashboard() {
    document.getElementById("loginScreen").classList.add("hide");
    document.getElementById("dashboard").classList.remove("hide");
    
    // Set UI User Info
    document.getElementById("userLogged").innerText = currentUser.usuario;
    document.getElementById("userAvatar").innerText = currentUser.usuario.charAt(0).toUpperCase();
    document.getElementById("userRoleDisplay").innerText = currentUser.role === 'admin' ? 'ADMINISTRADOR' : 'USUARIO';

    // Show/Hide Admin Tabs
    document.querySelectorAll(".admin-only").forEach(el => el.style.display = currentUser.role === 'admin' ? 'block' : 'none');

    // Load Data
    loadDataRealtime();
}

// --- DATA & REALTIME DASHBOARD ---
function loadDataRealtime() {
    const q = query(collection(db, "Solicitudes"), orderBy("createdAt", "desc"));
    
    // Listener en tiempo real (Snapshot)
    onSnapshot(q, (snapshot) => {
        allDocs = [];
        let stats = { total: 0, pending: 0, approved: 0 };
        const tbody = document.getElementById("solTableBody");
        const timeline = document.getElementById("historialList");
        
        tbody.innerHTML = "";
        timeline.innerHTML = "";

        snapshot.forEach(docSnap => {
            const data = docSnap.data();
            const id = docSnap.id;
            
            // Filtro de seguridad por Rol
            if(currentUser.role !== 'admin' && data.createdBy !== currentUser.usuario) return;

            allDocs.push({ id, ...data });

            // Stats
            stats.total++;
            if(data.estado === "Pendiente") stats.pending++;
            if(data.estado === "Aprobado") stats.approved++;

            // Render Tabla
            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td>
                    <b>${data.title}</b><br>
                    <small class="text-muted">${data.createdAt.substring(0,10)}</small>
                </td>
                <td>${data.tipo}</td>
                <td>v${data.version}</td>
                <td><span class="status-badge status-${data.estado}">${data.estado}</span></td>
                <td>
                    <button class="btn-text" onclick="verDetalle('${data.desc}', '${data.fileUrl}')">Ver</button>
                    ${currentUser.role === 'admin' && data.estado === 'Pendiente' ? 
                        `<button class="btn-text" style="color:var(--success)" onclick="abrirFirma('${id}')">Aprobar</button>
                         <button class="btn-text" style="color:var(--danger)" onclick="rechazar('${id}')">Rechazar</button>` : ''}
                </td>
            `;
            tbody.appendChild(tr);

            // Render Timeline (Solo últimos 5)
            if(stats.total <= 5) {
                timeline.innerHTML += `
                    <div class="timeline-item">
                        <div class="timeline-line"></div>
                        <div class="timeline-icon"><span class="material-icons-round">history</span></div>
                        <div class="timeline-content">
                            <strong>${data.accion}</strong> - ${data.title}
                            <div style="font-size:0.8rem; color:#888">${new Date(data.createdAt).toLocaleString()} por ${data.createdBy}</div>
                        </div>
                    </div>
                `;
            }
        });

        // Update UI Stats
        document.getElementById("statTotal").innerText = stats.total;
        document.getElementById("statPendientes").innerText = stats.pending;
        document.getElementById("statAprobados").innerText = stats.approved;
        
        // Empty State
        document.getElementById("emptyState").classList.toggle("hide", stats.total > 0);

        // Update Charts
        updateChart(stats);
    });
}

// --- CHART.JS INTEGRATION ---
let myChart = null;
function updateChart(stats) {
    const ctx = document.getElementById('mainChart').getContext('2d');
    if(myChart) myChart.destroy();
    
    myChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Pendientes', 'Aprobados', 'Rechazados'],
            datasets: [{
                data: [stats.pending, stats.approved, stats.total - (stats.pending + stats.approved)],
                backgroundColor: ['#f59e0b', '#10b981', '#ef4444'],
                borderWidth: 0
            }]
        },
        options: { responsive: true, maintainAspectRatio: false, cutout: '70%' }
    });
}

// --- SEARCH ---
document.getElementById("globalSearch").addEventListener("keyup", (e) => {
    const term = e.target.value.toLowerCase();
    const rows = document.querySelectorAll("#solTableBody tr");
    rows.forEach(row => {
        const text = row.innerText.toLowerCase();
        row.style.display = text.includes(term) ? "" : "none";
    });
});

// --- ACTIONS ---
window.toggleModal = (id) => document.getElementById(id).classList.toggle("hide");
window.checkModType = () => {
    const isMod = document.getElementById("solAccion").value === "Modificación";
    document.getElementById("solLastDate").disabled = !isMod;
};

window.crearSolicitud = async () => {
    const title = document.getElementById("solTitle").value;
    const tipo = document.getElementById("solTipo").value;
    const accion = document.getElementById("solAccion").value;
    
    if(!title) return Swal.fire("Error", "El título es obligatorio", "warning");

    showLoader(true);
    // Simular upload
    const fileUrl = "#"; // Aquí iría tu lógica de Cloudinary

    try {
        await addDoc(collection(db, "Solicitudes"), {
            title, tipo, accion, 
            version: document.getElementById("solVersion").value || "1.0",
            desc: document.getElementById("solDesc").value,
            fileUrl,
            estado: "Pendiente",
            createdBy: currentUser.usuario,
            createdAt: new Date().toISOString()
        });
        notify("Solicitud Creada Exitosamente", "success");
        toggleModal('modalSolicitud');
    } catch (e) {
        notify("Error al crear", "error");
    } finally {
        showLoader(false);
    }
};

window.verDetalle = (desc, url) => {
    Swal.fire({
        title: 'Detalles del Documento',
        html: `<p>${desc}</p><br>${url !== '#' ? `<a href="${url}" target="_blank" class="btn-primary">Ver Archivo</a>` : 'Sin archivo adjunto'}`,
        showCloseButton: true
    });
};

// --- FIRMA DIGITAL ---
const canvas = document.getElementById("signaturePad");
const ctx = canvas.getContext("2d");
let drawing = false;

// Funciones de dibujo (ratón y táctil)
const getPos = (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
    const y = (e.touches ? e.touches[0].clientY : e.clientY) - rect.top;
    return { x, y };
}

['mousedown', 'touchstart'].forEach(evt => 
    canvas.addEventListener(evt, (e) => { drawing = true; ctx.beginPath(); const p = getPos(e); ctx.moveTo(p.x, p.y); })
);
['mousemove', 'touchmove'].forEach(evt => 
    canvas.addEventListener(evt, (e) => { 
        if(!drawing) return; 
        e.preventDefault(); 
        const p = getPos(e); 
        ctx.lineTo(p.x, p.y); 
        ctx.stroke(); 
    })
);
['mouseup', 'touchend'].forEach(evt => canvas.addEventListener(evt, () => drawing = false));

document.getElementById("btnClearSign").onclick = () => ctx.clearRect(0,0,canvas.width, canvas.height);

window.abrirFirma = (id) => {
    currentSignId = id;
    document.getElementById("signerName").innerText = currentUser.usuario;
    ctx.clearRect(0,0,canvas.width, canvas.height);
    toggleModal("modalFirma");
};

document.getElementById("btnConfirmSign").onclick = async () => {
    showLoader(true);
    const firmaImg = canvas.toDataURL();
    
    await updateDoc(doc(db, "Solicitudes", currentSignId), {
        estado: "Aprobado",
        firmaAdmin: firmaImg,
        approvedAt: new Date().toISOString()
    });
    
    toggleModal("modalFirma");
    showLoader(false);
    Swal.fire("¡Aprobado!", "El documento ha sido firmado y procesado.", "success");
};

window.rechazar = async (id) => {
    const result = await Swal.fire({
        title: '¿Rechazar solicitud?',
        text: "Esta acción no se puede deshacer",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Sí, rechazar'
    });

    if (result.isConfirmed) {
        await updateDoc(doc(db, "Solicitudes", id), { estado: "Rechazado" });
        notify("Solicitud rechazada", "info");
    }
};

// --- PESTAÑAS ---
document.querySelectorAll(".nav-item").forEach(btn => {
    btn.onclick = () => {
        document.querySelectorAll(".nav-item").forEach(b => b.classList.remove("active"));
        document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
        btn.classList.add("active");
        document.getElementById(btn.dataset.tab).classList.add("active");
        
        // Mobile Sidebar Close
        if(window.innerWidth < 768) document.querySelector(".sidebar").classList.remove("show");
    };
});

// Inicialmente ocultar loader
window.onload = () => showLoader(false);
