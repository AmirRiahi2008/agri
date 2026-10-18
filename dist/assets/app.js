(() => {
  'use strict';
  const DATA = window.AgriProject;
  const PREFIX = `agri-passport:${DATA.project.id}:`;
  const OUTCOMES = ['بدون مغایرت', 'نیاز به پیگیری'];
  const TABS = ['reports', 'documents', 'letters'];
  let mapInstance = null;
  let expandedMap = null;
  let toastTimer;
  const digits = value => String(value ?? '').replace(/[۰-۹]/g, d => String(d.charCodeAt(0) - 1776)).replace(/[٠-٩]/g, d => String(d.charCodeAt(0) - 1632));
  const stageById = id => DATA.stages.find(stage => stage.id === id);
  const clone = value => JSON.parse(JSON.stringify(value));
  const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  const hydrateIcons = () => window.lucide?.createIcons({ attrs: { 'aria-hidden': 'true' } });
  const PHOTO_LIMIT = 3;
  const PHOTO_BYTES = 8 * 1024 * 1024;
  function validImages(value) {
    if (!Array.isArray(value)) return [];
    return value.filter(item => item && typeof item.url === 'string' && item.url.length <= 350000 && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(item.url))
      .slice(0, PHOTO_LIMIT).map((item, index) => ({ id: String(item.id || 'image-' + index).slice(0, 80), name: String(item.name || 'عکس گزارش').slice(0, 80), url: item.url }));
  }
  function blankCitizenDraft() { return { type: 'violation', title: '', body: '', images: [] }; }
  function validCitizenDraft(value) {
    const item = value && typeof value === 'object' ? value : {};
    return { type: item.type === 'praise' ? 'praise' : 'violation', title: typeof item.title === 'string' ? item.title.slice(0, 100) : '', body: typeof item.body === 'string' ? item.body.slice(0, 4000) : '', images: validImages(item.images) };
  }
  function validCitizenReports(value) {
    return Array.isArray(value) ? value.filter(item => item && typeof item.id === 'string' && item.id.startsWith('CITIZEN-') && typeof item.title === 'string' && typeof item.body === 'string' && ['violation', 'praise'].includes(item.type) && !Number.isNaN(Date.parse(item.date)))
      .map(item => ({ ...validCitizenDraft(item), id: item.id.slice(0, 100), code: String(item.code || '').slice(0, 40), date: item.date })) : [];
  }
  async function preparePhoto(file) {
    const source = URL.createObjectURL(file);
    try {
      const picture = await new Promise((resolve, reject) => {
        const img = new Image(); img.onload = () => resolve(img); img.onerror = () => reject(new Error('این فایل به‌عنوان عکس قابل خواندن نیست.')); img.src = source;
      });
      if (!picture.naturalWidth || !picture.naturalHeight || picture.naturalWidth * picture.naturalHeight > 40000000) throw new Error('ابعاد عکس بیش از حد بزرگ است؛ عکس کوچک‌تری انتخاب کنید.');
      const scale = Math.min(1, 1280 / Math.max(picture.naturalWidth, picture.naturalHeight));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(picture.naturalWidth * scale)); canvas.height = Math.max(1, Math.round(picture.naturalHeight * scale));
      const context = canvas.getContext('2d');
      if (!context) throw new Error('پردازش عکس در این مرورگر ممکن نیست.');
      context.fillStyle = '#ffffff'; context.fillRect(0, 0, canvas.width, canvas.height); context.drawImage(picture, 0, 0, canvas.width, canvas.height);
      let url = canvas.toDataURL('image/jpeg', 0.76);
      if (url.length > 350000) url = canvas.toDataURL('image/jpeg', 0.48);
      if (url.length > 350000 || !url.startsWith('data:image/jpeg;base64,')) throw new Error('حجم این عکس برای ثبت در نسخه نمایشی زیاد است؛ عکس کوچک‌تری انتخاب کنید.');
      return { id: 'IMG-' + (window.crypto?.randomUUID?.() || Math.random().toString(36).slice(2)), name: file.name.slice(0, 80), url };
    } finally { URL.revokeObjectURL(source); }
  }

  function phoneNumber(value) {
    let phone = digits(value).replace(/[\s()-]/g, '');
    if (phone.startsWith('+98')) phone = '0' + phone.slice(3);
    else if (phone.startsWith('0098')) phone = '0' + phone.slice(4);
    else if (phone.startsWith('98') && phone.length === 12) phone = '0' + phone.slice(2);
    return /^09\d{9}$/.test(phone) ? phone : '';
  }
  function readStore(key, fallback) {
    try { const value = localStorage.getItem(PREFIX + key); return value ? JSON.parse(value) : fallback; }
    catch { return fallback; }
  }
  function todayISO() {
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tehran', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
    const get = type => parts.find(part => part.type === type).value;
    return `${get('year')}-${get('month')}-${get('day')}`;
  }
  function validDate(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const date = new Date(value + 'T12:00:00Z');
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }
  function blankDraft(stageId) {
    const stage = stageById(stageId) || DATA.stages[0];
    return { stageId: stage.id, title: `گزارش ${stage.title}`, visitDate: todayISO(), progress: '', checked: [], body: '', outcome: OUTCOMES[0], followUp: '', images: [] };
  }
  function validDraft(value, stageId) {
    const blank = blankDraft(stageId);
    if (!value || typeof value !== 'object') return blank;
    const trim = (key, max) => typeof value[key] === 'string' ? value[key].slice(0, max) : blank[key];
    return {
      ...blank, title: trim('title', 100), body: trim('body', 4000), followUp: trim('followUp', 2000),
      visitDate: validDate(value.visitDate) ? value.visitDate : blank.visitDate,
      progress: typeof value.progress === 'number' || typeof value.progress === 'string' ? String(value.progress).slice(0, 6) : '',
      checked: Array.isArray(value.checked) ? stageById(blank.stageId).checks.map(item => item.id).filter(id => value.checked.includes(id)) : [],
      outcome: OUTCOMES.includes(value.outcome) ? value.outcome : OUTCOMES[0], images: validImages(value.images),
    };
  }
  function draftHasContent(draft) {
    return !!(draft.body.trim() || draft.followUp.trim() || draft.progress !== '' || draft.checked.length || draft.images.length || draft.title !== blankDraft(draft.stageId).title);
  }
  function validLocalReports(value) {
    if (!Array.isArray(value)) return [];
    return value.filter(report => report && typeof report.id === 'string' && report.id.startsWith('LOCAL-') && stageById(report.stageId) &&
      typeof report.title === 'string' && typeof report.body === 'string' && phoneNumber(report.ownerPhone) && validDate(report.visitDate) &&
      !Number.isNaN(Date.parse(report.date)) && Number.isFinite(report.progress) && report.progress >= 0 && report.progress <= 100 && OUTCOMES.includes(report.outcome))
      .map(report => ({
        id: report.id.slice(0, 100), code: String(report.code || '').slice(0, 40), stageId: report.stageId,
        title: report.title.slice(0, 100), body: report.body.slice(0, 4000), followUp: typeof report.followUp === 'string' ? report.followUp.slice(0, 2000) : '',
        visitDate: report.visitDate, date: report.date, progress: report.progress, outcome: report.outcome,
        checked: Array.isArray(report.checked) ? stageById(report.stageId).checks.map(item => item.id).filter(id => report.checked.includes(id)) : [],
        author: DATA.project.supervisor.name, role: DATA.project.supervisor.role, ownerPhone: phoneNumber(report.ownerPhone), images: validImages(report.images),
      }));
  }
  function setupAnimations() {
    if (!window.Motion?.animate || reducedMotion()) return;
    const { animate, inView } = window.Motion;
    document.querySelectorAll('[data-intro]').forEach((el, i) => animate(el, { opacity: [0, 1], y: [15, 0] }, { duration: 0.7, delay: i * 0.12, ease: [0.22, 1, 0.36, 1] }));
    document.querySelectorAll('[data-float]').forEach((el, i) => animate(el, { y: [0, -5, 0] }, { duration: 5 + i, repeat: Infinity, ease: 'easeInOut' }));
    if (inView) document.querySelectorAll('[data-reveal]').forEach(el => inView(el, () => animate(el, { opacity: [0, 1], y: [15, 0] }, { duration: 0.55, ease: [0.22, 1, 0.36, 1] }), { margin: '0px 0px -25px 0px' }));
  }
  function setupMap(component) {
    if (mapInstance || !component.hasCoordinates) return;
    if (!window.ProjectMap) { component.mapConnection = 'unavailable'; return; }
    mapInstance = window.ProjectMap.create('project-map', { onStatus: status => { if (component.modal !== 'map') component.mapConnection = status; } });
  }

  window.agriPortal = () => ({
    project: clone(DATA.project), unit: clone(DATA.unit), reportStages: clone(DATA.stages), documents: clone(DATA.documents), letters: clone(DATA.letters),
    view: 'public', modal: '', activeSection: 'building', controlTab: 'reports',
    phone: '', phoneInput: '', phoneError: '', reports: [], reportFilter: 'all', reportSearch: '',
    draft: blankDraft('1'), activeDraftStage: '1', formErrors: {}, draftState: '', hasDraft: false, resumeStageId: '', submitting: false,
    toastMessage: '', selectedDocument: null, documentKind: '', qrImage: '', mapConnection: 'loading',
    citizenDraft: blankCitizenDraft(), citizenReports: [], citizenErrors: {}, citizenReceipt: null, citizenSubmitting: false,
    photoUploadBusy: false, photoUploadToken: 0, photoError: '', previewImage: null,
    publicUrl: window.location.protocol.startsWith('http') ? new URL('./', window.location.href).href : 'https://building-passport.amirreza-riahi3311.chatgpt.site/',
    init() {
      this.phone = phoneNumber(readStore('session', ''));
      this.loadReports(); this.refreshDraftInfo(); this.loadCitizenReports();
      if (!this.hasCoordinates) this.mapConnection = 'pending';
      ['reports', 'reportFilter', 'reportSearch'].forEach(key => this.$watch(key, () => this.$nextTick(hydrateIcons)));
      this.$nextTick(() => {
        hydrateIcons(); setupMap(this); setupAnimations();
        if ('IntersectionObserver' in window) {
          const observer = new IntersectionObserver(entries => {
            if (this.view !== 'public') return;
            entries.forEach(entry => { if (entry.isIntersecting) this.activeSection = entry.target.id; });
          }, { rootMargin: '-15% 0px -65% 0px', threshold: 0 });
          ['building', 'supervision', 'location', 'citizen'].forEach(id => observer.observe(document.getElementById(id)));
        }
      });
      window.addEventListener('storage', event => { if (event.key === PREFIX + 'reports') { this.loadReports(); this.refreshDraftInfo(); } if (event.key === PREFIX + 'citizen-reports') this.loadCitizenReports(); });
    },
    fa(value) { return String(value ?? '').replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[Number(d)]); },
    numberFa(value) { return Number(value).toLocaleString('fa-IR'); },
    dateFa(value) { if (!value || Number.isNaN(Date.parse(value))) return '—'; return new Date(value.length === 10 ? value + 'T12:00:00Z' : value).toLocaleDateString('fa-IR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Tehran' }); },
    normalize(value) { return String(value).replace(/ي/g, 'ی').replace(/ك/g, 'ک').replace(/\u200c/g, ' ').toLowerCase().trim(); },
    get today() { return todayISO(); },
    get currentStage() { return this.reportStages.find(stage => stage.id === this.draft.stageId) || this.reportStages[0]; },
    get completedCount() { return this.reportStages.filter(stage => this.getStageReport(stage.id)).length; },
    get reportCompletion() { return Math.round(this.completedCount / this.reportStages.length * 100); },
    get nextStage() { return this.reportStages.find(stage => !this.getStageReport(stage.id)) || null; },
    get latestVisit() { return [...this.reports].sort((a, b) => b.visitDate.localeCompare(a.visitDate) || Date.parse(b.date) - Date.parse(a.date))[0] || null; },
    get physicalProgress() { return this.latestVisit?.progress ?? 0; },
    get reportActionLabel() { return this.hasDraft ? 'ادامه پیش‌نویس گزارش' : this.nextStage ? 'ثبت گزارش مرحله ' + this.fa(this.nextStage.id) : 'ثبت گزارش تکمیلی'; },
    get filteredReports() {
      const query = this.normalize(this.reportSearch);
      return this.reports.filter(report => (this.reportFilter === 'all' ||
        (this.reportFilter === 'mine' && report.ownerPhone === this.phone) ||
        (this.reportFilter === 'attention' && report.outcome === OUTCOMES[1]) || report.stageId === this.reportFilter) &&
        this.normalize(report.title + ' ' + this.stageTitle(report.stageId) + ' ' + report.body).includes(query));
    },
    stageTitle(id) { return this.reportStages.find(stage => stage.id === id)?.title || '—'; },
    getStageReport(id) { return this.reports.find(report => report.stageId === id) || null; },
    isStageUnlocked(id) { const index = this.reportStages.findIndex(stage => stage.id === id); return index >= 0 && this.reportStages.slice(0, index).every(stage => this.getStageReport(stage.id)); },
    stageState(id) { const report = this.getStageReport(id); return report ? report.outcome === OUTCOMES[1] ? 'نیاز به پیگیری' : 'گزارش ثبت شد' : this.isStageUnlocked(id) ? 'مرحله بعد' : 'در انتظار'; },
    statusClass(outcome) { return outcome === OUTCOMES[1] ? 'status-attention' : 'status-reviewed'; },
    clearReportFilters() { this.reportFilter = 'all'; this.reportSearch = ''; },
    loadReports() { this.reports = [...validLocalReports(readStore('reports', [])), ...clone(DATA.seedReports)].sort((a, b) => Date.parse(b.date) - Date.parse(a.date)); },

    notify(message) { clearTimeout(toastTimer); this.toastMessage = message; toastTimer = setTimeout(() => { this.toastMessage = ''; }, 4500); },
    navigateTo(id) { this.activeSection = id === 'project-board' ? 'building' : id; document.getElementById(id)?.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'start' }); },
    goPublic(id = 'building') { this.closeModal(); this.view = 'public'; this.$nextTick(() => { mapInstance?.refresh(); this.navigateTo(id); }); },
    enterControl() { if (this.phone) this.showControl(); else { this.phoneInput = ''; this.phoneError = ''; this.modal = 'login'; this.$nextTick(() => setTimeout(() => this.$refs.phoneInput?.focus(), 60)); } },
    showControl() { this.closeModal(); this.view = 'control'; this.$nextTick(() => { window.scrollTo({ top: 0, behavior: 'auto' }); hydrateIcons(); }); },
    login() {
      const phone = phoneNumber(this.phoneInput);
      if (!phone) { this.phoneError = 'شماره موبایل معتبر ۱۱ رقمی وارد کنید؛ مانند ۰۹۱۲۳۴۵۶۷۸۹.'; this.$refs.phoneInput?.focus(); return; }
      try { localStorage.setItem(PREFIX + 'session', JSON.stringify(phone)); }
      catch { this.notify('ورود در این نشست انجام شد؛ ذخیره ورود در مرورگر ممکن نیست.'); }
      this.phone = phone; this.refreshDraftInfo(); this.showControl();
    },
    logout() { this.closeModal(); try { localStorage.removeItem(PREFIX + 'session'); } catch {} this.phone = ''; this.draft = blankDraft('1'); this.hasDraft = false; this.resumeStageId = ''; this.goPublic(); this.notify('از پنل خارج شدید.'); },
    setControlTab(tab) { if (!TABS.includes(tab)) return; this.controlTab = tab; this.$nextTick(hydrateIcons); },
    focusControlTab(tab) { this.setControlTab(tab); this.$nextTick(() => document.getElementById(tab + '-tab')?.focus()); },
    cycleControlTab(direction) { this.focusControlTab(TABS[(TABS.indexOf(this.controlTab) + direction + TABS.length) % TABS.length]); },
    closeModal() {
      if (this.submitting) return;
      if (this.modal === 'report') this.saveDraft();
      if (this.modal === 'citizen' && !this.citizenReceipt) this.saveCitizenDraft();
      this.photoUploadToken++; this.photoUploadBusy = false; this.photoError = ''; this.previewImage = null;
      if (this.modal === 'map') { expandedMap?.destroy(); expandedMap = null; this.mapConnection = mapInstance?.status || (this.hasCoordinates ? 'unavailable' : 'pending'); }
      this.modal = '';
    },
    closeTop() { if (this.previewImage) this.previewImage = null; else this.closeModal(); },
    refreshDraftInfo() {
      const saved = this.phone ? this.reportStages.map(stage => ({ stageId: stage.id, value: readStore(`draft:${this.phone}:${stage.id}`, null) }))
        .filter(item => item.value && draftHasContent(validDraft(item.value, item.stageId)) && this.isStageUnlocked(item.stageId))
        .sort((a, b) => Number(b.value.updatedAt || 0) - Number(a.value.updatedAt || 0)) : [];
      this.hasDraft = saved.length > 0; this.resumeStageId = saved[0]?.stageId || '';
    },
    loadDraft(stageId) {
      const stored = readStore(`draft:${this.phone}:${stageId}`, null);
      this.draft = validDraft(stored, stageId); this.activeDraftStage = stageId;
      this.draftState = stored && draftHasContent(this.draft) ? 'پیش‌نویس این مرحله بازیابی شد' : '';
    },
    openReportForm(stageId) {
      if (!this.phone) { this.enterControl(); return; }
      this.refreshDraftInfo();
      const chosen = stageId || this.resumeStageId || this.nextStage?.id || '4';
      if (!this.isStageUnlocked(chosen)) { this.notify('ابتدا گزارش مراحل قبلی را ثبت کنید.'); return; }
      this.loadDraft(chosen); this.formErrors = {}; this.submitting = false; this.modal = 'report';
      this.photoError = '';
      this.$nextTick(() => { hydrateIcons(); setTimeout(() => this.$refs.reportTitle?.focus(), 60); });
    },
    persistDraft(stageId, draft) {
      if (!this.phone || !stageById(stageId)) return false;
      const value = validDraft(draft, stageId);
      try {
        const key = PREFIX + `draft:${this.phone}:${stageId}`;
        if (draftHasContent(value)) localStorage.setItem(key, JSON.stringify({ ...value, updatedAt: Date.now() }));
        else localStorage.removeItem(key);
        return true;
      } catch { return false; }
    },
    saveDraft() {
      if (!this.phone || this.submitting) return;
      const saved = this.persistDraft(this.activeDraftStage, this.draft);
      this.draftState = saved ? draftHasContent(this.draft) ? 'پیش‌نویس این مرحله ذخیره شد' : '' : 'ذخیره پیش‌نویس در این مرورگر ممکن نیست';
      this.refreshDraftInfo();
    },
    changeDraftStage() {
      if (this.photoUploadBusy) { this.draft.stageId = this.activeDraftStage; this.notify('ابتدا صبر کنید پردازش عکس‌ها تمام شود.'); return; }
      const chosen = this.draft.stageId;
      if (!this.isStageUnlocked(chosen)) { this.draft.stageId = this.activeDraftStage; this.notify('ابتدا گزارش مراحل قبلی را ثبت کنید.'); return; }
      const saved = this.persistDraft(this.activeDraftStage, { ...this.draft, stageId: this.activeDraftStage });
      if (!saved && draftHasContent(this.draft)) { this.draft.stageId = this.activeDraftStage; this.notify('پیش‌نویس ذخیره نشد؛ برای حفظ متن، مرحله تغییر نکرد.'); return; }
      this.loadDraft(chosen); this.formErrors = {}; this.refreshDraftInfo(); this.$nextTick(hydrateIcons);
    },
    submitReport() {
      if (!this.phone || this.submitting || this.photoUploadBusy) return;
      this.formErrors = {};
      const progressText = digits(this.draft.progress).replace(/٫/g, '.').trim();
      const progress = Number(progressText);
      if (!this.isStageUnlocked(this.draft.stageId)) this.formErrors.stage = 'ابتدا گزارش مراحل قبلی را ثبت کنید.';
      if (this.draft.title.trim().length < 3) this.formErrors.title = 'عنوان گزارش را با حداقل ۳ کاراکتر بنویسید.';
      if (!validDate(this.draft.visitDate) || this.draft.visitDate < this.project.startDate || this.draft.visitDate > todayISO()) this.formErrors.visitDate = 'تاریخ بازدید باید از شروع پروژه تا امروز باشد.';
      if (!progressText || !/^\d{1,3}(\.\d)?$/.test(progressText) || progress < 0 || progress > 100) this.formErrors.progress = 'درصد پیشرفت را بین صفر تا ۱۰۰ وارد کنید.';
      if (this.draft.body.trim().length < 10) this.formErrors.body = 'شرح بازدید را با حداقل ۱۰ کاراکتر بنویسید.';
      if (!OUTCOMES.includes(this.draft.outcome)) this.formErrors.outcome = 'نتیجه بازدید را انتخاب کنید.';
      const checked = this.currentStage.checks.map(item => item.id).filter(id => this.draft.checked.includes(id));
      if (this.draft.outcome === OUTCOMES[0] && checked.length !== this.currentStage.checks.length) this.formErrors.checklist = 'برای ثبت بدون مغایرت، بررسی همه موارد این مرحله را مشخص کنید.';
      if (this.draft.outcome === OUTCOMES[1] && this.draft.followUp.trim().length < 10) this.formErrors.followUp = 'موارد نیازمند پیگیری و اقدام بعدی را توضیح دهید.';
      if (Object.keys(this.formErrors).length) { this.$nextTick(() => document.getElementById('report-form')?.querySelector('[aria-invalid="true"]')?.focus()); return; }
      this.submitting = true;
      const date = new Date().toISOString();
      const random = window.crypto?.randomUUID ? window.crypto.randomUUID() : Math.random().toString(36).slice(2);
      const local = validLocalReports(readStore('reports', []));
      const report = {
        id: 'LOCAL-' + random, code: `AG–R0${this.draft.stageId}–${String(Date.now()).slice(-6)}`,
        stageId: this.draft.stageId, title: this.draft.title.trim().slice(0, 100), visitDate: this.draft.visitDate, progress,
        checked, body: this.draft.body.trim().slice(0, 4000), outcome: this.draft.outcome,
        followUp: this.draft.outcome === OUTCOMES[1] ? this.draft.followUp.trim().slice(0, 2000) : '',
        author: this.project.supervisor.name, role: this.project.supervisor.role, ownerPhone: this.phone, date, images: validImages(this.draft.images),
      };
      try { localStorage.setItem(PREFIX + 'reports', JSON.stringify([report, ...local])); }
      catch { this.submitting = false; this.formErrors.storage = 'گزارش ذخیره نشد. فضای ذخیره مرورگر پر یا غیرفعال است؛ متن گزارش حفظ شده است.'; return; }
      try { localStorage.removeItem(PREFIX + `draft:${this.phone}:${this.draft.stageId}`); } catch {}
      this.loadReports(); this.refreshDraftInfo(); this.draft = blankDraft(this.nextStage?.id || '4'); this.activeDraftStage = this.draft.stageId;
      this.draftState = ''; this.controlTab = 'reports'; this.reportFilter = 'all'; this.reportSearch = ''; this.submitting = false; this.modal = '';
      this.$nextTick(hydrateIcons); this.notify('گزارش مرحله ' + this.fa(report.stageId) + ' با موفقیت ثبت شد.');
    },
    openDocument(document, kind) { if (!this.phone || !document) return; this.selectedDocument = document; this.documentKind = kind; this.modal = 'document'; this.$nextTick(hydrateIcons); },
    openCitizenRecord(document) { this.selectedDocument = document; this.documentKind = 'citizen'; this.modal = 'document'; this.$nextTick(hydrateIcons); },
    openCitizen() {
      this.closeModal(); this.citizenDraft = validCitizenDraft(readStore('citizen-draft', null)); this.citizenErrors = {}; this.citizenReceipt = null; this.photoError = ''; this.modal = 'citizen';
      this.$nextTick(() => { hydrateIcons(); setTimeout(() => this.$refs.citizenTitle?.focus(), 60); });
    },
    citizenType(type) { return type === 'praise' ? 'گزارش تشویقی' : 'گزارش تخلف'; },
    loadCitizenReports() { this.citizenReports = validCitizenReports(readStore('citizen-reports', [])).sort((a, b) => Date.parse(b.date) - Date.parse(a.date)); },
    saveCitizenDraft() {
      if (this.citizenSubmitting) return;
      const value = validCitizenDraft(this.citizenDraft);
      try { if (value.title.trim() || value.body.trim() || value.images.length) localStorage.setItem(PREFIX + 'citizen-draft', JSON.stringify(value)); else localStorage.removeItem(PREFIX + 'citizen-draft'); }
      catch { this.citizenErrors.draft = 'ذخیره خودکار پیش‌نویس در این مرورگر ممکن نیست؛ متن فعلی شما حفظ شده است.'; }
    },
    submitCitizen() {
      if (this.citizenSubmitting || this.photoUploadBusy) return;
      this.citizenErrors = {};
      if (!['violation', 'praise'].includes(this.citizenDraft.type)) this.citizenErrors.type = 'نوع گزارش را انتخاب کنید.';
      if (this.citizenDraft.title.trim().length < 3) this.citizenErrors.title = 'عنوان گزارش را با حداقل ۳ کاراکتر بنویسید.';
      if (this.citizenDraft.body.trim().length < 10) this.citizenErrors.body = 'متن گزارش را با حداقل ۱۰ کاراکتر بنویسید.';
      if (Object.keys(this.citizenErrors).length) { this.$nextTick(() => document.getElementById('citizen-form')?.querySelector('[aria-invalid="true"]')?.focus()); return; }
      this.citizenSubmitting = true;
      const report = { ...validCitizenDraft(this.citizenDraft), title: this.citizenDraft.title.trim(), body: this.citizenDraft.body.trim(),
        id: 'CITIZEN-' + (window.crypto?.randomUUID?.() || Math.random().toString(36).slice(2)), code: 'PUB–' + String(Date.now()).slice(-8), date: new Date().toISOString() };
      try { localStorage.setItem(PREFIX + 'citizen-reports', JSON.stringify([report, ...validCitizenReports(readStore('citizen-reports', []))])); }
      catch { this.citizenSubmitting = false; this.citizenErrors.storage = 'گزارش ذخیره نشد؛ فضای مرورگر پر یا غیرفعال است. متن و عکس‌های شما در فرم حفظ شده‌اند.'; return; }
      try { localStorage.removeItem(PREFIX + 'citizen-draft'); } catch {}
      this.loadCitizenReports(); this.citizenReceipt = report; this.citizenDraft = blankCitizenDraft(); this.citizenSubmitting = false; this.$nextTick(hydrateIcons);
    },
    async uploadPhotos(event, target) {
      const input = event.target; const files = Array.from(input.files || []);
      if (!files.length || this.photoUploadBusy) return;
      const draft = target === 'citizen' ? this.citizenDraft : this.draft;
      this.photoError = '';
      if (draft.images.length + files.length > PHOTO_LIMIT) { this.photoError = 'برای هر گزارش حداکثر ۳ عکس انتخاب کنید.'; input.value = ''; return; }
      if (files.some(file => !['image/jpeg', 'image/png', 'image/webp'].includes(file.type))) { this.photoError = 'فقط عکس JPG، PNG یا WebP پذیرفته می‌شود.'; input.value = ''; return; }
      if (files.some(file => file.size > PHOTO_BYTES)) { this.photoError = 'حجم هر عکس باید حداکثر ۸ مگابایت باشد.'; input.value = ''; return; }
      const token = ++this.photoUploadToken; this.photoUploadBusy = true;
      try {
        const images = [];
        for (const file of files) { images.push(await preparePhoto(file)); if (token !== this.photoUploadToken) return; }
        draft.images = [...draft.images, ...images];
        if (target === 'citizen') this.saveCitizenDraft(); else this.saveDraft();
      } catch (error) { if (token === this.photoUploadToken) this.photoError = error.message || 'بارگذاری عکس انجام نشد؛ دوباره تلاش کنید.'; }
      finally { input.value = ''; if (token === this.photoUploadToken) this.photoUploadBusy = false; }
    },
    removePhoto(target, id) { const draft = target === 'citizen' ? this.citizenDraft : this.draft; draft.images = draft.images.filter(image => image.id !== id); if (target === 'citizen') this.saveCitizenDraft(); else this.saveDraft(); this.photoError = ''; },
    downloadDocument() {
      const doc = this.selectedDocument; if (!doc || (this.documentKind !== 'citizen' && !this.phone)) return;
      const report = this.documentKind === 'report';
      const text = [this.unit.title, this.project.name, 'شناسه پروژه: ' + this.project.number,
        'عنوان: ' + doc.title, 'شماره: ' + (doc.number || doc.code), 'تاریخ ثبت: ' + this.dateFa(doc.date), 'ثبت‌کننده: ' + (doc.author || 'گزارش مردمی بدون ورود'),
        ...(report ? ['سمت: ' + this.project.supervisor.role + ' ـ ' + this.project.supervisor.specialty, 'مرحله: ' + this.stageTitle(doc.stageId), 'تاریخ بازدید: ' + this.dateFa(doc.visitDate), 'پیشرفت فیزیکی: ' + this.fa(doc.progress) + '٪', 'نتیجه: ' + doc.outcome, '', 'موارد بررسی‌شده:', ...this.reportStages.find(stage => stage.id === doc.stageId).checks.map(item => `${doc.checked.includes(item.id) ? '☑' : '☐'} ${item.label}`)] : ['موضوع: ' + (doc.subject || this.citizenType(doc.type))]),
        '', doc.body, ...(report && doc.followUp ? ['', 'اقدامات پیگیری:', doc.followUp] : []), '', 'این فایل مربوط به نسخه نمایشی است و اعتبار اجرایی یا اداری ندارد.'].join('\n');
      const url = URL.createObjectURL(new Blob(['\uFEFF', text], { type: 'text/plain;charset=utf-8' }));
      const anchor = document.createElement('a'); anchor.href = url; anchor.download = `agri-${doc.id.replace(/[^a-zA-Z0-9-]/g, '')}.txt`;
      document.body.appendChild(anchor); anchor.click(); anchor.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000); this.notify('نسخه متنی مدرک آماده دریافت است.');
    },
    openQr() { const qr = window.qrcode(0, 'M'); qr.addData(this.publicUrl); qr.make(); this.qrImage = qr.createDataURL(5, 0); this.modal = 'qr'; },
    async copyProjectLink() {
      try {
        if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(this.publicUrl);
        else { const input = document.createElement('textarea'); input.value = this.publicUrl; input.style.position = 'fixed'; input.style.opacity = '0'; document.body.appendChild(input); input.select(); const ok = document.execCommand('copy'); input.remove(); if (!ok) throw new Error('copy failed'); }
        this.notify('لینک شناسنامه پروژه کپی شد.');
      } catch { this.notify('کپی خودکار ممکن نشد؛ لینک نمایش‌داده‌شده را انتخاب کنید.'); }
    },
    get hasCoordinates() { const point = this.project.location.coordinates; return Array.isArray(point) && point.length === 2 && point.every(Number.isFinite) && Math.abs(point[0]) <= 85 && Math.abs(point[1]) <= 180; },
    get coordinatesLabel() { return this.hasCoordinates ? `${this.project.location.coordinates[0].toFixed(5)}° N  /  ${this.project.location.coordinates[1].toFixed(5)}° E` : 'موقعیت دقیق در انتظار ثبت'; },
    get directionsUrl() { return this.hasCoordinates ? 'https://www.google.com/maps/dir/?api=1&destination=' + this.project.location.coordinates.join(',') : 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(this.project.name); },
    get mapStatusLabel() { return ({ loading: 'در حال اتصال به نقشه', osm: 'نقشه آنلاین', offline: 'اتصال نقشه برقرار نشد', partial: 'بارگیری ناقص نقشه', unavailable: 'نقشه در دسترس نیست', pending: 'در انتظار موقعیت دقیق' })[this.mapConnection] || 'موقعیت پروژه'; },
    get mapHasError() { return ['offline', 'partial', 'unavailable'].includes(this.mapConnection); },
    get mapErrorMessage() { return this.mapConnection === 'partial' ? 'بخشی از نقشه بارگیری نشد؛ دوباره تلاش کنید.' : 'برای نمایش نقشه، اتصال اینترنت را بررسی کنید یا مسیریابی را باز کنید.'; },
    openMap() {
      if (expandedMap || !this.hasCoordinates) return;
      this.modal = 'map'; this.mapConnection = 'loading';
      this.$nextTick(() => { if (this.modal !== 'map' || expandedMap) return; expandedMap = window.ProjectMap?.create('expanded-project-map', { expanded: true, onStatus: status => { this.mapConnection = status; } }); if (!expandedMap) this.mapConnection = 'unavailable'; hydrateIcons(); });
    },
    recenterMap() { (this.modal === 'map' ? expandedMap : mapInstance)?.recenter(); },
    retryMap() { const controller = this.modal === 'map' ? expandedMap : mapInstance; if (controller) controller.retry(); else if (this.modal === 'map') { this.modal = ''; this.openMap(); } else setupMap(this); },
  });
  document.addEventListener('alpine:init', () => window.Alpine.data('agriPortal', window.agriPortal));
})();
