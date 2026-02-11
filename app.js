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
                this.syncToCloud();
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
    // Page Renders (stubs to be implemented)
    // ========================================
    renderDashboard() {
        // Implemented in Commit 9
    }

    renderProjects() {
        // Implemented in Commit 3
    }

    renderKanban() {
        // Implemented in Commit 5
    }

    renderActivities() {
        // Implemented in Commit 6
    }

    renderMetrics() {
        // Implemented in Commit 7
    }

    renderReports() {
        // Implemented in Commit 8
    }
}

// Initialize app
const app = new WorkPulseApp();
