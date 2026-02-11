class WorkPulseApp {
    constructor() {
        this.data = {
            projects: [],
            tasks: [],
            activities: [],
            metrics: [],
            weeklySnapshots: [],
            settings: {
                theme: 'dark',
                userName: '',
                jobTitle: '',
                bossName: '',
                onboardingComplete: false,
                defaultView: 'dashboard'
            }
        };
        this.currentPage = 'dashboard';
        this.charts = {};
        this.confirmCallback = null;
        this.focusTrapElements = [];
        this.previousFocus = null;
        this.firebaseApp = null;
        this.auth = null;
        this.firestore = null;
        this.currentUser = null;
        this.syncTimeout = null;
        this.init();
    }

    // ========================================
    // Initialization
    // ========================================
    init() {
        this.loadData();
        this.applyTheme(this.data.settings.theme);
        this.setupNavigation();
        this.setupSidebar();
        this.setupModals();
        this.setupThemeToggle();
        this.setupSettings();
        this.setupExportImport();
        this.setupProjects();
        this.setupTasks();
        this.setupKanban();
        this.setupActivities();
        this.setupMetrics();
        this.setupReports();
        this.setupSnapshots();
        this.setupCommandPalette();
        this.setupKeyboardShortcuts();
        this.setupAuth();
        this.handleHashNavigation();
        this.renderStreakWidget();
        this.registerServiceWorker();
        window.addEventListener('hashchange', () => this.handleHashNavigation());
    }

    // ========================================
    // Data Persistence
    // ========================================
    loadData() {
        try {
            const saved = localStorage.getItem('workpulse-data');
            if (saved) {
                const parsed = JSON.parse(saved);
                this.data = { ...this.data, ...parsed };
                this.data.settings = { ...this.constructor.defaultSettings(), ...parsed.settings };
            }
        } catch (e) {
            console.error('Failed to load data:', e);
        }
    }

    saveData() {
        try {
            localStorage.setItem('workpulse-data', JSON.stringify(this.data));
            if (this.firestore && this.currentUser) {
                clearTimeout(this.syncTimeout);
                this.syncTimeout = setTimeout(() => this.syncToCloud(), 2000);
            }
        } catch (e) {
            console.error('Failed to save data:', e);
        }
    }

    static defaultSettings() {
        return {
            theme: 'dark',
            userName: '',
            jobTitle: '',
            bossName: '',
            onboardingComplete: false,
            defaultView: 'dashboard',
            streak: 0,
            longestStreak: 0,
            lastActiveDate: '',
            karma: 0,
            karmaLevel: 'Beginner'
        };
    }

    // ========================================
    // Utilities
    // ========================================
    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
    }

    escapeHtml(str) {
        if (str == null) return '';
        const s = String(str);
        const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
        return s.replace(/[&<>"']/g, c => map[c]);
    }

    formatDate(dateStr) {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }

    formatDateShort(dateStr) {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }

    formatTimestamp(ts) {
        if (!ts) return '';
        const d = new Date(ts);
        return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    }

    getRelativeDate(dateStr) {
        if (!dateStr) return '';
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const d = new Date(dateStr);
        d.setHours(0, 0, 0, 0);
        const diff = Math.round((today - d) / 86400000);
        if (diff === 0) return 'Today';
        if (diff === 1) return 'Yesterday';
        if (diff < 7) return `${diff} days ago`;
        return this.formatDate(dateStr);
    }

    getDateGroup(dateStr) {
        if (!dateStr) return 'Unknown';
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const d = new Date(dateStr);
        d.setHours(0, 0, 0, 0);
        const diff = Math.round((today - d) / 86400000);
        if (diff === 0) return 'Today';
        if (diff === 1) return 'Yesterday';
        if (diff < 7) return 'This Week';
        if (diff < 14) return 'Last Week';
        if (diff < 30) return 'This Month';
        return this.formatDate(dateStr);
    }

    toLocalDateString(date) {
        const d = date || new Date();
        return d.getFullYear() + '-' +
            String(d.getMonth() + 1).padStart(2, '0') + '-' +
            String(d.getDate()).padStart(2, '0');
    }

    getDueUrgency(dueDate) {
        if (!dueDate) return '';
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const due = new Date(dueDate);
        due.setHours(0, 0, 0, 0);
        const diff = Math.round((due - today) / 86400000);
        if (diff < 0) return 'overdue';
        if (diff === 0) return 'today';
        if (diff <= 7) return 'this-week';
        return 'future';
    }

    getWeekBounds(date) {
        const d = new Date(date || new Date());
        const day = d.getDay();
        const monday = new Date(d);
        monday.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
        monday.setHours(0, 0, 0, 0);
        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);
        sunday.setHours(23, 59, 59, 999);
        return { start: monday, end: sunday };
    }

    // ========================================
    // Navigation
    // ========================================
    setupNavigation() {
        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const page = link.dataset.page;
                this.navigateTo(page);
            });
        });
    }

    navigateTo(page) {
        this.currentPage = page;
        window.location.hash = page;

        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        const pageEl = document.getElementById(`page-${page}`);
        if (pageEl) pageEl.classList.add('active');

        document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
        const navLink = document.querySelector(`.nav-link[data-page="${page}"]`);
        if (navLink) navLink.classList.add('active');

        const title = document.getElementById('mobile-page-title');
        if (title && navLink) {
            title.textContent = navLink.querySelector('span').textContent;
        }

        this.closeSidebar();
        this.renderPage(page);
    }

    handleHashNavigation() {
        const hash = window.location.hash.replace('#', '') || this.data.settings.defaultView || 'dashboard';
        this.navigateTo(hash);
    }

    renderPage(page) {
        switch (page) {
            case 'dashboard': this.renderDashboard(); break;
            case 'projects': this.renderProjects(); break;
            case 'kanban': this.renderKanban(); break;
            case 'activity': this.renderActivities(); break;
            case 'metrics': this.renderMetrics(); break;
            case 'reports': this.renderReports(); break;
            case 'settings': this.renderSettings(); break;
        }
    }

    // ========================================
    // Sidebar (Mobile)
    // ========================================
    setupSidebar() {
        const toggle = document.getElementById('sidebar-toggle');
        const close = document.getElementById('sidebar-close');
        const overlay = document.getElementById('sidebar-overlay');

        if (toggle) toggle.addEventListener('click', () => this.openSidebar());
        if (close) close.addEventListener('click', () => this.closeSidebar());
        if (overlay) overlay.addEventListener('click', () => this.closeSidebar());
    }

    openSidebar() {
        document.getElementById('sidebar').classList.add('open');
        document.getElementById('sidebar-overlay').classList.add('active');
    }

    closeSidebar() {
        document.getElementById('sidebar').classList.remove('open');
        document.getElementById('sidebar-overlay').classList.remove('active');
    }

    // ========================================
    // Modals
    // ========================================
    setupModals() {
        document.querySelectorAll('.modal-overlay').forEach(overlay => {
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) this.closeModal(overlay.id);
            });
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                const shortcutsOverlay = document.getElementById('shortcuts-overlay');
                if (shortcutsOverlay?.classList.contains('active')) { this.hideShortcutsOverlay(); return; }
                const activeModal = document.querySelector('.modal-overlay.active');
                if (activeModal) this.closeModal(activeModal.id);
            }
        });

        const cancelBtn = document.getElementById('confirm-dialog-cancel');
        if (cancelBtn) cancelBtn.addEventListener('click', () => this.closeModal('confirm-dialog'));

        const okBtn = document.getElementById('confirm-dialog-ok');
        if (okBtn) okBtn.addEventListener('click', () => {
            if (this.confirmCallback) {
                this.confirmCallback();
                this.confirmCallback = null;
            }
            this.closeModal('confirm-dialog');
        });
    }

    openModal(id) {
        const overlay = document.getElementById(id);
        if (!overlay) return;
        this.previousFocus = document.activeElement;
        overlay.classList.add('active');
        this.trapFocus(overlay);
        const firstInput = overlay.querySelector('input:not([type="hidden"]), select, textarea, button:not(.btn-icon)');
        if (firstInput) firstInput.focus();
    }

    closeModal(id) {
        const overlay = document.getElementById(id);
        if (!overlay) return;
        overlay.classList.remove('active');
        this.releaseFocus();
        if (this.previousFocus) {
            this.previousFocus.focus();
            this.previousFocus = null;
        }
    }

    trapFocus(element) {
        const focusable = element.querySelectorAll(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        this._trapHandler = (e) => {
            if (e.key !== 'Tab') return;
            if (e.shiftKey) {
                if (document.activeElement === first) { e.preventDefault(); last.focus(); }
            } else {
                if (document.activeElement === last) { e.preventDefault(); first.focus(); }
            }
        };
        element.addEventListener('keydown', this._trapHandler);
    }

    releaseFocus() {
        document.querySelectorAll('.modal-overlay').forEach(overlay => {
            if (this._trapHandler) {
                overlay.removeEventListener('keydown', this._trapHandler);
            }
        });
    }

    confirmAction(message, callback) {
        const msgEl = document.getElementById('confirm-dialog-message');
        if (msgEl) msgEl.textContent = message;
        this.confirmCallback = callback;
        this.openModal('confirm-dialog');
    }

    // ========================================
    // Theme
    // ========================================
    setupThemeToggle() {
        const toggle = document.getElementById('theme-toggle');
        const toggleMobile = document.getElementById('theme-toggle-mobile');
        const themeLight = document.getElementById('theme-light');
        const themeDark = document.getElementById('theme-dark');

        const toggleTheme = () => {
            const next = this.data.settings.theme === 'dark' ? 'light' : 'dark';
            this.data.settings.theme = next;
            this.applyTheme(next);
            this.saveData();
        };

        if (toggle) toggle.addEventListener('click', toggleTheme);
        if (toggleMobile) toggleMobile.addEventListener('click', toggleTheme);

        if (themeLight) themeLight.addEventListener('click', () => {
            this.data.settings.theme = 'light';
            this.applyTheme('light');
            this.saveData();
            this.updateThemeButtons();
        });
        if (themeDark) themeDark.addEventListener('click', () => {
            this.data.settings.theme = 'dark';
            this.applyTheme('dark');
            this.saveData();
            this.updateThemeButtons();
        });
    }

    applyTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        const icons = document.querySelectorAll('#theme-toggle i, #theme-toggle-mobile i');
        icons.forEach(i => {
            i.className = theme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
        });
        this.updateThemeButtons();
    }

    updateThemeButtons() {
        const themeLight = document.getElementById('theme-light');
        const themeDark = document.getElementById('theme-dark');
        if (themeLight) themeLight.classList.toggle('active', this.data.settings.theme === 'light');
        if (themeDark) themeDark.classList.toggle('active', this.data.settings.theme === 'dark');
    }

    // ========================================
    // Toast Notifications
    // ========================================
    showToast(message, type = 'info') {
        const container = document.getElementById('toast-container');
        if (!container) return;

        const icons = {
            success: 'fa-check-circle',
            error: 'fa-exclamation-circle',
            warning: 'fa-exclamation-triangle',
            info: 'fa-info-circle'
        };

        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `<i class="fas ${icons[type] || icons.info}"></i><span>${this.escapeHtml(message)}</span>`;
        container.appendChild(toast);

        setTimeout(() => {
            toast.style.animation = 'toastOut 0.3s ease forwards';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    // ========================================
    // Settings
    // ========================================
    setupSettings() {
        const saveBtn = document.getElementById('save-settings-btn');
        if (saveBtn) saveBtn.addEventListener('click', () => this.saveSettings());
    }

    saveSettings() {
        const name = document.getElementById('setting-name');
        const title = document.getElementById('setting-title');
        const boss = document.getElementById('setting-boss');

        if (name) this.data.settings.userName = name.value.trim();
        if (title) this.data.settings.jobTitle = title.value.trim();
        if (boss) this.data.settings.bossName = boss.value.trim();

        this.saveData();
        this.showToast('Settings saved', 'success');
    }

    renderSettings() {
        const name = document.getElementById('setting-name');
        const title = document.getElementById('setting-title');
        const boss = document.getElementById('setting-boss');

        if (name) name.value = this.data.settings.userName || '';
        if (title) title.value = this.data.settings.jobTitle || '';
        if (boss) boss.value = this.data.settings.bossName || '';

        this.updateThemeButtons();
    }

    // ========================================
    // Export / Import
    // ========================================
    setupExportImport() {
        const exportBtn = document.getElementById('export-data-btn');
        const importBtn = document.getElementById('import-data-btn');
        const importInput = document.getElementById('import-file-input');

        if (exportBtn) exportBtn.addEventListener('click', () => this.exportData());
        if (importBtn) importBtn.addEventListener('click', () => {
            if (importInput) importInput.click();
        });
        if (importInput) importInput.addEventListener('change', (e) => this.importData(e));
    }

    exportData() {
        const json = JSON.stringify(this.data, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `workpulse-export-${this.toLocalDateString()}.json`;
        a.click();
        URL.revokeObjectURL(url);
        this.showToast('Data exported', 'success');
    }

    importData(e) {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            try {
                const imported = JSON.parse(ev.target.result);
                if (imported.projects || imported.tasks || imported.activities) {
                    this.confirmAction('This will replace all your data. Continue?', () => {
                        this.data = { ...this.data, ...imported };
                        this.data.settings = { ...this.constructor.defaultSettings(), ...imported.settings };
                        this.saveData();
                        this.renderPage(this.currentPage);
                        this.showToast('Data imported successfully', 'success');
                    });
                } else {
                    this.showToast('Invalid data file', 'error');
                }
            } catch (err) {
                this.showToast('Failed to parse file', 'error');
            }
        };
        reader.readAsText(file);
        e.target.value = '';
    }

    // ========================================
    // Firebase Auth & Sync
    // ========================================
    setupAuth() {
        const initFirebase = () => {
            if (!window.firebaseModules) return;
            const fm = window.firebaseModules;

            // Firebase config - replace with your project's config
            const firebaseConfig = {
                apiKey: "YOUR_API_KEY",
                authDomain: "YOUR_PROJECT.firebaseapp.com",
                projectId: "YOUR_PROJECT_ID",
                storageBucket: "YOUR_PROJECT.appspot.com",
                messagingSenderId: "YOUR_SENDER_ID",
                appId: "YOUR_APP_ID"
            };

            // Only init if config is set
            if (firebaseConfig.apiKey === 'YOUR_API_KEY') {
                console.log('Firebase not configured. Cloud sync disabled.');
                return;
            }

            try {
                this.firebaseApp = fm.initializeApp(firebaseConfig);
                this.auth = fm.getAuth(this.firebaseApp);
                this.firestore = fm.getFirestore(this.firebaseApp);

                fm.onAuthStateChanged(this.auth, (user) => this.handleAuth(user));
            } catch (e) {
                console.error('Firebase init failed:', e);
            }
        };

        if (window.firebaseModules) {
            initFirebase();
        } else {
            window.addEventListener('firebase-ready', initFirebase);
        }

        // Sign in button
        const signInBtn = document.getElementById('sign-in-btn');
        if (signInBtn) signInBtn.addEventListener('click', () => this.openModal('auth-modal'));

        // Google sign in
        const googleBtn = document.getElementById('google-sign-in-btn');
        if (googleBtn) googleBtn.addEventListener('click', () => this.handleGoogleSignIn());

        // Email form
        const emailForm = document.getElementById('auth-email-form');
        if (emailForm) emailForm.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleEmailSignIn();
        });

        // Register button
        const registerBtn = document.getElementById('auth-register-btn');
        if (registerBtn) registerBtn.addEventListener('click', () => this.handleEmailRegister());

        // Sign out
        const signOutBtn = document.getElementById('sign-out-btn');
        if (signOutBtn) signOutBtn.addEventListener('click', () => this.handleSignOut());

        // Sync now
        const syncNowBtn = document.getElementById('sync-now-btn');
        if (syncNowBtn) syncNowBtn.addEventListener('click', () => this.syncToCloud());
    }

    handleAuth(user) {
        this.currentUser = user;
        const signedOut = document.getElementById('auth-section-signed-out');
        const signedIn = document.getElementById('auth-section-signed-in');
        const userEmail = document.getElementById('auth-user-email');
        const syncStatus = document.getElementById('sync-status');
        const userInfo = document.getElementById('user-info');
        const userName = document.getElementById('user-display-name');

        if (user) {
            if (signedOut) signedOut.style.display = 'none';
            if (signedIn) signedIn.style.display = 'block';
            if (userEmail) userEmail.textContent = user.email || user.displayName || 'Unknown';
            if (syncStatus) {
                syncStatus.style.display = 'flex';
                syncStatus.innerHTML = '<i class="fas fa-cloud-upload-alt"></i><span>Synced</span>';
                syncStatus.className = 'sync-status synced';
            }
            if (userInfo) {
                userInfo.style.display = 'flex';
                if (userName) userName.textContent = user.displayName || user.email || 'User';
            }
            this.closeModal('auth-modal');
            this.startFirestoreSync();
        } else {
            if (signedOut) signedOut.style.display = 'block';
            if (signedIn) signedIn.style.display = 'none';
            if (syncStatus) syncStatus.style.display = 'none';
            if (userInfo) userInfo.style.display = 'none';
        }
    }

    async handleGoogleSignIn() {
        if (!this.auth) {
            this.showToast('Firebase not configured. Add your Firebase config to app.js', 'warning');
            return;
        }
        const fm = window.firebaseModules;
        try {
            const provider = new fm.GoogleAuthProvider();
            await fm.signInWithPopup(this.auth, provider);
            this.showToast('Signed in with Google', 'success');
        } catch (e) {
            this.showAuthError(e.message);
        }
    }

    async handleEmailSignIn() {
        if (!this.auth) {
            this.showToast('Firebase not configured. Add your Firebase config to app.js', 'warning');
            return;
        }
        const fm = window.firebaseModules;
        const email = document.getElementById('auth-email').value.trim();
        const password = document.getElementById('auth-password').value;

        if (!email || !password) {
            this.showAuthError('Please fill in all fields.');
            return;
        }

        try {
            await fm.signInWithEmailAndPassword(this.auth, email, password);
            this.showToast('Signed in successfully', 'success');
        } catch (e) {
            this.showAuthError(this.getFriendlyAuthError(e.code));
        }
    }

    async handleEmailRegister() {
        if (!this.auth) {
            this.showToast('Firebase not configured. Add your Firebase config to app.js', 'warning');
            return;
        }
        const fm = window.firebaseModules;
        const email = document.getElementById('auth-email').value.trim();
        const password = document.getElementById('auth-password').value;

        if (!email || !password) {
            this.showAuthError('Please fill in all fields.');
            return;
        }
        if (password.length < 6) {
            this.showAuthError('Password must be at least 6 characters.');
            return;
        }

        try {
            const cred = await fm.createUserWithEmailAndPassword(this.auth, email, password);
            if (this.data.settings.userName) {
                await fm.updateProfile(cred.user, { displayName: this.data.settings.userName });
            }
            this.showToast('Account created and signed in', 'success');
        } catch (e) {
            this.showAuthError(this.getFriendlyAuthError(e.code));
        }
    }

    async handleSignOut() {
        if (!this.auth) return;
        const fm = window.firebaseModules;
        try {
            await fm.signOut(this.auth);
            this.showToast('Signed out', 'info');
        } catch (e) {
            this.showToast('Sign out failed', 'error');
        }
    }

    showAuthError(msg) {
        const el = document.getElementById('auth-error');
        if (el) {
            el.textContent = msg;
            el.style.display = 'block';
            setTimeout(() => { el.style.display = 'none'; }, 5000);
        }
    }

    getFriendlyAuthError(code) {
        const map = {
            'auth/user-not-found': 'No account found with this email.',
            'auth/wrong-password': 'Incorrect password.',
            'auth/email-already-in-use': 'An account with this email already exists.',
            'auth/weak-password': 'Password must be at least 6 characters.',
            'auth/invalid-email': 'Please enter a valid email address.',
            'auth/too-many-requests': 'Too many attempts. Please try again later.',
            'auth/popup-closed-by-user': 'Sign-in popup was closed.',
            'auth/invalid-credential': 'Invalid email or password.'
        };
        return map[code] || 'Authentication failed. Please try again.';
    }

    async startFirestoreSync() {
        if (!this.firestore || !this.currentUser) return;
        const fm = window.firebaseModules;
        try {
            const docRef = fm.doc(this.firestore, 'users', this.currentUser.uid);
            const snap = await fm.getDoc(docRef);
            if (snap.exists()) {
                const cloud = snap.data();
                const localTime = localStorage.getItem('workpulse-lastSync') || '0';
                const cloudTime = cloud.lastSync || '0';
                if (cloudTime > localTime) {
                    this.data = { ...this.data, ...cloud.data };
                    this.data.settings = { ...this.constructor.defaultSettings(), ...cloud.data.settings };
                    this.saveDataLocal();
                    this.renderPage(this.currentPage);
                    this.showToast('Data synced from cloud', 'info');
                } else {
                    this.syncToCloud();
                }
            } else {
                this.syncToCloud();
            }
            this.updateSyncStatus('synced');
        } catch (e) {
            console.error('Sync failed:', e);
            this.updateSyncStatus('error');
        }
    }

    async syncToCloud() {
        if (!this.firestore || !this.currentUser) return;
        const fm = window.firebaseModules;
        this.updateSyncStatus('syncing');
        try {
            const now = new Date().toISOString();
            const docRef = fm.doc(this.firestore, 'users', this.currentUser.uid);
            await fm.setDoc(docRef, {
                data: this.data,
                lastSync: now,
                updatedAt: now
            });
            localStorage.setItem('workpulse-lastSync', now);
            this.updateSyncStatus('synced');
        } catch (e) {
            console.error('Cloud sync failed:', e);
            this.updateSyncStatus('error');
            this.showToast('Cloud sync failed', 'error');
        }
    }

    updateSyncStatus(status) {
        const el = document.getElementById('sync-status');
        if (!el) return;
        el.style.display = 'flex';
        const icons = { synced: 'fa-cloud', syncing: 'fa-sync fa-spin', error: 'fa-exclamation-triangle' };
        const labels = { synced: 'Synced', syncing: 'Syncing...', error: 'Sync error' };
        el.innerHTML = `<i class="fas ${icons[status]}"></i><span>${labels[status]}</span>`;
        el.className = `sync-status ${status}`;
    }

    saveDataLocal() {
        try {
            localStorage.setItem('workpulse-data', JSON.stringify(this.data));
        } catch (e) {
            console.error('Failed to save data:', e);
        }
    }

    // ========================================
    // Service Worker
    // ========================================
    registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('./sw.js')
                .then(() => console.log('SW registered'))
                .catch(err => console.error('SW registration failed:', err));
        }
    }

    // ========================================
    // Projects
    // ========================================
    setupProjects() {
        const addBtn = document.getElementById('add-project-btn');
        if (addBtn) addBtn.addEventListener('click', () => this.openProjectModal());

        const saveBtn = document.getElementById('save-project-btn');
        if (saveBtn) saveBtn.addEventListener('click', () => this.saveProject());

        // Color picker
        document.getElementById('project-color-options')?.addEventListener('click', (e) => {
            const opt = e.target.closest('.color-option');
            if (!opt) return;
            document.querySelectorAll('#project-color-options .color-option').forEach(o => o.classList.remove('selected'));
            opt.classList.add('selected');
        });

        // Filters
        const statusFilter = document.getElementById('project-status-filter');
        const searchFilter = document.getElementById('project-search');
        if (statusFilter) statusFilter.addEventListener('change', () => this.renderProjects());
        if (searchFilter) searchFilter.addEventListener('input', () => this.renderProjects());

        // Event delegation for project cards
        document.getElementById('projects-content')?.addEventListener('click', (e) => {
            const card = e.target.closest('.project-card');
            const editBtn = e.target.closest('.project-edit-btn');
            const deleteBtn = e.target.closest('.project-delete-btn');

            if (deleteBtn) {
                e.stopPropagation();
                const id = deleteBtn.dataset.id;
                this.deleteProject(id);
            } else if (editBtn) {
                e.stopPropagation();
                const id = editBtn.dataset.id;
                this.editProject(id);
            } else if (card) {
                const id = card.dataset.id;
                this.viewProjectDetail(id);
            }
        });
    }

    openProjectModal(project = null) {
        const title = document.getElementById('project-modal-title');
        const idField = document.getElementById('project-id');
        const nameField = document.getElementById('project-name');
        const descField = document.getElementById('project-description');
        const statusField = document.getElementById('project-status');
        const priorityField = document.getElementById('project-priority');
        const tagsField = document.getElementById('project-tags');

        if (project) {
            title.textContent = 'Edit Project';
            idField.value = project.id;
            nameField.value = project.name || '';
            descField.value = project.description || '';
            statusField.value = project.status || 'active';
            priorityField.value = project.priority || '3';
            tagsField.value = (project.tags || []).join(', ');
            document.querySelectorAll('#project-color-options .color-option').forEach(o => {
                o.classList.toggle('selected', o.dataset.color === project.color);
            });
        } else {
            title.textContent = 'New Project';
            idField.value = '';
            nameField.value = '';
            descField.value = '';
            statusField.value = 'active';
            priorityField.value = '3';
            tagsField.value = '';
            document.querySelectorAll('#project-color-options .color-option').forEach((o, i) => {
                o.classList.toggle('selected', i === 0);
            });
        }

        this.openModal('project-modal');
    }

    saveProject() {
        const id = document.getElementById('project-id').value;
        const name = document.getElementById('project-name').value.trim();
        const description = document.getElementById('project-description').value.trim();
        const status = document.getElementById('project-status').value;
        const priority = parseInt(document.getElementById('project-priority').value) || 3;
        const tagsRaw = document.getElementById('project-tags').value;
        const colorEl = document.querySelector('#project-color-options .color-option.selected');
        const color = colorEl ? colorEl.dataset.color : '#0d9488';

        if (!name) {
            this.showToast('Project name is required', 'error');
            return;
        }
        if (name.length > 100) {
            this.showToast('Project name must be 100 characters or less', 'error');
            return;
        }

        const tags = tagsRaw.split(',').map(t => t.trim()).filter(Boolean);
        const now = new Date().toISOString();

        if (id) {
            const idx = this.data.projects.findIndex(p => p.id === id);
            if (idx !== -1) {
                const old = this.data.projects[idx];
                this.data.projects[idx] = {
                    ...old, name, description, status, priority, tags, color,
                    updatedAt: now,
                    completedAt: status === 'completed' && old.status !== 'completed' ? now : old.completedAt
                };
                this.showToast('Project updated', 'success');
            }
        } else {
            this.data.projects.push({
                id: this.generateId(),
                name, description, status, priority, tags, color,
                createdAt: now, updatedAt: now, completedAt: null
            });
            this.showToast('Project created', 'success');
        }

        this.saveData();
        this.closeModal('project-modal');
        this.renderProjects();
    }

    editProject(id) {
        const project = this.data.projects.find(p => p.id === id);
        if (project) this.openProjectModal(project);
    }

    deleteProject(id) {
        const project = this.data.projects.find(p => p.id === id);
        if (!project) return;

        const taskCount = this.data.tasks.filter(t => t.projectId === id).length;
        const activityCount = this.data.activities.filter(a => a.projectId === id).length;
        const metricCount = this.data.metrics.filter(m => m.projectId === id).length;

        let msg = `Delete project "${project.name}"?`;
        const associations = [];
        if (taskCount) associations.push(`${taskCount} task(s)`);
        if (activityCount) associations.push(`${activityCount} activit${activityCount === 1 ? 'y' : 'ies'}`);
        if (metricCount) associations.push(`${metricCount} metric(s)`);
        if (associations.length) {
            msg += `\n\nThis will also delete ${associations.join(', ')} associated with this project.`;
        }

        this.confirmAction(msg, () => {
            this.data.projects = this.data.projects.filter(p => p.id !== id);
            this.data.tasks = this.data.tasks.filter(t => t.projectId !== id);
            this.data.activities = this.data.activities.filter(a => a.projectId !== id);
            this.data.metrics = this.data.metrics.filter(m => m.projectId !== id);
            this.saveData();
            this.renderProjects();
            this.showToast('Project deleted', 'success');
        });
    }

    getProject(id) {
        return this.data.projects.find(p => p.id === id);
    }

    viewProjectDetail(id) {
        // Navigates to projects page with detail view (implemented with tasks in Commit 4)
    }

    renderProjects() {
        const container = document.getElementById('projects-content');
        const filterBar = document.getElementById('projects-filter-bar');
        if (!container) return;

        let projects = [...this.data.projects];

        if (projects.length === 0) {
            if (filterBar) filterBar.style.display = 'none';
            container.innerHTML = `<div class="empty-state">
                <i class="fas fa-folder-open"></i>
                <p>No projects yet. Create your first project to get started!</p>
            </div>`;
            return;
        }

        if (filterBar) filterBar.style.display = 'flex';

        const statusFilter = document.getElementById('project-status-filter')?.value;
        const searchQuery = document.getElementById('project-search')?.value.toLowerCase();

        if (statusFilter) projects = projects.filter(p => p.status === statusFilter);
        if (searchQuery) projects = projects.filter(p =>
            p.name.toLowerCase().includes(searchQuery) ||
            (p.description || '').toLowerCase().includes(searchQuery) ||
            (p.tags || []).some(t => t.toLowerCase().includes(searchQuery))
        );

        if (projects.length === 0) {
            container.innerHTML = `<div class="empty-state">
                <i class="fas fa-search"></i>
                <p>No projects match your filters.</p>
            </div>`;
            return;
        }

        const statusLabels = { active: 'Active', 'on-hold': 'On Hold', completed: 'Completed', archived: 'Archived' };
        const statusClasses = { active: 'badge-primary', 'on-hold': 'badge-warning', completed: 'badge-success', archived: 'badge-muted' };

        container.innerHTML = projects.map(p => {
            const taskCount = this.data.tasks.filter(t => t.projectId === p.id).length;
            const doneTasks = this.data.tasks.filter(t => t.projectId === p.id && t.status === 'done').length;
            const priorityDots = Array.from({ length: 5 }, (_, i) =>
                `<span class="priority-dot ${i < p.priority ? 'filled' : ''}"></span>`
            ).join('');

            return `<div class="project-card" data-id="${this.escapeHtml(p.id)}" style="border-left-color:${this.escapeHtml(p.color || '#0d9488')}">
                <div class="project-card-header">
                    <span class="project-card-name">${this.escapeHtml(p.name)}</span>
                    <div class="project-card-actions">
                        <button class="btn-icon btn-ghost project-edit-btn" data-id="${this.escapeHtml(p.id)}" aria-label="Edit project">
                            <i class="fas fa-pen"></i>
                        </button>
                        <button class="btn-icon btn-ghost project-delete-btn" data-id="${this.escapeHtml(p.id)}" aria-label="Delete project">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
                ${p.description ? `<p class="project-card-desc">${this.escapeHtml(p.description)}</p>` : ''}
                <div class="project-card-meta">
                    <span class="badge ${statusClasses[p.status] || 'badge-muted'}">${statusLabels[p.status] || p.status}</span>
                    <span class="priority-dots">${priorityDots}</span>
                    ${taskCount ? `<span class="tag"><i class="fas fa-tasks"></i> ${doneTasks}/${taskCount}</span>` : ''}
                    ${(p.tags || []).map(t => `<span class="tag">${this.escapeHtml(t)}</span>`).join('')}
                </div>
            </div>`;
        }).join('');
    }

    // ========================================
    // Tasks
    // ========================================
    setupTasks() {
        const saveBtn = document.getElementById('save-task-btn');
        if (saveBtn) saveBtn.addEventListener('click', () => this.saveTask());

        // Show/hide blocker note
        const statusSelect = document.getElementById('task-status');
        if (statusSelect) statusSelect.addEventListener('change', () => {
            const group = document.getElementById('task-blocker-group');
            if (group) group.style.display = statusSelect.value === 'blocked' ? 'block' : 'none';
        });

        // Project detail event delegation
        document.getElementById('project-detail-body')?.addEventListener('click', (e) => {
            const editBtn = e.target.closest('.task-edit-btn');
            const deleteBtn = e.target.closest('.task-delete-btn');
            const addTaskBtn = e.target.closest('#project-detail-add-task');

            if (deleteBtn) {
                const id = deleteBtn.dataset.id;
                this.deleteTask(id);
            } else if (editBtn) {
                const id = editBtn.dataset.id;
                this.closeModal('project-detail-modal');
                this.editTask(id);
            } else if (addTaskBtn) {
                this.closeModal('project-detail-modal');
                this.openTaskModal(null, addTaskBtn.dataset.projectId);
            }
        });
    }

    openTaskModal(task = null, projectId = null) {
        const title = document.getElementById('task-modal-title');
        const idField = document.getElementById('task-id');
        const nameField = document.getElementById('task-name');
        const descField = document.getElementById('task-description');
        const projectField = document.getElementById('task-project');
        const statusField = document.getElementById('task-status');
        const blockerField = document.getElementById('task-blocker');
        const blockerGroup = document.getElementById('task-blocker-group');
        const priorityField = document.getElementById('task-priority');
        const dueDateField = document.getElementById('task-due-date');
        const tagsField = document.getElementById('task-tags');

        // Populate project dropdown
        projectField.innerHTML = '<option value="">Select a project...</option>' +
            this.data.projects.map(p =>
                `<option value="${this.escapeHtml(p.id)}">${this.escapeHtml(p.name)}</option>`
            ).join('');

        if (task) {
            title.textContent = 'Edit Task';
            idField.value = task.id;
            nameField.value = task.name || '';
            descField.value = task.description || '';
            projectField.value = task.projectId || '';
            statusField.value = task.status || 'backlog';
            blockerField.value = task.blockerNote || '';
            blockerGroup.style.display = task.status === 'blocked' ? 'block' : 'none';
            priorityField.value = task.priority || '3';
            dueDateField.value = task.dueDate || '';
            tagsField.value = (task.tags || []).join(', ');
        } else {
            title.textContent = 'New Task';
            idField.value = '';
            nameField.value = '';
            descField.value = '';
            projectField.value = projectId || '';
            statusField.value = 'backlog';
            blockerField.value = '';
            blockerGroup.style.display = 'none';
            priorityField.value = '3';
            dueDateField.value = '';
            tagsField.value = '';
        }

        this.openModal('task-modal');
    }

    saveTask() {
        const id = document.getElementById('task-id').value;
        const name = document.getElementById('task-name').value.trim();
        const description = document.getElementById('task-description').value.trim();
        const projectId = document.getElementById('task-project').value;
        const status = document.getElementById('task-status').value;
        const blockerNote = document.getElementById('task-blocker').value.trim();
        const priority = parseInt(document.getElementById('task-priority').value) || 3;
        const dueDate = document.getElementById('task-due-date').value;
        const tagsRaw = document.getElementById('task-tags').value;

        if (!name) {
            this.showToast('Task name is required', 'error');
            return;
        }
        if (!projectId) {
            this.showToast('Please select a project', 'error');
            return;
        }
        if (name.length > 200) {
            this.showToast('Task name must be 200 characters or less', 'error');
            return;
        }

        const tags = tagsRaw.split(',').map(t => t.trim()).filter(Boolean);
        const now = new Date().toISOString();

        if (id) {
            const idx = this.data.tasks.findIndex(t => t.id === id);
            if (idx !== -1) {
                const old = this.data.tasks[idx];
                const completedAt = status === 'done' && old.status !== 'done' ? now :
                    (status !== 'done' ? null : old.completedAt);
                this.data.tasks[idx] = {
                    ...old, name, description, projectId, status, blockerNote,
                    priority, dueDate, tags, completedAt, updatedAt: now
                };
                this.showToast('Task updated', 'success');
            }
        } else {
            const maxSort = this.data.tasks
                .filter(t => t.status === status)
                .reduce((max, t) => Math.max(max, t.sortOrder || 0), 0);
            this.data.tasks.push({
                id: this.generateId(),
                name, description, projectId, status, blockerNote,
                priority, dueDate, tags,
                completedAt: status === 'done' ? now : null,
                createdAt: now, updatedAt: now,
                sortOrder: maxSort + 1
            });
            this.showToast('Task created', 'success');
        }

        this.saveData();
        this.closeModal('task-modal');
        this.renderPage(this.currentPage);
    }

    editTask(id) {
        const task = this.data.tasks.find(t => t.id === id);
        if (task) this.openTaskModal(task);
    }

    deleteTask(id) {
        const task = this.data.tasks.find(t => t.id === id);
        if (!task) return;
        this.confirmAction(`Delete task "${task.name}"?`, () => {
            this.data.tasks = this.data.tasks.filter(t => t.id !== id);
            this.saveData();
            this.renderPage(this.currentPage);
            this.showToast('Task deleted', 'success');
        });
    }

    moveTaskStatus(taskId, newStatus) {
        const task = this.data.tasks.find(t => t.id === taskId);
        if (!task) return;
        const wasDone = task.status === 'done';
        const now = new Date().toISOString();
        task.status = newStatus;
        task.completedAt = newStatus === 'done' ? now : (newStatus !== 'done' ? null : task.completedAt);
        task.updatedAt = now;
        if (newStatus === 'done' && !wasDone) {
            this.updateStreak();
            const earlyBonus = task.dueDate && task.completedAt && task.completedAt.slice(0, 10) <= task.dueDate ? 5 : 0;
            this.addKarma(3 + earlyBonus);
        }
        this.saveData();
    }

    viewProjectDetail(id) {
        const project = this.data.projects.find(p => p.id === id);
        if (!project) return;

        const title = document.getElementById('project-detail-title');
        const body = document.getElementById('project-detail-body');
        if (title) title.textContent = project.name;

        const tasks = this.data.tasks.filter(t => t.projectId === id);
        const statusLabels = { backlog: 'Backlog', 'this-week': 'This Week', 'in-progress': 'In Progress', blocked: 'Blocked', done: 'Done' };

        let html = `<p style="color:var(--text-secondary);margin-bottom:16px;">${this.escapeHtml(project.description || 'No description')}</p>`;
        html += `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
            <h4 style="font-weight:700;">Tasks (${tasks.length})</h4>
            <button class="btn btn-primary btn-sm" id="project-detail-add-task" data-project-id="${this.escapeHtml(id)}">
                <i class="fas fa-plus"></i> Add Task
            </button>
        </div>`;

        if (tasks.length === 0) {
            html += '<p style="color:var(--text-muted);text-align:center;padding:20px;">No tasks yet.</p>';
        } else {
            html += '<div class="task-list">';
            tasks.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0)).forEach(t => {
                const urgency = this.getDueUrgency(t.dueDate);
                const dueLabel = t.dueDate ? this.formatDateShort(t.dueDate) : '';
                html += `<div class="task-list-item">
                    <span class="status-dot ${t.status}"></span>
                    <div class="task-list-info">
                        <div class="task-list-name">${this.escapeHtml(t.name)}</div>
                        <div class="task-list-meta">
                            <span class="badge badge-muted">${statusLabels[t.status] || t.status}</span>
                            ${dueLabel ? `<span class="task-due-date ${urgency}">${dueLabel}</span>` : ''}
                            ${t.blockerNote ? `<span style="color:var(--danger);"><i class="fas fa-exclamation-triangle"></i> ${this.escapeHtml(t.blockerNote)}</span>` : ''}
                        </div>
                    </div>
                    <button class="btn-icon btn-ghost task-edit-btn" data-id="${this.escapeHtml(t.id)}" aria-label="Edit task">
                        <i class="fas fa-pen"></i>
                    </button>
                    <button class="btn-icon btn-ghost task-delete-btn" data-id="${this.escapeHtml(t.id)}" aria-label="Delete task">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>`;
            });
            html += '</div>';
        }

        if (body) body.innerHTML = html;
        this.openModal('project-detail-modal');
    }

    // ========================================
    // Kanban
    // ========================================
    setupKanban() {
        const addBtn = document.getElementById('add-task-kanban-btn');
        if (addBtn) addBtn.addEventListener('click', () => this.openTaskModal());

        const filter = document.getElementById('kanban-project-filter');
        if (filter) filter.addEventListener('change', () => this.renderKanban());
    }

    renderKanban() {
        const container = document.getElementById('kanban-content');
        const filter = document.getElementById('kanban-project-filter');
        if (!container) return;

        // Populate project filter
        if (filter) {
            const val = filter.value;
            filter.innerHTML = '<option value="">All Projects</option>' +
                this.data.projects.map(p =>
                    `<option value="${this.escapeHtml(p.id)}">${this.escapeHtml(p.name)}</option>`
                ).join('');
            filter.value = val;
        }

        let tasks = [...this.data.tasks];
        const projectFilter = filter?.value;
        if (projectFilter) tasks = tasks.filter(t => t.projectId === projectFilter);

        const statuses = [
            { key: 'backlog', label: 'Backlog' },
            { key: 'this-week', label: 'This Week' },
            { key: 'in-progress', label: 'In Progress' },
            { key: 'blocked', label: 'Blocked' },
            { key: 'done', label: 'Done' }
        ];

        const isTouchDevice = 'ontouchstart' in window;

        container.innerHTML = statuses.map(s => {
            const colTasks = tasks.filter(t => t.status === s.key)
                .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));

            return `<div class="kanban-column" data-status="${s.key}">
                <div class="kanban-column-header">
                    <span>${s.label}</span>
                    <span class="count">${colTasks.length}</span>
                </div>
                <div class="kanban-column-body" data-status="${s.key}">
                    ${colTasks.map(t => {
                        const project = this.getProject(t.projectId);
                        const urgency = this.getDueUrgency(t.dueDate);
                        return `<div class="kanban-card" draggable="true" data-task-id="${this.escapeHtml(t.id)}"
                            style="border-left-color:${this.escapeHtml(project?.color || '#0d9488')}">
                            <div class="kanban-card-title">${this.escapeHtml(t.name)}</div>
                            <div class="kanban-card-meta">
                                ${project ? `<span class="kanban-card-project">${this.escapeHtml(project.name)}</span>` : ''}
                                ${t.dueDate ? `<span class="task-due-date ${urgency}">${this.formatDateShort(t.dueDate)}</span>` : ''}
                                ${t.priority >= 4 ? '<span class="badge badge-warning"><i class="fas fa-arrow-up"></i></span>' : ''}
                                ${t.blockerNote ? '<span class="badge badge-danger"><i class="fas fa-ban"></i></span>' : ''}
                            </div>
                            ${isTouchDevice ? `<select class="form-select kanban-mobile-move" data-task-id="${this.escapeHtml(t.id)}" style="margin-top:8px;font-size:0.75rem;padding:4px 8px;">
                                ${statuses.map(st => `<option value="${st.key}" ${st.key === t.status ? 'selected' : ''}>${st.label}</option>`).join('')}
                            </select>` : ''}
                        </div>`;
                    }).join('') || '<p style="text-align:center;color:var(--text-muted);font-size:0.8125rem;padding:12px;">No tasks</p>'}
                </div>
            </div>`;
        }).join('');

        this.setupKanbanDragDrop();
        this.setupKanbanCardClicks();
    }

    setupKanbanDragDrop() {
        const cards = document.querySelectorAll('.kanban-card');
        const columns = document.querySelectorAll('.kanban-column-body');

        cards.forEach(card => {
            card.addEventListener('dragstart', (e) => {
                card.classList.add('dragging');
                e.dataTransfer.setData('text/plain', card.dataset.taskId);
                e.dataTransfer.effectAllowed = 'move';
            });
            card.addEventListener('dragend', () => {
                card.classList.remove('dragging');
                columns.forEach(col => col.classList.remove('drag-over'));
            });
        });

        columns.forEach(col => {
            col.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                col.classList.add('drag-over');
            });
            col.addEventListener('dragleave', (e) => {
                if (!col.contains(e.relatedTarget)) {
                    col.classList.remove('drag-over');
                }
            });
            col.addEventListener('drop', (e) => {
                e.preventDefault();
                col.classList.remove('drag-over');
                const taskId = e.dataTransfer.getData('text/plain');
                const newStatus = col.dataset.status;
                if (taskId && newStatus) {
                    this.handleKanbanDrop(taskId, newStatus, e, col);
                }
            });
        });
    }

    handleKanbanDrop(taskId, newStatus, event, column) {
        const task = this.data.tasks.find(t => t.id === taskId);
        if (!task) return;

        this.moveTaskStatus(taskId, newStatus);

        // Calculate sort order based on drop position
        const cards = [...column.querySelectorAll('.kanban-card:not(.dragging)')];
        const colTasks = this.data.tasks
            .filter(t => t.status === newStatus && t.id !== taskId)
            .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));

        let newOrder;
        if (colTasks.length === 0) {
            newOrder = 1;
        } else {
            const afterCard = cards.find(c => {
                const rect = c.getBoundingClientRect();
                return event.clientY < rect.top + rect.height / 2;
            });
            if (!afterCard) {
                newOrder = (colTasks[colTasks.length - 1].sortOrder || 0) + 1;
            } else {
                const afterTask = colTasks.find(t => t.id === afterCard.dataset.taskId);
                const afterIdx = colTasks.indexOf(afterTask);
                if (afterIdx === 0) {
                    newOrder = (colTasks[0].sortOrder || 0) - 1;
                } else {
                    const before = colTasks[afterIdx - 1];
                    newOrder = ((before.sortOrder || 0) + (afterTask.sortOrder || 0)) / 2;
                }
            }
        }

        task.sortOrder = newOrder;
        this.saveData();
        this.renderKanban();
    }

    setupKanbanCardClicks() {
        // Click to edit
        document.querySelectorAll('.kanban-card').forEach(card => {
            card.addEventListener('click', (e) => {
                if (e.target.closest('select')) return;
                const taskId = card.dataset.taskId;
                this.editTask(taskId);
            });
        });

        // Mobile move dropdown
        document.querySelectorAll('.kanban-mobile-move').forEach(select => {
            select.addEventListener('change', (e) => {
                e.stopPropagation();
                const taskId = select.dataset.taskId;
                const newStatus = select.value;
                this.moveTaskStatus(taskId, newStatus);
                this.saveData();
                this.renderKanban();
            });
        });
    }

    // ========================================
    // Activities
    // ========================================
    setupActivities() {
        this.activityPage = 1;
        this.activitiesPerPage = 20;

        const addBtn = document.getElementById('add-activity-btn');
        if (addBtn) addBtn.addEventListener('click', () => this.openActivityModal());

        const saveBtn = document.getElementById('save-activity-btn');
        if (saveBtn) saveBtn.addEventListener('click', () => this.saveActivity());

        // Quick add
        const quickSubmit = document.getElementById('quick-activity-submit');
        if (quickSubmit) quickSubmit.addEventListener('click', () => this.quickAddActivity());
        const quickInput = document.getElementById('quick-activity-input');
        if (quickInput) {
            quickInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') this.quickAddActivity();
            });
            quickInput.addEventListener('input', () => {
                const detected = this.detectCategory(quickInput.value);
                const category = document.getElementById('quick-activity-category');
                if (detected && category && category.value === 'other') {
                    category.value = detected;
                }
            });
        }

        // Filters
        ['activity-project-filter', 'activity-category-filter', 'activity-date-from', 'activity-date-to'].forEach(id => {
            document.getElementById(id)?.addEventListener('change', () => { this.activityPage = 1; this.renderActivities(); });
        });
        document.getElementById('activity-search')?.addEventListener('input', () => { this.activityPage = 1; this.renderActivities(); });

        // Task select follows project select in modal
        document.getElementById('activity-project-select')?.addEventListener('change', () => {
            const projectId = document.getElementById('activity-project-select').value;
            const taskSelect = document.getElementById('activity-task-select');
            if (taskSelect) {
                const tasks = projectId ? this.data.tasks.filter(t => t.projectId === projectId) : [];
                taskSelect.innerHTML = '<option value="">No task</option>' +
                    tasks.map(t => `<option value="${this.escapeHtml(t.id)}">${this.escapeHtml(t.name)}</option>`).join('');
            }
        });

        // Event delegation for activity items
        document.getElementById('activity-content')?.addEventListener('click', (e) => {
            const editBtn = e.target.closest('.activity-edit-btn');
            const deleteBtn = e.target.closest('.activity-delete-btn');
            if (deleteBtn) {
                this.deleteActivity(deleteBtn.dataset.id);
            } else if (editBtn) {
                this.editActivity(editBtn.dataset.id);
            }
        });
    }

    openActivityModal(activity = null) {
        const title = document.getElementById('activity-modal-title');
        const idField = document.getElementById('activity-id');
        const entryField = document.getElementById('activity-entry');
        const projectField = document.getElementById('activity-project-select');
        const taskField = document.getElementById('activity-task-select');
        const categoryField = document.getElementById('activity-category-select');
        const dateField = document.getElementById('activity-date-input');
        const tagsField = document.getElementById('activity-tags-input');

        projectField.innerHTML = '<option value="">No project</option>' +
            this.data.projects.map(p => `<option value="${this.escapeHtml(p.id)}">${this.escapeHtml(p.name)}</option>`).join('');

        if (activity) {
            title.textContent = 'Edit Activity';
            idField.value = activity.id;
            entryField.value = activity.entry || '';
            projectField.value = activity.projectId || '';
            categoryField.value = activity.category || 'other';
            dateField.value = activity.date || '';
            tagsField.value = (activity.tags || []).join(', ');
            // Update task dropdown
            const tasks = activity.projectId ? this.data.tasks.filter(t => t.projectId === activity.projectId) : [];
            taskField.innerHTML = '<option value="">No task</option>' +
                tasks.map(t => `<option value="${this.escapeHtml(t.id)}">${this.escapeHtml(t.name)}</option>`).join('');
            taskField.value = activity.taskId || '';
        } else {
            title.textContent = 'Log Activity';
            idField.value = '';
            entryField.value = '';
            const lastProject = this.getLastUsedProject();
            projectField.value = lastProject || '';
            if (lastProject) {
                const tasks = this.data.tasks.filter(t => t.projectId === lastProject);
                taskField.innerHTML = '<option value="">No task</option>' +
                    tasks.map(t => `<option value="${this.escapeHtml(t.id)}">${this.escapeHtml(t.name)}</option>`).join('');
            } else {
                taskField.innerHTML = '<option value="">No task</option>';
            }
            categoryField.value = 'other';
            dateField.value = this.toLocalDateString();
            tagsField.value = '';
        }

        this.openModal('activity-modal');
    }

    saveActivity() {
        const id = document.getElementById('activity-id').value;
        const entry = document.getElementById('activity-entry').value.trim();
        const projectId = document.getElementById('activity-project-select').value || null;
        const taskId = document.getElementById('activity-task-select').value || null;
        const category = document.getElementById('activity-category-select').value;
        const date = document.getElementById('activity-date-input').value || this.toLocalDateString();
        const tagsRaw = document.getElementById('activity-tags-input').value;

        if (!entry) {
            this.showToast('Activity description is required', 'error');
            return;
        }
        if (entry.length > 1000) {
            this.showToast('Description must be 1000 characters or less', 'error');
            return;
        }

        const tags = tagsRaw.split(',').map(t => t.trim()).filter(Boolean);
        const now = new Date().toISOString();

        if (id) {
            const idx = this.data.activities.findIndex(a => a.id === id);
            if (idx !== -1) {
                this.data.activities[idx] = {
                    ...this.data.activities[idx], entry, projectId, taskId, category, date, tags, updatedAt: now
                };
                this.showToast('Activity updated', 'success');
            }
        } else {
            this.data.activities.push({
                id: this.generateId(), entry, projectId, taskId, category, date, tags,
                timestamp: now, createdAt: now
            });
            this.showToast('Activity logged', 'success');
        }

        this.updateStreak();
        this.addKarma(1);
        this.saveData();
        this.closeModal('activity-modal');
        this.renderActivities();
    }

    quickAddActivity() {
        const input = document.getElementById('quick-activity-input');
        const category = document.getElementById('quick-activity-category');
        const entry = input?.value.trim();
        if (!entry) return;

        const detected = this.detectCategory(entry);
        const finalCategory = category?.value !== 'other' ? category?.value : detected;
        const lastProject = this.getLastUsedProject();

        const now = new Date().toISOString();
        this.data.activities.push({
            id: this.generateId(),
            entry,
            projectId: lastProject,
            taskId: null,
            category: finalCategory || 'other',
            date: this.toLocalDateString(),
            tags: [],
            timestamp: now,
            createdAt: now
        });

        this.updateStreak();
        this.addKarma(1);
        this.saveData();
        if (input) input.value = '';
        this.showToast('Activity logged', 'success');
        this.renderActivities();
    }

    editActivity(id) {
        const activity = this.data.activities.find(a => a.id === id);
        if (activity) this.openActivityModal(activity);
    }

    deleteActivity(id) {
        const activity = this.data.activities.find(a => a.id === id);
        if (!activity) return;
        this.confirmAction('Delete this activity?', () => {
            this.data.activities = this.data.activities.filter(a => a.id !== id);
            this.saveData();
            this.renderActivities();
            this.showToast('Activity deleted', 'success');
        });
    }

    filterActivities() {
        let activities = [...this.data.activities];
        const projectFilter = document.getElementById('activity-project-filter')?.value;
        const categoryFilter = document.getElementById('activity-category-filter')?.value;
        const dateFrom = document.getElementById('activity-date-from')?.value;
        const dateTo = document.getElementById('activity-date-to')?.value;
        const search = document.getElementById('activity-search')?.value.toLowerCase();

        if (projectFilter) activities = activities.filter(a => a.projectId === projectFilter);
        if (categoryFilter) activities = activities.filter(a => a.category === categoryFilter);
        if (dateFrom) activities = activities.filter(a => a.date >= dateFrom);
        if (dateTo) activities = activities.filter(a => a.date <= dateTo);
        if (search) activities = activities.filter(a =>
            a.entry.toLowerCase().includes(search) ||
            (a.tags || []).some(t => t.toLowerCase().includes(search))
        );

        return activities.sort((a, b) => (b.timestamp || b.createdAt || '').localeCompare(a.timestamp || a.createdAt || ''));
    }

    renderActivities() {
        const container = document.getElementById('activity-content');
        const quickAdd = document.getElementById('activity-quick-add');
        const filterBar = document.getElementById('activity-filter-bar');
        const paginationEl = document.getElementById('activity-pagination');
        const projectFilter = document.getElementById('activity-project-filter');
        if (!container) return;

        // Show quick add and filter bar
        if (quickAdd) quickAdd.style.display = 'flex';

        // Populate project filter
        if (projectFilter) {
            const val = projectFilter.value;
            projectFilter.innerHTML = '<option value="">All Projects</option>' +
                this.data.projects.map(p =>
                    `<option value="${this.escapeHtml(p.id)}">${this.escapeHtml(p.name)}</option>`
                ).join('');
            projectFilter.value = val;
        }

        if (this.data.activities.length === 0) {
            if (filterBar) filterBar.style.display = 'none';
            if (paginationEl) paginationEl.style.display = 'none';
            container.innerHTML = `<div class="empty-state">
                <i class="fas fa-clock"></i>
                <p>No activities logged yet. Start tracking your daily work!</p>
            </div>`;
            return;
        }

        if (filterBar) filterBar.style.display = 'flex';

        const filtered = this.filterActivities();
        const totalPages = Math.ceil(filtered.length / this.activitiesPerPage);
        if (this.activityPage > totalPages) this.activityPage = Math.max(1, totalPages);
        const start = (this.activityPage - 1) * this.activitiesPerPage;
        const pageItems = filtered.slice(start, start + this.activitiesPerPage);

        if (pageItems.length === 0) {
            container.innerHTML = `<div class="empty-state">
                <i class="fas fa-search"></i>
                <p>No activities match your filters.</p>
            </div>`;
            if (paginationEl) paginationEl.style.display = 'none';
            return;
        }

        // Group by date
        const groups = {};
        pageItems.forEach(a => {
            const group = this.getDateGroup(a.date);
            if (!groups[group]) groups[group] = [];
            groups[group].push(a);
        });

        const categoryIcons = {
            build: 'fa-hammer', deploy: 'fa-rocket', meeting: 'fa-users',
            research: 'fa-microscope', support: 'fa-headset', other: 'fa-circle'
        };

        let html = '';
        for (const [groupName, items] of Object.entries(groups)) {
            html += `<div class="activity-date-group">
                <div class="activity-date-header">${this.escapeHtml(groupName)}</div>`;
            items.forEach(a => {
                const project = a.projectId ? this.getProject(a.projectId) : null;
                const icon = categoryIcons[a.category] || 'fa-circle';
                html += `<div class="activity-item" style="border-left-color:${this.escapeHtml(project?.color || 'var(--primary)')}">
                    <div class="activity-item-content">
                        <div class="activity-item-entry">${this.escapeHtml(a.entry)}</div>
                        <div class="activity-item-meta">
                            <span class="category-badge ${a.category}"><i class="fas ${icon}"></i> ${this.escapeHtml(a.category)}</span>
                            ${project ? `<span class="tag">${this.escapeHtml(project.name)}</span>` : ''}
                            ${a.timestamp ? `<span>${this.formatTimestamp(a.timestamp)}</span>` : ''}
                            ${(a.tags || []).map(t => `<span class="tag">${this.escapeHtml(t)}</span>`).join('')}
                        </div>
                    </div>
                    <div class="activity-item-actions">
                        <button class="btn-icon btn-ghost activity-edit-btn" data-id="${this.escapeHtml(a.id)}" aria-label="Edit activity">
                            <i class="fas fa-pen"></i>
                        </button>
                        <button class="btn-icon btn-ghost activity-delete-btn" data-id="${this.escapeHtml(a.id)}" aria-label="Delete activity">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>`;
            });
            html += '</div>';
        }

        container.innerHTML = html;

        // Pagination
        if (paginationEl) {
            if (totalPages <= 1) {
                paginationEl.style.display = 'none';
            } else {
                paginationEl.style.display = 'flex';
                paginationEl.innerHTML = `
                    <button class="btn btn-outline btn-sm" ${this.activityPage <= 1 ? 'disabled' : ''} onclick="app.activityPage--; app.renderActivities();">
                        <i class="fas fa-chevron-left"></i> Prev
                    </button>
                    <span class="pagination-info">Page ${this.activityPage} of ${totalPages}</span>
                    <button class="btn btn-outline btn-sm" ${this.activityPage >= totalPages ? 'disabled' : ''} onclick="app.activityPage++; app.renderActivities();">
                        Next <i class="fas fa-chevron-right"></i>
                    </button>`;
            }
        }
    }

    // ========================================
    // Metrics
    // ========================================
    setupMetrics() {
        const saveBtn = document.getElementById('save-metrics-btn');
        if (saveBtn) saveBtn.addEventListener('click', () => this.saveMetrics());

        // Live preview updates
        ['metrics-hours-to-run', 'metrics-runs-per-week', 'metrics-run-duration', 'metrics-hours-to-build', 'metrics-people-impacted'].forEach(id => {
            document.getElementById(id)?.addEventListener('input', () => this.updateMetricsPreview());
        });

        // Event delegation for metrics cards
        document.getElementById('metrics-content')?.addEventListener('click', (e) => {
            const editBtn = e.target.closest('.metrics-edit-btn');
            if (editBtn) this.openMetricsModal(editBtn.dataset.projectId);
        });
    }

    openMetricsModal(projectId) {
        const project = this.getProject(projectId);
        if (!project) return;

        const title = document.getElementById('metrics-modal-title');
        title.textContent = `Metrics: ${project.name}`;

        const existing = this.data.metrics.find(m => m.projectId === projectId);
        document.getElementById('metrics-id').value = existing?.id || '';
        document.getElementById('metrics-project-id').value = projectId;
        document.getElementById('metrics-hours-to-run').value = existing?.hoursToRun || '';
        document.getElementById('metrics-runs-per-week').value = existing?.runsPerWeek || '';
        document.getElementById('metrics-run-duration').value = existing?.runDurationMinutes || '';
        document.getElementById('metrics-hours-to-build').value = existing?.hoursToBuild || '';
        document.getElementById('metrics-people-impacted').value = existing?.peopleImpacted || '';

        this.updateMetricsPreview();
        this.openModal('metrics-modal');
    }

    saveMetrics() {
        const id = document.getElementById('metrics-id').value;
        const projectId = document.getElementById('metrics-project-id').value;
        const hoursToRun = parseFloat(document.getElementById('metrics-hours-to-run').value) || 0;
        const runsPerWeek = parseInt(document.getElementById('metrics-runs-per-week').value) || 0;
        const runDurationMinutes = parseInt(document.getElementById('metrics-run-duration').value) || 0;
        const hoursToBuild = parseFloat(document.getElementById('metrics-hours-to-build').value) || 0;
        const peopleImpacted = parseInt(document.getElementById('metrics-people-impacted').value) || 0;

        if (!projectId) {
            this.showToast('No project selected', 'error');
            return;
        }

        const now = new Date().toISOString();

        if (id) {
            const idx = this.data.metrics.findIndex(m => m.id === id);
            if (idx !== -1) {
                this.data.metrics[idx] = {
                    ...this.data.metrics[idx],
                    hoursToRun, runsPerWeek, runDurationMinutes, hoursToBuild, peopleImpacted,
                    updatedAt: now
                };
            }
        } else {
            // Remove existing if any
            this.data.metrics = this.data.metrics.filter(m => m.projectId !== projectId);
            this.data.metrics.push({
                id: this.generateId(), projectId,
                hoursToRun, runsPerWeek, runDurationMinutes, hoursToBuild, peopleImpacted,
                createdAt: now, updatedAt: now
            });
        }

        this.saveData();
        this.closeModal('metrics-modal');
        this.renderMetrics();
        this.showToast('Metrics saved', 'success');
    }

    calculateHoursSavedPerWeek(metric) {
        const manualHours = metric.hoursToRun * metric.runsPerWeek;
        const autoHours = (metric.runDurationMinutes / 60) * metric.runsPerWeek;
        return Math.max(0, manualHours - autoHours);
    }

    calculateHoursSavedPerMonth(metric) {
        return this.calculateHoursSavedPerWeek(metric) * 4.33;
    }

    calculateHoursSavedPerYear(metric) {
        return this.calculateHoursSavedPerWeek(metric) * 52;
    }

    calculateROI(metric) {
        if (!metric.hoursToBuild || metric.hoursToBuild === 0) return 0;
        const yearSaved = this.calculateHoursSavedPerYear(metric);
        return yearSaved / metric.hoursToBuild;
    }

    calculateBreakevenWeeks(metric) {
        const weekSaved = this.calculateHoursSavedPerWeek(metric);
        if (weekSaved <= 0) return Infinity;
        return metric.hoursToBuild / weekSaved;
    }

    getCumulativeMetrics() {
        let totalSavedWeek = 0, totalSavedYear = 0, totalBuildHours = 0, totalPeople = 0;
        this.data.metrics.forEach(m => {
            totalSavedWeek += this.calculateHoursSavedPerWeek(m);
            totalSavedYear += this.calculateHoursSavedPerYear(m);
            totalBuildHours += m.hoursToBuild || 0;
            totalPeople += m.peopleImpacted || 0;
        });
        const avgROI = totalBuildHours > 0 ? totalSavedYear / totalBuildHours : 0;
        return { totalSavedWeek, totalSavedYear, totalBuildHours, totalPeople, avgROI };
    }

    updateMetricsPreview() {
        const preview = document.getElementById('metrics-live-preview');
        if (!preview) return;

        const metric = {
            hoursToRun: parseFloat(document.getElementById('metrics-hours-to-run').value) || 0,
            runsPerWeek: parseInt(document.getElementById('metrics-runs-per-week').value) || 0,
            runDurationMinutes: parseInt(document.getElementById('metrics-run-duration').value) || 0,
            hoursToBuild: parseFloat(document.getElementById('metrics-hours-to-build').value) || 0,
            peopleImpacted: parseInt(document.getElementById('metrics-people-impacted').value) || 0
        };

        const weekSaved = this.calculateHoursSavedPerWeek(metric);
        const yearSaved = this.calculateHoursSavedPerYear(metric);
        const roi = this.calculateROI(metric);
        const breakeven = this.calculateBreakevenWeeks(metric);

        preview.innerHTML = `
            <h4 style="font-weight:700;margin-bottom:8px;font-size:0.875rem;"><i class="fas fa-calculator" style="color:var(--primary);"></i> Live Preview</h4>
            <div class="metric-row"><span class="metric-row-label">Hours saved/week</span><span class="metric-row-value">${weekSaved.toFixed(1)}h</span></div>
            <div class="metric-row"><span class="metric-row-label">Hours saved/year</span><span class="metric-row-value">${yearSaved.toFixed(0)}h</span></div>
            <div class="metric-row"><span class="metric-row-label">ROI</span><span class="metric-row-value">${(roi * 100).toFixed(0)}%</span></div>
            <div class="metric-row"><span class="metric-row-label">Breakeven</span><span class="metric-row-value">${breakeven === Infinity ? 'N/A' : breakeven.toFixed(1) + ' weeks'}</span></div>
        `;
    }

    renderMetrics() {
        const container = document.getElementById('metrics-content');
        const summaryEl = document.getElementById('metrics-summary');
        if (!container) return;

        const projects = this.data.projects.filter(p => p.status !== 'archived');

        if (projects.length === 0) {
            if (summaryEl) summaryEl.style.display = 'none';
            container.innerHTML = `<div class="empty-state">
                <i class="fas fa-chart-line"></i>
                <p>No projects yet. Create projects first to track metrics!</p>
            </div>`;
            return;
        }

        // Summary cards
        if (this.data.metrics.length > 0 && summaryEl) {
            const cum = this.getCumulativeMetrics();
            summaryEl.style.display = 'grid';
            summaryEl.innerHTML = `
                <div class="stat-card">
                    <div class="stat-icon primary"><i class="fas fa-clock"></i></div>
                    <div><div class="stat-value">${cum.totalSavedWeek.toFixed(1)}h</div><div class="stat-label">Saved/Week</div></div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon success"><i class="fas fa-calendar-check"></i></div>
                    <div><div class="stat-value">${cum.totalSavedYear.toFixed(0)}h</div><div class="stat-label">Saved/Year</div></div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon accent"><i class="fas fa-chart-line"></i></div>
                    <div><div class="stat-value">${(cum.avgROI * 100).toFixed(0)}%</div><div class="stat-label">Avg ROI</div></div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon info"><i class="fas fa-users"></i></div>
                    <div><div class="stat-value">${cum.totalPeople}</div><div class="stat-label">People Impacted</div></div>
                </div>
            `;
        } else if (summaryEl) {
            summaryEl.style.display = 'none';
        }

        // Per-project cards
        container.innerHTML = projects.map(p => {
            const metric = this.data.metrics.find(m => m.projectId === p.id);
            if (!metric) {
                return `<div class="metric-card">
                    <div class="metric-card-header">
                        <span class="metric-card-project">${this.escapeHtml(p.name)}</span>
                    </div>
                    <p style="color:var(--text-muted);margin-bottom:12px;">No metrics configured</p>
                    <button class="btn btn-primary btn-sm metrics-edit-btn" data-project-id="${this.escapeHtml(p.id)}">
                        <i class="fas fa-plus"></i> Add Metrics
                    </button>
                </div>`;
            }

            const weekSaved = this.calculateHoursSavedPerWeek(metric);
            const yearSaved = this.calculateHoursSavedPerYear(metric);
            const roi = this.calculateROI(metric);
            const breakeven = this.calculateBreakevenWeeks(metric);
            const roiClass = roi >= 1 ? 'positive' : roi > 0 ? 'neutral' : 'negative';
            const manualHours = metric.hoursToRun * metric.runsPerWeek;
            const autoHours = (metric.runDurationMinutes / 60) * metric.runsPerWeek;
            const barPercent = manualHours > 0 ? Math.min(100, (autoHours / manualHours) * 100) : 0;

            return `<div class="metric-card">
                <div class="metric-card-header">
                    <span class="metric-card-project">${this.escapeHtml(p.name)}</span>
                    <span class="roi-badge ${roiClass}">${(roi * 100).toFixed(0)}% ROI</span>
                </div>
                <div class="metric-row"><span class="metric-row-label">Manual time/run</span><span class="metric-row-value">${metric.hoursToRun}h</span></div>
                <div class="metric-row"><span class="metric-row-label">Runs/week</span><span class="metric-row-value">${metric.runsPerWeek}</span></div>
                <div class="metric-row"><span class="metric-row-label">Automated duration/run</span><span class="metric-row-value">${metric.runDurationMinutes}min</span></div>
                <div class="metric-row"><span class="metric-row-label">Hours saved/week</span><span class="metric-row-value" style="color:var(--success);font-weight:700;">${weekSaved.toFixed(1)}h</span></div>
                <div class="metric-row"><span class="metric-row-label">Hours saved/year</span><span class="metric-row-value">${yearSaved.toFixed(0)}h</span></div>
                <div class="metric-row"><span class="metric-row-label">Build investment</span><span class="metric-row-value">${metric.hoursToBuild}h</span></div>
                <div class="metric-row"><span class="metric-row-label">Breakeven</span><span class="metric-row-value">${breakeven === Infinity ? 'N/A' : breakeven.toFixed(1) + ' weeks'}</span></div>
                <div class="metric-row"><span class="metric-row-label">People impacted</span><span class="metric-row-value">${metric.peopleImpacted}</span></div>
                <div style="margin-top:8px;">
                    <div style="display:flex;justify-content:space-between;font-size:0.75rem;color:var(--text-muted);margin-bottom:4px;">
                        <span>Automated: ${autoHours.toFixed(1)}h/wk</span>
                        <span>Manual: ${manualHours.toFixed(1)}h/wk</span>
                    </div>
                    <div class="comparison-bar"><div class="comparison-bar-fill" style="width:${barPercent}%"></div></div>
                </div>
                <button class="btn btn-outline btn-sm metrics-edit-btn" data-project-id="${this.escapeHtml(p.id)}" style="margin-top:12px;">
                    <i class="fas fa-pen"></i> Edit Metrics
                </button>
            </div>`;
        }).join('');
    }

    // ========================================
    // Reports
    // ========================================
    setupReports() {
        const genBtn = document.getElementById('generate-report-btn');
        if (genBtn) genBtn.addEventListener('click', () => this.generateReport());

        const printBtn = document.getElementById('print-report-btn');
        if (printBtn) printBtn.addEventListener('click', () => this.printReport());

        const mdBtn = document.getElementById('export-md-btn');
        if (mdBtn) mdBtn.addEventListener('click', () => this.exportReportMarkdown());

        const preset = document.getElementById('report-date-preset');
        if (preset) preset.addEventListener('change', () => this.updateReportDates());

        // Report presets
        document.getElementById('report-presets')?.addEventListener('click', (e) => {
            const btn = e.target.closest('.report-preset-btn');
            if (!btn) return;
            document.querySelectorAll('.report-preset-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            this.applyReportPreset(btn.dataset.preset);
        });
    }

    updateReportDates() {
        const preset = document.getElementById('report-date-preset').value;
        const fromField = document.getElementById('report-date-from');
        const toField = document.getElementById('report-date-to');
        const today = new Date();
        let from, to = today;

        switch (preset) {
            case 'last-week':
                from = new Date(today);
                from.setDate(today.getDate() - 7);
                break;
            case 'last-2-weeks':
                from = new Date(today);
                from.setDate(today.getDate() - 14);
                break;
            case 'last-month':
                from = new Date(today);
                from.setMonth(today.getMonth() - 1);
                break;
            case 'custom':
                return; // Don't auto-set
        }

        if (fromField) fromField.value = this.toLocalDateString(from);
        if (toField) toField.value = this.toLocalDateString(to);
    }

    getCompletedInRange(from, to) {
        return this.data.tasks.filter(t =>
            t.status === 'done' && t.completedAt &&
            t.completedAt >= from && t.completedAt <= to + 'T23:59:59'
        );
    }

    getInProgressItems() {
        return this.data.tasks.filter(t => t.status === 'in-progress' || t.status === 'this-week');
    }

    getUpcomingItems() {
        return this.data.tasks.filter(t =>
            t.status === 'backlog' && t.dueDate
        ).sort((a, b) => a.dueDate.localeCompare(b.dueDate)).slice(0, 10);
    }

    getBlockers() {
        return this.data.tasks.filter(t => t.status === 'blocked');
    }

    getActivitiesInRange(from, to) {
        return this.data.activities.filter(a =>
            a.date >= from && a.date <= to
        ).sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''));
    }

    getMetricsSummary() {
        return this.data.metrics.map(m => {
            const project = this.getProject(m.projectId);
            return {
                ...m,
                projectName: project?.name || 'Unknown',
                weekSaved: this.calculateHoursSavedPerWeek(m),
                yearSaved: this.calculateHoursSavedPerYear(m),
                roi: this.calculateROI(m)
            };
        }).filter(m => m.weekSaved > 0);
    }

    generateReport() {
        const from = document.getElementById('report-date-from').value;
        const to = document.getElementById('report-date-to').value;
        if (!from || !to) {
            this.updateReportDates();
            setTimeout(() => this.generateReport(), 50);
            return;
        }

        const showCompleted = document.getElementById('report-show-completed').checked;
        const showProgress = document.getElementById('report-show-progress').checked;
        const showUpcoming = document.getElementById('report-show-upcoming').checked;
        const showBlockers = document.getElementById('report-show-blockers').checked;
        const showActivities = document.getElementById('report-show-activities').checked;
        const showMetrics = document.getElementById('report-show-metrics').checked;

        const previewArea = document.getElementById('report-preview-area');
        const printBtn = document.getElementById('print-report-btn');
        const mdBtn = document.getElementById('export-md-btn');

        let html = '<div class="report-preview" id="report-preview">';

        // Header
        const userName = this.data.settings.userName || 'Team Member';
        const bossName = this.data.settings.bossName;
        html += `<div style="margin-bottom:24px;">
            <h2 style="font-size:1.5rem;font-weight:700;">Status Update</h2>
            <p style="color:var(--text-secondary);">${this.escapeHtml(userName)}${bossName ? ` &rarr; ${this.escapeHtml(bossName)}` : ''}</p>
            <p style="color:var(--text-muted);font-size:0.8125rem;">${this.formatDate(from)} &ndash; ${this.formatDate(to)}</p>
        </div>`;

        // Completed
        if (showCompleted) {
            const completed = this.getCompletedInRange(from, to);
            html += '<div class="report-section">';
            html += '<div class="report-section-title"><i class="fas fa-check-circle" style="color:var(--success);"></i> Completed</div>';
            if (completed.length === 0) {
                html += '<p style="color:var(--text-muted);font-size:0.875rem;">No tasks completed in this period.</p>';
            } else {
                const byProject = {};
                completed.forEach(t => {
                    const pName = this.getProject(t.projectId)?.name || 'No Project';
                    if (!byProject[pName]) byProject[pName] = [];
                    byProject[pName].push(t);
                });
                for (const [pName, tasks] of Object.entries(byProject)) {
                    html += `<p style="font-weight:600;margin:8px 0 4px;font-size:0.875rem;">${this.escapeHtml(pName)}</p>`;
                    tasks.forEach(t => {
                        html += `<div class="report-item"><i class="fas fa-check" style="color:var(--success);margin-top:2px;"></i> ${this.escapeHtml(t.name)}</div>`;
                    });
                }
            }
            html += '</div>';
        }

        // In Progress
        if (showProgress) {
            const inProgress = this.getInProgressItems();
            html += '<div class="report-section">';
            html += '<div class="report-section-title"><i class="fas fa-spinner" style="color:var(--primary);"></i> In Progress</div>';
            if (inProgress.length === 0) {
                html += '<p style="color:var(--text-muted);font-size:0.875rem;">No tasks currently in progress.</p>';
            } else {
                inProgress.forEach(t => {
                    const project = this.getProject(t.projectId);
                    html += `<div class="report-item"><i class="fas fa-arrow-right" style="color:var(--primary);margin-top:2px;"></i>
                        <span>${this.escapeHtml(t.name)} ${project ? `<span class="tag">${this.escapeHtml(project.name)}</span>` : ''}</span></div>`;
                });
            }
            html += '</div>';
        }

        // Coming Up
        if (showUpcoming) {
            const upcoming = this.getUpcomingItems();
            if (upcoming.length > 0) {
                html += '<div class="report-section">';
                html += '<div class="report-section-title"><i class="fas fa-calendar" style="color:var(--info);"></i> Coming Up</div>';
                upcoming.forEach(t => {
                    html += `<div class="report-item"><i class="fas fa-circle" style="color:var(--info);font-size:0.5rem;margin-top:6px;"></i>
                        <span>${this.escapeHtml(t.name)} <span style="color:var(--text-muted);font-size:0.75rem;">(due ${this.formatDateShort(t.dueDate)})</span></span></div>`;
                });
                html += '</div>';
            }
        }

        // Blockers
        if (showBlockers) {
            const blockers = this.getBlockers();
            if (blockers.length > 0) {
                html += '<div class="report-section">';
                html += '<div class="report-section-title"><i class="fas fa-exclamation-triangle" style="color:var(--danger);"></i> Blockers</div>';
                blockers.forEach(t => {
                    html += `<div class="report-blocker"><strong>${this.escapeHtml(t.name)}</strong>
                        ${t.blockerNote ? `<br><span style="font-size:0.8125rem;">${this.escapeHtml(t.blockerNote)}</span>` : ''}</div>`;
                });
                html += '</div>';
            }
        }

        // Activity Highlights
        if (showActivities) {
            const activities = this.getActivitiesInRange(from, to).slice(0, 15);
            if (activities.length > 0) {
                html += '<div class="report-section">';
                html += '<div class="report-section-title"><i class="fas fa-clock" style="color:var(--accent);"></i> Activity Highlights</div>';
                activities.forEach(a => {
                    const project = a.projectId ? this.getProject(a.projectId) : null;
                    html += `<div class="report-item"><span class="category-badge ${a.category}" style="margin-top:2px;">${this.escapeHtml(a.category)}</span>
                        <span>${this.escapeHtml(a.entry)} ${project ? `<span class="tag">${this.escapeHtml(project.name)}</span>` : ''}
                        <span style="color:var(--text-muted);font-size:0.75rem;">${this.formatDateShort(a.date)}</span></span></div>`;
                });
                html += '</div>';
            }
        }

        // Value Delivered
        if (showMetrics) {
            const metricsSummary = this.getMetricsSummary();
            if (metricsSummary.length > 0) {
                const cum = this.getCumulativeMetrics();
                html += '<div class="report-section">';
                html += '<div class="report-section-title"><i class="fas fa-chart-line" style="color:var(--accent);"></i> Value Delivered</div>';
                html += `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:12px;margin-bottom:12px;">
                    <div class="stat-card" style="padding:12px;"><div class="stat-value" style="font-size:1.25rem;">${cum.totalSavedWeek.toFixed(1)}h</div><div class="stat-label">saved/week</div></div>
                    <div class="stat-card" style="padding:12px;"><div class="stat-value" style="font-size:1.25rem;">${cum.totalSavedYear.toFixed(0)}h</div><div class="stat-label">saved/year</div></div>
                    <div class="stat-card" style="padding:12px;"><div class="stat-value" style="font-size:1.25rem;">${cum.totalPeople}</div><div class="stat-label">people impacted</div></div>
                </div>`;
                metricsSummary.forEach(m => {
                    html += `<div class="report-item"><i class="fas fa-chart-bar" style="color:var(--primary);margin-top:2px;"></i>
                        <span><strong>${this.escapeHtml(m.projectName)}</strong>: ${m.weekSaved.toFixed(1)}h/week saved (${(m.roi * 100).toFixed(0)}% ROI)</span></div>`;
                });
                html += '</div>';
            }
        }

        html += '</div>';
        if (previewArea) previewArea.innerHTML = html;
        if (printBtn) printBtn.style.display = 'inline-flex';
        if (mdBtn) mdBtn.style.display = 'inline-flex';

        this._lastReport = { from, to, showCompleted, showProgress, showUpcoming, showBlockers, showActivities, showMetrics };
    }

    printReport() {
        window.print();
    }

    exportReportMarkdown() {
        if (!this._lastReport) return;
        const { from, to } = this._lastReport;
        const userName = this.data.settings.userName || 'Team Member';

        let md = `# Status Update\n**${userName}** | ${this.formatDate(from)} - ${this.formatDate(to)}\n\n`;

        if (this._lastReport.showCompleted) {
            const completed = this.getCompletedInRange(from, to);
            md += '## Completed\n';
            if (completed.length === 0) {
                md += '_No tasks completed in this period._\n\n';
            } else {
                const byProject = {};
                completed.forEach(t => {
                    const pName = this.getProject(t.projectId)?.name || 'No Project';
                    if (!byProject[pName]) byProject[pName] = [];
                    byProject[pName].push(t);
                });
                for (const [pName, tasks] of Object.entries(byProject)) {
                    md += `\n**${pName}**\n`;
                    tasks.forEach(t => { md += `- ${t.name}\n`; });
                }
                md += '\n';
            }
        }

        if (this._lastReport.showProgress) {
            const inProgress = this.getInProgressItems();
            md += '## In Progress\n';
            inProgress.forEach(t => {
                const project = this.getProject(t.projectId);
                md += `- ${t.name}${project ? ` (${project.name})` : ''}\n`;
            });
            md += '\n';
        }

        if (this._lastReport.showBlockers) {
            const blockers = this.getBlockers();
            if (blockers.length > 0) {
                md += '## Blockers\n';
                blockers.forEach(t => {
                    md += `- **${t.name}**${t.blockerNote ? `: ${t.blockerNote}` : ''}\n`;
                });
                md += '\n';
            }
        }

        if (this._lastReport.showActivities) {
            const activities = this.getActivitiesInRange(from, to).slice(0, 15);
            if (activities.length > 0) {
                md += '## Activity Highlights\n';
                activities.forEach(a => {
                    md += `- [${a.category}] ${a.entry} (${this.formatDateShort(a.date)})\n`;
                });
                md += '\n';
            }
        }

        if (this._lastReport.showMetrics) {
            const metricsSummary = this.getMetricsSummary();
            if (metricsSummary.length > 0) {
                const cum = this.getCumulativeMetrics();
                md += '## Value Delivered\n';
                md += `- **${cum.totalSavedWeek.toFixed(1)}h** saved/week | **${cum.totalSavedYear.toFixed(0)}h** saved/year | **${cum.totalPeople}** people impacted\n`;
                metricsSummary.forEach(m => {
                    md += `- ${m.projectName}: ${m.weekSaved.toFixed(1)}h/week saved (${(m.roi * 100).toFixed(0)}% ROI)\n`;
                });
                md += '\n';
            }
        }

        const blob = new Blob([md], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `status-update-${from}-to-${to}.md`;
        a.click();
        URL.revokeObjectURL(url);
        this.showToast('Markdown exported', 'success');
    }

    renderReports() {
        this.updateReportDates();
    }

    applyReportPreset(preset) {
        const datePreset = document.getElementById('report-date-preset');
        const fromField = document.getElementById('report-date-from');
        const toField = document.getElementById('report-date-to');
        const today = new Date();
        let from;

        const checkboxes = {
            completed: document.getElementById('report-show-completed'),
            progress: document.getElementById('report-show-progress'),
            upcoming: document.getElementById('report-show-upcoming'),
            blockers: document.getElementById('report-show-blockers'),
            activities: document.getElementById('report-show-activities'),
            metrics: document.getElementById('report-show-metrics')
        };

        switch (preset) {
            case 'standup':
                // Yesterday + Today
                from = new Date(today);
                from.setDate(today.getDate() - 1);
                if (datePreset) datePreset.value = 'custom';
                if (fromField) fromField.value = this.toLocalDateString(from);
                if (toField) toField.value = this.toLocalDateString(today);
                if (checkboxes.completed) checkboxes.completed.checked = true;
                if (checkboxes.progress) checkboxes.progress.checked = true;
                if (checkboxes.upcoming) checkboxes.upcoming.checked = false;
                if (checkboxes.blockers) checkboxes.blockers.checked = true;
                if (checkboxes.activities) checkboxes.activities.checked = false;
                if (checkboxes.metrics) checkboxes.metrics.checked = false;
                break;

            case 'one-on-one':
                // Last 2 weeks
                from = new Date(today);
                from.setDate(today.getDate() - 14);
                if (datePreset) datePreset.value = 'last-2-weeks';
                if (fromField) fromField.value = this.toLocalDateString(from);
                if (toField) toField.value = this.toLocalDateString(today);
                if (checkboxes.completed) checkboxes.completed.checked = true;
                if (checkboxes.progress) checkboxes.progress.checked = true;
                if (checkboxes.upcoming) checkboxes.upcoming.checked = false;
                if (checkboxes.blockers) checkboxes.blockers.checked = true;
                if (checkboxes.activities) checkboxes.activities.checked = false;
                if (checkboxes.metrics) checkboxes.metrics.checked = true;
                break;

            case 'monthly':
                // Last month
                from = new Date(today);
                from.setMonth(today.getMonth() - 1);
                if (datePreset) datePreset.value = 'last-month';
                if (fromField) fromField.value = this.toLocalDateString(from);
                if (toField) toField.value = this.toLocalDateString(today);
                Object.values(checkboxes).forEach(cb => { if (cb) cb.checked = true; });
                break;
        }

        this.generateReport();
    }

    // ========================================
    // Dashboard
    // ========================================
    renderDashboard() {
        this.renderDashboardGreeting();
        this.renderDashboardStats();
        this.renderTodayFocus();
        this.renderActiveProjects();
        this.renderTaskCompletionChart();
        this.renderHoursSavedChart();
        this.renderRecentActivityFeed();
        this.renderUpcomingDeadlines();
        this.renderSnapshotHistory();
    }

    renderDashboardGreeting() {
        const el = document.getElementById('dashboard-greeting');
        if (!el) return;
        const hour = new Date().getHours();
        const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
        const name = this.data.settings.userName;
        el.textContent = name ? `${greeting}, ${name}` : greeting;
    }

    renderDashboardStats() {
        const container = document.getElementById('dashboard-stats');
        if (!container) return;

        const activeProjects = this.data.projects.filter(p => p.status === 'active').length;
        const inProgressTasks = this.data.tasks.filter(t => t.status === 'in-progress').length;
        const blockedTasks = this.data.tasks.filter(t => t.status === 'blocked').length;
        const cum = this.data.metrics.length > 0 ? this.getCumulativeMetrics() : { totalSavedWeek: 0 };

        container.innerHTML = `
            <div class="stat-card">
                <div class="stat-icon primary"><i class="fas fa-folder-open"></i></div>
                <div><div class="stat-value">${activeProjects}</div><div class="stat-label">Active Projects</div></div>
            </div>
            <div class="stat-card">
                <div class="stat-icon info"><i class="fas fa-play-circle"></i></div>
                <div><div class="stat-value">${inProgressTasks}</div><div class="stat-label">In Progress</div></div>
            </div>
            <div class="stat-card">
                <div class="stat-icon danger"><i class="fas fa-exclamation-triangle"></i></div>
                <div><div class="stat-value">${blockedTasks}</div><div class="stat-label">Blocked</div></div>
            </div>
            <div class="stat-card">
                <div class="stat-icon success"><i class="fas fa-clock"></i></div>
                <div><div class="stat-value">${cum.totalSavedWeek.toFixed(1)}h</div><div class="stat-label">Hours Saved/Week</div></div>
            </div>
        `;
    }

    renderTodayFocus() {
        const container = document.getElementById('dashboard-today-focus');
        if (!container) return;

        const today = this.toLocalDateString();
        const focusTasks = this.data.tasks.filter(t => {
            if (t.status === 'done' && t.completedAt && t.completedAt.slice(0, 10) === today) return true;
            if (t.status === 'in-progress') return true;
            if (t.dueDate === today && t.status !== 'done') return true;
            if (t.dueDate && t.dueDate < today && t.status !== 'done') return true;
            return false;
        });

        if (focusTasks.length === 0 && this.data.tasks.length === 0) {
            container.innerHTML = '';
            return;
        }

        const doneCount = focusTasks.filter(t => t.status === 'done').length;

        let html = `<div class="today-focus-card">
            <div class="today-focus-header">
                <h3><i class="fas fa-crosshairs"></i> Today's Focus</h3>
                <span class="today-focus-count">${doneCount}/${focusTasks.length} done</span>
            </div>`;

        if (focusTasks.length === 0) {
            html += '<div class="today-focus-empty"><i class="fas fa-check-circle" style="color:var(--success);margin-right:6px;"></i>All clear! Add a task to focus on today.</div>';
        } else {
            html += '<ul class="today-focus-list">';
            focusTasks.sort((a, b) => {
                if (a.status === 'done' && b.status !== 'done') return 1;
                if (a.status !== 'done' && b.status === 'done') return -1;
                return 0;
            }).forEach(t => {
                const isDone = t.status === 'done';
                const isOverdue = t.dueDate && t.dueDate < today && !isDone;
                const project = this.getProject(t.projectId);
                html += `<li class="today-focus-item ${isDone ? 'is-done' : ''}">
                    <input type="checkbox" ${isDone ? 'checked' : ''} onchange="app.toggleTodayTask('${this.escapeHtml(t.id)}')">
                    ${isOverdue ? '<span class="overdue-dot" title="Overdue"></span>' : ''}
                    <span class="task-label">${this.escapeHtml(t.name)}</span>
                    ${project ? `<span class="task-project">${this.escapeHtml(project.name)}</span>` : ''}
                </li>`;
            });
            html += '</ul>';
        }

        html += `<div class="today-focus-quick-add">
            <input type="text" id="today-quick-add" placeholder="Add a task for today..." onkeydown="if(event.key==='Enter')app.quickAddTodayTask(this.value)">
            <button class="btn btn-primary btn-sm" onclick="app.quickAddTodayTask(document.getElementById('today-quick-add').value)" aria-label="Add task">
                <i class="fas fa-plus"></i>
            </button>
        </div>`;

        html += '</div>';
        container.innerHTML = html;
    }

    toggleTodayTask(taskId) {
        const task = this.data.tasks.find(t => t.id === taskId);
        if (!task) return;
        const now = new Date().toISOString();
        if (task.status === 'done') {
            task.status = 'in-progress';
            task.completedAt = null;
        } else {
            task.status = 'done';
            task.completedAt = now;
            this.updateStreak();
            const earlyBonus = task.dueDate && now.slice(0, 10) <= task.dueDate ? 5 : 0;
            this.addKarma(3 + earlyBonus);
        }
        task.updatedAt = now;
        this.saveData();
        this.renderTodayFocus();
        this.renderDashboardStats();
    }

    quickAddTodayTask(name) {
        name = (name || '').trim();
        if (!name) return;
        const now = new Date().toISOString();
        const today = this.toLocalDateString();
        this.data.tasks.push({
            id: this.generateId(),
            name,
            description: '',
            projectId: '',
            status: 'in-progress',
            blockerNote: '',
            priority: 3,
            dueDate: today,
            tags: [],
            completedAt: null,
            createdAt: now,
            updatedAt: now,
            sortOrder: 0
        });
        this.saveData();
        const input = document.getElementById('today-quick-add');
        if (input) input.value = '';
        this.renderTodayFocus();
        this.renderDashboardStats();
        this.showToast('Task added to today', 'success');
    }

    renderActiveProjects() {
        const container = document.getElementById('dashboard-active-projects');
        if (!container) return;

        const active = this.data.projects.filter(p => p.status === 'active').slice(0, 5);
        if (active.length === 0) {
            container.innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:20px;font-size:0.875rem;">No active projects</p>';
            return;
        }

        container.innerHTML = active.map(p => {
            const tasks = this.data.tasks.filter(t => t.projectId === p.id);
            const done = tasks.filter(t => t.status === 'done').length;
            const pct = tasks.length > 0 ? Math.round((done / tasks.length) * 100) : 0;
            return `<div style="display:flex;align-items:center;gap:12px;padding:8px 0;border-bottom:1px solid var(--border);">
                <div style="width:8px;height:8px;border-radius:50%;background:${this.escapeHtml(p.color || '#0d9488')};flex-shrink:0;"></div>
                <div style="flex:1;min-width:0;">
                    <div style="font-weight:600;font-size:0.875rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${this.escapeHtml(p.name)}</div>
                    <div style="font-size:0.75rem;color:var(--text-muted);">${done}/${tasks.length} tasks done</div>
                </div>
                <div style="font-weight:700;font-size:0.875rem;color:var(--primary);">${pct}%</div>
            </div>`;
        }).join('');
    }

    renderTaskCompletionChart() {
        const canvas = document.getElementById('chart-task-completion');
        if (!canvas) return;

        const statusCounts = {
            backlog: this.data.tasks.filter(t => t.status === 'backlog').length,
            'this-week': this.data.tasks.filter(t => t.status === 'this-week').length,
            'in-progress': this.data.tasks.filter(t => t.status === 'in-progress').length,
            blocked: this.data.tasks.filter(t => t.status === 'blocked').length,
            done: this.data.tasks.filter(t => t.status === 'done').length
        };

        const isDark = this.data.settings.theme === 'dark';
        const textColor = isDark ? '#94a3b8' : '#64748b';
        const gridColor = isDark ? '#334155' : '#e2e8f0';

        const data = {
            labels: ['Backlog', 'This Week', 'In Progress', 'Blocked', 'Done'],
            datasets: [{
                data: Object.values(statusCounts),
                backgroundColor: ['#94a3b8', '#2563eb', '#0d9488', '#dc2626', '#16a34a'],
                borderRadius: 6,
                borderWidth: 0
            }]
        };

        const options = {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: { beginAtZero: true, ticks: { color: textColor, stepSize: 1 }, grid: { color: gridColor } },
                x: { ticks: { color: textColor, font: { size: 10 } }, grid: { display: false } }
            }
        };

        if (this.charts.taskCompletion) {
            this.charts.taskCompletion.data = data;
            this.charts.taskCompletion.options = options;
            this.charts.taskCompletion.update();
        } else {
            this.charts.taskCompletion = new Chart(canvas, { type: 'bar', data, options });
        }
    }

    renderHoursSavedChart() {
        const canvas = document.getElementById('chart-hours-saved');
        if (!canvas) return;

        // Generate last 8 weeks data
        const weeks = [];
        const today = new Date();
        for (let i = 7; i >= 0; i--) {
            const d = new Date(today);
            d.setDate(d.getDate() - i * 7);
            const bounds = this.getWeekBounds(d);
            const label = this.formatDateShort(this.toLocalDateString(bounds.start));
            // Cumulative hours saved is constant per week (same metrics)
            const cum = this.data.metrics.length > 0 ? this.getCumulativeMetrics() : { totalSavedWeek: 0 };
            weeks.push({ label, value: cum.totalSavedWeek * (8 - i) });
        }

        const isDark = this.data.settings.theme === 'dark';
        const textColor = isDark ? '#94a3b8' : '#64748b';
        const gridColor = isDark ? '#334155' : '#e2e8f0';

        const data = {
            labels: weeks.map(w => w.label),
            datasets: [{
                label: 'Cumulative Hours Saved',
                data: weeks.map(w => parseFloat(w.value.toFixed(1))),
                borderColor: '#0d9488',
                backgroundColor: 'rgba(13, 148, 136, 0.1)',
                fill: true,
                tension: 0.4,
                pointRadius: 3,
                pointBackgroundColor: '#0d9488'
            }]
        };

        const options = {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: { beginAtZero: true, ticks: { color: textColor }, grid: { color: gridColor } },
                x: { ticks: { color: textColor, font: { size: 10 } }, grid: { display: false } }
            }
        };

        if (this.charts.hoursSaved) {
            this.charts.hoursSaved.data = data;
            this.charts.hoursSaved.options = options;
            this.charts.hoursSaved.update();
        } else {
            this.charts.hoursSaved = new Chart(canvas, { type: 'line', data, options });
        }
    }

    renderRecentActivityFeed() {
        const container = document.getElementById('dashboard-recent-activity');
        if (!container) return;

        const recent = [...this.data.activities]
            .sort((a, b) => (b.timestamp || b.createdAt || '').localeCompare(a.timestamp || a.createdAt || ''))
            .slice(0, 8);

        if (recent.length === 0) {
            container.innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:20px;font-size:0.875rem;">No recent activity</p>';
            return;
        }

        const categoryIcons = {
            build: 'fa-hammer', deploy: 'fa-rocket', meeting: 'fa-users',
            research: 'fa-microscope', support: 'fa-headset', other: 'fa-circle'
        };

        container.innerHTML = recent.map(a => {
            const icon = categoryIcons[a.category] || 'fa-circle';
            return `<div style="display:flex;gap:8px;padding:6px 0;border-bottom:1px solid var(--border);font-size:0.8125rem;">
                <span class="category-badge ${a.category}" style="flex-shrink:0;margin-top:2px;"><i class="fas ${icon}"></i></span>
                <span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${this.escapeHtml(a.entry)}</span>
                <span style="color:var(--text-muted);flex-shrink:0;font-size:0.75rem;">${this.getRelativeDate(a.date)}</span>
            </div>`;
        }).join('');
    }

    renderUpcomingDeadlines() {
        const container = document.getElementById('dashboard-deadlines');
        if (!container) return;

        const upcoming = this.data.tasks
            .filter(t => t.dueDate && t.status !== 'done')
            .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
            .slice(0, 5);

        if (upcoming.length === 0) {
            container.innerHTML = '';
            return;
        }

        let html = `<div class="card"><h3 class="card-title"><i class="fas fa-calendar-alt"></i> Upcoming Deadlines</h3>`;
        upcoming.forEach(t => {
            const urgency = this.getDueUrgency(t.dueDate);
            const project = this.getProject(t.projectId);
            html += `<div style="display:flex;align-items:center;gap:12px;padding:8px 0;border-bottom:1px solid var(--border);">
                <span class="status-dot ${t.status}"></span>
                <div style="flex:1;min-width:0;">
                    <div style="font-weight:600;font-size:0.875rem;">${this.escapeHtml(t.name)}</div>
                    ${project ? `<div style="font-size:0.75rem;color:var(--text-muted);">${this.escapeHtml(project.name)}</div>` : ''}
                </div>
                <span class="task-due-date ${urgency}">${this.formatDateShort(t.dueDate)}</span>
            </div>`;
        });
        html += '</div>';
        container.innerHTML = html;
    }

    // ========================================
    // Weekly Snapshots
    // ========================================
    setupSnapshots() {
        this.autoGenerateCurrentWeekSnapshot();
    }

    autoGenerateCurrentWeekSnapshot() {
        if (this.data.tasks.length === 0 && this.data.activities.length === 0) return;

        const { start, end } = this.getWeekBounds(new Date());
        const weekStart = this.toLocalDateString(start);
        const weekEnd = this.toLocalDateString(end);

        const existing = this.data.weeklySnapshots.find(s => s.weekStart === weekStart);

        if (existing) {
            // Check if stale (>1 day old)
            const lastUpdated = new Date(existing.updatedAt || existing.createdAt);
            const now = new Date();
            const daysSinceUpdate = (now - lastUpdated) / 86400000;
            if (daysSinceUpdate < 1) return;

            // Refresh existing snapshot
            const updated = this.generateWeeklySnapshot(weekStart, weekEnd);
            const idx = this.data.weeklySnapshots.findIndex(s => s.id === existing.id);
            if (idx !== -1) {
                this.data.weeklySnapshots[idx] = { ...existing, ...updated, id: existing.id, updatedAt: new Date().toISOString() };
            }
        } else {
            const snapshot = this.generateWeeklySnapshot(weekStart, weekEnd);
            snapshot.id = this.generateId();
            snapshot.createdAt = new Date().toISOString();
            snapshot.updatedAt = new Date().toISOString();
            this.data.weeklySnapshots.push(snapshot);
        }

        this.saveData();
    }

    generateWeeklySnapshot(weekStart, weekEnd) {
        const completed = this.data.tasks.filter(t =>
            t.status === 'done' && t.completedAt &&
            t.completedAt >= weekStart && t.completedAt <= weekEnd + 'T23:59:59'
        ).map(t => t.id);

        const inProgress = this.data.tasks.filter(t =>
            t.status === 'in-progress' || t.status === 'this-week'
        ).map(t => t.id);

        const newTasks = this.data.tasks.filter(t =>
            t.createdAt && t.createdAt >= weekStart && t.createdAt <= weekEnd + 'T23:59:59'
        ).map(t => t.id);

        const stuck = this.data.tasks.filter(t =>
            t.status === 'blocked'
        ).map(t => t.id);

        const summary = this.buildSnapshotSummary(completed, inProgress, newTasks, stuck);

        return { weekStart, weekEnd, completed, inProgress, newTasks, stuck, summary };
    }

    buildSnapshotSummary(completed, inProgress, newTasks, stuck) {
        const parts = [];
        if (completed.length > 0) parts.push(`Completed ${completed.length} task${completed.length !== 1 ? 's' : ''}`);
        if (inProgress.length > 0) parts.push(`${inProgress.length} in progress`);
        if (newTasks.length > 0) parts.push(`${newTasks.length} new task${newTasks.length !== 1 ? 's' : ''} added`);
        if (stuck.length > 0) parts.push(`${stuck.length} blocked`);
        return parts.join('. ') + (parts.length > 0 ? '.' : 'No significant activity this week.');
    }

    renderSnapshotHistory() {
        const container = document.getElementById('dashboard-snapshot');
        if (!container) return;

        const snapshots = [...this.data.weeklySnapshots]
            .sort((a, b) => b.weekStart.localeCompare(a.weekStart))
            .slice(0, 4);

        if (snapshots.length === 0) {
            container.innerHTML = '';
            return;
        }

        let html = '<div class="card"><h3 class="card-title"><i class="fas fa-history"></i> Weekly Snapshots</h3>';

        snapshots.forEach(s => {
            const completedNames = s.completed.map(id => this.data.tasks.find(t => t.id === id)?.name).filter(Boolean);
            const stuckNames = s.stuck.map(id => this.data.tasks.find(t => t.id === id)?.name).filter(Boolean);

            html += `<div class="snapshot-card">
                <div class="snapshot-header">
                    <span class="snapshot-week">${this.formatDateShort(s.weekStart)} - ${this.formatDateShort(s.weekEnd)}</span>
                </div>
                <div class="snapshot-sections">
                    <div class="snapshot-section completed">
                        <div class="snapshot-section-label"><span class="badge badge-success">${s.completed.length}</span> Completed</div>
                        ${completedNames.slice(0, 3).map(n => `<div style="font-size:0.75rem;">${this.escapeHtml(n)}</div>`).join('')}
                        ${completedNames.length > 3 ? `<div style="font-size:0.75rem;color:var(--text-muted);">+${completedNames.length - 3} more</div>` : ''}
                    </div>
                    <div class="snapshot-section in-progress">
                        <div class="snapshot-section-label"><span class="badge badge-info">${s.inProgress.length}</span> In Progress</div>
                    </div>
                    <div class="snapshot-section new-tasks">
                        <div class="snapshot-section-label"><span class="badge badge-primary">${s.newTasks.length}</span> New</div>
                    </div>
                    <div class="snapshot-section stuck">
                        <div class="snapshot-section-label"><span class="badge badge-danger">${s.stuck.length}</span> Blocked</div>
                        ${stuckNames.map(n => `<div style="font-size:0.75rem;">${this.escapeHtml(n)}</div>`).join('')}
                    </div>
                </div>
                ${s.summary ? `<div class="snapshot-summary">${this.escapeHtml(s.summary)}</div>` : ''}
            </div>`;
        });

        html += '</div>';
        container.innerHTML = html;
    }

    // ========================================
    // Smart Activity Defaults
    // ========================================
    detectCategory(text) {
        if (!text) return null;
        const lower = text.toLowerCase();
        const patterns = {
            deploy: ['deploy', 'release', 'ship', 'push to prod', 'go live', 'launch'],
            meeting: ['meet', 'standup', 'sync', '1:1', 'one-on-one', 'huddle', 'retro', 'planning'],
            research: ['research', 'investigate', 'explore', 'spike', 'prototype', 'evaluate', 'analyze'],
            support: ['fix', 'debug', 'support', 'ticket', 'incident', 'hotfix', 'troubleshoot', 'bug'],
            build: ['build', 'develop', 'code', 'implement', 'create', 'refactor', 'write', 'feature']
        };
        for (const [category, keywords] of Object.entries(patterns)) {
            if (keywords.some(k => lower.includes(k))) return category;
        }
        return null;
    }

    getLastUsedProject() {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - 7);
        const cutoffStr = this.toLocalDateString(cutoff);
        const recent = this.data.activities
            .filter(a => a.projectId && a.date >= cutoffStr)
            .sort((a, b) => (b.timestamp || b.createdAt || '').localeCompare(a.timestamp || a.createdAt || ''));
        return recent.length > 0 ? recent[0].projectId : null;
    }

    // ========================================
    // Streaks & Karma
    // ========================================
    updateStreak() {
        const today = this.toLocalDateString();
        const last = this.data.settings.lastActiveDate;
        if (last === today) return; // Already counted today

        if (last) {
            const lastDate = new Date(last);
            const todayDate = new Date(today);
            const diffDays = Math.round((todayDate - lastDate) / 86400000);
            if (diffDays === 1) {
                this.data.settings.streak++;
            } else {
                this.data.settings.streak = 1;
            }
        } else {
            this.data.settings.streak = 1;
        }

        this.data.settings.lastActiveDate = today;
        if (this.data.settings.streak > (this.data.settings.longestStreak || 0)) {
            this.data.settings.longestStreak = this.data.settings.streak;
        }

        // Milestone celebrations
        const streak = this.data.settings.streak;
        if ([7, 30, 100].includes(streak)) {
            this.showStreakCelebration(streak);
        }

        this.renderStreakWidget();
    }

    addKarma(points) {
        this.data.settings.karma = (this.data.settings.karma || 0) + points;
        const karma = this.data.settings.karma;
        if (karma >= 1000) this.data.settings.karmaLevel = 'Legend';
        else if (karma >= 500) this.data.settings.karmaLevel = 'Expert';
        else if (karma >= 200) this.data.settings.karmaLevel = 'Achiever';
        else if (karma >= 50) this.data.settings.karmaLevel = 'Contributor';
        else this.data.settings.karmaLevel = 'Beginner';
        this.renderStreakWidget();
    }

    renderStreakWidget() {
        let widget = document.getElementById('streak-widget');
        if (!widget) {
            const footer = document.querySelector('.sidebar-footer');
            if (!footer) return;
            widget = document.createElement('div');
            widget.id = 'streak-widget';
            widget.className = 'streak-widget';
            footer.insertBefore(widget, footer.firstChild);
        }

        const streak = this.data.settings.streak || 0;
        const level = this.data.settings.karmaLevel || 'Beginner';
        const karma = this.data.settings.karma || 0;
        const levelClass = level.toLowerCase();

        widget.innerHTML = `<div class="streak-info">
            <i class="fas fa-fire streak-flame"></i>
            <span class="streak-count">${streak}</span>
            <span class="streak-label">day${streak !== 1 ? 's' : ''}</span>
        </div>
        <span class="karma-badge ${levelClass}" title="${karma} karma">${this.escapeHtml(level)}</span>`;
    }

    showStreakCelebration(count) {
        const milestones = { 7: 'One week streak!', 30: 'One month streak!', 100: '100-day streak!' };
        const msg = milestones[count] || `${count}-day streak!`;
        this.showToast(`${msg} Keep it going!`, 'success');
    }

    // ========================================
    // Command Palette
    // ========================================
    setupCommandPalette() {
        this.commandPaletteOpen = false;
        this.commandPaletteIndex = 0;

        document.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                e.preventDefault();
                this.commandPaletteOpen ? this.closeCommandPalette() : this.openCommandPalette();
            }
        });

        const overlay = document.getElementById('command-palette');
        if (overlay) {
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) this.closeCommandPalette();
            });
        }

        const input = document.getElementById('command-palette-input');
        if (input) {
            input.addEventListener('input', () => this.filterCommands(input.value));
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Escape') { this.closeCommandPalette(); return; }
                if (e.key === 'ArrowDown') { e.preventDefault(); this.navigateCommand(1); }
                if (e.key === 'ArrowUp') { e.preventDefault(); this.navigateCommand(-1); }
                if (e.key === 'Enter') { e.preventDefault(); this.executeSelectedCommand(); }
            });
        }
    }

    openCommandPalette() {
        const overlay = document.getElementById('command-palette');
        const input = document.getElementById('command-palette-input');
        if (!overlay) return;
        this.commandPaletteOpen = true;
        overlay.classList.add('active');
        if (input) { input.value = ''; input.focus(); }
        this.commandPaletteIndex = 0;
        this._commandItems = this.buildCommandIndex();
        this.renderCommandResults(this._commandItems);
    }

    closeCommandPalette() {
        const overlay = document.getElementById('command-palette');
        if (!overlay) return;
        this.commandPaletteOpen = false;
        overlay.classList.remove('active');
    }

    buildCommandIndex() {
        const commands = [];
        // Nav pages
        const pages = [
            { label: 'Go to Dashboard', icon: 'fa-tachometer-alt', keywords: 'home overview', action: () => this.navigateTo('dashboard') },
            { label: 'Go to Projects', icon: 'fa-folder-open', keywords: 'projects list', action: () => this.navigateTo('projects') },
            { label: 'Go to Task Board', icon: 'fa-columns', keywords: 'kanban board tasks', action: () => this.navigateTo('kanban') },
            { label: 'Go to Activity Log', icon: 'fa-clock', keywords: 'activities journal', action: () => this.navigateTo('activity') },
            { label: 'Go to Metrics', icon: 'fa-chart-line', keywords: 'metrics roi value', action: () => this.navigateTo('metrics') },
            { label: 'Go to Reports', icon: 'fa-file-alt', keywords: 'reports 1:1', action: () => this.navigateTo('reports') },
            { label: 'Go to Settings', icon: 'fa-cog', keywords: 'settings preferences', action: () => this.navigateTo('settings') },
        ];
        commands.push(...pages);

        // Actions
        commands.push(
            { label: 'New Project', icon: 'fa-plus', keywords: 'create project add', action: () => this.openProjectModal(), hint: 'P' },
            { label: 'New Task', icon: 'fa-plus', keywords: 'create task add', action: () => this.openTaskModal(), hint: 'N' },
            { label: 'Log Activity', icon: 'fa-plus', keywords: 'create activity add log', action: () => this.openActivityModal(), hint: 'A' },
            { label: 'Toggle Theme', icon: 'fa-adjust', keywords: 'dark light mode theme', action: () => { const next = this.data.settings.theme === 'dark' ? 'light' : 'dark'; this.data.settings.theme = next; this.applyTheme(next); this.saveData(); }, hint: 'T' },
        );
        if (this.auth && this.currentUser) {
            commands.push({ label: 'Sign Out', icon: 'fa-sign-out-alt', keywords: 'logout sign out', action: () => this.handleSignOut() });
        }

        // Projects
        this.data.projects.forEach(p => {
            commands.push({ label: p.name, icon: 'fa-folder', keywords: `project ${(p.tags || []).join(' ')}`, action: () => this.viewProjectDetail(p.id), hint: 'Project' });
        });

        // Tasks
        this.data.tasks.forEach(t => {
            commands.push({ label: t.name, icon: 'fa-check-square', keywords: `task ${t.status}`, action: () => this.editTask(t.id), hint: 'Task' });
        });

        return commands;
    }

    filterCommands(query) {
        if (!this._commandItems) return;
        const q = query.toLowerCase().trim();
        let filtered;
        if (!q) {
            filtered = this._commandItems;
        } else {
            filtered = this._commandItems.filter(cmd => {
                const searchable = `${cmd.label} ${cmd.keywords || ''}`.toLowerCase();
                return q.split(/\s+/).every(term => searchable.includes(term));
            });
        }
        this.commandPaletteIndex = 0;
        this.renderCommandResults(filtered);
    }

    renderCommandResults(items) {
        const container = document.getElementById('command-palette-results');
        if (!container) return;
        this._filteredCommands = items;

        if (items.length === 0) {
            container.innerHTML = '<div class="command-palette-empty">No results found</div>';
            return;
        }

        container.innerHTML = items.map((cmd, i) =>
            `<div class="command-palette-item ${i === this.commandPaletteIndex ? 'selected' : ''}" data-index="${i}">
                <i class="fas ${cmd.icon}"></i>
                <span class="cmd-label">${this.escapeHtml(cmd.label)}</span>
                ${cmd.hint ? `<span class="cmd-hint">${this.escapeHtml(cmd.hint)}</span>` : ''}
            </div>`
        ).join('');

        container.querySelectorAll('.command-palette-item').forEach(el => {
            el.addEventListener('click', () => {
                this.commandPaletteIndex = parseInt(el.dataset.index);
                this.executeSelectedCommand();
            });
        });
    }

    navigateCommand(direction) {
        if (!this._filteredCommands || this._filteredCommands.length === 0) return;
        this.commandPaletteIndex = Math.max(0, Math.min(this._filteredCommands.length - 1, this.commandPaletteIndex + direction));
        const container = document.getElementById('command-palette-results');
        if (!container) return;
        container.querySelectorAll('.command-palette-item').forEach((el, i) => {
            el.classList.toggle('selected', i === this.commandPaletteIndex);
        });
        const selected = container.querySelector('.command-palette-item.selected');
        if (selected) selected.scrollIntoView({ block: 'nearest' });
    }

    executeSelectedCommand() {
        if (!this._filteredCommands || this._filteredCommands.length === 0) return;
        const cmd = this._filteredCommands[this.commandPaletteIndex];
        if (cmd && cmd.action) {
            this.closeCommandPalette();
            cmd.action();
        }
    }

    // ========================================
    // Keyboard Shortcuts
    // ========================================
    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Don't fire in inputs/textareas/contenteditable
            const tag = e.target.tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || e.target.isContentEditable) return;
            // Don't fire if command palette is open
            if (this.commandPaletteOpen) return;
            // Don't fire if a modal is open
            if (document.querySelector('.modal-overlay.active')) return;
            // Ignore combos with ctrl/meta/alt
            if (e.ctrlKey || e.metaKey || e.altKey) return;

            switch (e.key) {
                case 'n': case 'N': e.preventDefault(); this.openTaskModal(); break;
                case 'a': case 'A': e.preventDefault(); this.openActivityModal(); break;
                case 'p': case 'P': e.preventDefault(); this.openProjectModal(); break;
                case 'd': case 'D': e.preventDefault(); this.navigateTo('dashboard'); break;
                case 'b': case 'B': e.preventDefault(); this.navigateTo('kanban'); break;
                case 'l': case 'L': e.preventDefault(); this.navigateTo('activity'); break;
                case 't': case 'T': e.preventDefault();
                    const next = this.data.settings.theme === 'dark' ? 'light' : 'dark';
                    this.data.settings.theme = next;
                    this.applyTheme(next);
                    this.saveData();
                    break;
                case '?': e.preventDefault(); this.showShortcutsOverlay(); break;
            }
        });
    }

    showShortcutsOverlay() {
        const overlay = document.getElementById('shortcuts-overlay');
        if (overlay) overlay.classList.add('active');
    }

    hideShortcutsOverlay() {
        const overlay = document.getElementById('shortcuts-overlay');
        if (overlay) overlay.classList.remove('active');
    }
}

// Initialize app
const app = new WorkPulseApp();
