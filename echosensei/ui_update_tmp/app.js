/* ══════════════════════════════════════════════════════════════════════════════
   EchoSensei — App Controller (Complete Rebuild)
   ══════════════════════════════════════════════════════════════════════════════ */

// ==================== PARTICLE SYSTEM ====================
class ParticleSystem {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.particles = [];
        this.resize();
        window.addEventListener('resize', () => this.resize());
        for (let i = 0; i < 60; i++) {
            this.particles.push({
                x: Math.random() * this.w, y: Math.random() * this.h,
                vx: (Math.random() - 0.5) * 0.3, vy: (Math.random() - 0.5) * 0.3,
                r: Math.random() * 1.5 + 0.5, o: Math.random() * 0.3 + 0.05
            });
        }
        this.animate();
    }
    resize() {
        const dpr = window.devicePixelRatio || 1;
        this.w = window.innerWidth; this.h = window.innerHeight;
        this.canvas.width = this.w * dpr; this.canvas.height = this.h * dpr;
        this.canvas.style.width = this.w + 'px'; this.canvas.style.height = this.h + 'px';
        this.ctx.scale(dpr, dpr);
    }
    animate() {
        this.ctx.clearRect(0, 0, this.w, this.h);
        this.particles.forEach(p => {
            p.x += p.vx; p.y += p.vy;
            if (p.x < 0) p.x = this.w; if (p.x > this.w) p.x = 0;
            if (p.y < 0) p.y = this.h; if (p.y > this.h) p.y = 0;
            this.ctx.beginPath();
            this.ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
            this.ctx.fillStyle = `rgba(0,229,255,${p.o})`;
            this.ctx.fill();
        });
        requestAnimationFrame(() => this.animate());
    }
}

// ==================== WAVEFORM VISUALIZER ====================
class WaveformVisualizer {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.isActive = false;
        this.analyser = null;
        this.idleBars = Array.from({ length: 40 }, () => ({
            height: Math.random() * 0.15 + 0.05, phase: Math.random() * Math.PI * 2
        }));
        this.resize();
        window.addEventListener('resize', () => this.resize());
        this.drawIdle();
    }
    resize() {
        const rect = this.canvas.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        this.canvas.width = rect.width * dpr;
        this.canvas.height = rect.height * dpr;
        this.ctx.scale(dpr, dpr);
        this.w = rect.width; this.h = rect.height;
    }
    startAudio(stream) {
        try {
            const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            const source = audioCtx.createMediaStreamSource(stream);
            this.analyser = audioCtx.createAnalyser();
            this.analyser.fftSize = 128;
            source.connect(this.analyser);
            this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);
            this.isActive = true;
            this.audioCtx = audioCtx;
            this.drawLive();
        } catch (e) { console.error('Waveform error:', e); }
    }
    stopAudio() {
        this.isActive = false;
        if (this.audioCtx) this.audioCtx.close();
        this.drawIdle();
    }
    drawIdle() {
        if (this.isActive) return;
        const time = Date.now() / 1000;
        this.ctx.clearRect(0, 0, this.w, this.h);
        const barW = this.w / this.idleBars.length - 2;
        const cy = this.h / 2;
        this.idleBars.forEach((bar, i) => {
            const h = (Math.sin(time * 1.5 + bar.phase) * 0.5 + 0.5) * bar.height * this.h;
            const x = i * (barW + 2);
            const g = this.ctx.createLinearGradient(x, cy - h, x, cy + h);
            g.addColorStop(0, 'rgba(0,229,255,0.25)');
            g.addColorStop(0.5, 'rgba(168,85,247,0.15)');
            g.addColorStop(1, 'rgba(0,229,255,0.25)');
            this.ctx.fillStyle = g;
            this.ctx.fillRect(x, cy - h, barW, h * 2);
        });
        requestAnimationFrame(() => this.drawIdle());
    }
    drawLive() {
        if (!this.isActive) return;
        this.analyser.getByteFrequencyData(this.dataArray);
        this.ctx.clearRect(0, 0, this.w, this.h);
        const barW = this.w / this.dataArray.length - 2;
        const cy = this.h / 2;
        this.dataArray.forEach((val, i) => {
            const h = (val / 255) * cy * 0.9;
            const x = i * (barW + 2);
            const r = val / 255;
            const g = this.ctx.createLinearGradient(x, cy - h, x, cy + h);
            g.addColorStop(0, `rgba(0,229,255,${0.4 + r * 0.6})`);
            g.addColorStop(0.5, `rgba(168,85,247,${0.3 + r * 0.5})`);
            g.addColorStop(1, `rgba(244,63,94,${0.3 + r * 0.4})`);
            this.ctx.fillStyle = g;
            this.ctx.fillRect(x, cy - h, barW, h * 2);
        });
        requestAnimationFrame(() => this.drawLive());
    }
}

// ==================== SPEECH ENGINE ====================
class SpeechEngine {
    constructor() {
        this.mediaRecorder = null;
        this.audioChunks = [];
        this.isListening = false;
        this.fullTranscript = '';
        this.onEnd = null;
        this.onError = null;
        this.supported = navigator.mediaDevices && navigator.mediaDevices.getUserMedia;
    }
    init() { return !!this.supported; }

    start(stream) {
        if (!this.supported) return;
        this.audioChunks = [];
        this.isListening = true;
        this.fullTranscript = '';

        try {
            this.mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
            this.mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) this.audioChunks.push(e.data);
            };
            this.mediaRecorder.onstop = () => {
                const blob = new Blob(this.audioChunks, { type: 'audio/webm' });
                stream.getTracks().forEach(t => t.stop());
                if (this.onEnd) this.onEnd(blob);
            };
            this.mediaRecorder.start();
        } catch (err) {
            console.error('MediaRecorder error:', err);
            if (this.onError) this.onError(err);
        }
    }
    stop() {
        this.isListening = false;
        if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
            this.mediaRecorder.stop();
        }
    }
}

// ==================== SENSEI TTS ====================
class SenseiVoice {
    constructor() {
        this.synth = window.speechSynthesis;
        this.voice = null;
        this._loadVoice();
    }
    _loadVoice() {
        const setVoice = () => {
            const voices = this.synth.getVoices();
            // Prefer deep male voice
            this.voice = voices.find(v => /male|david|daniel|james/i.test(v.name) && v.lang.startsWith('en'))
                || voices.find(v => v.lang.startsWith('en'))
                || voices[0];
        };
        setVoice();
        this.synth.onvoiceschanged = setVoice;
    }
    speak(text) {
        if (!this.synth || !text) return;
        this.synth.cancel();
        const utt = new SpeechSynthesisUtterance(text);
        if (this.voice) utt.voice = this.voice;
        utt.rate = 0.85;
        utt.pitch = 0.7; // Deep sensei voice
        utt.volume = 1;
        this.synth.speak(utt);
    }
}

// ==================== APP CONTROLLER ====================
document.addEventListener('DOMContentLoaded', () => {
    // --- Loader ---
    setTimeout(() => document.getElementById('loader').classList.add('hidden'), 3000);

    // --- Particles ---
    new ParticleSystem(document.getElementById('particles-canvas'));

    // --- Waveform ---
    const waveform = new WaveformVisualizer(document.getElementById('waveform-canvas'));

    // --- Speech ---
    const speech = new SpeechEngine();
    speech.init();

    // --- Sensei TTS ---
    const senseiVoice = new SenseiVoice();

    // --- Session counter ---
    let sessionCount = 0;

    // ==================== TAB NAVIGATION ====================
    const navLinks = document.querySelectorAll('.nav-link[data-tab]');
    const tabPages = document.querySelectorAll('.tab-page');
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const tab = link.dataset.tab;
            navLinks.forEach(l => l.classList.remove('active'));
            link.classList.add('active');
            tabPages.forEach(p => p.classList.remove('active'));
            document.getElementById(`tab-${tab}`).classList.add('active');
        });
    });

    // --- Hamburger ---
    const hamburger = document.getElementById('nav-hamburger');
    const navLinksContainer = document.querySelector('.nav-links');
    hamburger.addEventListener('click', () => navLinksContainer.classList.toggle('open'));

    // ==================== RECORDING LOGIC ====================
    const micBtn = document.getElementById('mic-button');
    const micIcon = document.getElementById('mic-icon');
    const micArea = document.querySelector('.mic-area');
    const voiceStatus = document.getElementById('voice-status');
    const durationEl = document.getElementById('recording-duration');
    const detectedLang = document.getElementById('detected-language');
    const transcriptionOutput = document.getElementById('transcription-output');
    const wordCountEl = document.getElementById('word-count');
    const charCountEl = document.getElementById('char-count');
    const reportEmpty = document.getElementById('report-empty');
    const reportGrid = document.getElementById('report-grid');

    let isRecording = false;
    let recordingTimer = null;
    let recordingSeconds = 0;
    
    // Maintain a session ID across requests
    let sessionId = Math.random().toString(36).substring(2, 10);

    micBtn.addEventListener('click', () => {
        if (!isRecording) startRecording();
        else stopRecording();
    });

    async function startRecording() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            isRecording = true;
            micBtn.classList.add('active');
            micArea.classList.add('active');
            micIcon.className = 'fas fa-stop';
            voiceStatus.textContent = 'Listening...';
            voiceStatus.classList.add('recording');
            recordingSeconds = 0;
            durationEl.textContent = '0:00';
            recordingTimer = setInterval(() => {
                recordingSeconds++;
                const m = Math.floor(recordingSeconds / 60);
                const s = String(recordingSeconds % 60).padStart(2, '0');
                durationEl.textContent = `${m}:${s}`;
            }, 1000);

            waveform.startAudio(stream);
            speech.start(stream);

            transcriptionOutput.innerHTML = '<div class="empty-state"><div class="radar-icon" style="border-color:rgba(244,63,94,0.3);"><i class="fas fa-microphone" style="color:var(--rose);"></i></div><p style="color:var(--rose);">Recording in progress...</p></div>';
        } catch (err) {
            console.error(err);
            alert("Could not access microphone. Ensure you are on localhost and allow permissions.");
        }
    }

    function stopRecording() {
        isRecording = false;
        micBtn.classList.remove('active');
        micArea.classList.remove('active');
        micIcon.className = 'fas fa-microphone';
        voiceStatus.textContent = 'Processing...';
        voiceStatus.classList.remove('recording');
        clearInterval(recordingTimer);
        waveform.stopAudio();
        speech.stop();
    }

    speech.onEnd = async (audioBlob) => {
        transcriptionOutput.innerHTML = '<div class="empty-state"><i class="fas fa-spinner fa-spin" style="font-size:28px;color:var(--cyan);margin-bottom:16px;"></i><p>Analyzing with AI4Bharat + LLaMA-3...</p></div>';

        const formData = new FormData();
        formData.append('audio', audioBlob, 'recording.webm');
        const langDropdown = document.getElementById('input-language').value;
        formData.append('language', langDropdown);
        formData.append('session_id', sessionId);

        try {
            const response = await fetch('/api/transcribe_and_analyze', {
                method: 'POST', body: formData
            });

            if (!response.ok) {
                const errData = await response.json().catch(() => ({}));
                transcriptionOutput.innerHTML = `<div class="empty-state"><i class="fas fa-exclamation-circle" style="font-size:28px;color:var(--rose);margin-bottom:16px;"></i><p style="color:var(--rose);">Server error: ${errData.error || 'Unknown error'}</p></div>`;
                voiceStatus.textContent = 'Error';
                return;
            }

            const result = await response.json();

            // 1. Transcription
            const text = result.transcription.text;
            const langName = result.transcription.lang_name;
            speech.fullTranscript = text;
            transcriptionOutput.innerHTML = `<span style="font-size:16px;line-height:1.8;">${text}</span>`;
            const words = text.trim().split(/\s+/).filter(Boolean);
            wordCountEl.innerHTML = `<i class="fas fa-font"></i> ${words.length} words`;
            charCountEl.innerHTML = `<i class="fas fa-text-width"></i> ${text.length} chars`;
            detectedLang.textContent = langName;

            // 2. Medical Report
            const extraction = result.analysis;
            if (extraction && extraction.data) {
                renderReport(extraction.domain, extraction.data);
            }

            // 3. Sensei Akinator
            if (result.akinator) {
                const question = result.akinator.sensei_question || "Tell me more about your symptoms.";
                const doctorNeeded = result.akinator.requires_doctor_supervision;
                const diagnosis = result.akinator.current_diagnosis_guess || "Unknown";

                // Add user message to chat
                addChatMessage('user', text);
                // Add sensei response with typewriter
                addChatMessage('sensei', question, true);
                // Speak it
                senseiVoice.speak(question);

                // Triage card
                const triageEl = document.getElementById('sensei-triage');
                triageEl.style.display = 'block';
                document.getElementById('triage-diagnosis').textContent = diagnosis;
                const triageDoc = document.getElementById('triage-doctor');
                triageDoc.textContent = doctorNeeded ? '⚠️ YES — See a doctor' : '✅ No — Monitor at home';
                triageDoc.style.color = doctorNeeded ? 'var(--rose)' : 'var(--emerald)';
            }

            sessionCount++;
            document.getElementById('stat-sessions').textContent = sessionCount;

        } catch (err) {
            console.error(err);
            transcriptionOutput.innerHTML = '<div class="empty-state"><i class="fas fa-exclamation-circle" style="font-size:28px;color:var(--rose);margin-bottom:16px;"></i><p style="color:var(--rose);">Network error connecting to backend.</p></div>';
        }

        voiceStatus.textContent = 'Ready';
    };

    // ==================== RENDER MEDICAL REPORT ====================
    function renderReport(domain, entities) {
        reportEmpty.style.display = 'none';
        reportGrid.style.display = 'grid';
        reportGrid.innerHTML = '';

        const iconMap = {
            symptoms: 'symptom', severity: 'vitals', duration: 'duration',
            patient_name: 'diagnosis', existing_conditions: 'medication',
            issue: 'symptom', summary: 'diagnosis', amount: 'vitals',
            date: 'duration', transaction_type: 'medication',
            order_id: 'diagnosis', product: 'medication'
        };
        const faMap = {
            symptom: 'fa-virus', duration: 'fa-hourglass', medication: 'fa-pills',
            diagnosis: 'fa-stethoscope', vitals: 'fa-heart-pulse'
        };

        for (const [key, val] of Object.entries(entities)) {
            if (!val || val === '' || val === 0) continue;
            const type = iconMap[key] || 'diagnosis';
            const icon = faMap[type] || 'fa-circle-info';
            const item = document.createElement('div');
            item.className = 'report-item';
            item.innerHTML = `
                <div class="report-item-header">
                    <div class="report-item-icon ${type}"><i class="fas ${icon}"></i></div>
                    <span class="report-item-label">${key.replace(/_/g, ' ')}</span>
                </div>
                <div class="report-item-value">${val}</div>`;
            reportGrid.appendChild(item);
        }
    }

    // ==================== CHAT MESSAGES ====================
    function addChatMessage(role, text, typewriter = false) {
        const chat = document.getElementById('chat-messages');
        const msgDiv = document.createElement('div');
        msgDiv.className = `chat-msg ${role}-msg`;

        const icon = role === 'sensei' ? 'fa-umbrella' : 'fa-user';
        const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        msgDiv.innerHTML = `
            <div class="msg-avatar"><i class="fas ${icon}"></i></div>
            <div class="msg-bubble">
                <p class="msg-text"></p>
                <span class="msg-time">${time}</span>
            </div>`;
        chat.appendChild(msgDiv);

        const textEl = msgDiv.querySelector('.msg-text');
        if (typewriter) {
            let i = 0;
            const timer = setInterval(() => {
                if (i < text.length) {
                    textEl.textContent = text.substring(0, i + 1);
                    i++;
                } else {
                    clearInterval(timer);
                }
            }, 30);
        } else {
            textEl.textContent = text;
        }

        chat.scrollTop = chat.scrollHeight;
    }

    // ==================== COPY / CLEAR ====================
    document.getElementById('copy-transcription').addEventListener('click', () => {
        const text = speech.fullTranscript;
        if (text) {
            navigator.clipboard.writeText(text);
            showToast('Copied to clipboard!');
        }
    });
    document.getElementById('clear-transcription').addEventListener('click', () => {
        transcriptionOutput.innerHTML = '<div class="empty-state"><div class="radar-icon"><i class="fas fa-satellite-dish"></i></div><p>Waiting for voice input...</p></div>';
        wordCountEl.innerHTML = '<i class="fas fa-font"></i> 0 words';
        charCountEl.innerHTML = '<i class="fas fa-text-width"></i> 0 chars';
        reportEmpty.style.display = 'flex';
        reportGrid.style.display = 'none';
        reportGrid.innerHTML = '';
        speech.fullTranscript = '';
    });

    // ==================== TOAST ====================
    function showToast(msg) {
        const toast = document.createElement('div');
        toast.style.cssText = `position:fixed;bottom:30px;left:50%;transform:translateX(-50%);padding:10px 24px;border-radius:10px;background:rgba(0,229,255,0.15);border:1px solid rgba(0,229,255,0.3);color:#00e5ff;font-size:13px;z-index:9999;animation:fadeInUp 0.3s ease;backdrop-filter:blur(10px);`;
        toast.textContent = msg;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 2500);
    }
});
