class PomodoroApp {
    constructor() {
        // App State
        this.focusDuration = 25 * 60; // in seconds
        this.breakDuration = 7 * 60;  // in seconds
        this.timeLeft = this.focusDuration;
        this.mode = 'focus'; // 'focus' or 'break'
        this.isRunning = false;
        this.timerInterval = null;
        this.hasCheckedIn = false; // To track if we've shown the mid-session modal during this focus session
        this.tasks = JSON.parse(localStorage.getItem('pomodoroTasks')) || [];

        // DOM Elements
        this.timeDisplay = document.getElementById('time-left');
        this.modeLabel = document.getElementById('mode-label');
        this.circle = document.getElementById('progress-ring-circle');
        
        // Buttons
        this.startBtn = document.getElementById('start-btn');
        this.pauseBtn = document.getElementById('pause-btn');
        this.resetBtn = document.getElementById('reset-btn');
        this.openSettingsBtn = document.getElementById('open-settings');
        this.addTaskBtn = document.getElementById('add-task-btn');
        
        // Modals
        this.settingsModal = document.getElementById('settings-modal');
        this.focusPromptModal = document.getElementById('focus-prompt-modal');
        this.distractionModal = document.getElementById('distraction-modal');
        this.focusPromptText = document.getElementById('focus-prompt-text');
        
        // Modal Action Buttons
        this.saveSettingsBtn = document.getElementById('save-settings');
        this.onTrackBtn = document.getElementById('on-track-btn');
        this.notOnTrackBtn = document.getElementById('not-on-track-btn');
        this.takeBreakBtn = document.getElementById('take-break-btn');
        this.restartFocusBtn = document.getElementById('restart-focus-btn');
        
        // Inputs
        this.newTaskInput = document.getElementById('new-task-input');
        this.focusInput = document.getElementById('focus-duration');
        this.breakInput = document.getElementById('break-duration');
        this.taskListEl = document.getElementById('task-list');

        // Setup Progress Ring
        this.circumference = 115 * 2 * Math.PI;
        this.circle.style.strokeDasharray = `${this.circumference} ${this.circumference}`;
        this.circle.style.strokeDashoffset = 0;

        // Audio
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();

        this.init();
    }

    init() {
        this.updateDisplay();
        this.renderTasks();
        this.attachEventListeners();
    }

    playNotificationSound() {
        if(this.audioContext.state === 'suspended') {
            this.audioContext.resume();
        }
        const osc = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, this.audioContext.currentTime); // A5
        osc.frequency.exponentialRampToValueAtTime(110, this.audioContext.currentTime + 0.5);
        
        gainNode.gain.setValueAtTime(0.5, this.audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.5);
        
        osc.connect(gainNode);
        gainNode.connect(this.audioContext.destination);
        osc.start();
        osc.stop(this.audioContext.currentTime + 0.5);
    }

    attachEventListeners() {
        // Timer Controls
        this.startBtn.addEventListener('click', () => this.startTimer());
        this.pauseBtn.addEventListener('click', () => this.pauseTimer());
        this.resetBtn.addEventListener('click', () => this.resetTimer());

        // Settings
        this.openSettingsBtn.addEventListener('click', () => this.settingsModal.classList.remove('hidden'));
        this.saveSettingsBtn.addEventListener('click', () => this.saveSettings());
        
        // Tasks
        this.addTaskBtn.addEventListener('click', () => this.addTask());
        this.newTaskInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.addTask();
        });

        // Modals overlay click to close (Settings only)
        this.settingsModal.addEventListener('click', (e) => {
            if(e.target === this.settingsModal) this.settingsModal.classList.add('hidden');
        });

        // Focus Check Modals
        this.onTrackBtn.addEventListener('click', () => {
            this.focusPromptModal.classList.add('hidden');
            this.startTimer();
        });

        this.notOnTrackBtn.addEventListener('click', () => {
            this.focusPromptModal.classList.add('hidden');
            this.distractionModal.classList.remove('hidden');
        });

        // Distraction Action Modals
        this.takeBreakBtn.addEventListener('click', () => {
            this.distractionModal.classList.add('hidden');
            this.switchMode('break');
            this.startTimer();
        });

        this.restartFocusBtn.addEventListener('click', () => {
            this.distractionModal.classList.add('hidden');
            this.switchMode('focus');
            this.resetTimer();
            this.startTimer();
        });
    }

    startTimer() {
        if (this.isRunning) return;
        this.isRunning = true;
        
        this.startBtn.classList.add('hidden');
        this.pauseBtn.classList.remove('hidden');

        this.timerInterval = setInterval(() => {
            this.timeLeft--;
            this.updateDisplay();

            // Mid-session focus check logic
            if (this.mode === 'focus' && !this.hasCheckedIn) {
                const totalFocusTime = this.focusDuration;
                if (this.timeLeft === Math.floor(totalFocusTime / 2)) {
                    this.hasCheckedIn = true;
                    this.pauseTimer();
                    this.playNotificationSound();
                    
                    const focusedTask = this.tasks.find(t => t.isFocused);
                    if (focusedTask) {
                        this.focusPromptText.textContent = `Are you still actively working on: "${focusedTask.text}"?`;
                    } else {
                        this.focusPromptText.textContent = `You are halfway through your focus session. Stay focused!`;
                    }

                    this.focusPromptModal.classList.remove('hidden');
                }
            }

            // Timer complete logic
            if (this.timeLeft <= 0) {
                this.pauseTimer();
                this.playNotificationSound();
                setTimeout(() => this.playNotificationSound(), 600); // double beep
                
                if (this.mode === 'focus') {
                    this.switchMode('break');
                } else {
                    this.switchMode('focus');
                }
            }
        }, 1000);
    }

    pauseTimer() {
        this.isRunning = false;
        clearInterval(this.timerInterval);
        this.pauseBtn.classList.add('hidden');
        this.startBtn.classList.remove('hidden');
    }

    resetTimer() {
        this.pauseTimer();
        this.hasCheckedIn = false;
        this.timeLeft = this.mode === 'focus' ? this.focusDuration : this.breakDuration;
        this.updateDisplay();
    }

    switchMode(newMode) {
        this.mode = newMode;
        this.hasCheckedIn = false;
        this.timeLeft = this.mode === 'focus' ? this.focusDuration : this.breakDuration;
        
        this.modeLabel.textContent = this.mode === 'focus' ? 'Focus' : 'Break';
        
        // Update coloring for break mode
        if (this.mode === 'break') {
            this.modeLabel.style.color = 'var(--success)';
            document.getElementById('gradient').innerHTML = `
                <stop offset="0%" stop-color="#10b981" />
                <stop offset="100%" stop-color="#3b82f6" />
            `;
        } else {
            this.modeLabel.style.color = 'var(--primary)';
            document.getElementById('gradient').innerHTML = `
                <stop offset="0%" stop-color="#FF3366" />
                <stop offset="100%" stop-color="#FF9933" />
            `;
        }
        
        this.updateDisplay();
    }

    updateDisplay() {
        // Time text
        const minutes = Math.floor(this.timeLeft / 60);
        const seconds = this.timeLeft % 60;
        const timeString = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        this.timeDisplay.textContent = timeString;
        document.title = `${timeString} - FocusFlow`;

        // Progress ring
        const totalDuration = this.mode === 'focus' ? this.focusDuration : this.breakDuration;
        const offset = this.circumference - (this.timeLeft / totalDuration) * this.circumference;
        this.circle.style.strokeDashoffset = offset;
    }

    saveSettings() {
        const newFocusMins = parseInt(this.focusInput.value);
        const newBreakMins = parseInt(this.breakInput.value);
        
        if (newFocusMins > 0 && newBreakMins > 0) {
            this.focusDuration = newFocusMins * 60;
            this.breakDuration = newBreakMins * 60;
            
            this.resetTimer();
            this.settingsModal.classList.add('hidden');
        }
    }

    // Task Management
    addTask() {
        const text = this.newTaskInput.value.trim();
        if (text) {
            // First task gets focus automatically
            const isFirst = this.tasks.length === 0;
            this.tasks.push({ id: Date.now(), text, completed: false, isFocused: isFirst });
            this.newTaskInput.value = '';
            this.saveTasks();
            this.renderTasks();
        }
    }

    setFocusTask(id) {
        this.tasks.forEach(t => {
            t.isFocused = (t.id === id);
        });
        this.saveTasks();
        this.renderTasks();
    }

    toggleTask(id) {
        const task = this.tasks.find(t => t.id === id);
        if (task) {
            task.completed = !task.completed;
            this.saveTasks();
            this.renderTasks();
        }
    }

    deleteTask(id) {
        this.tasks = this.tasks.filter(t => t.id !== id);
        this.saveTasks();
        this.renderTasks();
    }

    saveTasks() {
        localStorage.setItem('pomodoroTasks', JSON.stringify(this.tasks));
    }

    renderTasks() {
        this.taskListEl.innerHTML = '';
        this.tasks.forEach(task => {
            const li = document.createElement('li');
            li.className = `task-item ${task.completed ? 'completed' : ''}`;
            
            li.innerHTML = `
                <button class="focus-task-btn ${task.isFocused ? 'active' : ''}" onclick="app.setFocusTask(${task.id})" aria-label="Set as focus" title="Set as focus task">🎯</button>
                <input type="checkbox" ${task.completed ? 'checked' : ''} onchange="app.toggleTask(${task.id})">
                <span onclick="app.toggleTask(${task.id})">${task.text}</span>
                <button class="delete-task-btn" onclick="app.deleteTask(${task.id})" aria-label="Delete task">✕</button>
            `;
            this.taskListEl.appendChild(li);
        });
    }
}

// Initialize App
const app = new PomodoroApp();
