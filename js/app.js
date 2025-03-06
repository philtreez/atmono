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

// Erstelle den finalPass und finalComposer
const finalPass = new THREE.ShaderPass( THREE.CopyShader );
finalPass.renderToScreen = true;

const finalComposer = new THREE.EffectComposer(renderer);
finalComposer.addPass(renderPass);
finalComposer.addPass(finalPass);

// Erstelle den OutlinePass
const outlinePass = new THREE.OutlinePass(
  new THREE.Vector2(window.innerWidth, window.innerHeight), 
  scene, 
  camera
);
outlinePass.edgeStrength = 1.0;     
outlinePass.edgeGlow = 2.0;         
outlinePass.edgeThickness = 0.5;    
outlinePass.visibleEdgeColor.set('#ffffff');
outlinePass.hiddenEdgeColor.set('#000000');

// Füge den OutlinePass zum finalComposer hinzu
finalComposer.addPass(outlinePass);


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

// ================= Zufällige 3D-Formen via ConvexGeometry =================

function createRandom3DShape() {
  const points = [];
  const numPoints = 20 + Math.floor(Math.random() * 10); // zwischen 20 und 30 Punkte
  for (let i = 0; i < numPoints; i++) {
    const point = new THREE.Vector3(
      (Math.random() - 0.5),
      (Math.random() - 0.5),
      (Math.random() - 0.5)
    ).normalize().multiplyScalar(0.5 + Math.random() * 0.5);
    points.push(point);
  }
  const geometry = new THREE.ConvexGeometry(points);
  // Skaliere die Geometrie auf etwa ein Drittel
  geometry.scale(0.33, 0.33, 0.33);
  return geometry;
}

// ================= Satelliten (Orbit um das Hauptobjekt) =================
const satellites = [];
const satelliteCount = 8;

for (let i = 0; i < satelliteCount; i++) {
  // Verwende die zufällige 3D-Form statt einer Kugel
  const satGeometry = createRandom3DShape();
  // Material im Wireframe-Modus beibehalten
  const satMaterial = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    wireframe: true,
    emissive: 0xffffff,
    emissiveIntensity: 0.3
  });
  const satellite = new THREE.Mesh(satGeometry, satMaterial);
  
  // Orbit-Parameter
  satellite.userData.angle = (i / satelliteCount) * Math.PI * 2;
  satellite.userData.inclination = (Math.random() - 0.5) * (Math.PI / 3);
  satellite.userData.orbitRadius = 2 + Math.random() * 2;
  satellite.userData.orbitSpeed = 0.2 + Math.random() * 0.8;
  satellite.userData.selfRotationSpeed = 0.2 + Math.random() * 0.5;
  
  // Positionierung des Satelliten im Orbit um das Hauptobjekt
  satellite.position.x = morphObject.position.x + satellite.userData.orbitRadius * Math.cos(satellite.userData.angle) * Math.cos(satellite.userData.inclination);
  satellite.position.y = morphObject.position.y + satellite.userData.orbitRadius * Math.sin(satellite.userData.inclination);
  satellite.position.z = morphObject.position.z + satellite.userData.orbitRadius * Math.sin(satellite.userData.angle) * Math.cos(satellite.userData.inclination);
  
  satellites.push(satellite);
  scene.add(satellite);
}

outlinePass.selectedObjects = satellites;

// ================= Clock =================

const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  
  const delta = clock.getDelta();
  // Update des Hauptobjekts (morphObject) – Morphing bleibt erhalten
  const positions = morphObject.geometry.attributes.position.array;
  const origPositions = morphObject.geometry.userData.origPositions;
  const vertexCount = positions.length / 3;
  
  for (let i = 0; i < vertexCount; i++) {
    const ix = i * 3;
    const ox = origPositions[ix];
    const oy = origPositions[ix + 1];
    const oz = origPositions[ix + 2];
    const sinOffset = Math.sin(clock.getElapsedTime() + (ox + oy + oz) * currentMorphFrequency);
    const noiseOffset = currentNoiseFactor * Math.sin(clock.getElapsedTime() * 0.5 + (ox - oy + oz));
    const offset = sinOffset + noiseOffset;
    positions[ix]     = ox + ox * offset * currentMorphIntensity;
    positions[ix + 1] = oy + oy * offset * currentMorphIntensity;
    positions[ix + 2] = oz + oz * offset * currentMorphIntensity;
  }
  morphObject.geometry.attributes.position.needsUpdate = true;
  morphObject.rotation.x += 0.005;
  morphObject.rotation.y += 0.005;
  
  // Update der Satelliten: Orbit und Rotation (keine zusätzliche Morphing-Logik)
  satellites.forEach((satellite) => {
    satellite.userData.angle += satellite.userData.orbitSpeed * delta;
    satellite.position.x = morphObject.position.x + satellite.userData.orbitRadius * Math.cos(satellite.userData.angle) * Math.cos(satellite.userData.inclination);
    satellite.position.y = morphObject.position.y + satellite.userData.orbitRadius * Math.sin(satellite.userData.inclination);
    satellite.position.z = morphObject.position.z + satellite.userData.orbitRadius * Math.sin(satellite.userData.angle) * Math.cos(satellite.userData.inclination);
    
    satellite.rotation.y += satellite.userData.selfRotationSpeed * delta;
  });
  
  // Optionale Kamera-Bewegung
  camera.position.x = Math.sin(clock.getElapsedTime() * 0.2) * 0.2;
  camera.rotation.y = Math.sin(clock.getElapsedTime() * 0.3) * 0.1;
  
  // Statt composer.render() verwenden wir finalComposer.render()!
  finalComposer.render();
}

animate();



// ================= Effekt: Random Planet (seqlight) =================

function triggerPlanetLight(paramValue) {
  // paramValue: 0 bedeutet keiner, 1–8 bewirken, dass der jeweilige Satellit aufleuchtet.
  if (paramValue <= 0 || paramValue > satellites.length) return;
  const index = paramValue - 1; // z. B. 1 entspricht dem ersten Satelliten
  const satellite = satellites[index];
  if (!satellite) return;
  
  // Speichere den Originalwert
  const originalEmissiveIntensity = satellite.material.emissiveIntensity;
  
  // Erhöhe kurzzeitig die emissiveIntensity für den Glow-Effekt
  satellite.material.emissiveIntensity = 5;
  
  // Nach 500 ms wird der Effekt wieder zurückgesetzt
  setTimeout(() => {
    satellite.material.emissiveIntensity = originalEmissiveIntensity;
  }, 120);
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

// ---------------- RNBO Integration Code ----------------

window.rnboDevice = null;
window.device = null; // Für sendValueToRNBO
let parameterQueue = {};

async function setupRNBO() {
  const patchExportURL = "https://atmono-philtreezs-projects.vercel.app/export/patch.export.json";
  const WAContext = window.AudioContext || window.webkitAudioContext;
  const context = new WAContext();               // AudioContext erstellen
  window.rnboContext = context;                    // Global speichern
  const outputNode = context.createGain();
  outputNode.connect(context.destination);
  
  // Analyser Node hinzufügen:
  const analyser = context.createAnalyser();
  analyser.fftSize = 512;
  window.rnboAnalyser = analyser;  // Global speichern, damit das Oszilloskop darauf zugreifen kann
  outputNode.connect(analyser);
  
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
  attachRNBOMessages(deviceInstance, context);
  attachOutports(deviceInstance);
  flushParameterQueue();
  
  document.body.onclick = () => context.resume();
  
  // Starte das Oszilloskop, wenn der Analyser vorhanden ist
  setupOscilloscope();
}

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

// Zeichnet einen einzelnen Oszilloskop-Frame
function drawOscilloscopeFrame() {
  const canvas = document.getElementById("oscilloscope");
  if (!canvas) {
    console.error("Kein Oscilloskop-Canvas gefunden!");
    return;
  }
  const ctx = canvas.getContext("2d");
  const analyser = window.rnboAnalyser;
  if (!analyser) {
    console.error("Kein Analyser verfügbar.");
    return;
  }
  
  const bufferLength = analyser.fftSize;
  const dataArray = new Float32Array(bufferLength);
  analyser.getFloatTimeDomainData(dataArray);
  
  // Hintergrund und Gitter zeichnen
  ctx.fillStyle = 'rgb(10, 10, 10)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = 'rgba(80, 80, 80, 0.5)';
  ctx.lineWidth = 1;
  const gridSpacing = 15;
  for (let x = gridSpacing; x < canvas.width; x += gridSpacing) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
    ctx.stroke();
  }
  for (let y = gridSpacing; y < canvas.height; y += gridSpacing) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
  }
  
  // Zeichne Wellenform
  ctx.lineWidth = 2;
  ctx.strokeStyle = 'white';
  ctx.beginPath();
  const sliceWidth = canvas.width / bufferLength;
  let x = 0;
  for (let i = 0; i < bufferLength; i++) {
    const y = canvas.height / 2 + dataArray[i] * (canvas.height / 2 * 10);
    if (i === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
    x += sliceWidth;
  }
  ctx.stroke();
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

function visualizeWaveform(samples) {
  const canvas = document.getElementById("waveform");
  if (!canvas) {
    console.warn("Kein Canvas-Element mit der ID 'waveform' gefunden.");
    return;
  }
  const ctx = canvas.getContext("2d");
  // Canvas leeren
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  // Zeichne eine Linie, die den Verlauf der Amplitude darstellt.
  ctx.beginPath();
  const step = Math.floor(samples.length / canvas.width);
  for (let i = 0; i < canvas.width; i++) {
    const sampleIndex = i * step;
    const sample = samples[sampleIndex];
    // Normalisiere den Samplewert (-1 bis 1) auf die Canvas-Höhe
    const y = (1 - (sample + 1) / 2) * canvas.height;
    if (i === 0) {
      ctx.moveTo(i, y);
    } else {
      ctx.lineTo(i, y);
    }
  }
  ctx.strokeStyle = "white";
  ctx.lineWidth = 1;
  ctx.stroke();
}

// Holt den AudioBuffer aus dem RNBO-Gerät mithilfe der releaseDataBuffer‑Methode
// und visualisiert anschließend den ersten Kanal
async function visualizeBuffer(bufferName) {
  if (!window.rnboDevice || typeof window.rnboDevice.releaseDataBuffer !== 'function') {
    console.warn("RNBO device oder releaseDataBuffer Funktion nicht verfügbar.");
    return;
  }
  try {
    const dataBuffer = await window.rnboDevice.releaseDataBuffer(bufferName);
    if (!window.rnboContext) {
      console.warn("Kein AudioContext verfügbar. Stelle sicher, dass setupRNBO() aufgerufen wurde.");
      return;
    }
    const audioBuffer = await dataBuffer.getAsAudioBuffer(window.rnboContext);
    if (!audioBuffer) {
      console.warn("Kein AudioBuffer von " + bufferName + " erhalten.");
      return;
    }
    const channelData = audioBuffer.getChannelData(0);
    visualizeWaveform(channelData);
  } catch (err) {
    console.error("Fehler beim Abrufen des DataBuffers: ", err);
  }
}

// ---------------- Steuerung: RNBO Nachrichten ----------------

function attachRNBOMessages(device, context) {
  const controlIds = ["s1", "s2", "s3", "s4", "s5", "s6", "s7", "s8", "s9", "s10", "vol", "playstat", "b1", "b2", "b3", "b4", "b5", "b6", "b7", "b8", "rndm", "rec"];
  
  // --- Restliche Parameter-Integration ---
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
      if (param.id === "rndmblink") {
        const value = parseInt(param.value);
        updateRndmblinkTransparency(value);
        console.log("rndmblink aktualisiert: ", value);
      }
      if (param.id === "bloomRadius") {
        bloomPass.radius = parseFloat(param.value);
        console.log("Bloom radius updated: " + bloomPass.radius);
      }
      if (param.id === "playstat") {
        const value = parseFloat(param.value);
        updatePlaystatSliderFromRNBO(value);
        console.log("playstat aktualisiert: ", value);
      }
      if (param.id === "rec") {
        updateButtonFromRNBO(param.id, parseFloat(param.value));
        console.log(`REC aktualisiert aus RNBO: ${param.value}`);
        
        // Falls Aufnahme beendet wird (1 → 0), Buffer visualisieren
        if (parseFloat(param.value) === 0) {
          setTimeout(() => {
            visualizeBuffer("lulu");
          }, 1);
        }
      }
      // Für "rndm" und "rec" als Buttons
      else if (param.id === "rndm") {
        updateButtonFromRNBO(param.id, parseFloat(param.value));
        console.log(`${param.id} aktualisiert: ${param.value}`);
      }
      // Für andere Parameter, die Slider oder Buttons sein könnten
      else if (controlIds.includes(param.id)) {
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
      if (ev.tag === "rndmblink") {
        const value = parseInt(ev.payload);
        updateRndmblinkTransparency(value);
        console.log("rndmblink aktualisiert: ", value);
      }
      if (ev.tag === "bloomRadius") {
        bloomPass.radius = parseFloat(ev.payload);
        console.log("Bloom radius updated: " + bloomPass.radius);
      }
      if (ev.tag === "playstat") {
        const value = parseFloat(ev.payload);
        updatePlaystatSliderFromRNBO(value);
        console.log("playstat aktualisiert: ", value);
      }
      else if (ev.tag === "rndm" || ev.tag === "rec") {
        updateButtonFromRNBO(ev.tag, parseFloat(ev.payload));
        console.log(`${ev.tag} aktualisiert: ${ev.payload}`);
      }
      else if (controlIds.includes(ev.tag)) {
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

// ---------------- Steuerung der Outports ----------------

function attachOutports(device) {
  device.messageEvent.subscribe(ev => {
    if (ev.tag === "trig16th") {
      // Jedes Mal, wenn der Trigger aus RNBO kommt (jede 16tel Note), wird ein Frame gezeichnet
      drawOscilloscopeFrame();
      console.log("Oscilloscope getriggert (16tel Note)");
    }
    if (ev.tag === "glitchy") {
      glitchPass.enabled = (parseInt(ev.payload) === 1);
    }
    if (ev.tag.startsWith("light1") || ev.tag.startsWith("light2")) {
      updateLights(ev.tag, ev.payload);
    }
    console.log(`${ev.tag}: ${ev.payload}`);
  });
}

function updateLights(outport, value) {
  const intVal = Math.round(parseFloat(value));
  console.log(`Update Lights for ${outport}: ${intVal}`);
  for (let i = 1; i <= 8; i++) {
    const el = document.getElementById(`${outport}-${i}`);
    if (el) {
      el.style.opacity = (intVal === i) ? "1" : "0";
    }
  }
}

// ---------------- Rotary Slider Setup (Vertikale Slider für s1 ... s8) ----------------

function updateSliderFromRNBO(id, value) {
  const sliderContainer = document.getElementById("slider-" + id);
  if (sliderContainer) {
    sliderContainer.dataset.value = value;
    const thumb = sliderContainer.querySelector(".thumb");
    if (thumb) {
      const travel = sliderContainer.clientHeight - thumb.clientHeight;
      thumb.style.top = (value * travel) + "px";
    }
  }
}

function setupVerticalSliders() {
  const sliderIds = ["s1", "s2", "s3", "s4", "s5", "s6", "s7", "s8", "s9", "s10"];
  sliderIds.forEach(id => {
    const sliderContainer = document.getElementById("slider-" + id);
    if (!sliderContainer) {
      console.warn("Slider container nicht gefunden:", "slider-" + id);
      return;
    }
    sliderContainer.style.width = "30px";
    sliderContainer.style.height = "130px";
    sliderContainer.style.position = "relative";
    sliderContainer.style.borderRadius = "4px";
    sliderContainer.dataset.value = "0";
    const thumb = sliderContainer.querySelector(".thumb");
    if (!thumb) {
      console.warn("Thumb div nicht gefunden in:", "slider-" + id);
      return;
    }
    thumb.style.width = "30px";
    thumb.style.height = "13px";
    thumb.style.position = "absolute";
    thumb.style.top = "0px";
    thumb.style.left = "0px";
    thumb.style.borderRadius = "4px";
    thumb.style.touchAction = "none";
    let isDragging = false;
    let startY = 0;
    let initialValue = 0;
    thumb.addEventListener("pointerdown", (e) => {
      isDragging = true;
      startY = e.clientY;
      initialValue = parseFloat(sliderContainer.dataset.value);
      thumb.setPointerCapture(e.pointerId);
    });
    thumb.addEventListener("pointermove", (e) => {
      if (!isDragging) return;
      const dy = e.clientY - startY;
      const travel = sliderContainer.clientHeight - thumb.clientHeight;
      let delta = dy / travel;
      let newValue = initialValue + delta;
      newValue = Math.max(0, Math.min(newValue, 1));
      sliderContainer.dataset.value = newValue.toString();
      thumb.style.top = (newValue * travel) + "px";
      sendValueToRNBO(id, newValue);
    });
    thumb.addEventListener("pointerup", () => { isDragging = false; });
    thumb.addEventListener("pointercancel", () => { isDragging = false; });
  });
}

// ---------------- Volume Slider Setup (IDs: volume-slider, volume-thumb) ----------------

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

function setupPlaystatSlider() {
  const slider = document.getElementById("playstat-slider");
  const thumb = document.getElementById("playstat-thumb");
  if (!slider || !thumb) {
    console.error("Playstat slider elements not found!");
    return;
  }
  const sliderWidth = slider.offsetWidth;
  const thumbWidth = thumb.offsetWidth;
  const maxMovement = sliderWidth - thumbWidth;
  // Initialer Wert für playstat (zwischen 0 und 1)
  const initialValue = 0.5;
  const initialX = maxMovement * initialValue;
  thumb.style.left = initialX + "px";
  sendValueToRNBO("playstat", initialValue);
  
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
    sendValueToRNBO("playstat", normalizedValue);
  });
  
  document.addEventListener("mouseup", () => { isDragging = false; });
}

function updatePlaystatSliderFromRNBO(value) {
  const slider = document.getElementById("playstat-slider");
  const thumb = document.getElementById("playstat-thumb");
  if (!slider || !thumb) return;
  const maxMovement = slider.offsetWidth - thumb.offsetWidth;
  thumb.style.left = (value * maxMovement) + "px";
}


// ---------------- Button Setup (IDs: b1 ... b8, rndm) ----------------

function setupButtons() {
  const buttonIds = ["b1", "b2", "b3", "b4", "b5", "b6", "b7", "b8", "rndm", "rec"];
  buttonIds.forEach(id => {
    const button = document.getElementById(id);
    if (!button) {
      console.warn("Button element nicht gefunden:", id);
      return;
    }
    button.dataset.value = "0";
    button.style.opacity = "0";
    button.style.cursor = "pointer";
    button.addEventListener("click", () => {
      let current = parseInt(button.dataset.value);
      let newValue = (current === 0) ? 1 : 0;
      button.dataset.value = newValue.toString();
      button.style.opacity = (newValue === 1) ? "1" : "0";
      sendValueToRNBO(id, newValue);

      // Wenn der "rec"-Button von 1 (Aufnahme läuft) auf 0 (Aufnahme beendet) wechselt,
      // dann den Buffer "lulu" auslesen und visualisieren.
      if (id === "rec" && newValue === 0) {
        // Kurzes Delay, damit der Buffer ggf. aktualisiert wurde
        setTimeout(() => {
          visualizeBuffer("lulu");
        }, 10);
      }
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

// ---------------- Random Blink (rndmblink) Setup ----------------

function updateRndmblinkTransparency(value) {
  const blinkDivs = document.querySelectorAll("#rndmcont .rndmblink");
  if (value == 0) {
    blinkDivs.forEach(div => {
      div.style.opacity = "0";
    });
  } else if (value == 1) {
    blinkDivs.forEach(div => {
      div.style.opacity = Math.random() > 0.5 ? "1" : "0";
    });
  }
}

// ---------------- DOMContentLoaded Aufrufe ----------------
document.addEventListener("DOMContentLoaded", () => {
  setupRNBO(); // RNBO initialisieren
  setupVolumeSlider();
  setupVerticalSliders();
  setupButtons();
  setupPlaystatSlider();
});
