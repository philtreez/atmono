// ================= Three.js + Post-Processing Setup =================

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);

const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);
camera.position.z = 5;

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
const threeContainer = document.getElementById("threejs-container") || document.body;
threeContainer.appendChild(renderer.domElement);

const composer = new THREE.EffectComposer(renderer);
const renderPass = new THREE.RenderPass(scene, camera);
composer.addPass(renderPass);

const bloomPass = new THREE.UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  0.5,  // Stärke
  0.1,  // Radius
  0.3   // Schwellenwert
);
bloomPass.threshold = 0;
bloomPass.strength = 0.5;
bloomPass.radius = 0.35;
composer.addPass(bloomPass);

const glitchPass = new THREE.GlitchPass();
glitchPass.enabled = false;
composer.addPass(glitchPass);

// ================= Star Field (Hintergrund) =================

function createStarField() {
  const starCount = 10000;
  const starGeometry = new THREE.BufferGeometry();
  const positions = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount; i++) {
    positions[i * 3]     = (Math.random() - 0.5) * 2000;
    positions[i * 3 + 1] = (Math.random() - 0.5) * 2000;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 2000;
  }
  starGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const starMaterial = new THREE.PointsMaterial({
    color: 0xffffff,
    size: 0.7,
    sizeAttenuation: true
  });
  const stars = new THREE.Points(starGeometry, starMaterial);
  scene.add(stars);
}
createStarField();

// ================= Zusätzliche Parameter mit Smoothing =================
let targetMorphIntensity = 0.3;    // Wird per RNBO-Nachricht gesetzt
let currentMorphIntensity = 0.3;   // Aktueller, geglätteter Wert

let targetMorphFrequency = 4.0;    // Zielwert für die Frequenz
let currentMorphFrequency = 4.0;   // Geglätteter Frequenzwert

let targetNoiseFactor = 0.1;       // Zielwert für den Noise-Effekt
let currentNoiseFactor = 0.1;      // Geglätteter Noise-Wert

const smoothingFactor = 0.05;      // Kleinere Werte = glattere Übergänge

// ================= Morphing 3D-Objekt Setup =================

// Erstelle eine feingetesselte Kugelgeometrie als Basis für das Morphing
const geometry = new THREE.SphereGeometry(1.5, 128, 128);
// Speichere die ursprünglichen Vertex-Positionen
geometry.userData.origPositions = geometry.attributes.position.array.slice(0);

const material = new THREE.MeshBasicMaterial({
  color: 0xffffff,
  wireframe: true
});

const morphObject = new THREE.Mesh(geometry, material);
scene.add(morphObject);

// ================= Clock =================

const clock = new THREE.Clock();

// ================= Animate Function =================

function animate() {
  requestAnimationFrame(animate);
  const time = clock.getElapsedTime();

  // Smoothing: Angleiche alle Zielwerte
  currentMorphIntensity += (targetMorphIntensity - currentMorphIntensity) * smoothingFactor;
  currentMorphFrequency += (targetMorphFrequency - currentMorphFrequency) * smoothingFactor;
  currentNoiseFactor     += (targetNoiseFactor - currentNoiseFactor) * smoothingFactor;

  // Aktualisiere die Scheitelpunkte des Objekts
  const positions = morphObject.geometry.attributes.position.array;
  const origPositions = morphObject.geometry.userData.origPositions;
  const vertexCount = positions.length / 3;

  for (let i = 0; i < vertexCount; i++) {
    const ix = i * 3;
    const ox = origPositions[ix];
    const oy = origPositions[ix + 1];
    const oz = origPositions[ix + 2];

    // Kombiniere einen Sinus-Effekt mit einem "Rausch"-Effekt
    const sinOffset = Math.sin(time + (ox + oy + oz) * currentMorphFrequency);
    const noiseOffset = currentNoiseFactor * Math.sin(time * 0.5 + (ox - oy + oz));
    const offset = sinOffset + noiseOffset;

    positions[ix]     = ox + ox * offset * currentMorphIntensity;
    positions[ix + 1] = oy + oy * offset * currentMorphIntensity;
    positions[ix + 2] = oz + oz * offset * currentMorphIntensity;
  }
  morphObject.geometry.attributes.position.needsUpdate = true;

  // Drehe das Objekt für einen dynamischen Effekt
  morphObject.rotation.x += 0.005;
  morphObject.rotation.y += 0.005;

  // Optionale leichte Kamera-Bewegung (hier kannst du auch statisch bleiben, um den "Schwebe-Effekt" zu verstärken)
  camera.position.x = Math.sin(time * 0.5) * 0.5;
  camera.rotation.y = Math.sin(time * 0.3) * 0.1;

  composer.render();
}
animate();

// ================= Effekt: Random Planet (seqlight) =================

function triggerSeqlight() {
  // Erstelle einen "Planeten" als Kugel
  const planetGeometry = new THREE.SphereGeometry(0.5, 32, 32);
  const planetMaterial = new THREE.MeshBasicMaterial({ color: 0xffaa00 });
  const planetMesh = new THREE.Mesh(planetGeometry, planetMaterial);

  // Platziere den Planeten zufällig im Raum (z. B. im Bereich -100 bis 100)
  planetMesh.position.x = (Math.random() - 0.5) * 200;
  planetMesh.position.y = (Math.random() - 0.5) * 200;
  planetMesh.position.z = (Math.random() - 0.5) * 200;

  scene.add(planetMesh);

  // Entferne den Planeten nach 1 Sekunde wieder
  setTimeout(() => {
    scene.remove(planetMesh);
  }, 1000);
}

// ================= RNBO Integration =================

window.rnboDevice = null;
window.device = null; // Für sendValueToRNBO
let parameterQueue = {};

async function setupRNBO() {
  const patchExportURL = "https://atmono-philtreezs-projects.vercel.app/export/patch.export.json";
  const WAContext = window.AudioContext || window.webkitAudioContext;
  const context = new WAContext();
  const outputNode = context.createGain();
  outputNode.connect(context.destination);
  
  let response, patcher;
  try {
    response = await fetch(patchExportURL);
    patcher = await response.json();
    if (!window.RNBO) {
      await loadRNBOScript(patcher.desc.meta.rnboversion);
    }
  } catch (err) {
    console.error("Fehler beim Laden des RNBO-Patchers:", err);
    return;
  }
  
  let deviceInstance;
  try {
    deviceInstance = await RNBO.createDevice({ context, patcher });
  } catch (err) {
    console.error("Fehler beim Erstellen des RNBO-Geräts:", err);
    return;
  }
  
  window.rnboDevice = deviceInstance;
  window.device = deviceInstance;
  deviceInstance.node.connect(outputNode);
  attachRNBOMessages(deviceInstance);
  attachOutports(deviceInstance);
  flushParameterQueue();
  
  document.body.onclick = () => context.resume();
}

setupRNBO();

function loadRNBOScript(version) {
  return new Promise((resolve, reject) => {
    if (/^\d+\.\d+\.\d+-dev$/.test(version)) {
      throw new Error("Patcher exported with a Debug Version! Bitte gib die korrekte RNBO-Version an.");
    }
    const el = document.createElement("script");
    el.src = "https://c74-public.nyc3.digitaloceanspaces.com/rnbo/" + encodeURIComponent(version) + "/rnbo.min.js";
    el.onload = resolve;
    el.onerror = function(err) {
      reject(new Error("Fehler beim Laden von rnbo.js v" + version));
    };
    document.body.appendChild(el);
  });
}

function sendValueToRNBO(param, value) {
  if (window.device && window.device.parametersById && window.device.parametersById.has(param)) {
    window.device.parametersById.get(param).value = value;
    console.log(`🎛 Updated RNBO param: ${param} = ${value}`);
  } else {
    console.warn(`rnboDevice nicht verfügbar. Parameter ${param} wird zwischengespeichert:`, value);
    parameterQueue[param] = value;
  }
}

function flushParameterQueue() {
  if (window.device && window.device.parametersById) {
    for (const [param, value] of Object.entries(parameterQueue)) {
      if (window.device.parametersById.has(param)) {
        window.device.parametersById.get(param).value = value;
        console.log(`🎛 Zwischengespeicherter Parameter ${param} gesetzt auf ${value}`);
      }
    }
    parameterQueue = {};
  }
}

// ================= Steuerung: RNBO Nachrichten =================

function updateSliderFromRNBO(id, value) {
  const slider = document.getElementById("slider-" + id);
  if (slider) {
    slider.dataset.value = value;
    const degrees = value * 270; // 0-1 entspricht 0 bis 270° Drehung
    slider.style.transform = `rotate(${degrees}deg)`;
  }
}

function attachRNBOMessages(device) {
  const controlIds = ["s1", "s2", "s3", "s4", "s5", "s6", "s7", "s8", "vol", "b1", "b2", "b3", "b4", "b5", "b6", "b7", "b8"];

  if (device.parameterChangeEvent) {
    device.parameterChangeEvent.subscribe(param => {
      if (param.id === "morph") {
        targetMorphIntensity = parseFloat(param.value);
        console.log(`Target morph intensity updated: ${targetMorphIntensity}`);
      }
      if (param.id === "morphFrequency") {
        targetMorphFrequency = parseFloat(param.value);
        console.log(`Target morph frequency updated: ${targetMorphFrequency}`);
      }
      if (param.id === "noiseFactor") {
        targetNoiseFactor = parseFloat(param.value);
        console.log(`Target noise factor updated: ${targetNoiseFactor}`);
      }
      if (param.id === "seqlight" && parseInt(param.value) === 1) {
        triggerSeqlight();
        console.log("seqlight ausgelöst: Planet erscheint zufällig im Weltall");
      }
      if (param.id === "bloomStrength") {
        bloomPass.strength = parseFloat(param.value);
        console.log("Bloom strength updated: " + bloomPass.strength);
      }
      if (param.id === "bloomRadius") {
        bloomPass.radius = parseFloat(param.value);
        console.log("Bloom radius updated: " + bloomPass.radius);
      }
      // Bestehende Steuerung für Slider und Buttons
      if (controlIds.includes(param.id)) {
        if (param.id.startsWith("b")) {
          updateButtonFromRNBO(param.id, parseFloat(param.value));
        } else {
          updateSliderFromRNBO(param.id, parseFloat(param.value));
        }
      }
      console.log(`Parameter ${param.id} geändert: ${param.value}`);
    });
  } else if (device.messageEvent) {
    device.messageEvent.subscribe(ev => {
      if (ev.tag === "morph") {
        targetMorphIntensity = parseFloat(ev.payload);
        console.log(`Target morph intensity updated: ${targetMorphIntensity}`);
      }
      if (ev.tag === "morphFrequency") {
        targetMorphFrequency = parseFloat(ev.payload);
        console.log(`Target morph frequency updated: ${targetMorphFrequency}`);
      }
      if (ev.tag === "noiseFactor") {
        targetNoiseFactor = parseFloat(ev.payload);
        console.log(`Target noise factor updated: ${targetNoiseFactor}`);
      }
      if (ev.tag === "seqlight" && parseInt(ev.payload) === 1) {
        triggerSeqlight();
        console.log("seqlight ausgelöst: Planet erscheint zufällig im Weltall");
      }
      if (ev.tag === "bloomStrength") {
        bloomPass.strength = parseFloat(ev.payload);
        console.log("Bloom strength updated: " + bloomPass.strength);
      }
      if (ev.tag === "bloomRadius") {
        bloomPass.radius = parseFloat(ev.payload);
        console.log("Bloom radius updated: " + bloomPass.radius);
      }
      if (controlIds.includes(ev.tag)) {
        if (ev.tag.startsWith("b")) {
          updateButtonFromRNBO(ev.tag, parseFloat(ev.payload));
        } else {
          updateSliderFromRNBO(ev.tag, parseFloat(ev.payload));
        }
      }
      console.log(`Message ${ev.tag}: ${ev.payload}`);
    });
  }
}

function attachOutports(device) {
  device.messageEvent.subscribe(ev => {
    // Handle grider und glitchy wie bisher:
    if (ev.tag === "grider" && parseInt(ev.payload) === 1) {
      const randomIndex = Math.floor(Math.random() * tunnelPlanes.length);
      const randomPlane = tunnelPlanes[randomIndex];
      const edges = new THREE.EdgesGeometry(gridGeometry);
      const lineMaterial = new THREE.LineBasicMaterial({
        color: 0x00ff82,
        linewidth: 40,
        transparent: true,
        opacity: 0.65,
        blending: THREE.AdditiveBlending,
        depthTest: false,
        depthWrite: false
      });
      const thickOutline = new THREE.LineSegments(edges, lineMaterial);
      thickOutline.scale.set(1, 1, 1);
      randomPlane.add(thickOutline);
      setTimeout(() => {
        randomPlane.remove(thickOutline);
      }, 100);
    }
    
    if (ev.tag === "glitchy") {
      glitchPass.enabled = (parseInt(ev.payload) === 1);
    }
    
    // Hier prüfen wir, ob der Outport für Light-Daten ist
    if (ev.tag.startsWith("light1") || ev.tag.startsWith("light2")) {
      // updateLights erwartet den Outport-Namen (z. B. "light1" oder "light2") und einen Wert (0-8)
      updateLights(ev.tag, ev.payload);
    }
    
    console.log(`${ev.tag}: ${ev.payload}`);
  });
}

function updateLights(outport, value) {
  const intVal = Math.round(parseFloat(value));
  console.log(`Update Lights for ${outport}: ${intVal}`);
  // Wenn der Wert 0 ist, sollen alle unsichtbar sein.
  for (let i = 1; i <= 8; i++) {
    const el = document.getElementById(`${outport}-${i}`);
    if (el) {
      el.style.opacity = (intVal === i) ? "1" : "0";
    }
  }
}

// ================= Rotary Slider Setup (IDs: slider-s1 ... slider-s8) =================

function setupVerticalSliders() {
  const sliderIds = ["s1", "s2", "s3", "s4", "s5", "s6", "s7", "s8"];
  
  sliderIds.forEach(id => {
    // Hole den Container, der als Hintergrund dient
    const sliderContainer = document.getElementById("slider-" + id);
    if (!sliderContainer) {
      console.warn("Slider container nicht gefunden:", "slider-" + id);
      return;
    }
    
    // Style den Container (Hintergrund)
    sliderContainer.style.width = "30px";
    sliderContainer.style.height = "150px";
    sliderContainer.style.position = "relative";
    sliderContainer.style.backgroundColor = "#ccc"; // Hintergrundfarbe, z. B. hellgrau
    sliderContainer.style.borderRadius = "4px";
    sliderContainer.dataset.value = "0"; // Initialwert 0
    
    // Erstelle den Thumb, falls noch nicht vorhanden
    let thumb = sliderContainer.querySelector(".thumb");
    if (!thumb) {
      thumb = document.createElement("div");
      thumb.className = "thumb";
      sliderContainer.appendChild(thumb);
    }
    
    // Style den Thumb
    thumb.style.width = "30px";
    thumb.style.height = "40px";
    thumb.style.position = "absolute";
    thumb.style.top = "0px"; // Initial oben
    thumb.style.left = "0px";
    thumb.style.backgroundColor = "#888"; // z. B. dunkleres Grau
    thumb.style.borderRadius = "4px";
    thumb.style.touchAction = "none";
    
    // Variablen zur Steuerung der Drag-Interaktion
    let isDragging = false;
    let startY = 0;
    let initialValue = 0;
    
    // Beim Pointer-Down am Thumb: Drag starten
    thumb.addEventListener("pointerdown", (e) => {
      isDragging = true;
      startY = e.clientY;
      initialValue = parseFloat(sliderContainer.dataset.value);
      thumb.setPointerCapture(e.pointerId);
    });
    
    // Beim Pointer-Move: Verschiebe den Thumb vertikal
    thumb.addEventListener("pointermove", (e) => {
      if (!isDragging) return;
      
      const dy = e.clientY - startY;
      // Berechne den verfügbaren Bewegungsbereich
      const travel = sliderContainer.clientHeight - thumb.clientHeight;
      // Berechne den neuen Wert (zwischen 0 und 1)
      let delta = dy / travel;
      let newValue = initialValue + delta;
      newValue = Math.max(0, Math.min(newValue, 1));
      sliderContainer.dataset.value = newValue.toString();
      
      // Setze die neue Position des Thumbs
      thumb.style.top = (newValue * travel) + "px";
      
      // Sende den neuen Wert an RNBO (oder andere Steuerungslogik)
      sendValueToRNBO(id, newValue);
    });
    
    // Beende das Dragging
    thumb.addEventListener("pointerup", () => { isDragging = false; });
    thumb.addEventListener("pointercancel", () => { isDragging = false; });
  });
}

// ================= Volume Slider Setup (IDs: volume-slider, volume-thumb) =================

function setupVolumeSlider() {
  const slider = document.getElementById("volume-slider");
  const thumb = document.getElementById("volume-thumb");
  if (!slider || !thumb) {
    console.error("Volume slider elements not found!");
    return;
  }
  
  const sliderWidth = slider.offsetWidth;
  const thumbWidth = thumb.offsetWidth;
  const maxMovement = sliderWidth - thumbWidth;
  
  const initialValue = 0.05;
  const initialX = maxMovement * initialValue;
  thumb.style.left = initialX + "px";
  sendValueToRNBO("vol", initialValue);
  
  let isDragging = false;
  thumb.addEventListener("mousedown", (e) => {
    isDragging = true;
    e.preventDefault();
  });
  
  document.addEventListener("mousemove", (e) => {
    if (!isDragging) return;
    const sliderRect = slider.getBoundingClientRect();
    let newX = e.clientX - sliderRect.left - (thumb.offsetWidth / 2);
    newX = Math.max(0, Math.min(newX, maxMovement));
    thumb.style.left = newX + "px";
    const normalizedValue = newX / maxMovement;
    sendValueToRNBO("vol", normalizedValue);
  });
  
  document.addEventListener("mouseup", () => { isDragging = false; });
}

function updateVolumeSliderFromRNBO(value) {
  const slider = document.getElementById("volume-slider");
  const thumb = document.getElementById("volume-thumb");
  if (!slider || !thumb) return;
  const maxMovement = slider.offsetWidth - thumb.offsetWidth;
  thumb.style.left = (value * maxMovement) + "px";
}

// ================= Button Setup (IDs: b1 ... b8) =================

function setupButtons() {
  const buttonIds = ["b1", "b2", "b3", "b4", "b5", "b6", "b7", "b8"];
  buttonIds.forEach(id => {
    const button = document.getElementById(id);
    if (!button) {
      console.warn("Button element nicht gefunden:", id);
      return;
    }
    // Initialer Zustand: 0 = unsichtbar
    button.dataset.value = "0";
    button.style.opacity = "0";
    button.style.cursor = "pointer";
    
    button.addEventListener("click", () => {
      let current = parseInt(button.dataset.value);
      let newValue = (current === 0) ? 1 : 0;
      button.dataset.value = newValue.toString();
      button.style.opacity = (newValue === 1) ? "1" : "0";
      sendValueToRNBO(id, newValue);
    });
  });
}

function updateButtonFromRNBO(id, value) {
  const button = document.getElementById(id);
  if (button) {
    button.dataset.value = value.toString();
    button.style.opacity = (parseInt(value) === 1) ? "1" : "0";
  }
}

// ================= DOMContentLoaded Aufrufe =================

document.addEventListener("DOMContentLoaded", () => {
  setupVolumeSlider();
  setupRotarySliders();
  setupButtons();
});
