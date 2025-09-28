const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

let audioCtx, analyser, source, bufferLength, dataArray, audio;
let rotationAngle = 0;
let particles = [];

// Effets choisis
const effects = {
  rainbow: false,
  glow: false,
  particles: false,
  maxRadius: 200,
  rotationSpeed: 0.02,
  shape: "circle",
};

// Variables pour l'export vidéo
let mediaRecorder;
let recordedChunks = [];
let audioDuration = 0;
let isExporting = false;
let exportAnimationId = null;
let isPlaying = false;

// NOUVELLES variables pour le slider double
let startSlider, endSlider, rangeSelection;
let startTimeDisplay, endTimeDisplay, customDurationDisplay;

// Fonction pour formater le temps en HH:MM:SS
function formatTime(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours.toString().padStart(2, "0")}:${minutes
      .toString()
      .padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  } else {
    return `${minutes.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}`;
  }
}

// Fonction pour convertir HH:MM:SS en secondes
function timeToSeconds(timeString) {
  const parts = timeString.split(":");
  let seconds = 0;

  if (parts.length === 3) {
    // HH:MM:SS
    seconds =
      parseInt(parts[0]) * 3600 + parseInt(parts[1]) * 60 + parseInt(parts[2]);
  } else if (parts.length === 2) {
    // MM:SS
    seconds = parseInt(parts[0]) * 60 + parseInt(parts[1]);
  }

  return seconds;
}

// Fonction pour mettre à jour le slider double
function updateRangeSlider() {
  if (!startSlider || !endSlider || !audioDuration) return;

  const startValue = parseInt(startSlider.value);
  const endValue = parseInt(endSlider.value);

  // S'assurer que start < end
  if (startValue >= endValue) {
    if (startSlider === document.activeElement) {
      endSlider.value = Math.min(startValue + 1, 100);
    } else {
      startSlider.value = Math.max(endValue - 1, 0);
    }
  }

  const finalStartValue = parseInt(startSlider.value);
  const finalEndValue = parseInt(endSlider.value);

  // Calculer les positions et durées
  const startSeconds = (finalStartValue / 100) * audioDuration;
  const endSeconds = (finalEndValue / 100) * audioDuration;
  const duration = endSeconds - startSeconds;

  // Mettre à jour la zone sélectionnée (dual-range-fill)
  if (rangeSelection) {
    const leftPercent = finalStartValue;
    const widthPercent = finalEndValue - finalStartValue;

    rangeSelection.style.left = `${leftPercent}%`;
    rangeSelection.style.width = `${widthPercent}%`;
  }

  // Mettre à jour les indicateurs de temps
  if (startTimeDisplay) {
    startTimeDisplay.textContent = formatTime(startSeconds);
    startTimeDisplay.style.left = `${finalStartValue}%`;
  }

  if (endTimeDisplay) {
    endTimeDisplay.textContent = formatTime(endSeconds);
    endTimeDisplay.style.left = `${finalEndValue}%`;
  } // Mettre à jour la durée
  if (customDurationDisplay) {
    customDurationDisplay.textContent = `Durée sélectionnée: ${formatTime(
      duration
    )}`;
  }
}

// Fonction pour initialiser le slider double
function initializeRangeSlider() {
  startSlider = document.getElementById("rangeMin");
  endSlider = document.getElementById("rangeMax");
  rangeSelection = document.getElementById("rangeFill");
  startTimeDisplay = document.getElementById("labelMin");
  endTimeDisplay = document.getElementById("labelMax");
  customDurationDisplay = document.getElementById("selectedDuration");

  if (startSlider && endSlider) {
    // Définir la durée maximale
    if (audioDuration) {
      endSlider.value = 100;
      endTimeDisplay.textContent = formatTime(audioDuration);
    }

    // Event listeners
    startSlider.addEventListener("input", updateRangeSlider);
    endSlider.addEventListener("input", updateRangeSlider);

    // Mise à jour initiale
    updateRangeSlider();
  }
}

// Fonction pour obtenir les valeurs du slider
function getCustomRange() {
  if (!startSlider || !endSlider || !audioDuration) return null;

  const startPercent = parseInt(startSlider.value) / 100;
  const endPercent = parseInt(endSlider.value) / 100;

  return {
    startTime: startPercent * audioDuration,
    endTime: endPercent * audioDuration,
    duration: (endPercent - startPercent) * audioDuration,
  };
}

// UN SEUL event listener pour fileInput
document.getElementById("fileInput").addEventListener("change", function (e) {
  const file = e.target.files[0];
  if (!file) return;

  // Animation de chargement sur l'input
  this.style.background =
    "linear-gradient(145deg, rgba(78, 205, 196, 0.2), rgba(68, 160, 141, 0.1))";
  this.style.borderColor = "rgba(78, 205, 196, 0.5)";

  // Arrêter l'ancien audio s'il existe
  if (audio) {
    audio.pause();
    audio.src = "";
    audio = null;
  }
  if (audioCtx) {
    audioCtx.close();
  }

  // Créer un nouvel élément audio
  audio = new Audio();
  audio.src = URL.createObjectURL(file);
  audio.controls = true;
  audio.loop = false;

  // Ajout des event listeners pour le statut audio
  audio.addEventListener("play", () => {
    isPlaying = true;
    updatePlayPauseButton();
  });

  audio.addEventListener("pause", () => {
    isPlaying = false;
    updatePlayPauseButton();
  });

  audio.addEventListener("ended", () => {
    isPlaying = false;
    updatePlayPauseButton();
  });

  // Récupérer la durée de l'audio
  audio.addEventListener("loadedmetadata", () => {
    audioDuration = audio.duration;

    const fullDurationEl = document.getElementById("fullDuration");
    const endTimeEl = document.getElementById("endTime");

    if (fullDurationEl) {
      fullDurationEl.textContent = `Durée: ${formatTime(audioDuration)}`;
    }
    if (endTimeEl) {
      endTimeEl.value = formatTime(audioDuration);
    }

    // CORRECTION: Afficher le bouton d'export avec position correcte
    const exportBtn = document.getElementById("exportButton");
    if (exportBtn) {
      exportBtn.style.display = "block";
      exportBtn.style.position = "fixed";
      exportBtn.style.bottom = "30px";
      exportBtn.style.right = "30px";
      exportBtn.style.transform = "scale(0)";
      exportBtn.style.zIndex = "100";

      setTimeout(() => {
        exportBtn.style.transform = "scale(1)";
        exportBtn.style.transition =
          "transform 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55)";
      }, 100);
    }

    // Activation du bouton pause/play
    const playPauseBtn = document.getElementById("playPauseButton");
    if (playPauseBtn) {
      console.log("Activation du bouton play/pause");
      playPauseBtn.style.display = "flex";
      playPauseBtn.style.visibility = "visible";
      playPauseBtn.style.opacity = "1";
      playPauseBtn.style.zIndex = "1000";
      playPauseBtn.style.position = "fixed";
      playPauseBtn.style.pointerEvents = "auto";
      playPauseBtn.style.cursor = "pointer";
      playPauseBtn.style.transform = "translateX(-50%) scale(1)";
      playPauseBtn.style.transition = "all 0.3s ease";
      playPauseBtn.title = "Mettre en pause";
      console.log("Bouton play/pause activé et opaque");
    }

    updateCustomDuration();

    // Restaurer le style original de l'input après 2 secondes
    const inputElement = this;
    setTimeout(() => {
      inputElement.style.background = "";
      inputElement.style.borderColor = "";
    }, 2000);
  });

  audio.play();

  // Contexte audio
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  source = audioCtx.createMediaElementSource(audio);
  analyser = audioCtx.createAnalyser();
  source.connect(analyser);
  analyser.connect(audioCtx.destination);

  analyser.fftSize = 256;
  bufferLength = analyser.frequencyBinCount;
  dataArray = new Uint8Array(bufferLength);

  animate();
});

// Classe pour les particules
class Particle {
  constructor(x, y, color) {
    this.x = x;
    this.y = y;
    this.vx = (Math.random() - 0.5) * 4;
    this.vy = (Math.random() - 0.5) * 4;
    this.alpha = 1;
    this.color = color;
  }

  update() {
    this.x += this.vx;
    this.y += this.vy;
    this.alpha -= 0.02;
  }

  draw() {
    ctx.globalAlpha = this.alpha;
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}

// Dessin des formes
function drawShape(x, y, radius, sides, inset = 1) {
  ctx.beginPath();
  for (let i = 0; i < sides; i++) {
    let angle = (i / sides) * Math.PI * 2;
    let r = i % 2 === 0 ? radius : radius * inset;
    let px = x + r * Math.cos(angle);
    let py = y + r * Math.sin(angle);
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.stroke();
}

// Fonction utilitaire pour dessiner des formes sur un contexte spécifique
function drawShapeOnContext(context, x, y, radius, sides, inset = 1) {
  context.beginPath();
  for (let i = 0; i < sides; i++) {
    let angle = (i / sides) * Math.PI * 2;
    let r = i % 2 === 0 ? radius : radius * inset;
    let px = x + r * Math.cos(angle);
    let py = y + r * Math.sin(angle);
    if (i === 0) context.moveTo(px, py);
    else context.lineTo(px, py);
  }
  context.closePath();
  context.stroke();
}

// Fonction pour mettre à jour le bouton play/pause
function updatePlayPauseButton() {
  const playPauseBtn = document.getElementById("playPauseButton");
  if (!playPauseBtn) return;

  if (isPlaying) {
    playPauseBtn.textContent = "❚❚";
    playPauseBtn.classList.add("playing");
    playPauseBtn.classList.remove("paused");
    playPauseBtn.title = "Mettre en pause";
  } else {
    playPauseBtn.textContent = "▶︎";
    playPauseBtn.classList.add("paused");
    playPauseBtn.classList.remove("playing");
    playPauseBtn.title = "Reprendre la lecture";
  }
}

// Fonction pour redimensionner le canvas
function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}

// Redimensionnement initial et sur changement de taille
resizeCanvas();
window.addEventListener("resize", resizeCanvas);

// Détection mobile pour ajuster les effets
const isMobile =
  /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );

// Ajuster les effets par défaut selon l'appareil
if (isMobile) {
  effects.maxRadius = 150;
  effects.rotationSpeed = 0.015;
  effects.particles = false;
}

// Fonction d'animation
function animate() {
  requestAnimationFrame(animate);

  if (!analyser) return;

  analyser.getByteFrequencyData(dataArray);

  // Dynamisme : on met plus de poids aux basses fréquences
  let lowFreq = dataArray.slice(0, dataArray.length / 4);
  let sum = lowFreq.reduce((a, b) => a + b, 0);
  let avg = sum / lowFreq.length;

  // Effacer fond en noir
  ctx.fillStyle = "black";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Adapter la taille selon l'écran
  const baseRadius = Math.min(canvas.width, canvas.height) * 0.05;
  let radius = baseRadius + (avg / 255) * effects.maxRadius;

  // Rotation continue
  rotationAngle += effects.rotationSpeed;

  // Couleur dynamique
  let color;
  if (effects.rainbow) {
    color = `hsl(${(Date.now() / 15) % 360}, 100%, 50%)`;
  } else {
    color = `hsl(${avg * 2}, 100%, 50%)`;
  }

  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(2, Math.min(canvas.width, canvas.height) / 80);
  ctx.shadowBlur = effects.glow ? (isMobile ? 15 : 30) : 0;
  ctx.shadowColor = color;

  const x = canvas.width / 2;
  const y = canvas.height / 2;

  // Appliquer rotation
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotationAngle);

  switch (effects.shape) {
    case "circle":
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, Math.PI * 2);
      ctx.stroke();
      break;
    case "square":
      ctx.beginPath();
      ctx.rect(-radius, -radius, radius * 2, radius * 2);
      ctx.stroke();
      break;
    case "triangle":
      drawShapeOnContext(ctx, 0, 0, radius, 3);
      break;
    case "hexagon":
      drawShapeOnContext(ctx, 0, 0, radius, 6);
      break;
    case "star":
      drawShapeOnContext(ctx, 0, 0, radius, 10, 0.5);
      break;
  }

  ctx.restore();

  // Particules optimisées
  if (effects.particles && avg > (isMobile ? 200 : 180)) {
    if (!isMobile || particles.length < 20) {
      particles.push(new Particle(x, y, color));
    }
  }

  particles.forEach((p, i) => {
    p.update();
    p.draw();
    if (p.alpha <= 0) particles.splice(i, 1);
  });
}

// Gestion tactile pour mobile
let touchStartX = 0;
let touchStartY = 0;

canvas.addEventListener(
  "touchstart",
  (e) => {
    e.preventDefault();
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
  },
  { passive: false }
);

canvas.addEventListener(
  "touchmove",
  (e) => {
    e.preventDefault();
  },
  { passive: false }
);

canvas.addEventListener(
  "touchend",
  (e) => {
    e.preventDefault();
    const touchEndX = e.changedTouches[0].clientX;
    const touchEndY = e.changedTouches[0].clientY;

    const deltaX = touchEndX - touchStartX;
    const deltaY = Math.abs(touchEndY - touchStartY);

    if (Math.abs(deltaX) > 50 && deltaY < 100) {
      const panel = document.getElementById("controlPanel");
      if (deltaX > 0 && touchStartX < 50) {
        panel.classList.add("open");
      } else if (deltaX < 0 && panel.classList.contains("open")) {
        panel.classList.remove("open");
      }
    }
  },
  { passive: false }
);

// Gestionnaire du bouton play/pause
const playPauseButton = document.getElementById("playPauseButton");
if (playPauseButton) {
  playPauseButton.addEventListener("click", () => {
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
    } else {
      // Gérer le contexte audio pour les navigateurs modernes
      if (audioCtx && audioCtx.state === "suspended") {
        audioCtx.resume().then(() => {
          audio.play();
        });
      } else {
        audio.play();
      }
    }
  });
}

// Contrôles panneau
const panel = document.getElementById("controlPanel");
const toggleBtn = document.getElementById("togglePanel");

if (toggleBtn && panel) {
  toggleBtn.addEventListener("click", () => {
    const isOpen = panel.classList.contains("open");
    panel.classList.toggle("open");

    if (!isOpen) {
      // Animer les éléments du panneau lors de l'ouverture
      const panelElements = panel.querySelectorAll("label, h2, select");
      panelElements.forEach((el, index) => {
        el.style.opacity = "0";
        el.style.transform = "translateX(-20px)";
        setTimeout(() => {
          el.style.transition = "opacity 0.3s ease, transform 0.3s ease";
          el.style.opacity = "1";
          el.style.transform = "translateX(0)";
        }, index * 50);
      });
    }
  });
}

// Effets listeners
document.getElementById("rainbowEffect").addEventListener("change", (e) => {
  effects.rainbow = e.target.checked;
  if (e.target.checked) {
    e.target.parentElement.style.background =
      "linear-gradient(135deg, rgba(255, 0, 150, 0.1), rgba(0, 255, 255, 0.1))";
  } else {
    e.target.parentElement.style.background = "";
  }
});

document.getElementById("glowEffect").addEventListener("change", (e) => {
  effects.glow = e.target.checked;
  if (e.target.checked) {
    e.target.parentElement.style.background =
      "linear-gradient(135deg, rgba(78, 205, 196, 0.1), rgba(68, 160, 141, 0.05))";
  } else {
    e.target.parentElement.style.background = "";
  }
});

document.getElementById("particlesEffect").addEventListener("change", (e) => {
  effects.particles = e.target.checked;
  if (e.target.checked) {
    e.target.parentElement.style.background =
      "linear-gradient(135deg, rgba(255, 215, 0, 0.1), rgba(255, 140, 0, 0.05))";
  } else {
    e.target.parentElement.style.background = "";
  }
});

// Sliders
document.getElementById("maxRadius").addEventListener("input", (e) => {
  effects.maxRadius = +e.target.value;
  const percentage = ((e.target.value - 100) / (400 - 100)) * 100;
  e.target.style.background = `linear-gradient(90deg, rgba(78, 205, 196, 0.6) 0%, rgba(78, 205, 196, 0.6) ${percentage}%, rgba(255, 255, 255, 0.1) ${percentage}%, rgba(255, 255, 255, 0.1) 100%)`;
});

document.getElementById("rotationSpeed").addEventListener("input", (e) => {
  effects.rotationSpeed = +e.target.value;
  const percentage = ((e.target.value - 0) / (0.1 - 0)) * 100;
  e.target.style.background = `linear-gradient(90deg, rgba(78, 205, 196, 0.6) 0%, rgba(78, 205, 196, 0.6) ${percentage}%, rgba(255, 255, 255, 0.1) ${percentage}%, rgba(255, 255, 255, 0.1) 100%)`;
});

document.getElementById("shapeSelect").addEventListener("change", (e) => {
  effects.shape = e.target.value;
  e.target.style.background =
    "linear-gradient(145deg, rgba(78, 205, 196, 0.3), rgba(68, 160, 141, 0.2))";
  setTimeout(() => {
    e.target.style.background = "";
  }, 500);
});

// Gestion du popup d'export
const exportButton = document.getElementById("exportButton");
const exportPopup = document.getElementById("exportPopup");
const closePopup = document.getElementById("closePopup");
const successMessage = document.getElementById("successMessage");

if (exportButton) {
  exportButton.addEventListener("click", () => {
    exportPopup.classList.add("show");
    addAnimationClasses();

    // S'assurer que la section du dual range slider est visible
    const customRangeInputs = document.getElementById("customRangeInputs");
    if (customRangeInputs) {
      customRangeInputs.style.display = "block";
    }

    // Initialiser le slider quand le popup s'ouvre
    setTimeout(() => {
      initializeRangeSlider();
    }, 150);
  });
}

if (closePopup) {
  closePopup.addEventListener("click", closeExportPopup);
}

if (exportPopup) {
  exportPopup.addEventListener("click", (e) => {
    if (e.target === exportPopup) {
      closeExportPopup();
    }
  });
}

function closeExportPopup() {
  if (exportPopup) {
    exportPopup.classList.remove("show");
  }
  const progressContainer = document.getElementById("exportProgress");
  const progressFill = document.getElementById("progressFill");
  if (progressContainer) progressContainer.style.display = "none";
  if (progressFill) progressFill.style.width = "0%";

  // Réinitialiser l'état d'export
  isExporting = false;
  if (exportAnimationId) {
    cancelAnimationFrame(exportAnimationId);
    exportAnimationId = null;
  }
}

// Fonction pour ajouter des animations d'entrée
function addAnimationClasses() {
  const elements = document.querySelectorAll(".fade-in-up");
  elements.forEach((el, index) => {
    el.style.animationDelay = `${index * 0.1}s`;
  });
}

// Gestion des options d'export
const exportTypeRadios = document.querySelectorAll('input[name="exportType"]');
const customRangeInputs = document.getElementById("customRangeInputs");

// Afficher par défaut la section du dual range slider
if (customRangeInputs) {
  customRangeInputs.style.display = "block";
}

// Initialiser le range slider par défaut
setTimeout(() => {
  initializeRangeSlider();
}, 100);

if (exportTypeRadios) {
  exportTypeRadios.forEach((radio) => {
    radio.addEventListener("change", (e) => {
      if (e.target.value === "custom") {
        if (customRangeInputs) customRangeInputs.style.display = "block";
        // Réinitialiser et mettre à jour le slider
        setTimeout(() => {
          initializeRangeSlider();
        }, 100);
      } else {
        if (customRangeInputs) customRangeInputs.style.display = "none";
      }
    });
  });
}

// Mise à jour de la durée personnalisée
function updateCustomDuration() {
  const startTimeEl = document.getElementById("startTime");
  const endTimeEl = document.getElementById("endTime");
  const customDurationEl = document.getElementById("customDuration");

  if (startTimeEl && endTimeEl && customDurationEl) {
    const startTime = timeToSeconds(startTimeEl.value);
    const endTime = timeToSeconds(endTimeEl.value);
    const duration = Math.max(0, endTime - startTime);
    customDurationEl.textContent = `Durée: ${formatTime(duration)}`;
  }
}

const startTimeEl = document.getElementById("startTime");
const endTimeEl = document.getElementById("endTime");
if (startTimeEl) startTimeEl.addEventListener("change", updateCustomDuration);
if (endTimeEl) endTimeEl.addEventListener("change", updateCustomDuration);

// Fonction d'export vidéo avec support des formats
async function exportVideo(
  startTime = 0,
  duration = null,
  quality = "1080",
  format = "landscape"
) {
  try {
    const exportDuration = duration || audioDuration;
    if (exportDuration > 900) {
      alert(
        "❌ Erreur: La durée ne peut pas dépasser 15 minutes pour l'exportation."
      );
      return;
    }

    // Marquer comme en cours d'export
    isExporting = true;

    const progressContainer = document.getElementById("exportProgress");
    const progressFill = document.getElementById("progressFill");
    const progressText = document.getElementById("progressText");

    if (progressContainer) progressContainer.style.display = "block";
    if (progressText) progressText.textContent = "Préparation de l'export...";
    if (progressFill) progressFill.style.width = "10%";

    const tempCanvas = document.createElement("canvas");
    const tempCtx = tempCanvas.getContext("2d");

    // Déterminer les dimensions selon le format et la qualité
    let width, height;
    const qualityMultiplier = {
      480: 0.5,
      720: 0.75,
      1080: 1.0,
    }[quality];

    switch (format) {
      case "portrait": // 9:16 pour Reels/Stories
        width = Math.round(1080 * qualityMultiplier);
        height = Math.round(1920 * qualityMultiplier);
        break;
      case "square": // 1:1 pour Instagram Post
        width = Math.round(1080 * qualityMultiplier);
        height = Math.round(1080 * qualityMultiplier);
        break;
      case "landscape": // 16:9 pour YouTube
      default:
        width = Math.round(1920 * qualityMultiplier);
        height = Math.round(1080 * qualityMultiplier);
        break;
    }

    tempCanvas.width = width;
    tempCanvas.height = height;

    if (progressText)
      progressText.textContent = "Configuration de l'enregistrement...";
    if (progressFill) progressFill.style.width = "20%";

    const stream = tempCanvas.captureStream(30);

    if (audio && audioCtx) {
      const audioDestination = audioCtx.createMediaStreamDestination();
      source.connect(audioDestination);
      const audioTracks = audioDestination.stream.getAudioTracks();
      audioTracks.forEach((track) => stream.addTrack(track));
    }

    recordedChunks = [];

    // Vérifier la compatibilité du codec
    let mimeType = "video/webm;codecs=vp9,opus";
    if (!MediaRecorder.isTypeSupported(mimeType)) {
      mimeType = "video/webm;codecs=vp8,opus";
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = "video/webm";
        if (!MediaRecorder.isTypeSupported(mimeType)) {
          mimeType = "";
        }
      }
    }

    console.log("Using MIME type:", mimeType);

    mediaRecorder = new MediaRecorder(stream, {
      mimeType: mimeType || undefined,
      videoBitsPerSecond:
        quality === "1080" ? 8000000 : quality === "720" ? 5000000 : 2500000,
    });

    mediaRecorder.onstart = () => {
      console.log("MediaRecorder started");
      recordedChunks = []; // Réinitialiser les chunks
    };

    mediaRecorder.ondataavailable = (event) => {
      console.log("Data available, size:", event.data.size);
      if (event.data && event.data.size > 0) {
        recordedChunks.push(event.data);
      }
    };

    mediaRecorder.onerror = (event) => {
      console.error("MediaRecorder error:", event.error);
      alert("❌ Erreur d'enregistrement: " + event.error.message);
      closeExportPopup();
      isExporting = false;
    };

    mediaRecorder.onstop = () => {
      console.log("MediaRecorder stopped, isExporting:", isExporting);
      console.log("Recorded chunks:", recordedChunks.length);

      if (!isExporting) {
        console.log("Export was cancelled");
        return;
      }

      if (recordedChunks.length === 0) {
        console.error("No data recorded");
        alert("❌ Erreur: Aucune donnée enregistrée. Veuillez réessayer.");
        closeExportPopup();
        return;
      }

      const blob = new Blob(recordedChunks, { type: "video/webm" });
      console.log("Blob created, size:", blob.size);

      if (blob.size === 0) {
        console.error("Empty blob created");
        alert("❌ Erreur: Fichier vide généré. Veuillez réessayer.");
        closeExportPopup();
        return;
      }

      const url = URL.createObjectURL(blob);
      console.log("Blob URL created:", url);

      const a = document.createElement("a");
      a.style.display = "none";
      a.href = url;

      // Nom de fichier selon le format
      const formatNames = {
        landscape: "paysage",
        portrait: "portrait",
        square: "carre",
      };
      a.download = `music_visualizer_${
        formatNames[format]
      }_${quality}p_${Date.now()}.webm`;

      console.log("Download filename:", a.download);

      document.body.appendChild(a);

      // Essayer le téléchargement
      try {
        a.click();
        console.log("Download triggered successfully");
      } catch (error) {
        console.error("Click download failed:", error);
        // Alternative de téléchargement
        const link = document.createElement("a");
        link.href = url;
        link.download = a.download;
        document.body.appendChild(link);
        link.dispatchEvent(
          new MouseEvent("click", {
            bubbles: true,
            cancelable: true,
            view: window,
          })
        );
        document.body.removeChild(link);
      }

      document.body.removeChild(a);

      // Nettoyer l'URL après un délai pour permettre le téléchargement
      setTimeout(() => {
        URL.revokeObjectURL(url);
      }, 1000);

      showSuccessMessage();
      closeExportPopup();
      isExporting = false; // S'assurer que l'état est réinitialisé
    };

    if (progressText)
      progressText.textContent = "Démarrage de l'enregistrement...";
    if (progressFill) progressFill.style.width = "30%";

    audio.currentTime = startTime;

    await new Promise((resolve) => {
      audio.addEventListener("seeked", resolve, { once: true });
    });

    mediaRecorder.start();
    audio.play();

    let exportStartTime = Date.now();
    const exportDurationMs = exportDuration * 1000;

    function renderFrame() {
      if (!isExporting) {
        // Export annulé
        if (exportAnimationId) {
          cancelAnimationFrame(exportAnimationId);
          exportAnimationId = null;
        }
        return;
      }

      if (!analyser) return;

      const currentTime = Date.now() - exportStartTime;
      const progress = Math.min(currentTime / exportDurationMs, 1);

      const progressPercent = 30 + progress * 60;
      if (progressFill) progressFill.style.width = `${progressPercent}%`;
      if (progressText)
        progressText.textContent = `Enregistrement en cours... ${Math.round(
          progress * 100
        )}%`;

      analyser.getByteFrequencyData(dataArray);

      let lowFreq = dataArray.slice(0, dataArray.length / 4);
      let sum = lowFreq.reduce((a, b) => a + b, 0);
      let avg = sum / lowFreq.length;

      tempCtx.fillStyle = "black";
      tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);

      const baseRadius = Math.min(tempCanvas.width, tempCanvas.height) * 0.05;
      let radius = baseRadius + (avg / 255) * effects.maxRadius;

      rotationAngle += effects.rotationSpeed;

      let color;
      if (effects.rainbow) {
        color = `hsl(${(Date.now() / 15) % 360}, 100%, 50%)`;
      } else {
        color = `hsl(${avg * 2}, 100%, 50%)`;
      }

      tempCtx.strokeStyle = color;
      tempCtx.lineWidth = Math.max(
        2,
        Math.min(tempCanvas.width, tempCanvas.height) / 80
      );
      tempCtx.shadowBlur = effects.glow ? 30 : 0;
      tempCtx.shadowColor = color;

      const x = tempCanvas.width / 2;
      const y = tempCanvas.height / 2;

      tempCtx.save();
      tempCtx.translate(x, y);
      tempCtx.rotate(rotationAngle);

      switch (effects.shape) {
        case "circle":
          tempCtx.beginPath();
          tempCtx.arc(0, 0, radius, 0, Math.PI * 2);
          tempCtx.stroke();
          break;
        case "square":
          tempCtx.beginPath();
          tempCtx.rect(-radius, -radius, radius * 2, radius * 2);
          tempCtx.stroke();
          break;
        case "triangle":
          drawShapeOnContext(tempCtx, 0, 0, radius, 3);
          break;
        case "hexagon":
          drawShapeOnContext(tempCtx, 0, 0, radius, 6);
          break;
        case "star":
          drawShapeOnContext(tempCtx, 0, 0, radius, 10, 0.5);
          break;
      }

      tempCtx.restore();

      if (
        currentTime < exportDurationMs &&
        mediaRecorder.state === "recording" &&
        isExporting
      ) {
        exportAnimationId = requestAnimationFrame(renderFrame);
      } else {
        if (progressText)
          progressText.textContent = "Finalisation de la vidéo...";
        if (progressFill) progressFill.style.width = "95%";

        setTimeout(() => {
          if (
            isExporting &&
            mediaRecorder &&
            mediaRecorder.state === "recording"
          ) {
            console.log("Stopping MediaRecorder...");
            // Demander les dernières données avant d'arrêter
            mediaRecorder.requestData();
            // Attendre un peu avant d'arrêter pour s'assurer que requestData est traité
            setTimeout(() => {
              mediaRecorder.stop();
            }, 100);
          }
          if (audio) {
            audio.pause();
          }
          if (progressFill) progressFill.style.width = "100%";
        }, 500); // Augmenter le délai pour permettre la finalisation
      }
    }

    renderFrame();
  } catch (error) {
    console.error("Erreur lors de l'export:", error);
    alert("❌ Erreur lors de l'export de la vidéo. Veuillez réessayer.");
    closeExportPopup();
    isExporting = false;
  }
}

function showSuccessMessage() {
  if (successMessage) {
    successMessage.classList.add("show");

    for (let i = 0; i < 20; i++) {
      setTimeout(() => {
        const confetti = document.createElement("div");
        confetti.style.position = "fixed";
        confetti.style.width = "10px";
        confetti.style.height = "10px";
        confetti.style.background = `hsl(${Math.random() * 360}, 100%, 50%)`;
        confetti.style.left = Math.random() * window.innerWidth + "px";
        confetti.style.top = "-10px";
        confetti.style.borderRadius = "50%";
        confetti.style.pointerEvents = "none";
        confetti.style.zIndex = "1002";
        confetti.style.animation = `confetti-fall ${
          2 + Math.random() * 3
        }s linear forwards`;
        document.body.appendChild(confetti);

        setTimeout(() => {
          confetti.remove();
        }, 5000);
      }, i * 100);
    }

    setTimeout(() => {
      successMessage.classList.remove("show");
    }, 3000);
  }
}

// CSS pour confettis
const style = document.createElement("style");
style.textContent = `
  @keyframes confetti-fall {
    0% {
      transform: translateY(-10px) rotate(0deg);
      opacity: 1;
    }
    100% {
      transform: translateY(100vh) rotate(360deg);
      opacity: 0;
    }
  }
`;
document.head.appendChild(style);

// Initialisation
document.addEventListener("DOMContentLoaded", () => {
  // Animation d'entrée pour l'input file - CORRECTION du centrage
  const fileInput = document.getElementById("fileInput");
  if (fileInput) {
    fileInput.style.opacity = "0";
    fileInput.style.transform = "translateX(-50%) translateY(-20px)";
    fileInput.style.left = "50%";
    fileInput.style.position = "fixed";

    setTimeout(() => {
      fileInput.style.transition = "opacity 0.6s ease, transform 0.6s ease";
      fileInput.style.opacity = "1";
      fileInput.style.transform = "translateX(-50%) translateY(0)";
    }, 300);
  }

  // Animation pour le toggle button du panneau - CORRECTION de la visibilité
  const toggleBtn = document.getElementById("togglePanel");
  if (toggleBtn) {
    toggleBtn.style.opacity = "0";
    toggleBtn.style.transform = "scale(0)";
    setTimeout(() => {
      toggleBtn.style.transition =
        "opacity 0.5s ease, transform 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55)";
      toggleBtn.style.opacity = "1";
      toggleBtn.style.transform = "scale(1)";
    }, 600);
  }

  // Initialisation du bouton play/pause (désactivé par défaut)
  const playPauseBtn = document.getElementById("playPauseButton");
  if (playPauseBtn) {
    console.log("Initialisation du bouton play/pause");
    playPauseBtn.style.opacity = "0.3";
    playPauseBtn.style.pointerEvents = "none";
    playPauseBtn.style.cursor = "not-allowed";
    playPauseBtn.textContent = "▶";
    playPauseBtn.title = "Chargez d'abord un fichier audio";

    // S'assurer que le bouton reste visible
    setInterval(() => {
      if (playPauseBtn && playPauseBtn.style.display === "none") {
        console.log("Bouton masqué détecté, restauration...");
        playPauseBtn.style.display = "flex";
      }
    }, 1000);
  }
});

// Boutons export
const exportVideoBtn = document.getElementById("exportVideoBtn");
if (exportVideoBtn) {
  exportVideoBtn.addEventListener("click", () => {
    const exportType = document.querySelector(
      'input[name="exportType"]:checked'
    )?.value;
    const quality = document.getElementById("qualitySelect")?.value || "1080";
    const format =
      document.getElementById("formatSelect")?.value || "landscape";

    if (exportType === "full") {
      exportVideo(0, audioDuration, quality, format);
    } else {
      // Utilisation des valeurs du slider
      const range = getCustomRange();

      if (!range) {
        alert("❌ Erreur: Impossible de récupérer la sélection.");
        return;
      }

      if (range.duration <= 0) {
        alert("❌ Erreur: La durée sélectionnée doit être supérieure à 0.");
        return;
      }

      if (range.duration > 900) {
        // 15 minutes max
        alert(
          "❌ Erreur: La durée sélectionnée ne peut pas dépasser 15 minutes."
        );
        return;
      }

      exportVideo(range.startTime, range.duration, quality, format);
    }
  });
}

// Bouton d'annulation d'export
const cancelExportBtn = document.getElementById("cancelExportBtn");
if (cancelExportBtn) {
  cancelExportBtn.addEventListener("click", () => {
    if (isExporting) {
      // Arrêter l'export
      isExporting = false;

      if (mediaRecorder && mediaRecorder.state === "recording") {
        mediaRecorder.stop();
      }

      if (audio) {
        audio.pause();
      }

      if (exportAnimationId) {
        cancelAnimationFrame(exportAnimationId);
        exportAnimationId = null;
      }

      // Réinitialiser l'interface
      const progressText = document.getElementById("progressText");
      if (progressText) {
        progressText.textContent = "❌ Export annulé";
      }

      setTimeout(() => {
        closeExportPopup();
      }, 1000);

      console.log("Export annulé par l'utilisateur");
    }
  });
}

// Boutons sociaux
const shareTwitterBtn = document.getElementById("shareTwitterBtn");
const shareInstagramBtn = document.getElementById("shareInstagramBtn");

if (shareTwitterBtn) {
  shareTwitterBtn.addEventListener("click", () => {
    alert(
      "🐦 Fonction de partage Twitter à venir! Pour l'instant, exportez et partagez manuellement."
    );
  });
}

if (shareInstagramBtn) {
  shareInstagramBtn.addEventListener("click", () => {
    alert(
      "📷 Fonction de partage Instagram à venir! Pour l'instant, exportez et partagez manuellement."
    );
  });
}
