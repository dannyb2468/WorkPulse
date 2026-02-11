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
        this.setupAuth();
        this.handleHashNavigation();
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
            defaultView: 'dashboard'
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
    // Page Renders (stubs)
    // ========================================
    renderDashboard() {}
    renderKanban() {}
    renderActivities() {}
    renderMetrics() {}
    renderReports() {}
}

// Initialize app
const app = new WorkPulseApp();
