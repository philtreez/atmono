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

// ================= Satelliten (Orbit um das Hauptobjekt) =================
const satellites = [];
const satelliteCount = 8;
// Entferne die globalen orbitRadius und orbitSpeed, da jeder Satellit eigene Werte bekommt

for (let i = 0; i < satelliteCount; i++) {
  // Erstelle einen kleinen Satelliten als Kugel, weiß, im Wireframe-Look
  const satGeometry = new THREE.SphereGeometry(0.2, 16, 16);
  const satMaterial = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    wireframe: true,
    emissive: 0x000000,
    emissiveIntensity: 0
  });
  const satellite = new THREE.Mesh(satGeometry, satMaterial);
  
  // Setze einen Startwinkel (Azimut) gleichmäßig verteilt
  satellite.userData.angle = (i / satelliteCount) * Math.PI * 2;
  // Weise jedem Satelliten eine zufällige Neigung zu (zwischen -30° und +30°)
  satellite.userData.inclination = (Math.random() - 0.5) * (Math.PI / 3); // Bereich: -pi/6 bis +pi/6
  
  // Jeder Satellit bekommt einen eigenen Orbitradius (z. B. zwischen 2 und 4) und eine eigene Umlaufgeschwindigkeit (z. B. zwischen 0.2 und 1.0)
  satellite.userData.orbitRadius = 2 + Math.random() * 2; // 2 bis 4
  satellite.userData.orbitSpeed = 0.2 + Math.random() * 0.8; // 0.2 bis 1.0

  // Initiale Positionierung mit individuellen Werten
  satellite.position.x = morphObject.position.x + satellite.userData.orbitRadius * Math.cos(satellite.userData.angle) * Math.cos(satellite.userData.inclination);
  satellite.position.y = morphObject.position.y + satellite.userData.orbitRadius * Math.sin(satellite.userData.inclination);
  satellite.position.z = morphObject.position.z + satellite.userData.orbitRadius * Math.sin(satellite.userData.angle) * Math.cos(satellite.userData.inclination);
  
  satellites.push(satellite);
  scene.add(satellite);
}


// ================= Clock =================

const clock = new THREE.Clock();

// ================= Animate Function =================
function animate() {
  requestAnimationFrame(animate);
  const time = clock.getElapsedTime();
  const delta = clock.getDelta(); // Einmal pro Frame berechnen

  // --- Update des Hauptobjekts (morphObject) ---
  const positions = morphObject.geometry.attributes.position.array;
  const origPositions = morphObject.geometry.userData.origPositions;
  const vertexCount = positions.length / 3;
  
  for (let i = 0; i < vertexCount; i++) {
    const ix = i * 3;
    const ox = origPositions[ix];
    const oy = origPositions[ix + 1];
    const oz = origPositions[ix + 2];
    
    // Berechne den Offset mit Sinus- und Noise-Effekt
    const sinOffset = Math.sin(time + (ox + oy + oz) * currentMorphFrequency);
    const noiseOffset = currentNoiseFactor * Math.sin(time * 0.5 + (ox - oy + oz));
    const offset = sinOffset + noiseOffset;
    
    positions[ix]     = ox + ox * offset * currentMorphIntensity;
    positions[ix + 1] = oy + oy * offset * currentMorphIntensity;
    positions[ix + 2] = oz + oz * offset * currentMorphIntensity;
  }
  morphObject.geometry.attributes.position.needsUpdate = true;
  
  // Leichte Rotation des Hauptobjekts
  morphObject.rotation.x += 0.005;
  morphObject.rotation.y += 0.005;
  
  // --- Update der Satelliten ---
  satellites.forEach(satellite => {
    // Aktualisiere den Azimutwinkel mit der individuellen orbitSpeed
    satellite.userData.angle += satellite.userData.orbitSpeed * delta;
    
    // Berechne die neue Position unter Berücksichtigung des individuellen Orbitradius und der Neigung:
    satellite.position.x = morphObject.position.x + satellite.userData.orbitRadius * Math.cos(satellite.userData.angle) * Math.cos(satellite.userData.inclination);
    satellite.position.y = morphObject.position.y + satellite.userData.orbitRadius * Math.sin(satellite.userData.inclination);
    satellite.position.z = morphObject.position.z + satellite.userData.orbitRadius * Math.sin(satellite.userData.angle) * Math.cos(satellite.userData.inclination);
  });
  
  // Optionale leichte Kamera-Bewegung (schwebender Effekt)
  camera.position.x = Math.sin(time * 0.2) * 0.2;
  camera.rotation.y = Math.sin(time * 0.3) * 0.1;
  
  composer.render();
}

animate();



// ================= Effekt: Random Planet (seqlight) =================

function triggerPlanetLight(paramValue) {
  // paramValue: 0 bedeutet keiner, 1-8 bewirken, dass der jeweilige Satellit aufleuchtet.
  if (paramValue <= 0 || paramValue > satellites.length) return;
  const index = paramValue - 1; // z. B. 1 entspricht dem ersten Satelliten
  const satellite = satellites[index];
  if (!satellite) return;
  
  // Speichere den Originalwert, falls du später den Effekt zurücksetzen möchtest
  const originalEmissiveIntensity = satellite.material.emissiveIntensity;
  
  // Setze den emissiven Wert auf weiß und erhöhe die Intensität, sodass der Satellit "aufleuchtet"
  satellite.material.emissive.setHex(0xffffff);
  satellite.material.emissiveIntensity = 5;  // hoher Wert für starken Glow
  
  // Optional: Du kannst auch die Größe kurzzeitig ändern oder andere Effekte hinzufügen.
  
  // Nach 500 ms wird der Effekt wieder zurückgesetzt
  setTimeout(() => {
    satellite.material.emissiveIntensity = originalEmissiveIntensity;
    satellite.material.emissive.setHex(0x000000);
  }, 500);
}


function triggerSeqlight() {
  // Erstelle einen größeren "Planeten" als Kugel (z. B. Radius 1.0) und setze ihn auf weiß
  const planetGeometry = new THREE.SphereGeometry(1.0, 32, 32);
  
  // Verwende ein Material mit emissiven Eigenschaften, um einen Glow-Effekt zu fördern
  const planetMaterial = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: 0xffffff,
    emissiveIntensity: 2, // Erhöht den Leuchteffekt
    roughness: 0.1,
    metalness: 0.5
  });
  
  const planetMesh = new THREE.Mesh(planetGeometry, planetMaterial);

  // Platziere den Planeten zufällig im Raum (z. B. im Bereich -100 bis 100)
  planetMesh.position.x = (Math.random() - 0.5) * 200;
  planetMesh.position.y = (Math.random() - 0.5) * 200;
  planetMesh.position.z = (Math.random() - 0.5) * 200;

  scene.add(planetMesh);

  // Entferne den Planeten nach 1 Sekunde wieder
  setTimeout(() => {
    scene.remove(planetMesh);
  }, 100);
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
  const sliderContainer = document.getElementById("slider-" + id);
  if (sliderContainer) {
    // Speichere den neuen Wert
    sliderContainer.dataset.value = value;
    // Suche den Thumb im Container
    const thumb = sliderContainer.querySelector(".thumb");
    if (thumb) {
      // Berechne den verfügbaren vertikalen Bewegungsbereich
      const travel = sliderContainer.clientHeight - thumb.clientHeight;
      // Setze den Thumb vertikal entsprechend dem Wert (0 bis 1)
      thumb.style.top = (value * travel) + "px";
    }
  }
}

function attachRNBOMessages(device) {
  const controlIds = ["s1", "s2", "s3", "s4", "s5", "s6", "s7", "s8", "vol", "b1", "b2", "b3", "b4", "b5", "b6", "b7", "b8", "rndm"];

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
      if (param.id === "planetlight") {
        const value = parseInt(param.value);
        triggerPlanetLight(value);
        console.log("planetlight ausgelöst für Satellit:", value);
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
      if (ev.tag === "planetlight") {
        const value = parseInt(ev.payload);
        triggerPlanetLight(value);
        console.log("planetlight ausgelöst für Satellit:", value);
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
    // Hole den Container, der als Hintergrund dient (aus Webflow erstellt)
    const sliderContainer = document.getElementById("slider-" + id);
    if (!sliderContainer) {
      console.warn("Slider container nicht gefunden:", "slider-" + id);
      return;
    }
    
    // Stelle sicher, dass der Container die richtigen Styles hat (falls nicht, kannst du sie auch im JS setzen)
    sliderContainer.style.width = "30px";
    sliderContainer.style.height = "150px";
    sliderContainer.style.position = "relative";
    sliderContainer.style.borderRadius = "4px";
    sliderContainer.dataset.value = "0"; // Initialwert 0
    
    // Suche im Container nach einem existierenden Thumb-Div
    const thumb = sliderContainer.querySelector(".thumb");
    if (!thumb) {
      console.warn("Thumb div nicht gefunden in:", "slider-" + id);
      return;
    }
    
    // Style den Thumb (falls nötig – du kannst diese auch in Webflow definieren)
    thumb.style.width = "30px";
    thumb.style.height = "30px";
    thumb.style.position = "absolute";
    thumb.style.top = "0px"; // Initial oben
    thumb.style.left = "0px";
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
      // Berechne den verfügbaren Bewegungsbereich (Container-Höhe minus Thumb-Höhe)
      const travel = sliderContainer.clientHeight - thumb.clientHeight;
      // Berechne den neuen Wert (zwischen 0 und 1)
      let delta = dy / travel;
      let newValue = initialValue + delta;
      newValue = Math.max(0, Math.min(newValue, 1));
      sliderContainer.dataset.value = newValue.toString();
      
      // Setze die neue Position des Thumbs
      thumb.style.top = (newValue * travel) + "px";
      
      // Sende den neuen Wert an RNBO (oder an eine andere Steuerungslogik)
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
  const buttonIds = ["b1", "b2", "b3", "b4", "b5", "b6", "b7", "b8", "rndm"];
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
  setupVerticalSliders();
  setupButtons();
});
