/**
 * ECHOSENSEI — CONVERSATIONAL INTELLIGENCE PLATFORM
 * Full Frontend Controller: Domain switching, text input, sessions, editable review, analytics
 */
document.addEventListener('DOMContentLoaded', () => {

    // ── STATE ──
    let currentDomain = 'healthcare';
    let currentSessionId = null;
    let isRecording = false;
    let mediaRecorder;
    let audioChunks = [];
    let startTime;
    let timerInterval;
    let isEditMode = false;

    // ── DOM REFS ──
    const loader = document.getElementById('loader');
    const fill = document.getElementById('loader-fill');
    const app = document.getElementById('app');
    const bootLines = document.querySelectorAll('.loader-boot span');
    const navLinks = document.querySelectorAll('.nav-link');
    const pages = document.querySelectorAll('.pg');

    // ── PARTICLE BACKGROUND ──
    const pCanvas = document.getElementById('particle-canvas');
    if (pCanvas) {
        const pCtx = pCanvas.getContext('2d');
        let particles = [];
        const resizeParticles = () => {
            pCanvas.width = window.innerWidth;
            pCanvas.height = window.innerHeight;
        };
        window.addEventListener('resize', resizeParticles);
        resizeParticles();

        class Particle {
            constructor() { this.reset(); }
            reset() {
                this.x = Math.random() * pCanvas.width;
                this.y = Math.random() * pCanvas.height;
                this.size = Math.random() * 2 + 0.5;
                this.speedX = (Math.random() - 0.5) * 0.3;
                this.speedY = (Math.random() - 0.5) * 0.3;
                this.opacity = Math.random() * 0.3 + 0.1;
                this.hue = Math.random() > 0.5 ? 187 : 295; // cyan or magenta
            }
            update() {
                this.x += this.speedX;
                this.y += this.speedY;
                if (this.x < 0 || this.x > pCanvas.width || this.y < 0 || this.y > pCanvas.height) this.reset();
            }
            draw() {
                pCtx.beginPath();
                pCtx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
                pCtx.fillStyle = `hsla(${this.hue}, 100%, 60%, ${this.opacity})`;
                pCtx.fill();
            }
        }

        for (let i = 0; i < 60; i++) particles.push(new Particle());

        function animateParticles() {
            pCtx.clearRect(0, 0, pCanvas.width, pCanvas.height);
            particles.forEach(p => { p.update(); p.draw(); });
            // Draw connections
            for (let i = 0; i < particles.length; i++) {
                for (let j = i + 1; j < particles.length; j++) {
                    const dx = particles[i].x - particles[j].x;
                    const dy = particles[i].y - particles[j].y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist < 120) {
                        pCtx.beginPath();
                        pCtx.moveTo(particles[i].x, particles[i].y);
                        pCtx.lineTo(particles[j].x, particles[j].y);
                        pCtx.strokeStyle = `rgba(0, 229, 255, ${0.06 * (1 - dist / 120)})`;
                        pCtx.lineWidth = 0.5;
                        pCtx.stroke();
                    }
                }
            }
            requestAnimationFrame(animateParticles);
        }
        animateParticles();
    }

    // ── EKG CANVAS ──
    const ekgCanvas = document.getElementById('ekg-canvas');
    if (ekgCanvas) {
        const ctx = ekgCanvas.getContext('2d');
        let w, h;
        const resize = () => { w = ekgCanvas.width = window.innerWidth; h = ekgCanvas.height = window.innerHeight; };
        window.addEventListener('resize', resize);
        resize();
        
        let x = 0;
        const drawEKG = () => {
            ctx.fillStyle = 'rgba(0,0,0,0.06)';
            ctx.fillRect(0, 0, w, h);
            ctx.strokeStyle = '#00e5ff';
            ctx.lineWidth = 2;
            ctx.shadowBlur = 20;
            ctx.shadowColor = '#00e5ff';
            ctx.beginPath();
            ctx.moveTo(x, h/2);
            
            let y = h/2;
            let mod = x % 200;
            if (mod > 160 && mod < 170) y -= 45;
            else if (mod >= 170 && mod < 185) y += 55;
            else if (mod >= 185 && mod < 195) y -= 12;
            
            x += 3;
            if (x > w) { x = 0; ctx.clearRect(0,0,w,h); }
            ctx.lineTo(x, y);
            ctx.stroke();
            requestAnimationFrame(drawEKG);
        };
        drawEKG();
    }

    // ── LOADER SEQUENCE ──
    let progress = 0;
    const interval = setInterval(() => {
        progress += Math.random() * 8;
        if (progress > 100) {
            progress = 100;
            clearInterval(interval);
            setTimeout(completeLoader, 600);
        }
        fill.style.width = progress + '%';
        if (progress > 15) bootLines[0].classList.add('on');
        if (progress > 35) bootLines[1].classList.add('on');
        if (progress > 55) bootLines[2].classList.add('on');
        if (progress > 75) bootLines[3].classList.add('on');
        if (progress > 95) bootLines[4].classList.add('on');
    }, 100);

    function completeLoader() {
        loader.classList.add('out');
        const landingPage = document.getElementById('landing-page');
        if (landingPage) {
            landingPage.classList.remove('hidden');
        } else {
            // Fallback just in case
            app.classList.remove('app-hidden');
            document.getElementById('navbar').classList.remove('hidden-nav');
        }
    }

    // ── LANDING PAGE HANDLER ──
    const startSpeakingBtn = document.getElementById('start-speaking-btn');
    if (startSpeakingBtn) {
        startSpeakingBtn.addEventListener('click', () => {
            const landingPage = document.getElementById('landing-page');
            landingPage.style.opacity = '0';
            landingPage.style.transform = 'scale(0.95)';
            
            setTimeout(() => {
                landingPage.classList.add('hidden');
                app.classList.remove('app-hidden');
                document.getElementById('navbar').classList.remove('hidden-nav');
                createNewSession();
                loadAnalytics();
            }, 600);
        });
    }

    // ── TAB MANAGEMENT ──
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const tabId = link.getAttribute('data-tab');
            navLinks.forEach(l => l.classList.remove('active'));
            link.classList.add('active');
            pages.forEach(p => p.classList.remove('active'));
            document.getElementById(`pg-${tabId}`).classList.add('active');
            
            // Load data for specific tabs
            if (tabId === 'history') loadSessionHistory();
            if (tabId === 'timeline') loadAnalytics();
        });
    });

    // ── DOMAIN HARDCODED TO HEALTHCARE ──
    const reportTitle = document.getElementById('report-title');
    if (reportTitle) reportTitle.textContent = 'MEDICAL ENTITIES';

    // ── SESSION MANAGEMENT ──
    const sessionDisplay = document.getElementById('session-display');
    const newSessionBtn = document.getElementById('new-session-btn');

    async function createNewSession() {
        try {
            const res = await fetch('/api/session/new', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ domain: currentDomain })
            });
            const data = await res.json();
            currentSessionId = data.session_id;
            sessionDisplay.textContent = currentSessionId;
            
            if (typeof gsap !== 'undefined') {
                gsap.fromTo('#session-display', { opacity: 0, y: -10 }, { opacity: 1, y: 0, duration: 0.5 });
            }
        } catch (e) {
            currentSessionId = 'local_' + Date.now().toString(36);
            sessionDisplay.textContent = currentSessionId;
        }
    }

    newSessionBtn.addEventListener('click', () => {
        createNewSession();
        // Clear chat
        const chatFeed = document.getElementById('chat-feed');
        chatFeed.innerHTML = '<div class="msg-ai msg"><div class="msg-bub"><p>New session started. How can I help you?</p></div></div>';
        // Clear report
        document.getElementById('report-empty').classList.remove('hidden');
        document.getElementById('report-grid').classList.add('hidden');
        document.getElementById('report-grid').innerHTML = '';
        // Clear sidebar
        const sidebar = document.getElementById('sidebar-entities');
        if (sidebar) sidebar.innerHTML = '<div class="empty-state small"><i class="fas fa-dna"></i><p>Start a conversation</p></div>';
        // Clear transcription
        document.getElementById('trans-out').innerHTML = '<div class="empty-state"><i class="fas fa-satellite-dish"></i><p>Awaiting voice signal...</p></div>';
    });

    // ── SFX ──
    const sfx = {
        scan: () => new Audio('https://assets.mixkit.co/sfx/preview/mixkit-medical-monitor-beep-1051.mp3').play().catch(()=>{}),
        ok: () => new Audio('https://assets.mixkit.co/sfx/preview/mixkit-modern-technology-select-3124.mp3').play().catch(()=>{}),
        record: () => new Audio('https://assets.mixkit.co/sfx/preview/mixkit-futuristic-robotic-voice-2443.mp3').play().catch(()=>{})
    };

    // ── VOICE RECORDING ──
    const micBtn = document.getElementById('mic-btn');
    const chatMic = document.getElementById('chat-mic');
    const vStatus = document.getElementById('v-status');
    const vDur = document.getElementById('v-dur');
    const micArea = document.getElementById('mic-area');
    const waveCanvas = document.getElementById('voice-wave');
    const waveCtx = waveCanvas.getContext('2d');
    let analyzer, dataArray;

    function initWave(stream) {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const source = audioCtx.createMediaStreamSource(stream);
        analyzer = audioCtx.createAnalyser();
        analyzer.fftSize = 64;
        source.connect(analyzer);
        dataArray = new Uint8Array(analyzer.frequencyBinCount);
        drawWave();
    }

    function drawWave() {
        if (!isRecording) {
            waveCtx.clearRect(0, 0, waveCanvas.width, waveCanvas.height);
            return;
        }
        requestAnimationFrame(drawWave);
        analyzer.getByteFrequencyData(dataArray);
        waveCtx.clearRect(0, 0, waveCanvas.width, waveCanvas.height);
        const barWidth = (waveCanvas.width / dataArray.length) * 2.5;
        let x = 0;
        dataArray.forEach(val => {
            const h = (val / 255) * waveCanvas.height;
            const g = waveCtx.createLinearGradient(x, (waveCanvas.height-h)/2, x, (waveCanvas.height+h)/2);
            g.addColorStop(0, '#00e5ff');
            g.addColorStop(0.5, '#a855f7');
            g.addColorStop(1, '#e040fb');
            waveCtx.fillStyle = g;
            waveCtx.fillRect(x, (waveCanvas.height - h)/2, barWidth - 2, h);
            x += barWidth;
        });
    }

    async function toggleRec() {
        if (!isRecording) {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                mediaRecorder = new MediaRecorder(stream);
                audioChunks = [];
                mediaRecorder.ondataavailable = e => audioChunks.push(e.data);
                mediaRecorder.onstop = () => sendAudio(new Blob(audioChunks, { type: 'audio/webm' }));
                
                mediaRecorder.start();
                isRecording = true;
                transOut.innerHTML = '<div class="empty-state"><i class="fas fa-wave-square blink"></i><p>Listening...</p></div>';
                startTime = Date.now();
                timerInterval = setInterval(updateTimer, 1000);
                
                micBtn.classList.add('active');
                if (chatMic) chatMic.classList.add('active');
                micArea.classList.add('mic-area-active');
                vStatus.textContent = "● REC";
                vStatus.style.color = '#ff1744';
                sfx.record();
                initWave(stream);
            } catch (e) { alert("Mic access denied or error: " + e); }
        } else {
            mediaRecorder.stop();
            isRecording = false;
            clearInterval(timerInterval);
            micBtn.classList.remove('active');
            if (chatMic) chatMic.classList.remove('active');
            micArea.classList.remove('mic-area-active');
            vStatus.textContent = "Processing...";
            vStatus.style.color = '';
        }
    }

    function updateTimer() {
        const diff = Math.floor((Date.now() - startTime) / 1000);
        const m = Math.floor(diff / 60);
        const s = String(diff % 60).padStart(2,'0');
        vDur.textContent = `${m}:${s}`;
    }

    micBtn.addEventListener('click', toggleRec);
    if (chatMic) chatMic.addEventListener('click', toggleRec);

    // ── TEXT INPUT ──
    const textInput = document.getElementById('text-input');
    const sendTextBtn = document.getElementById('send-text-btn');
    const chatTextInput = document.getElementById('chat-text-input');
    const chatSendBtn = document.getElementById('chat-send-btn');

    function sendTextMessage(text) {
        if (!text.trim()) return;
        showProcessing();
        addChat('user', text);

        fetch('/api/text_input', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                text: text,
                session_id: currentSessionId,
                domain: currentDomain,
                language: document.getElementById('input-lang').value === 'auto' ? 'English' : 
                         document.getElementById('input-lang').selectedOptions[0].text
            })
        })
        .then(r => r.json())
        .then(data => handleResult(data))
        .catch(e => {
            console.error(e);
            hideProcessing();
            addChat('sensei', 'Communication error with neural core.');
        });
    }

    sendTextBtn.addEventListener('click', () => {
        sendTextMessage(textInput.value);
        textInput.value = '';
    });
    textInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            sendTextMessage(textInput.value);
            textInput.value = '';
        }
    });

    chatSendBtn.addEventListener('click', () => {
        sendTextMessage(chatTextInput.value);
        chatTextInput.value = '';
    });
    chatTextInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            sendTextMessage(chatTextInput.value);
            chatTextInput.value = '';
        }
    });

    // ── PROCESSING STATE ──
    const senseiMsg = document.getElementById('sensei-msg');
    const senseiMsgSub = document.getElementById('sensei-msg-sub');
    const senseiDots = document.getElementById('sensei-dots');
    const diagStrip = document.getElementById('sensei-diag');
    const diagVal = document.getElementById('diag-val');
    const docAlert = document.getElementById('sensei-alert');
    const transOut = document.getElementById('trans-out');
    const chatFeed = document.getElementById('chat-feed');
    const reportGrid = document.getElementById('report-grid');
    const reportEmpty = document.getElementById('report-empty');
    const mWords = document.getElementById('m-words');
    const mChars = document.getElementById('m-chars');
    const detLang = document.getElementById('det-lang');
    const chatDots = document.getElementById('chat-dots');

    function showProcessing() {
        senseiMsg.classList.add('hidden');
        if (senseiMsgSub) senseiMsgSub.classList.add('hidden');
        senseiDots.classList.remove('hidden');
        if (chatDots) chatDots.classList.remove('hidden');
    }

    function hideProcessing() {
        senseiDots.classList.add('hidden');
        if (chatDots) chatDots.classList.add('hidden');
        senseiMsg.classList.remove('hidden');
    }

    // ── AUDIO PIPELINE ──
    async function sendAudio(blob) {
        showProcessing();
        
        const fd = new FormData();
        fd.append('audio', blob, 'rec.webm');
        const lang = document.getElementById('input-lang').value;
        fd.append('language', lang);
        fd.append('session_id', currentSessionId);
        fd.append('domain', currentDomain);
        
        try {
            const res = await fetch('/api/transcribe_and_analyze', { method: 'POST', body: fd });
            const data = await res.json();
            handleResult(data);
        } catch (e) {
            console.error(e);
            senseiMsg.textContent = "Communication error with neural core.";
            hideProcessing();
        }
    }

    // ── INSTANT TEXT RENDERING ──
    function matrixDecode(el, targetText, speed=5) {
        el.textContent = targetText; // Visual latency completely disabled!
    }

    // ── CREATE FLOATING MESSAGES (For chat logs) ──
    function createMsgDiv(role, text) {
        const d = document.createElement('div');
        d.className = 'msg-' + role + ' msg';
        const bub = document.createElement('div');
        bub.className = 'msg-bub';
        const p = document.createElement('p');
        p.textContent = text;
        bub.appendChild(p);
        d.appendChild(bub);
        return {d, p};
    }

    // ── UPDATE UI STREAMING DATA ──
    function addChat(role, text, subtext = "") {
        const {d, p} = createMsgDiv(role, text);
        if (subtext) {
            const subP = document.createElement('p');
            subP.className = 'msg-sub';
            subP.textContent = `(${subtext})`;
            d.querySelector('.msg-bub').appendChild(subP);
        }
        chatFeed.appendChild(d);
        chatFeed.scrollTop = chatFeed.scrollHeight;
    }

    // ── HANDLE RESULT ──
    function handleResult(data) {
        hideProcessing();
        vStatus.textContent = 'Ready';
        vStatus.style.color = '';
        vDur.textContent = '0:00';

        if (data.error) {
            addChat('sensei', `Error: ${data.error}`);
            return;
        }

        if (data.transcription) {
            transOut.innerHTML = `<p>${data.transcription.text}</p>`;
            detLang.textContent = data.transcription.lang_name;
            mWords.textContent = (data.transcription.text || "").split(' ').length;
            mChars.textContent = (data.transcription.text || "").length;
            addChat('user', data.transcription.text);
        }

        if (data.akinator) {
            const ak = data.akinator;
            const reply = ak.sensei_question || "I've analyzed your data. Could you tell me more?";
            const sub = ak.sensei_question_english || "";
            
            matrixDecode(senseiMsg, reply, 20);
            if (sub && sub !== reply) {
                senseiMsgSub.classList.remove('hidden');
                matrixDecode(senseiMsgSub, `(${sub})`, 10);
                addChat('sensei', reply, sub);
            } else {
                addChat('sensei', reply);
            }
            
            const diagSource = ak.differential_diagnoses || [];
            
            // Re-map to string if it's the old format or parse new object format
            let renderHtml = "";
            window.lastDifferentialDiagnoses = []; // cache for PDF
            
            if (Array.isArray(diagSource) && diagSource.length > 0) {
                if (typeof diagSource[0] === 'object') {
                    window.lastDifferentialDiagnoses = diagSource;
                    renderHtml = diagSource.map(d => `<span class="diag-chip">${d.disease} <small>${d.probability}</small></span>`).join(' ');
                } else {
                    renderHtml = diagSource.join(', ');
                }
            } else if (typeof diagSource === 'string' && diagSource !== "Unknown") {
                renderHtml = diagSource;
            }
                
            if (renderHtml && renderHtml !== "Unknown" && renderHtml.trim() !== "") {
                diagStrip.classList.remove('hidden');
                diagVal.innerHTML = renderHtml;
            }
            if (ak.requires_doctor_supervision) docAlert.classList.remove('hidden');
            
            speakText(reply);
        }

        if (data.analysis && data.analysis.data) {
            renderEntities(data.analysis.data);
            renderSidebarEntities(data.analysis.data);
            updateTurnCount();
        }

        addTimeline(data);
        sfx.ok();

        // Update RAG live context display
        if (data.rag_context && data.rag_context.length > 0) {
            renderRAGContext(data.rag_context);
        }
    }

    function updateTurnCount() {
        const statTurns = document.getElementById('stat-turns');
        if (statTurns) {
            const current = parseInt(statTurns.textContent) || 0;
            statTurns.textContent = current + 1;
            if (typeof gsap !== 'undefined') {
                gsap.fromTo(statTurns, { scale: 1.3, color: '#00e5ff' }, { scale: 1, color: '#fff', duration: 0.5 });
            }
        }
    }

    // ── RENDER ENTITIES (Dashboard) ──
    function renderEntities(entities) {
        const keys = Object.entries(entities).filter(([_,v]) => v && v !== 'null' && v !== 'unknown' && v !== '');
        if (keys.length) {
            reportEmpty.classList.add('hidden');
            reportGrid.classList.remove('hidden');
            reportGrid.innerHTML = '';
            keys.forEach(([k, v], i) => {
                const item = document.createElement('div');
                item.className = 'entity-item';
                item.style.animationDelay = `${i * 0.06}s`;
                
                if (isEditMode) {
                    item.innerHTML = `
                        <div class="ent-icon"><i class="fas fa-notes-medical"></i></div>
                        <div class="ent-content" style="flex:1">
                            <div class="ent-label">${k.replace(/_/g,' ')}</div>
                            <input class="entity-edit-input" data-field="${k}" value="${v}">
                        </div>
                        <button class="ent-act entity-save-btn" data-field="${k}"><i class="fas fa-check"></i></button>`;
                    
                    item.querySelector('.entity-save-btn').addEventListener('click', async (e) => {
                        const field = e.currentTarget.dataset.field;
                        const input = item.querySelector('.entity-edit-input');
                        try {
                            await fetch(`/api/sessions/${currentSessionId}/data`, {
                                method: 'PUT',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ field, value: input.value })
                            });
                            sfx.ok();
                            if (typeof gsap !== 'undefined') gsap.fromTo(item, { backgroundColor: 'rgba(0,229,255,0.1)' }, { backgroundColor: 'transparent', duration: 1 });
                        } catch (err) { console.error(err); }
                    });
                } else {
                    item.innerHTML = `
                        <div class="ent-icon"><i class="fas fa-notes-medical"></i></div>
                        <div class="ent-content">
                            <div class="ent-label">${k.replace(/_/g,' ')}</div>
                            <div class="ent-val">${v}</div>
                        </div>`;
                }
                
                reportGrid.appendChild(item);
            });
        }
    }

    // ── RENDER SIDEBAR ENTITIES (Chat page) ──
    function renderSidebarEntities(entities) {
        const sidebar = document.getElementById('sidebar-entities');
        if (!sidebar) return;
        const keys = Object.entries(entities).filter(([_,v]) => v && v !== 'null' && v !== 'unknown' && v !== '');
        if (keys.length) {
            sidebar.innerHTML = '';
            keys.forEach(([k, v], i) => {
                const item = document.createElement('div');
                item.className = 'entity-item';
                item.style.animationDelay = `${i * 0.06}s`;
                item.innerHTML = `<div><div class="entity-label">${k.replace(/_/g,' ')}</div><div class="entity-value">${v}</div></div>`;
                sidebar.appendChild(item);
            });
        }
    }

    // ── EDIT MODE TOGGLE ──
    const editToggleBtn = document.getElementById('edit-toggle-btn');
    editToggleBtn.addEventListener('click', async () => {
        isEditMode = !isEditMode;
        editToggleBtn.innerHTML = isEditMode ? '<i class="fas fa-eye"></i> View' : '<i class="fas fa-pen"></i> Edit';
        
        // Re-render current entities
        try {
            const res = await fetch(`/api/sessions/${currentSessionId}`);
            const session = await res.json();
            if (session.data) renderEntities(session.data);
        } catch (e) {
            console.error(e);
        }
    });

    // ── CHAT ──
    function addChat(role, text, subtext = null) {
        const row = document.createElement('div');
        row.className = `msg msg-${role === 'sensei' ? 'ai' : 'user'}`;
        let content = `<p>${text}</p>`;
        if (subtext) content += `<p class="msg-sub">(${subtext})</p>`;
        row.innerHTML = `<div class="msg-bub">${content}</div>`;
        chatFeed.appendChild(row);
        chatFeed.scrollTop = chatFeed.scrollHeight;
    }

    // ── TIMELINE ──
    function addTimeline(data) {
        const track = document.getElementById('tl-track');
        const node = document.createElement('div');
        node.className = 'tl-node';
        node.style.borderColor = 'var(--cyan)';
        const evType = data.akinator ? "AI REASONING" : "DATA CAPTURE";
        const diag = data.akinator?.current_diagnosis_guess || '';
        node.innerHTML = `
            <span style="font-size:.6rem; color:var(--txt3); font-family:'Share Tech Mono'; letter-spacing:1px;">SEQ_${Date.now().toString(36).toUpperCase()}</span>
            <h4 style="font-size:.75rem; color:var(--txt); margin-top:5px; letter-spacing:1px;">${evType}</h4>
            ${diag ? `<p style="font-size:.7rem; color:var(--cyan); margin-top:4px;">→ ${diag}</p>` : ''}
        `;
        track.appendChild(node);
        if (typeof gsap !== 'undefined') gsap.from(node, { x: -20, opacity: 0, duration: 0.6, ease: 'power3.out' });
    }

    // ── TTS ──
    function speakText(text) {
        const synth = window.speechSynthesis;
        const utter = new SpeechSynthesisUtterance(text);
        const voices = synth.getVoices();
        utter.voice = voices.find(v => v.lang.includes('en') && v.name.includes('Google')) || voices[0];
        utter.pitch = 0.9;
        utter.rate = 0.95;
        synth.speak(utter);
    }

    // ── PDF EXPORT ──
    function generatePDFReport(titleSuffix = "Report") {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        const domainLabel = DOMAIN_CONFIG[currentDomain]?.label || 'General';
        doc.setFontSize(22); doc.text(`EchoSensei ${domainLabel} ${titleSuffix}`, 20, 20);
        doc.setFontSize(10); doc.text(`Session: ${currentSessionId} | Domain: ${domainLabel}`, 20, 30);
        doc.setFontSize(12); doc.text("Generated by Sensei AI", 20, 38);
        return doc;
    }

    document.getElementById('pdf-btn').addEventListener('click', () => {
        const doc = generatePDFReport("Chat Log");
        let y = 55;
        document.querySelectorAll('.msg-bub p:not(.msg-sub)').forEach(p => {
            const lines = doc.splitTextToSize(p.textContent, 170);
            lines.forEach(line => {
                if (y > 280) { doc.addPage(); y = 20; }
                doc.text(line, 20, y);
                y += 7;
            });
            y += 3;
        });
        doc.save(`echosensei-chat-${currentSessionId.substring(0,6)}.pdf`);
    });

    const dashReportBtn = document.getElementById('dashboard-report-btn');
    if (dashReportBtn) {
        dashReportBtn.addEventListener('click', () => {
            const doc = generatePDFReport("Differential Probability Report");
            let y = 50;
            
            doc.setFontSize(14);
            doc.setTextColor(14, 116, 144); // Clinical Blue Tone
            doc.text("Clinical Possibilities & Probabilities:", 20, y);
            y += 10;
            
            const diags = window.lastDifferentialDiagnoses || [];
            
            if (diags.length === 0) {
                doc.setFontSize(11);
                doc.setTextColor(0, 0, 0);
                doc.text("No disease probabilities have been gathered yet. Continue conversation.", 20, y);
                y += 10;
            } else {
                diags.forEach(d => {
                    if (y > 270) { doc.addPage(); y = 20; }
                    
                    doc.setFontSize(12);
                    doc.setTextColor(0, 0, 0);
                    // Bold the disease name
                    doc.setFont("helvetica", "bold");
                    doc.text(`${d.disease || "Unknown"} (${d.probability || "N/A"})`, 20, y);
                    
                    doc.setFont("helvetica", "normal");
                    doc.setFontSize(10);
                    doc.setTextColor(80, 80, 80);
                    y += 6;
                    
                    const reasonLines = doc.splitTextToSize(`Reasoning: ${d.reasoning || "Insufficient data to provide robust reasoning."}`, 170);
                    reasonLines.forEach(line => {
                        if (y > 280) { doc.addPage(); y = 20; }
                        doc.text(line, 20, y);
                        y += 5;
                    });
                    y += 4;
                });
            }
            
            doc.save(`echosensei-patient-probabilities-${currentSessionId.substring(0,6)}.pdf`);
        });
    }

    document.getElementById('clear-btn').addEventListener('click', () => {
        chatFeed.innerHTML = '';
        sfx.record();
    });

    // ── SESSION HISTORY ──
    const historySearch = document.getElementById('history-search');
    const sessionsGrid = document.getElementById('sessions-grid');

    async function loadSessionHistory(query = '') {
        try {
            const url = query ? `/api/sessions?q=${encodeURIComponent(query)}` : '/api/sessions';
            const res = await fetch(url);
            const data = await res.json();
            renderSessionCards(data.sessions || []);
        } catch (e) {
            console.error(e);
            sessionsGrid.innerHTML = '<div class="empty-state"><i class="fas fa-wifi-slash"></i><p>Could not load sessions</p></div>';
        }
    }

    function renderSessionCards(sessions) {
        if (!sessions.length) {
            sessionsGrid.innerHTML = '<div class="empty-state"><i class="fas fa-folder-open"></i><p>No sessions found.</p></div>';
            return;
        }
        sessionsGrid.innerHTML = '';
        sessions.forEach((sess, i) => {
            const card = document.createElement('div');
            card.className = 'session-card';
            card.style.animationDelay = `${i * 0.08}s`;
            const domainClass = sess.domain || 'general';
            const preview = Object.entries(sess.data_preview || {}).map(([k,v]) => 
                `<div class="session-preview-item"><strong>${k.replace(/_/g,' ')}:</strong> ${v}</div>`
            ).join('');
            
            const timeAgo = getTimeAgo(sess.created_at);
            
            card.innerHTML = `
                <button class="session-delete-btn" data-sid="${sess.session_id}"><i class="fas fa-trash"></i></button>
                <div class="session-card-head">
                    <span class="session-domain-badge ${domainClass}">${domainClass}</span>
                    <span class="session-id">#${sess.session_id}</span>
                </div>
                <div class="session-meta">
                    <span><i class="fas fa-clock"></i> ${timeAgo}</span>
                    <span><i class="fas fa-comments"></i> ${sess.turn} turns</span>
                    <span><i class="fas fa-language"></i> ${sess.language}</span>
                </div>
                <div class="session-preview">${preview || '<div class="session-preview-item" style="color:var(--txt3)">No data yet</div>'}</div>
            `;

            // Delete handler
            card.querySelector('.session-delete-btn').addEventListener('click', async (e) => {
                e.stopPropagation();
                const sid = e.currentTarget.dataset.sid;
                if (confirm(`Delete session ${sid}?`)) {
                    await fetch(`/api/sessions/${sid}`, { method: 'DELETE' });
                    loadSessionHistory();
                }
            });

            sessionsGrid.appendChild(card);
        });
    }

    function getTimeAgo(isoStr) {
        if (!isoStr) return 'Unknown';
        const diff = Date.now() - new Date(isoStr).getTime();
        const mins = Math.floor(diff / 60000);
        if (mins < 1) return 'Just now';
        if (mins < 60) return `${mins}m ago`;
        const hours = Math.floor(mins / 60);
        if (hours < 24) return `${hours}h ago`;
        return `${Math.floor(hours / 24)}d ago`;
    }

    if (historySearch) {
        let searchTimeout;
        historySearch.addEventListener('input', () => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => loadSessionHistory(historySearch.value), 300);
        });
    }

    // ── ANALYTICS ──
    async function loadAnalytics() {
        try {
            const res = await fetch('/api/analytics');
            const data = await res.json();
            renderAnalytics(data);
        } catch (e) {
            console.error(e);
        }
    }

    function renderAnalytics(data) {
        // Update stat cards
        const statSessions = document.getElementById('stat-sessions');
        if (statSessions) statSessions.textContent = data.total_sessions || 0;

        // Language bar chart
        const langChart = document.getElementById('lang-chart');
        if (langChart) renderBarChart(langChart, data.language_distribution || {});
    }

    function renderBarChart(container, dist) {
        const colors = { Hindi: '#ff9100', English: '#00e5ff', Tamil: '#a855f7', Kannada: '#00e676', Unknown: '#4a4e73' };
        const entries = Object.entries(dist);
        const max = Math.max(...entries.map(([_,v]) => v), 1);

        if (!entries.length) {
            container.innerHTML = '<div class="empty-state small"><p style="color:var(--txt3)">No language data yet</p></div>';
            return;
        }

        const bars = entries.map(([lang, count]) => {
            const height = (count / max) * 150;
            const color = colors[lang] || '#666';
            return `<div class="bar-col">
                <div class="bar-fill" style="height:${height}px;background:linear-gradient(to top, ${color}, ${color}88)" data-count="${count}"></div>
                <span class="bar-label">${lang}</span>
            </div>`;
        }).join('');

        container.innerHTML = `<div class="bar-chart">${bars}</div>`;
    }

    // ── RAG STATUS POLLING ──
    async function loadRAGStatus() {
        try {
            const res = await fetch('/api/rag/status');
            const data = await res.json();
            const indexCountEl = document.getElementById('rag-index-count');
            const modelBadge = document.getElementById('rag-model-badge');
            
            if (indexCountEl) indexCountEl.textContent = data.total_chunks || 0;
            
            if (modelBadge) {
                if (data.model_loaded) {
                    modelBadge.classList.add('rag-active');
                    modelBadge.innerHTML = '<i class="fas fa-circle"></i> Model Active';
                } else {
                    modelBadge.classList.remove('rag-active');
                    modelBadge.classList.add('rag-inactive');
                    modelBadge.innerHTML = '<i class="fas fa-circle"></i> Model Offline';
                }
            }

            if (typeof gsap !== 'undefined' && indexCountEl) {
                gsap.fromTo(indexCountEl, { scale: 1.3, color: '#a855f7' }, { scale: 1, color: '#fff', duration: 0.5 });
            }
        } catch (e) {
            console.log('[RAG] Status check failed:', e);
        }
    }

    function renderRAGContext(ragResults) {
        const container = document.getElementById('rag-context-live');
        if (!container) return;
        
        if (!ragResults || ragResults.length === 0) {
            container.innerHTML = '<div class="rag-context-empty"><i class="fas fa-satellite-dish"></i> No matching historical context found for this query</div>';
            return;
        }
        
        let html = '<div class="rag-context-header"><i class="fas fa-check-circle"></i> Retrieved ' + ragResults.length + ' relevant context chunk(s):</div>';
        ragResults.forEach((r, i) => {
            const score = (r.score * 100).toFixed(0);
            html += `<div class="rag-context-chip" style="animation-delay: ${i * 0.1}s">
                <div class="rag-chip-score">${score}%</div>
                <div class="rag-chip-text">${r.text}</div>
                <div class="rag-chip-meta">Session: ${r.session}</div>
            </div>`;
        });
        container.innerHTML = html;

        // Animate chips in
        if (typeof gsap !== 'undefined') {
            gsap.from('.rag-context-chip', { y: 15, opacity: 0, stagger: 0.1, duration: 0.5, ease: 'power3.out' });
        }

        // Also refresh chunk count
        loadRAGStatus();
    }

    // Load RAG status on startup
    setTimeout(loadRAGStatus, 2000);

    // ══════════════════════════════════════════════════════════════════════════
    // ══  DOCUFLOW — SPEECH-DRIVEN DOCUMENTATION CONTROLLER (v2: Full Session)
    // ══════════════════════════════════════════════════════════════════════════

    const DF = {
        phase: 1,
        patientInfo: {},
        transcript: [],          // classified transcript from LLM
        rawTranscript: '',       // raw text from Whisper
        isRecording: false,
        mediaRecorder: null,
        audioStream: null,
        audioChunks: [],         // accumulate full recording
        recordingStartTime: null,
        timerInterval: null,
        reportId: null,
        reportData: {},

        // Section definitions for report
        SECTIONS: [
            { key: 'complaint', label: 'Complaint / Query', icon: 'fa-comment-medical' },
            { key: 'symptoms', label: 'Symptoms', icon: 'fa-virus' },
            { key: 'duration', label: 'Duration', icon: 'fa-clock' },
            { key: 'background_history', label: 'Background History', icon: 'fa-book-medical' },
            { key: 'past_history', label: 'Past History', icon: 'fa-history' },
            { key: 'clinical_observations', label: 'Clinical Observations', icon: 'fa-stethoscope' },
            { key: 'diagnosis', label: 'Diagnosis / Classification', icon: 'fa-diagnoses' },
            { key: 'treatment_advice', label: 'Treatment Advice', icon: 'fa-prescription' },
            { key: 'action_plan', label: 'Action Plan / Treatment Plan', icon: 'fa-clipboard-list' },
            { key: 'immunization_data', label: 'Immunization Data', icon: 'fa-syringe' },
            { key: 'pregnancy_data', label: 'Pregnancy Data', icon: 'fa-baby' },
            { key: 'risk_indicators', label: 'Risk Indicators', icon: 'fa-exclamation-triangle' },
            { key: 'injury_mobility', label: 'Injury & Mobility Details', icon: 'fa-wheelchair' },
            { key: 'ent_findings', label: 'ENT Findings', icon: 'fa-ear-listen' },
            { key: 'verification_notes', label: 'Verification & Survey Responses', icon: 'fa-clipboard-check' },
            { key: 'doctor_notes', label: 'Doctor\'s Notes', icon: 'fa-user-md' }
        ]
    };

    // Safely convert any value (string, array, object) to a display string
    function dfStringify(val) {
        if (!val) return '';
        if (typeof val === 'string') return val;
        if (Array.isArray(val)) return val.map(v => typeof v === 'object' ? JSON.stringify(v) : String(v)).join(', ');
        if (typeof val === 'object') {
            // Try to make a readable string from object keys
            return Object.entries(val).map(([k, v]) => `${k}: ${v}`).join('; ');
        }
        return String(val);
    }

    function dfSetPhase(n) {
        DF.phase = n;
        document.querySelectorAll('.df-phase').forEach(p => p.classList.remove('active'));
        document.querySelectorAll('.df-step').forEach(s => {
            s.classList.remove('active', 'done');
            const sPhase = parseInt(s.dataset.phase);
            if (sPhase < n) s.classList.add('done');
            if (sPhase === n) s.classList.add('active');
        });
        const phaseEl = document.getElementById(`df-phase-${n}`);
        if (phaseEl) phaseEl.classList.add('active');
    }

    // Phase 1: Patient Registration
    const dfStartBtn = document.getElementById('df-start-recording');
    if (dfStartBtn) {
        dfStartBtn.addEventListener('click', () => {
            const name = document.getElementById('df-name').value.trim();
            const age = document.getElementById('df-age').value.trim();
            const sex = document.getElementById('df-sex').value;
            if (!name || !age || !sex) {
                alert('Please fill in Name, Age, and Sex.');
                return;
            }
            DF.patientInfo = {
                name, age, sex,
                blood_group: document.getElementById('df-blood').value,
                contact: document.getElementById('df-contact').value.trim(),
                allergies: document.getElementById('df-allergies').value.trim(),
                existing_conditions: document.getElementById('df-existing').value.trim()
            };
            DF.transcript = [];
            DF.rawTranscript = '';
            DF.audioChunks = [];
            dfSetPhase(2);
            dfStartRecording();
        });
    }

    // Phase 2: Full-Session Recording (no chunking, no speaker toggle)
    async function dfStartRecording() {
        try {
            DF.audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            DF.isRecording = true;
            DF.recordingStartTime = Date.now();
            DF.audioChunks = [];

            // Single continuous MediaRecorder
            const recorder = new MediaRecorder(DF.audioStream);
            recorder.ondataavailable = e => {
                if (e.data.size > 0) DF.audioChunks.push(e.data);
            };
            recorder.start(1000); // collect data every second (but keep recording continuously)
            DF.mediaRecorder = recorder;

            // Start timer
            DF.timerInterval = setInterval(dfUpdateTimer, 1000);

            // Waveform visualization
            dfInitWaveform(DF.audioStream);

            // Update recording status text
            const feed = document.getElementById('df-transcript-feed');
            feed.innerHTML = `
                <div class="df-trans-empty">
                    <i class="fas fa-circle" style="color:var(--red);animation:recBlink 1s ease-in-out infinite"></i>
                    Recording in progress...<br>
                    <small style="color:var(--txt3);margin-top:8px;display:block">The conversation is being recorded continuously.<br>
                    Speaker identification will be done automatically by AI after recording stops.</small>
                </div>
            `;
        } catch (e) {
            alert('Microphone access denied: ' + e.message);
        }
    }

    function dfStopRecording() {
        return new Promise(resolve => {
            DF.isRecording = false;
            clearInterval(DF.timerInterval);

            if (DF.mediaRecorder && DF.mediaRecorder.state !== 'inactive') {
                DF.mediaRecorder.onstop = () => {
                    if (DF.audioStream) {
                        DF.audioStream.getTracks().forEach(t => t.stop());
                    }
                    resolve();
                };
                DF.mediaRecorder.stop();
            } else {
                if (DF.audioStream) {
                    DF.audioStream.getTracks().forEach(t => t.stop());
                }
                resolve();
            }
        });
    }

    function dfUpdateTimer() {
        const elapsed = Math.floor((Date.now() - DF.recordingStartTime) / 1000);
        const h = String(Math.floor(elapsed / 3600)).padStart(2, '0');
        const m = String(Math.floor((elapsed % 3600) / 60)).padStart(2, '0');
        const s = String(elapsed % 60).padStart(2, '0');
        document.getElementById('df-rec-timer').textContent = `${h}:${m}:${s}`;
    }

    function dfInitWaveform(stream) {
        const canvas = document.getElementById('df-wave-canvas');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const source = audioCtx.createMediaStreamSource(stream);
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 64;
        source.connect(analyser);
        const dataArray = new Uint8Array(analyser.frequencyBinCount);

        function draw() {
            if (!DF.isRecording) { ctx.clearRect(0, 0, canvas.width, canvas.height); return; }
            requestAnimationFrame(draw);
            analyser.getByteFrequencyData(dataArray);
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            const barWidth = (canvas.width / dataArray.length) * 2.5;
            let x = 0;
            dataArray.forEach(val => {
                const h = (val / 255) * canvas.height;
                const g = ctx.createLinearGradient(x, (canvas.height-h)/2, x, (canvas.height+h)/2);
                g.addColorStop(0, '#ff1744');
                g.addColorStop(0.5, '#e040fb');
                g.addColorStop(1, '#00e5ff');
                ctx.fillStyle = g;
                ctx.fillRect(x, (canvas.height - h)/2, barWidth - 2, h);
                x += barWidth;
            });
        }
        draw();
    }

    function dfSetStatus(icon, text, detail) {
        const feed = document.getElementById('df-transcript-feed');
        feed.innerHTML = `
            <div class="df-trans-empty" style="flex-direction:column;gap:12px">
                <div class="sensei-dots"><span></span><span></span><span></span></div>
                <div style="display:flex;align-items:center;gap:8px;font-size:.95rem;color:var(--cyan)">
                    <i class="fas ${icon}"></i> ${text}
                </div>
                ${detail ? `<small style="color:var(--txt3)">${detail}</small>` : ''}
            </div>
        `;
    }

    // Stop & Generate — full pipeline
    const dfStopBtn = document.getElementById('df-stop-generate');
    if (dfStopBtn) {
        dfStopBtn.addEventListener('click', async () => {
            dfStopBtn.disabled = true;
            dfStopBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';

            // 1. Stop recording
            await dfStopRecording();

            if (DF.audioChunks.length === 0) {
                alert('No audio recorded. Please speak before generating.');
                dfStopBtn.disabled = false;
                dfStopBtn.innerHTML = '<i class="fas fa-file-medical"></i> Stop & Generate Report';
                dfStartRecording();
                return;
            }

            // 2. Build full audio blob
            const fullBlob = new Blob(DF.audioChunks, { type: 'audio/webm' });
            console.log(`[DocuFlow] Full recording: ${(fullBlob.size / 1024).toFixed(1)} KB`);

            // -- Step A: Transcribe full audio --
            dfSetStatus('fa-ear-listen', 'Transcribing full conversation...', 'Sending audio to Groq Whisper for transcription');

            try {
                const fd = new FormData();
                fd.append('audio', fullBlob, `session_${Date.now()}.webm`);
                fd.append('language', document.getElementById('df-lang').value);

                const transRes = await fetch('/api/docuflow/transcribe_full', { method: 'POST', body: fd });
                const transData = await transRes.json();

                if (!transData.success || !transData.text || transData.text.trim().length < 5) {
                    dfSetStatus('fa-exclamation-triangle', 'Transcription failed or empty', 'Please try recording again with clearer audio');
                    dfStopBtn.disabled = false;
                    dfStopBtn.innerHTML = '<i class="fas fa-file-medical"></i> Stop & Generate Report';
                    return;
                }

                DF.rawTranscript = transData.text;
                document.getElementById('df-trans-lang').textContent = transData.lang_name || '—';

                // -- Step B: Classify speakers + Generate report --
                dfSetStatus('fa-brain', 'AI classifying speakers & generating report...', `Transcript: ${DF.rawTranscript.length} chars | Identifying Doctor vs Patient turns and extracting clinical data`);

                const reportRes = await fetch('/api/docuflow/process_full', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        raw_transcript: DF.rawTranscript,
                        patient_info: DF.patientInfo,
                        language: document.getElementById('df-lang').selectedOptions[0]?.text || 'English'
                    })
                });
                const reportData = await reportRes.json();

                if (reportData.success) {
                    DF.reportId = reportData.report_id;
                    DF.reportData = reportData.report_data;
                    DF.transcript = reportData.transcript || [];

                    // Show classified transcript in the feed before moving to report
                    dfRenderClassifiedTranscript(DF.transcript);

                    // Short delay to let user see the transcript, then move to report
                    setTimeout(() => {
                        dfSetPhase(3);
                        // Show patient bar
                        const patientBar = document.getElementById('df-report-patient');
                        patientBar.innerHTML = Object.entries(DF.patientInfo)
                            .filter(([_, v]) => v)
                            .map(([k, v]) => `<span class="df-rp-item"><strong>${k.replace(/_/g, ' ')}:</strong> ${v}</span>`)
                            .join('');
                        dfRenderReport(reportData.report_data);
                    }, 2000);
                } else {
                    dfSetStatus('fa-exclamation-circle', 'Report generation failed', reportData.error || 'Unknown error');
                }
            } catch (e) {
                dfSetStatus('fa-exclamation-circle', 'Network error', e.message);
            }

            dfStopBtn.disabled = false;
            dfStopBtn.innerHTML = '<i class="fas fa-file-medical"></i> Stop & Generate Report';
        });
    }

    function dfRenderClassifiedTranscript(transcript) {
        const feed = document.getElementById('df-transcript-feed');
        feed.innerHTML = '';

        if (!transcript || transcript.length === 0) {
            feed.innerHTML = '<div class="df-trans-empty"><i class="fas fa-ban"></i> No turns identified</div>';
            return;
        }

        let wordCount = 0;
        transcript.forEach((turn, i) => {
            const speaker = turn.speaker || 'Unknown';
            const text = turn.text || '';
            wordCount += text.split(/\s+/).length;

            const el = document.createElement('div');
            el.className = `df-trans-turn ${speaker.toLowerCase()}`;
            el.style.animationDelay = `${i * 0.05}s`;
            el.innerHTML = `
                <div class="df-trans-speaker">
                    <i class="fas ${speaker === 'Doctor' ? 'fa-user-md' : 'fa-user'}"></i> ${speaker}
                </div>
                <div class="df-trans-text">${text}</div>
            `;
            feed.appendChild(el);
        });
        feed.scrollTop = feed.scrollHeight;

        document.getElementById('df-turn-count').textContent = transcript.length;
        document.getElementById('df-word-count').textContent = wordCount;
    }

    function dfRenderReport(reportData) {
        const grid = document.getElementById('df-report-grid');
        grid.innerHTML = '';

        DF.SECTIONS.forEach((sec, i) => {
            const rawVal = reportData[sec.key] || '';
            const val = dfStringify(rawVal);
            const section = document.createElement('div');
            section.className = 'df-report-section';
            section.style.animationDelay = `${i * 0.06}s`;
            section.innerHTML = `
                <div class="df-report-section-head">
                    <div class="df-report-section-title"><i class="fas ${sec.icon}"></i> ${sec.label}</div>
                    <span class="df-report-section-badge">editable</span>
                </div>
                <div class="df-report-content" contenteditable="true" data-field="${sec.key}">${val || '<em style="color:var(--txt3)">Not discussed — click to add</em>'}</div>
            `;
            grid.appendChild(section);

            // Auto-save on blur
            const content = section.querySelector('.df-report-content');
            content.addEventListener('focus', () => {
                if (content.innerHTML.includes('Not discussed')) content.innerHTML = '';
            });
            content.addEventListener('blur', () => {
                const newVal = content.innerText.trim();
                DF.reportData[sec.key] = newVal;
                if (DF.reportId) {
                    fetch(`/api/docuflow/reports/${DF.reportId}/field`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ field: sec.key, value: newVal })
                    }).catch(e => console.error(e));
                }
            });
        });

        document.getElementById('df-report-actions').classList.remove('hidden');
        if (typeof gsap !== 'undefined') {
            gsap.from('.df-report-section', { y: 20, opacity: 0, stagger: 0.06, duration: 0.5, ease: 'power3.out' });
        }
    }

    // Phase 3 → Phase 4
    const dfGotoExport = document.getElementById('df-goto-export');
    if (dfGotoExport) {
        dfGotoExport.addEventListener('click', () => {
            dfSetPhase(4);
            dfRenderExportPreview();
        });
    }

    // Back to edit
    const dfBackEdit = document.getElementById('df-back-edit');
    if (dfBackEdit) {
        dfBackEdit.addEventListener('click', () => dfSetPhase(3));
    }

    // New session
    const dfNewSession = document.getElementById('df-new-session');
    if (dfNewSession) {
        dfNewSession.addEventListener('click', () => {
            DF.transcript = [];
            DF.rawTranscript = '';
            DF.reportData = {};
            DF.reportId = null;
            DF.audioChunks = [];
            document.getElementById('df-name').value = '';
            document.getElementById('df-age').value = '';
            document.getElementById('df-sex').value = '';
            document.getElementById('df-transcript-feed').innerHTML = '<div class="df-trans-empty"><i class="fas fa-satellite-dish"></i> Waiting for speech...</div>';
            document.getElementById('df-turn-count').textContent = '0';
            document.getElementById('df-word-count').textContent = '0';
            document.getElementById('df-rec-timer').textContent = '00:00:00';
            document.getElementById('df-report-grid').innerHTML = '';
            document.getElementById('df-report-actions').classList.add('hidden');
            dfSetPhase(1);
        });
    }

    function dfRenderExportPreview() {
        const preview = document.getElementById('df-export-preview');
        let html = `<h3>ECHOSENSEI — CLINICAL REPORT</h3>`;
        html += `<div class="df-exp-section"><h4>Patient Information</h4><p>`;
        html += Object.entries(DF.patientInfo).filter(([_,v]) => v).map(([k,v]) => `<strong>${k.replace(/_/g,' ')}:</strong> ${v}`).join(' &nbsp;|&nbsp; ');
        html += `</p></div>`;
        DF.SECTIONS.forEach(sec => {
            const rawVal = DF.reportData[sec.key];
            const val = dfStringify(rawVal);
            if (val && val !== 'N/A' && val !== 'Not discussed') {
                html += `<div class="df-exp-section"><h4>${sec.label}</h4><p>${val}</p></div>`;
            }
        });
        preview.innerHTML = html;
    }

    // PDF Download
    const dfPdfBtn = document.getElementById('df-download-pdf');
    if (dfPdfBtn) {
        dfPdfBtn.addEventListener('click', () => {
            // Check if jsPDF is loaded
            if (!window.jspdf || !window.jspdf.jsPDF) {
                alert('PDF library is still loading. Please wait a moment and try again.');
                // Try loading it dynamically as fallback
                const script = document.createElement('script');
                script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
                script.onload = () => console.log('[DocuFlow] jsPDF loaded via fallback');
                document.head.appendChild(script);
                return;
            }
            try {
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF();
            const pageWidth = doc.internal.pageSize.getWidth();
            let y = 20;

            // Header
            doc.setFillColor(10, 14, 30);
            doc.rect(0, 0, pageWidth, 40, 'F');
            doc.setFontSize(20);
            doc.setTextColor(0, 229, 255);
            doc.text('ECHOSENSEI', pageWidth / 2, 18, { align: 'center' });
            doc.setFontSize(10);
            doc.setTextColor(200, 200, 200);
            doc.text('CLINICAL DOCUMENTATION REPORT', pageWidth / 2, 26, { align: 'center' });
            doc.setFontSize(8);
            doc.text(`Generated: ${new Date().toLocaleString()} | Report ID: ${DF.reportId || 'N/A'}`, pageWidth / 2, 34, { align: 'center' });
            y = 50;

            // Patient Info
            doc.setFontSize(11);
            doc.setTextColor(0, 0, 0);
            doc.setFont('helvetica', 'bold');
            doc.text('PATIENT INFORMATION', 20, y);
            y += 7;
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(9);
            Object.entries(DF.patientInfo).filter(([_,v]) => v).forEach(([k, v]) => {
                doc.text(`${k.replace(/_/g, ' ').toUpperCase()}: ${v}`, 20, y);
                y += 5;
            });
            y += 5;
            doc.setDrawColor(0, 229, 255);
            doc.line(20, y, pageWidth - 20, y);
            y += 8;

            // Report sections
            DF.SECTIONS.forEach(sec => {
                const rawVal = DF.reportData[sec.key];
                const val = dfStringify(rawVal);
                if (val && val !== 'N/A' && val !== 'Not discussed') {
                    if (y > 270) { doc.addPage(); y = 20; }
                    doc.setFont('helvetica', 'bold');
                    doc.setFontSize(10);
                    doc.setTextColor(14, 116, 144);
                    doc.text(sec.label.toUpperCase(), 20, y);
                    y += 6;
                    doc.setFont('helvetica', 'normal');
                    doc.setFontSize(9);
                    doc.setTextColor(50, 50, 50);
                    const lines = doc.splitTextToSize(val, pageWidth - 40);
                    lines.forEach(line => {
                        if (y > 280) { doc.addPage(); y = 20; }
                        doc.text(line, 20, y);
                        y += 5;
                    });
                    y += 6;
                }
            });

            // Footer
            if (y > 260) { doc.addPage(); y = 20; }
            y += 10;
            doc.setDrawColor(0, 229, 255);
            doc.line(20, y, pageWidth - 20, y);
            y += 8;
            doc.setFontSize(8);
            doc.setTextColor(120, 120, 120);
            doc.text('This report was generated by EchoSensei AI Clinical Documentation System.', 20, y);
            y += 4;
            doc.text('Reviewed and approved by the attending physician.', 20, y);
            y += 10;
            doc.text('Doctor\'s Signature: ________________________', 20, y);
            doc.text(`Date: ${new Date().toLocaleDateString()}`, pageWidth - 70, y);

            doc.save(`EchoSensei-Report-${DF.reportId || 'draft'}.pdf`);
            } catch (err) {
                console.error('[DocuFlow] PDF generation error:', err);
                alert('Error generating PDF: ' + err.message);
            }
        });
    }

    // Finalize — save to History tab
    const dfFinalizeBtn = document.getElementById('df-finalize');
    if (dfFinalizeBtn) {
        dfFinalizeBtn.addEventListener('click', async () => {
            if (!DF.reportId) {
                alert('No report to finalize.');
                return;
            }
            dfFinalizeBtn.disabled = true;
            dfFinalizeBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
            try {
                // 1. Mark report as finalized
                await fetch(`/api/docuflow/reports/${DF.reportId}/finalize`, { method: 'POST' });

                // 2. Save to History (create a session entry so it shows in the History tab)
                const res = await fetch('/api/docuflow/save_to_history', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        report_id: DF.reportId,
                        patient_info: DF.patientInfo,
                        report_data: DF.reportData,
                        transcript: DF.transcript
                    })
                });
                const data = await res.json();
                if (data.success) {
                    alert('Report finalized and saved to History!');
                    // Navigate to History tab
                    document.querySelector('[data-tab="history"]')?.click();
                } else {
                    alert('Report finalized but failed to save to history: ' + (data.error || 'Unknown error'));
                }
            } catch (e) {
                console.error(e);
                alert('Error finalizing report: ' + e.message);
            }
            dfFinalizeBtn.disabled = false;
            dfFinalizeBtn.innerHTML = '<i class="fas fa-check-circle"></i> Finalize Report';
        });
    }

});
