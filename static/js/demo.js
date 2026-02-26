// GLP-1 Growth OS Demo - Interactive JavaScript

const ws = new WebSocket(`ws://${window.location.host}/ws`);

// State
let currentMode = 'new';
let activePatientId = null;
let patients = {};

// DOM Elements
const modeToggle = document.getElementById('mode-toggle');
const oldLabel = document.getElementById('old-label');
const newLabel = document.getElementById('new-label');
const simulateBtn = document.getElementById('simulate-btn');
const resetBtn = document.getElementById('reset-btn');
const retentionBtn = document.getElementById('retention-btn');
const chatMessages = document.getElementById('chat-messages');
const storyOverlay = document.getElementById('story-overlay');
const startDemoBtn = document.getElementById('start-demo-btn');
const comparisonModal = document.getElementById('comparison-modal');
const closeComparisonBtn = document.getElementById('close-comparison');

// Clock update
function updateClock() {
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes().toString().padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    document.getElementById('clock').textContent = `${displayHours}:${minutes} ${ampm}`;
}
setInterval(updateClock, 1000);
updateClock();

// Mode Toggle
modeToggle.addEventListener('change', (e) => {
    currentMode = e.target.checked ? 'new' : 'old';
    if (currentMode === 'new') {
        newLabel.classList.add('active');
        oldLabel.classList.remove('active');
        document.getElementById('chat-status').textContent = 'AI Active';
        document.getElementById('chat-status').style.color = 'var(--success)';
    } else {
        oldLabel.classList.add('active');
        newLabel.classList.remove('active');
        document.getElementById('chat-status').textContent = 'Voicemail';
        document.getElementById('chat-status').style.color = 'var(--danger)';
    }
});

// WebSocket Handlers
ws.onopen = () => {
    console.log('Connected to demo server');
};

ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    handleMessage(data);
};

ws.onerror = (error) => {
    console.error('WebSocket error:', error);
};

function handleMessage(data) {
    switch (data.type) {
        case 'new_lead':
            handleNewLead(data);
            break;
        case 'message':
            handleNewMessage(data);
            break;
        case 'stage_change':
            handleStageChange(data);
            break;
        case 'checkin':
            handleCheckin(data);
            break;
        case 'metrics':
            updateMetrics(data.metrics);
            break;
        case 'reset':
            handleReset();
            break;
    }
}

function handleNewLead(data) {
    const patient = data.patient;
    patients[patient.id] = patient;
    activePatientId = patient.id;
    
    // Clear chat and show typing
    if (chatMessages.querySelector('.empty-state')) {
        chatMessages.innerHTML = '';
    }
    
    // Add patient to list
    addPatientToList(patient);
    
    // Enable retention button if in new mode
    if (currentMode === 'new') {
        retentionBtn.disabled = false;
    }
    
    // Update metrics
    updateMetrics(data.metrics);
    
    // Show typing indicator
    showTypingIndicator();
}

function handleNewMessage(data) {
    hideTypingIndicator();
    
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${data.sender}`;
    
    const textSpan = document.createElement('span');
    textSpan.textContent = data.text;
    messageDiv.appendChild(textSpan);
    
    if (data.sender !== 'system') {
        const timeDiv = document.createElement('div');
        timeDiv.className = 'message-time';
        timeDiv.textContent = new Date(data.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        messageDiv.appendChild(timeDiv);
    }
    
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    
    // Show typing again if more messages expected
    if (data.sender === 'patient' && currentMode === 'new') {
        setTimeout(showTypingIndicator, 500);
    }
}

function handleStageChange(data) {
    const stage = data.stage;
    const patient = patients[data.patient_id];
    
    if (patient) {
        patient.stage = stage;
        updatePatientStatus(data.patient_id, stage);
    }
    
    // Highlight active stage
    document.querySelectorAll('.stage').forEach(el => el.classList.remove('active'));
    const stageEl = document.getElementById(`stage-${stage}`);
    if (stageEl) {
        stageEl.classList.add('active');
        setTimeout(() => stageEl.classList.remove('active'), 2000);
    }
    
    updateMetrics(data.metrics);
}

function handleCheckin(data) {
    const checkin = data.data;
    const patient = patients[checkin.patient_id];
    
    if (patient) {
        // Add checkin to chat as AI message
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message ai';
        messageDiv.innerHTML = `
            <div style="font-size: 11px; opacity: 0.7; margin-bottom: 4px;">Day ${checkin.day} Check-in</div>
            <span>${checkin.text}</span>
            <div class="message-time">${new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
        `;
        chatMessages.appendChild(messageDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }
    
    updateMetrics(data.metrics);
}

function handleReset() {
    patients = {};
    activePatientId = null;
    chatMessages.innerHTML = `
        <div class="empty-state">
            <div class="empty-icon">📱</div>
            <p>Click "Simulate 8:47 PM Lead" to see the magic happen</p>
        </div>
    `;
    document.getElementById('patient-list').innerHTML = '<div class="no-patients">No active patients</div>';
    retentionBtn.disabled = true;
    
    // Reset all metrics display
    document.getElementById('count-lead').textContent = '0';
    document.getElementById('count-booked').textContent = '0';
    document.getElementById('count-showed').textContent = '0';
    document.getElementById('count-retained').textContent = '0';
    document.getElementById('count-upsold').textContent = '0';
}

// UI Helpers
function showTypingIndicator() {
    if (document.querySelector('.typing')) return;
    
    const typingDiv = document.createElement('div');
    typingDiv.className = 'typing';
    typingDiv.innerHTML = `
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
    `;
    chatMessages.appendChild(typingDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function hideTypingIndicator() {
    const typing = document.querySelector('.typing');
    if (typing) typing.remove();
}

function addPatientToList(patient) {
    const list = document.getElementById('patient-list');
    if (list.querySelector('.no-patients')) {
        list.innerHTML = '';
    }
    
    const initials = patient.name.split(' ').map(n => n[0]).join('');
    
    const item = document.createElement('div');
    item.className = 'patient-item';
    item.id = `patient-${patient.id}`;
    item.innerHTML = `
        <div class="patient-avatar">${initials}</div>
        <div class="patient-info">
            <div class="patient-name">${patient.name}</div>
            <div class="patient-stage">${patient.stage}</div>
        </div>
        <div class="patient-status">active</div>
    `;
    
    list.insertBefore(item, list.firstChild);
}

function updatePatientStatus(patientId, stage) {
    const item = document.getElementById(`patient-${patientId}`);
    if (item) {
        const stageEl = item.querySelector('.patient-stage');
        stageEl.textContent = stage;
        
        const statusEl = item.querySelector('.patient-status');
        if (stage === 'lost') {
            statusEl.textContent = 'lost';
            statusEl.classList.add('lost');
        }
    }
}

function updateMetrics(metrics) {
    // Update stage counts
    document.getElementById('count-lead').textContent = metrics.total_leads;
    document.getElementById('count-booked').textContent = metrics.booked;
    document.getElementById('count-showed').textContent = metrics.showed || 0;
    document.getElementById('count-retained').textContent = metrics.retained;
    document.getElementById('count-upsold').textContent = metrics.upsold;
    
    // Update revenue with animation
    const capturedEl = document.getElementById('revenue-captured');
    const oldCaptured = parseInt(capturedEl.textContent.replace(/[^0-9]/g, '')) || 0;
    if (oldCaptured !== metrics.revenue_captured) {
        capturedEl.textContent = `$${metrics.revenue_captured.toLocaleString()}`;
        capturedEl.classList.add('revenue-bump');
        setTimeout(() => capturedEl.classList.remove('revenue-bump'), 500);
    }
    
    document.getElementById('revenue-lost').textContent = `$${metrics.revenue_lost.toLocaleString()}`;
    
    // Update patients saved
    const saved = metrics.booked - (metrics.lost || 0);
    document.getElementById('patients-saved').textContent = saved > 0 ? saved : 0;
    
    // Update response time
    const responseEl = document.getElementById('response-time');
    if (currentMode === 'new') {
        responseEl.textContent = '4 sec';
        document.getElementById('response-comparison').textContent = 'vs 24-48 hours manual';
    } else {
        responseEl.textContent = '24+ hrs';
        document.getElementById('response-comparison').textContent = 'voicemail delay';
    }
}

// Button Handlers
simulateBtn.addEventListener('click', () => {
    // Set clock to 8:47 PM
    document.getElementById('clock').textContent = '8:47 PM';
    
    ws.send(JSON.stringify({
        action: 'simulate_lead',
        mode: currentMode
    }));
    
    simulateBtn.disabled = true;
    simulateBtn.classList.remove('pulse');
    
    setTimeout(() => {
        simulateBtn.disabled = false;
        simulateBtn.classList.add('pulse');
    }, 8000);
});

resetBtn.addEventListener('click', () => {
    ws.send(JSON.stringify({ action: 'reset' }));
});

retentionBtn.addEventListener('click', () => {
    if (activePatientId) {
        ws.send(JSON.stringify({
            action: 'simulate_retention',
            patient_id: activePatientId
        }));
        retentionBtn.disabled = true;
    }
});

// Story overlay
startDemoBtn.addEventListener('click', () => {
    storyOverlay.classList.add('hidden');
    setTimeout(() => {
        comparisonModal.classList.add('show');
    }, 500);
});

closeComparisonBtn.addEventListener('click', () => {
    comparisonModal.classList.remove('show');
});

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
    if (e.key === ' ') {
        e.preventDefault();
        simulateBtn.click();
    } else if (e.key === 'r' || e.key === 'R') {
        resetBtn.click();
    }
});

// Initial animation
window.addEventListener('load', () => {
    document.body.style.opacity = '0';
    setTimeout(() => {
        document.body.style.transition = 'opacity 0.5s';
        document.body.style.opacity = '1';
    }, 100);
});
