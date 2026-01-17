// FIREBASE CONFIG
const firebaseConfig = {
  apiKey: "TU_API_KEY",
  authDomain: "TU_AUTH_DOMAIN",
  projectId: "TU_PROJECT_ID",
  storageBucket: "TU_STORAGE_BUCKET",
  messagingSenderId: "TU_MESSAGING_SENDER_ID",
  appId: "TU_APP_ID"
};
firebase.initializeApp(firebaseConfig);

const auth = firebase.auth();
const db = firebase.firestore();

let currentUser = null;
let activeDocId = null;

// LOGIN
async function handleLogin() {
  const email = document.getElementById("logUser").value;
  const pass = document.getElementById("logPass").value;

  try {
    const res = await auth.signInWithEmailAndPassword(email, pass);
    currentUser = res.user;
    await loadUserData();
    showApp();
  } catch (e) {
    document.getElementById("loginMsg").innerText = "Error de acceso";
  }
}

// LOGOUT
function logout(){
  auth.signOut();
  location.reload();
}

// SHOW APP
function showApp(){
  document.getElementById("view-login").classList.add("hidden");
  document.getElementById("view-app").classList.remove("hidden");
  document.getElementById("userDisplay").innerText = currentUserData.nombre;
}

// USER DATA
let currentUserData = null;
async function loadUserData(){
  const doc = await db.collection("Users").doc(currentUser.uid).get();
  currentUserData = doc.data();
  if(currentUserData.rol === "Admin"){
    document.querySelectorAll(".admin").forEach(e => e.classList.remove("hidden"));
  }
  loadData();
}

// CREATE ADMIN (button)
async function crearAdmin(){
  const email = "admin@fci.com";
  const pass = "123456";

  try {
    const res = await auth.createUserWithEmailAndPassword(email, pass);
    await db.collection("Users").doc(res.user.uid).set({
      nombre: "Admin Maestro",
      user: "admin",
      rol: "Admin",
      gerencia: "SGC"
    });
    alert("Admin creado!");
  } catch(e){
    alert("Admin ya existe o error.");
  }
}

// SWITCH TAB
function switchTab(id){
  document.querySelectorAll(".tab").forEach(t=>t.classList.remove("active"));
  document.querySelector(`[data-tab="${id}"]`).classList.add("active");
  document.querySelectorAll(".tab-content").forEach(c=>c.classList.add("hidden"));
  document.getElementById("tab-"+id).classList.remove("hidden");
}

// LOAD DATA
function loadData(){
  loadGerencias();
  loadSolicitudes();
  loadUsers();
  loadStats();
}

// GERENCIAS
function loadGerencias(){
  db.collection("gerencias").onSnapshot(s=>{
    let opt = '<option value="">Seleccione...</option>';
    let list = "";
    s.forEach(doc=>{
      const d = doc.data();
      opt += `<option value="${d.nombre}">${d.nombre}</option>`;
      list += `<li>${d.nombre} <button onclick="delDoc('gerencias','${doc.id}')">x</button></li>`;
    });
    document.getElementById("u-ger").innerHTML = opt;
    document.getElementById("o-parent").innerHTML = opt;
    document.getElementById("s-ger").innerHTML = opt;
    document.getElementById("list-ger").innerHTML = list;
  });
}

// DEPARTAMENTOS
function loadDepsForForm(ger){
  db.collection("departamentos").where("parent","==",ger).get().then(s=>{
    let html="";
    s.forEach(doc=> html += `<option>${doc.data().nombre}</option>`);
    document.getElementById("s-dep").innerHTML = html || "<option>N/A</option>";
  });
}
function loadDepartamentos(){
  db.collection("departamentos").onSnapshot(s=>{
    let list="";
    s.forEach(doc=>{
      const d=doc.data();
      list += `<li>${d.nombre} (${d.parent}) <button onclick="delDoc('departamentos','${doc.id}')">x</button></li>`;
    });
    document.getElementById("list-dep").innerHTML = list;
  });
}

// SOLICITUDES
function loadSolicitudes(){
  db.collection("Solicitudes").orderBy("fecha","desc").onSnapshot(s=>{
    let html="";
    s.forEach(doc=>{
      const d=doc.data();
      html += `
        <tr>
          <td>${d.fciId}</td>
          <td>${d.titulo}</td>
          <td>${d.estado}</td>
          <td>${d.gerencia}</td>
          <td><button onclick="viewDoc('${doc.id}')">Ver</button></td>
        </tr>`;
    });
    document.getElementById("tbody-sol").innerHTML = html;

    // HISTORIAL
    document.getElementById("historial").innerHTML = html;
  });
}

// STATS
function loadStats(){
  db.collection("Solicitudes").onSnapshot(s=>{
    let total=0, pend=0, apr=0, fin=0;
    s.forEach(doc=>{
      total++;
      const st = doc.data().estado;
      if(st=="Pendiente") pend++;
      if(st=="Aprobado") apr++;
      if(st=="Finalizado") fin++;
    });
    document.getElementById("statTotal").innerText = total;
    document.getElementById("statPend").innerText = pend;
    document.getElementById("statApr").innerText = apr;
    document.getElementById("statFin").innerText = fin;
  });
}

// MODAL
function openModal(id){ document.getElementById(id).classList.remove("hidden"); }
function closeModal(){ document.getElementById("modal-req").classList.add("hidden"); }

// CREATE SOLICITUD (upload file)
async function submitSol(){
  const file = document.getElementById("s-file").files[0];
  let fileUrl = "";

  // SUBIR A CLOUDINARY (DEBES CONFIGURARLO)
  // Aquí usarías Cloudinary upload API (recomendado)
  // Pero como tu pediste completo, te dejo un placeholder:
  // fileUrl = await uploadToCloudinary(file);

  fileUrl = "https://via.placeholder.com/150"; // temporal

  const idFci = await getNextID();
  await db.collection("Solicitudes").add({
    fciId: idFci,
    titulo: document.getElementById("s-tit").value,
    tipo: document.getElementById("s-tipo").value,
    accion: document.getElementById("s-acc").value,
    version: document.getElementById("s-ver").value,
    fechaVersion: document.getElementById("s-fver").value,
    gerencia: document.getElementById("s-ger").value,
    departamento: document.getElementById("s-dep").value,
    justificacion: document.getElementById("s-just").value,
    descripcion: document.getElementById("s-desc").value,
    file: fileUrl,
    estado: "Pendiente",
    uid: currentUser.uid,
    userName: currentUserData.nombre,
    fecha: new Date()
  });

  closeModal();
}

// USERS
function loadUsers(){
  db.collection("Users").onSnapshot(s=>{
    let html="";
    s.forEach(doc=>{
      const u=doc.data();
      html += `
        <tr>
          <td>${u.nombre}</td>
          <td>${u.user}</td>
          <td>${u.rol}</td>
          <td>${u.gerencia}</td>
          <td><button onclick="delDoc('Users','${doc.id}')">Eliminar</button></td>
        </tr>`;
    });
    document.getElementById("tbody-users").innerHTML = html;
  });
}

async function saveUser(){
  const nombre = document.getElementById("u-nom").value;
  const email = document.getElementById("u-email").value;
  const pass = document.getElementById("u-pass").value;
  const rol = document.getElementById("u-rol").value;
  const ger = document.getElementById("u-ger").value;

  const res = await auth.createUserWithEmailAndPassword(email, pass);
  await db.collection("Users").doc(res.user.uid).set({
    nombre,
    user: email,
    rol,
    gerencia: ger
  });
  alert("Usuario creado!");
}

// ORGANIZACIÓN
function addOrg(col, inpId, pId=null){
  const val = document.getElementById(inpId).value;
  const data = { nombre: val };
  if(pId) data.parent = document.getElementById(pId).value;
  db.collection(col).add(data);
  if(col==="departamentos") loadDepartamentos();
}

// DELETE DOC
function delDoc(col,id){
  if(confirm("Eliminar?")){
    db.collection(col).doc(id).delete();
  }
}

// ID COUNTER
async function getNextID(){
  const ref = db.collection("Config").doc("counts");
  const doc = await ref.get();
  const n = doc.exists ? doc.data().val + 1 : 1;
  await ref.set({ val: n });
  return "FCI-SGD-" + String(n).padStart(4,"0");
}