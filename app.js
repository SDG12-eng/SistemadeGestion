// FIREBASE CONFIG
const firebaseConfig = {
  apiKey: "AIzaSyDdzCiachuhbE9jATz-TesPI2vUVIJrHjM",
  authDomain: "sistemadegestion-7400d.firebaseapp.com",
  projectId: "sistemadegestion-7400d",
  storageBucket: "sistemadegestion-7400d.appspot.com",
  messagingSenderId: "709030283072",
  appId: "1:709030283072:web:5997837b36a448e9515ca5"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const storage = firebase.storage();

let currentUser = null;
let activeSolId = null;

// LOGIN
async function handleLogin(){
    const u = document.getElementById("logUser").value;
    const p = document.getElementById("logPass").value;

    const snap = await db.collection("Usuarios").where("user","==",u).where("pass","==",p).get();
    if(!snap.empty){
        currentUser = { id: snap.docs[0].id, ...snap.docs[0].data() };
        document.getElementById("view-login").classList.add("hidden");
        document.getElementById("view-app").classList.remove("hidden");
        document.getElementById("userDisplay").innerText = currentUser.nombre;

        if(currentUser.rol === "Admin"){
            document.querySelectorAll(".admin-only").forEach(e => e.classList.remove("hidden"));
        }

        loadData();
    } else {
        alert("Usuario o contraseña incorrectos");
    }
}

function logout(){
    currentUser = null;
    location.reload();
}

// CREAR ADMIN
async function createAdmin(){
    const snap = await db.collection("Usuarios").where("user","==","Admin").get();
    if(!snap.empty){
        alert("Admin ya existe");
        return;
    }
    await db.collection("Usuarios").add({
        nombre: "Administrador",
        user: "Admin",
        pass: "1130",
        rol: "Admin",
        gerencia: "SGC",
        departamento: "Archivos"
    });
    alert("Admin creado: Admin / 1130");
}

// DASHBOARD & DATA
function switchTab(id){
    document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
    document.querySelectorAll(".tab-content").forEach(c => c.classList.add("hidden"));

    document.querySelector(`.tab[onclick="switchTab('${id}')"]`).classList.add("active");
    document.getElementById("tab-"+id).classList.remove("hidden");
}

async function loadData(){
    // Stats
    db.collection("Usuarios").onSnapshot(s => {
        document.getElementById("count-users").innerText = s.size;
        renderUsers(s);
    });

    db.collection("gerencias").onSnapshot(s => {
        document.getElementById("count-ger").innerText = s.size;
        renderGerencias(s);
    });

    db.collection("departamentos").onSnapshot(s => {
        document.getElementById("count-dep").innerText = s.size;
        renderDepartamentos(s);
    });

    db.collection("Solicitudes").orderBy("fecha","desc").onSnapshot(s => {
        document.getElementById("count-sol").innerText = s.size;
        renderSolicitudes(s);
    });
}

// RENDER USERS
function renderUsers(snapshot){
    const tbody = document.getElementById("tbody-users");
    tbody.innerHTML = "";
    snapshot.forEach(doc => {
        const u = doc.data();
        tbody.innerHTML += `
            <tr>
                <td>${u.nombre}</td>
                <td>${u.user}</td>
                <td>${u.rol}</td>
                <td>${u.gerencia || 'N/A'}</td>
                <td><button class="btn btn-danger" onclick="deleteDoc('Usuarios','${doc.id}')">Eliminar</button></td>
            </tr>
        `;
    });
}

// SAVE USER
function saveUser(){
    const data = {
        nombre: document.getElementById("u-nom").value,
        user: document.getElementById("u-user").value,
        pass: document.getElementById("u-pass").value,
        rol: document.getElementById("u-rol").value,
        gerencia: document.getElementById("u-ger").value,
    };
    db.collection("Usuarios").add(data);
    alert("Usuario creado");
}

// RENDER GERENCIAS
function renderGerencias(snapshot){
    const list = document.getElementById("list-ger");
    const sel = document.getElementById("o-parent");
    const sger = document.getElementById("u-ger");
    const sger2 = document.getElementById("s-ger");

    list.innerHTML = "";
    sel.innerHTML = "<option value=''>Seleccione...</option>";
    sger.innerHTML = "<option value=''>Seleccione...</option>";
    sger2.innerHTML = "<option value=''>Seleccione...</option>";

    snapshot.forEach(doc => {
        const g = doc.data();
        list.innerHTML += `<li>${g.nombre} <button class="btn btn-danger" onclick="deleteDoc('gerencias','${doc.id}')">Eliminar</button></li>`;
        sel.innerHTML += `<option value="${g.nombre}">${g.nombre}</option>`;
        sger.innerHTML += `<option value="${g.nombre}">${g.nombre}</option>`;
        sger2.innerHTML += `<option value="${g.nombre}">${g.nombre}</option>`;
    });
}

// RENDER DEPARTAMENTOS
function renderDepartamentos(snapshot){
    const list = document.getElementById("list-dep");
    list.innerHTML = "";
    snapshot.forEach(doc => {
        const d = doc.data();
        list.innerHTML += `<li>${d.nombre} (${d.parent}) <button class="btn btn-danger" onclick="deleteDoc('departamentos','${doc.id}')">Eliminar</button></li>`;
    });
}

// ADD ORG
function addOrg(col, inpId, parentId=null){
    const val = document.getElementById(inpId).value;
    const data = { nombre: val };
    if(parentId){
        data.parent = document.getElementById(parentId).value;
    }
    db.collection(col).add(data);
}

// DELETE DOC
function deleteDoc(col, id){
    if(confirm("¿Eliminar?")){
        db.collection(col).doc(id).delete();
    }
}

// SOLICITUDES
async function submitSol(){
    const fileInput = document.getElementById("s-file");
    const file = fileInput.files[0];

    let fileUrl = "";
    if(file){
        const storageRef = storage.ref();
        const fileRef = storageRef.child(`fci_documentos/${Date.now()}_${file.name}`);
        await fileRef.put(file);
        fileUrl = await fileRef.getDownloadURL();
    }

    const solData = {
        fciId: await getNextID(),
        titulo: document.getElementById("s-tit").value,
        tipo: document.getElementById("s-tipo").value,
        accion: document.getElementById("s-acc").value,
        gerencia: document.getElementById("s-ger").value,
        departamento: document.getElementById("s-dep").value,
        motivo: document.getElementById("s-just").value,
        version: document.getElementById("s-ver").value,
        fechaVersion: document.getElementById("s-fver").value,
        archivo: fileUrl,
        estado: "Pendiente",
        uid: currentUser.id,
        userName: currentUser.nombre,
        fecha: new Date()
    };

    await db.collection("Solicitudes").add(solData);
    closeModal();
}

// RENDER SOLICITUDES
function renderSolicitudes(snapshot){
    const tbody = document.getElementById("tbody-sol");
    tbody.innerHTML = "";

    snapshot.forEach(doc => {
        const s = doc.data();
        // mostrar según rol
        if(currentUser.rol === "Solicitante" && s.uid !== currentUser.id) return;
        if(currentUser.rol === "Gerente" && s.gerencia !== currentUser.gerencia) return;

        tbody.innerHTML += `
            <tr>
                <td>${s.fciId}</td>
                <td>${s.titulo}</td>
                <td>${s.tipo}</td>
                <td>${s.accion}</td>
                <td>${s.estado}</td>
                <td>${s.gerencia}</td>
                <td>${s.departamento}</td>
                <td>${s.userName}</td>
                <td><button class="btn btn-primary" onclick="viewSol('${doc.id}')">Ver</button></td>
            </tr>
        `;
    });
}

// VIEW SOLICITUD
async function viewSol(id){
    activeSolId = id;
    const doc = await db.collection("Solicitudes").doc(id).get();
    const s = doc.data();

    document.getElementById("v-title").innerText = `${s.fciId} - ${s.titulo}`;
    document.getElementById("v-details").innerHTML = `
        <p><strong>Tipo:</strong> ${s.tipo}</p>
        <p><strong>Acción:</strong> ${s.accion}</p>
        <p><strong>Gerencia:</strong> ${s.gerencia}</p>
        <p><strong>Departamento:</strong> ${s.departamento}</p>
        <p><strong>Motivo:</strong> ${s.motivo}</p>
        <p><strong>Estado:</strong> ${s.estado}</p>
        <p><strong>Solicitante:</strong> ${s.userName}</p>
        <p><strong>Archivo:</strong> ${s.archivo ? `<a href="${s.archivo}" target="_blank">Ver</a>` : "No hay archivo"}</p>
    `;

    if(currentUser.rol !== "Solicitante"){
        document.getElementById("v-admin-panel").classList.remove("hidden");
        document.getElementById("v-status").value = s.estado;
    } else {
        document.getElementById("v-admin-panel").classList.add("hidden");
    }

    openModal('modal-view');
}

// UPDATE STATUS
async function updateStatus(){
    const st = document.getElementById("v-status").value;
    const comment = document.getElementById("v-comment").value;

    await db.collection("Solicitudes").doc(activeSolId).update({
        estado: st,
        comentario: comment
    });

    closeModal();
}

// MODALS
function openModal(id){
    document.getElementById(id).classList.remove("hidden");
}

function closeModal(){
    document.querySelectorAll(".modal").forEach(m => m.classList.add("hidden"));
}

// ID COUNTER
async function getNextID(){
    const ref = db.collection("Config").doc("counts");
    const d = await ref.get();
    if(!d.exists){
        await ref.set({ val: 0 });
        return "FCI-SOL-0001";
    }
    const n = d.data().val + 1;
    await ref.update({ val: n });
    return "FCI-SOL-" + n.toString().padStart(4, '0');
}

// LOAD DEPARTAMENTOS EN FORM
async function loadDepsForForm(ger){
    const s = await db.collection("departamentos").where("parent","==",ger).get();
    let html = "<option value=''>Seleccione...</option>";
    s.forEach(doc => html += `<option>${doc.data().nombre}</option>`);
    document.getElementById("s-dep").innerHTML = html;
}

// DEMO DATA
async function setupDemoData(){
    await createAdmin();
    await db.collection("gerencias").add({ nombre: "Archivos" });
    await db.collection("departamentos").add({ nombre: "Documentación", parent: "Archivos" });
    alert("Demo inicializada");
}