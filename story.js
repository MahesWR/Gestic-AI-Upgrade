// ============================================
// KONSTANTA & KONFIGURASI
// ============================================
const CONFIG = {
    MODEL_URL: "model-lokal/",
    WEBCAM_WIDTH: 250,
    WEBCAM_HEIGHT: 250,
    CONFIDENCE_THRESHOLD: 0.90,
    COUNTDOWN_DURATION: 3000,
    SUCCESS_DISPLAY_TIME: 1500,
    DEBOUNCE_TIME: 500
};

// ============================================
// STATE MANAGEMENT
// ============================================
const state = {
    model: null,
    webcam: null,
    maxPredictions: 0,
    isWebcamRunning: false,
    currentStoryNode: "start",
    expectedAnswers: [],
    canAcceptInput: false,
    isProcessing: false,
    lastDetectionTime: 0
};

// ============================================
// DOM ELEMENTS
// ============================================
const elements = {
    modal: document.getElementById('story-modal'),
    storyText: document.getElementById('modal-story-text'),
    choicesContainer: document.getElementById('modal-choices-container'),
    webcamContainerMain: document.getElementById('webcam-container-main'),
    labelContainerMain: document.getElementById('label-container-main'),
    loadingTextMain: document.getElementById('loading-text-main'),
    webcamContainerStory: document.getElementById('modal-webcam-container-story'),
    startButton: document.getElementById('startButton'),
    statusContainer: document.getElementById('status-container')
};

// ============================================
// DATA CERITA (Diterjemahkan)
// ============================================
const story = {
    "start": {
        text: "You're going on vacation. What color shirt will you wear?",
        choices: [
            { text: "Blue", targetNode: "scene_kendaraan", vidRef: "y0tdkvqudp" }, 
            { text: "Black", targetNode: "scene_kendaraan", vidRef: "1hfbxabyl2" }
        ],
        expected: ["Blue", "Black"]
    },
    "scene_kendaraan": {
        text: "Shirt is ready! How will you travel?",
        choices: [
            { text: "Car", targetNode: "scene_alas_kaki", vidRef: "1gvu4v3d6m" }, 
            { text: "MotorCycle", targetNode: "scene_alas_kaki", vidRef: "yhfmsf9p3s" }
        ],
        expected: ["Car", "MotorCycle"]
    },
    "scene_alas_kaki": {
        text: "Almost time to go! What footwear will you wear?",
        choices: [
            { text: "Shoes", targetNode: "scene_aksesori", vidRef: "zscxyy9xqw" },
            { text: "Slippers", targetNode: "scene_aksesori", vidRef: "j3k6w9mygt" }
        ],
        expected: ["Shoes", "Slippers"]
    },
    "scene_aksesori": {
        text: "One last thing! What accessory will you wear?",
        choices: [
            { text: "Watch", targetNode: "scene_end", vidRef: "09y3h39vzp" },
            { text: "Cap", targetNode: "scene_end", vidRef: "c78da0yv1s" }
        ],
        expected: ["Watch", "Cap"]
    },
    "scene_end": {
        text: "🎉 You're all set! Have a great vacation! 🎉",
        choices: [],
        expected: [],
        isEnd: true
    }
};

// ============================================
// UTILITY FUNCTIONS (Diterjemahkan)
// ============================================
function showError(message) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.textContent = message;
    errorDiv.style.animation = 'slideDown 0.4s ease';
    return errorDiv;
}

function updateStatusIndicator(status) {
    elements.statusContainer.innerHTML = '';
    
    if (status === 'waiting') {
        const indicator = document.createElement('div');
        indicator.className = 'status-indicator waiting';
        // Teks diterjemahkan
        indicator.innerHTML = '<div class="status-pulse"></div><span>Get Ready... Show your sign</span>';
        elements.statusContainer.appendChild(indicator);
    } else if (status === 'detecting') {
        const indicator = document.createElement('div');
        indicator.className = 'status-indicator detecting';
        // Teks diterjemahkan
        indicator.innerHTML = '<div class="status-pulse"></div><span>Detecting sign...</span>';
        elements.statusContainer.appendChild(indicator);
    }
}

function showCountdown(container, callback) {
    const overlay = document.createElement('div');
    overlay.className = 'countdown-overlay';
    
    let count = 3;
    const updateCount = () => {
        overlay.innerHTML = `<div class="countdown-number">${count}</div>`;
    };
    
    updateCount();
    container.appendChild(overlay);
    
    const interval = setInterval(() => {
        count--;
        if (count > 0) {
            updateCount();
        } else {
            clearInterval(interval);
            overlay.remove();
            if (callback) callback();
        }
    }, 1000);
}

// ============================================
// WEBCAM INITIALIZATION (Diterjemahkan & Dimodifikasi)
// ============================================
async function initMainWebcam() {
    // Teks diterjemahkan
    elements.loadingTextMain.innerHTML = '<div class="loading-spinner"></div><div>Downloading Model...</div>';
    elements.startButton.disabled = true;
    
    try {
        const modelURL = CONFIG.MODEL_URL + "model.json";
        const metadataURL = CONFIG.MODEL_URL + "metadata.json";

        state.model = await tmImage.load(modelURL, metadataURL);
        state.maxPredictions = state.model.getTotalClasses();

        const flip = true;
        state.webcam = new tmImage.Webcam(CONFIG.WEBCAM_WIDTH, CONFIG.WEBCAM_HEIGHT, flip);
        await state.webcam.setup();
        await state.webcam.play();
        state.isWebcamRunning = true;
        
        // MODIFIKASI: Hapus loading text, jangan hapus overlay
        elements.loadingTextMain.remove(); 
        // MODIFIKASI: Hapus baris 'innerHTML = ""'
        // elements.webcamContainerMain.innerHTML = ''; 
        elements.webcamContainerMain.appendChild(state.webcam.canvas);
        
        const classNames = state.model.getClassLabels();
        classNames.forEach(className => {
            const classPredictionDiv = document.createElement("div");
            classPredictionDiv.className = 'prediction-bar';
            const barFill = document.createElement("div");
            barFill.className = 'bar-fill';
            barFill.id = `bar-main-${className}`;
            barFill.innerText = `${className}: 0%`;
            barFill.style.width = '0%';
            classPredictionDiv.appendChild(barFill);
            elements.labelContainerMain.appendChild(classPredictionDiv);
        });
        
        elements.startButton.disabled = false;
        window.requestAnimationFrame(loopMain);

    } catch (error) {
        console.error("Failed to initialize webcam:", error);
        elements.loadingTextMain.innerHTML = '';
        // Teks diterjemahkan
        elements.webcamContainerMain.appendChild(
            showError("❌ Failed to load model or camera. Please allow camera access and ensure a stable internet connection.")
        );
        state.isWebcamRunning = false;
    }
}

// ============================================
// PREDICTION LOOPS
// ============================================
async function loopMain() {
    if (state.isWebcamRunning && elements.modal.style.display !== "block") {
        state.webcam.update();
        await predictMain();
        window.requestAnimationFrame(loopMain);
    }
}

async function predictMain() {
    if (!state.model || !state.webcam || !state.webcam.canvas) return;

    const prediction = await state.model.predict(state.webcam.canvas);
    
    for (let i = 0; i < state.maxPredictions; i++) {
        const classPrediction = prediction[i];
        const barElement = document.getElementById(`bar-main-${classPrediction.className}`);
        if (barElement) {
            const probabilityPercent = (classPrediction.probability * 100).toFixed(1);
            barElement.style.width = `${probabilityPercent}%`;
            barElement.innerText = `${classPrediction.className}: ${probabilityPercent}%`;
        }
    }
}

async function loopStory() {
    if (elements.modal.style.display === "block" && state.isWebcamRunning) {
        state.webcam.update();
        if (state.canAcceptInput && !state.isProcessing) {
            await predictStory();
        }
        window.requestAnimationFrame(loopStory);
    }
}

async function predictStory() {
    if (!state.model || !state.webcam || !state.webcam.canvas || state.isProcessing) return;

    const prediction = await state.model.predict(state.webcam.canvas);
    
    const relevantAnswers = [...state.expectedAnswers, "Background"];
    const filteredPredictions = prediction.filter(p => relevantAnswers.includes(p.className));
    filteredPredictions.sort((a, b) => b.probability - a.probability);
    
    let topRelevantPrediction = filteredPredictions[0];

    // Update main prediction bars
    for (let i = 0; i < state.maxPredictions; i++) {
        const classPrediction = prediction[i];
        const barElement = document.getElementById(`bar-main-${classPrediction.className}`);
        if (barElement) {
            const probabilityPercent = (classPrediction.probability * 100).toFixed(1);
            barElement.style.width = `${probabilityPercent}%`;
            barElement.innerText = `${classPrediction.className}: ${probabilityPercent}%`;
        }
    }

    // Remove previous success classes
    document.querySelectorAll('.choice-video-box').forEach(box => box.classList.remove('success'));
    
    const now = Date.now();
    const timeSinceLastDetection = now - state.lastDetectionTime;

    if (topRelevantPrediction && 
        topRelevantPrediction.className !== "Background" && 
        topRelevantPrediction.probability > CONFIG.CONFIDENCE_THRESHOLD &&
        timeSinceLastDetection > CONFIG.DEBOUNCE_TIME) {
        
        state.isProcessing = true;
        state.lastDetectionTime = now;
        updateStatusIndicator('detecting');
        
        const correctBox = document.getElementById(`choice-box-${topRelevantPrediction.className}`);
        if (correctBox) {
            correctBox.classList.add('success');
        }

        const choice = story[state.currentStoryNode].choices.find(
            c => c.text === topRelevantPrediction.className
        );

        if (choice) {
            setTimeout(() => {
                displayStoryNode(choice.targetNode);
                state.isProcessing = false;
            }, CONFIG.SUCCESS_DISPLAY_TIME);
        } else {
            state.isProcessing = false;
        }
    }
}

// ============================================
// MODAL FUNCTIONS (Dimodifikasi)
// ============================================
function openStoryModal() {
    elements.modal.style.display = "block";
    
    if (state.webcam && state.webcam.canvas) {
        // MODIFIKASI: Hapus baris 'innerHTML = ""'
        // elements.webcamContainerStory.innerHTML = '';
        elements.webcamContainerStory.appendChild(state.webcam.canvas);
        state.webcam.canvas.style.width = '100%';
        state.webcam.canvas.style.height = '100%';
    }
    
    displayStoryNode("start");
    window.requestAnimationFrame(loopStory);
}

function closeModal() {
    elements.modal.style.display = "none";
    state.canAcceptInput = false;
    
    if (state.webcam && state.webcam.canvas) {
        // MODIFIKASI: Hapus baris 'innerHTML = ""'
        // elements.webcamContainerMain.innerHTML = '';
        elements.webcamContainerMain.appendChild(state.webcam.canvas);
    }
    
    window.requestAnimationFrame(loopMain);
}

function displayStoryNode(nodeName) {
    const node = story[nodeName];
    if (!node) return;

    elements.modal.style.display = 'block';
    state.currentStoryNode = nodeName;
    elements.storyText.innerText = node.text;
    
    elements.choicesContainer.innerHTML = '';
    
    node.choices.forEach(choice => {
        const vidRef = choice.vidRef;
        
        const choiceBox = document.createElement('div');
        choiceBox.className = 'choice-video-box';
        choiceBox.id = `choice-box-${choice.text}`;
        
        const blockquote = document.createElement('blockquote');
        blockquote.className = 'signasldata-embed';
        blockquote.setAttribute('data-vidref', vidRef);
        
        const link = document.createElement('a');
        link.href = `https://www.signasl.org/sign/${choice.text.toLowerCase().replace(/ /g, '-')}`;
        // Teks diterjemahkan
        link.innerText = `See sign for '${choice.text}'`;
        blockquote.appendChild(link);
        
        const textEl = document.createElement('p');
        // Teks diterjemahkan
        textEl.innerText = `Make the Sign: "${choice.text}"`;
        
        choiceBox.appendChild(blockquote);
        choiceBox.appendChild(textEl);
        elements.choicesContainer.appendChild(choiceBox);
    });
    
    setTimeout(() => {
        if (window.SignASL && typeof window.SignASL.init === 'function') {
            window.SignASL.init();
        }
    }, 100);
    
    state.expectedAnswers = node.expected;
    
    if (node.isEnd) {
        const restartButton = document.createElement('button');
        // Teks diterjemahkan
        restartButton.innerText = "🔄 Start Story Again";
        restartButton.className = 'neon-button';
        restartButton.style.fontSize = '1em';
        restartButton.style.padding = '10px 20px';
        restartButton.style.marginTop = '20px';
        restartButton.onclick = () => displayStoryNode("start");
        elements.choicesContainer.appendChild(restartButton);
        
        elements.statusContainer.innerHTML = '';
        state.canAcceptInput = false;
    } else {
        updateStatusIndicator('waiting');
        
        showCountdown(elements.webcamContainerStory, () => {
            state.canAcceptInput = true;
            updateStatusIndicator('detecting');
        });
    }
}

// ============================================
// INITIALIZATION
// ============================================
AOS.init();
window.onload = initMainWebcam;