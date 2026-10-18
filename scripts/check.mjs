import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { JSDOM, VirtualConsole } from 'jsdom';

const html = await readFile('dist/index.html','utf8');
const script = await readFile('dist/assets/app.js','utf8');
const mapScript = await readFile('dist/assets/project-map.js','utf8');
const dataScript = await readFile('dist/assets/project-data.js','utf8');
const vendor = await Promise.all(['lucide.js','qrcode.js','focus.js','alpine.js','leaflet.js','motion.js','gesture.js'].map(name => readFile('dist/assets/vendor/' + name,'utf8')));
const prefix = 'agri-passport:AG-1405-001:';
const testPoint = [36.3, 53.4]; // Synthetic point used only by map tests.
const farmPoint = [36.6106937, 53.1022981]; // Balad POI geometry, not the shared map viewport.
const allContexts = [];
let checks = 0;
const pass = label => { checks++; console.log('PASS ' + label); };
const tick = () => new Promise(resolve => setTimeout(resolve,100));

async function boot(stored = {}, blocked = false, { mobile = false, offline = false, point, photoDelay = 0, photoFails = false } = {}) {
  const errors = [];
  const vc = new VirtualConsole();
  vc.on('jsdomError', e => { if (!String(e).includes('navigation')) errors.push(e.message); });
  vc.on('warn', (...args) => { if (String(args[0]).includes('Alpine')) errors.push(args.join(' ')); });
  const dom = new JSDOM(html,{ url:'https://building-passport.amirreza-riahi3311.chatgpt.site/',runScripts:'outside-only',pretendToBeVisual:true,virtualConsole:vc });
  const { window:w } = dom;
  w.matchMedia = q => ({ matches:q.includes('reduced-motion') || (mobile && q.includes('max-width')),media:q,addEventListener(){},removeEventListener(){} });
  Object.defineProperty(w.navigator,'onLine',{value:!offline,configurable:true});
  const maps = [];
  const sizes = new Map([
    ['project-map',{width:mobile ? 354 : 640,height:mobile ? 320 : 380}],
    ['expanded-project-map',{width:mobile ? 390 : 1000,height:mobile ? 580 : 600}],
  ]);
  for (const [id] of sizes) {
    const el = w.document.getElementById(id);
    Object.defineProperty(el,'clientWidth',{get:()=>sizes.get(id).width});
    Object.defineProperty(el,'clientHeight',{get:()=>sizes.get(id).height});
    el.getBoundingClientRect = () => ({x:0,y:0,top:0,left:0,right:sizes.get(id).width,bottom:sizes.get(id).height,...sizes.get(id)});
  }
  const observers = new Set();
  w.ResizeObserver = class {
    constructor(callback) { this.callback=callback;observers.add(this); }
    observe(el) { this.el=el; }
    disconnect() { observers.delete(this); }
  };
  w.scrollTo = () => {};
  w.HTMLElement.prototype.scrollIntoView = () => {};
  w.HTMLAnchorElement.prototype.click = function() { this.dataset.clicked = 'true'; };
  w.URL.createObjectURL = blob => { w.lastDownloadBlob = blob; return 'blob:test'; };
  w.URL.revokeObjectURL = () => {};
  w.Image = class {
    naturalWidth = 2000; naturalHeight = 1000;
    set src(value) { w.setTimeout(() => photoFails ? this.onerror?.() : this.onload?.(),photoDelay); }
  };
  w.HTMLCanvasElement.prototype.getContext = function() { return {fillRect(){},drawImage:()=>{w.lastPhotoDimensions=[this.width,this.height];}}; };
  w.HTMLCanvasElement.prototype.toDataURL = function() { return w.photoDataURL || 'data:image/jpeg;base64,/9j/2Q=='; };

  w.addEventListener('error', e => { errors.push(e.error?.message || e.message); e.preventDefault(); });
  for (const [key,value] of Object.entries(stored)) w.localStorage.setItem(key,value);
  if (blocked) Object.defineProperty(w,'localStorage',{ get(){ throw new Error('Storage unavailable'); } });
  w.eval(vendor[5]); w.eval(vendor[4]); w.eval(vendor[6]);
  const mapFactory = w.L.map;
  w.L.map = (...args) => { const map=mapFactory(...args);maps.push(map);return map; };
  w.eval(vendor[0]); w.eval(vendor[1]); w.eval(vendor[2]); w.eval(dataScript); if (point !== undefined) w.AgriProject.project.location.coordinates = point; w.eval(mapScript); w.eval(script); w.eval(vendor[3]);
  await tick();
  const d = w.document; allContexts.push({dom,errors});
  return { dom,w,d,state:w.Alpine.$data(d.body),errors,maps,
    resizeMap(id,width,height) { sizes.set(id,{width,height});for(const observer of observers)if(observer.el.id===id)observer.callback([{target:observer.el}]); },
  };
}

function input(ctx,selector,value,type='input') { const el=ctx.d.querySelector(selector); assert.ok(el,selector); el.value=value; el.dispatchEvent(new ctx.w.Event(type,{ bubbles:true })); }
function click(ctx,selector) { const el=ctx.d.querySelector(selector); assert.ok(el,selector); el.dispatchEvent(new ctx.w.MouseEvent('click',{ bubbles:true })); }
function submit(ctx,selector) { const el=ctx.d.querySelector(selector); (el.matches('form')?el:el.closest('form')).dispatchEvent(new ctx.w.Event('submit',{ bubbles:true,cancelable:true })); }
function snapshot(ctx) { return Object.fromEntries(Array.from({length:ctx.w.localStorage.length},(_,i)=>{ const k=ctx.w.localStorage.key(i);return [k,ctx.w.localStorage.getItem(k)]; })); }
function liveTiles(ctx,id='project-map') { return Array.from(ctx.d.querySelectorAll(`#${id} .project-live-tiles img`)); }
async function finishTiles(ctx,source='osm',id='project-map') {
  for (let round=0;round<4;round++) {
    await tick();
    const pending=liveTiles(ctx,id).filter(tile=>typeof tile.onload==='function');
    if (!pending.length && liveTiles(ctx,id).every(tile=>tile.classList.contains('leaflet-tile-loaded'))) return;
    for (const tile of pending) {
      if (source==='offline')tile.onerror?.(new ctx.w.Event('error'));
      else tile.onload?.(new ctx.w.Event('load'));
    }
  }
}

const ctx = await boot();
assert.equal(ctx.state.view,'public');
assert.equal(ctx.d.documentElement.lang,'fa');assert.equal(ctx.d.documentElement.dir,'rtl');
assert.equal(ctx.d.querySelector('#control-page').style.display,'none');
assert.match(ctx.d.querySelector('#building-title').textContent,/احداث واحد مرغداری گوشتی.*فخرالدین کشیری/);
for(const label of ['کارفرما','شماره پروانه تأسیس','ظرفیت واحد','تعداد سالن‌ها','مساحت زمین','زیربنای کل','دستگاه نظارت','تاریخ شروع پروژه','مدت اجرا'])assert.ok(ctx.d.querySelector('#project-board').textContent.includes(label),label);
assert.equal(ctx.d.querySelectorAll('.supervisor-card').length,1);
assert.match(ctx.d.querySelector('.supervisor-card').textContent,/مهندسی کشاورزی/);
assert.equal(ctx.d.querySelectorAll('.public-stage').length,4);assert.equal(ctx.d.querySelectorAll('.stage-card').length,4);
assert.equal(ctx.state.completedCount,2);assert.equal(ctx.state.nextStage.id,'3');assert.equal(ctx.state.physicalProgress,45);
assert.equal(ctx.d.querySelector('#report-role'),null);assert.equal(ctx.d.querySelector('#labs-tab'),null);
assert.doesNotMatch(html+script+dataScript,/ناظر سازه|ناظر معمار|ناظر برق|آزمایشگاه بتن|دانشگاه امام/);
assert.equal(typeof ctx.w.Motion.animate,'function');
pass('Agricultural board contains every requested field, one agricultural engineer and exactly four construction stages.');

click(ctx,'.citizen-open');await tick();assert.equal(ctx.state.modal,'citizen');assert.equal(ctx.state.phone,'');
submit(ctx,'#citizen-form');await tick();assert.ok(ctx.state.citizenErrors.title);assert.ok(ctx.state.citizenErrors.body);assert.equal(ctx.state.citizenReports.length,0);
input(ctx,'#citizen-title','مشاهده در محوطه واحد');input(ctx,'#citizen-body','<img src=x onerror="window.unexpected=true"> متن گزارش مردمی برای بررسی وضعیت محوطه.');
const photoInput=ctx.d.querySelector('#citizen-photos');
Object.defineProperty(photoInput,'files',{value:[new ctx.w.File(['photo'],'site.jpg',{type:'image/jpeg'})],configurable:true});
photoInput.dispatchEvent(new ctx.w.Event('change',{bubbles:true}));await tick();
assert.equal(ctx.state.citizenDraft.images.length,1);assert.deepEqual(ctx.w.lastPhotoDimensions,[1280,640]);
assert.equal(ctx.state.photoUploadBusy,false);assert.ok(ctx.d.querySelector('#citizen-form .photo-thumb img'));
click(ctx,'#citizen-form .photo-thumb>button');await tick();assert.ok(ctx.state.previewImage);
ctx.w.dispatchEvent(new ctx.w.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));await tick();
assert.equal(ctx.state.previewImage,null);assert.equal(ctx.state.modal,'citizen');
submit(ctx,'#citizen-form');await tick();
assert.ok(ctx.state.citizenReceipt);assert.equal(ctx.state.citizenReports.length,1);assert.equal(ctx.state.reports.length,2);
assert.equal(ctx.state.completedCount,2);assert.equal(ctx.state.phone,'');
assert.equal(JSON.parse(ctx.w.localStorage.getItem(prefix+'citizen-reports'))[0].images.length,1);
assert.equal(ctx.w.localStorage.getItem(prefix+'reports'),null);
pass('Public violation report works without login; image upload, downscaling and preview work through mocked browser image APIs; no inspector record is created.');

ctx.state.closeModal();await tick();click(ctx,'.citizen-record');await tick();
assert.equal(ctx.state.documentKind,'citizen');assert.equal(ctx.state.modal,'document');
assert.match(ctx.d.querySelector('.document-body').textContent,/<img src=x/);assert.equal(ctx.d.querySelector('.document-body img'),null);
assert.equal(ctx.w.unexpected,undefined);assert.equal(ctx.d.querySelectorAll('.document-photos img').length,1);
ctx.state.downloadDocument();assert.ok(ctx.w.lastDownloadBlob.size>100);
ctx.state.closeModal();ctx.state.openCitizen();await tick();
click(ctx,'input[name="citizen-type"][value="praise"]');await tick();
input(ctx,'#citizen-title','محوطه مرتب و منظم');input(ctx,'#citizen-body','وضعیت محوطه و مسیر دسترسی در بازدید من مرتب و منظم بود.');
submit(ctx,'#citizen-form');await tick();assert.equal(ctx.state.citizenReports.length,2);assert.equal(ctx.state.citizenReports[0].type,'praise');
ctx.state.closeModal();ctx.state.openCitizen();await tick();input(ctx,'#citizen-title','پیش‌نویس گزارش مردمی');input(ctx,'#citizen-body','این متن برای ادامه نوشتن گزارش مردمی حفظ می‌شود.');
ctx.state.closeModal();await tick();ctx.state.openCitizen();await tick();assert.equal(ctx.state.citizenDraft.title,'پیش‌نویس گزارش مردمی');
const publicReload=await boot(snapshot(ctx));
assert.equal(publicReload.state.citizenReports.length,2);assert.equal(publicReload.state.citizenReports[1].images.length,1);
assert.equal(publicReload.state.reports.length,2);assert.equal(publicReload.state.phone,'');
pass('Praise reports, anonymous drafts, photos, local receipts and safe text display survive reload and remain separate from inspection.');

ctx.state.closeModal();click(ctx,'.header-login');await tick();
input(ctx,'#phone-input','123');submit(ctx,'#phone-input');await tick();assert.equal(ctx.state.modal,'login');assert.ok(ctx.state.phoneError);
input(ctx,'#phone-input','۰۹۱۲۳۴۵۶۷۸۹');submit(ctx,'#phone-input');await tick();
assert.equal(ctx.state.phone,'09123456789');assert.equal(ctx.state.view,'control');assert.equal(ctx.state.modal,'');
assert.equal(JSON.parse(ctx.w.localStorage.getItem(prefix+'session')),'09123456789');
click(ctx,'#documents-tab');await tick();assert.equal(ctx.d.querySelectorAll('#documents-panel .lab-card').length,3);
click(ctx,'#documents-panel .lab-card button');await tick();assert.match(ctx.d.querySelector('#document-title').textContent,/پروانه تأسیس/);
ctx.state.downloadDocument();assert.ok(ctx.w.lastDownloadBlob.size>100);ctx.state.closeModal();
click(ctx,'#letters-tab');await tick();assert.equal(ctx.d.querySelectorAll('#letters-panel .report-card').length,3);
click(ctx,'#letters-panel .report-card');await tick();assert.match(ctx.d.querySelector('.document-body').textContent,/ناظر ساخت/);
ctx.state.closeModal();click(ctx,'#reports-tab');await tick();
ctx.d.querySelector('#reports-tab').dispatchEvent(new ctx.w.KeyboardEvent('keydown',{key:'ArrowLeft',bubbles:true}));await tick();assert.equal(ctx.state.controlTab,'documents');assert.equal(ctx.d.activeElement.id,'documents-tab');
ctx.d.querySelector('#documents-tab').dispatchEvent(new ctx.w.KeyboardEvent('keydown',{key:'End',bubbles:true}));await tick();assert.equal(ctx.state.controlTab,'letters');
ctx.d.querySelector('#letters-tab').dispatchEvent(new ctx.w.KeyboardEvent('keydown',{key:'Home',bubbles:true}));await tick();assert.equal(ctx.state.controlTab,'reports');
pass('Persian mobile login, agricultural documents, letters, downloads and RTL keyboard tabs work.');

assert.equal(ctx.state.isStageUnlocked('4'),false);ctx.state.openReportForm('4');assert.equal(ctx.state.modal,'');
click(ctx,'.new-report-button');await tick();assert.equal(ctx.state.draft.stageId,'3');
assert.equal(ctx.d.querySelectorAll('#report-stage option').length,4);
assert.equal(ctx.d.querySelector('#report-stage option[value="4"]').disabled,true);
submit(ctx,'#report-form');await tick();assert.ok(ctx.state.formErrors.progress);assert.ok(ctx.state.formErrors.body);assert.ok(ctx.state.formErrors.checklist);
input(ctx,'#report-progress','۱۰۱');input(ctx,'#report-date','2999-01-01');input(ctx,'#report-body','مشاهدات بازدید از تکمیل سالن‌ها و تأسیسات واحد ثبت شد.');
submit(ctx,'#report-form');await tick();assert.ok(ctx.state.formErrors.progress);assert.ok(ctx.state.formErrors.visitDate);
input(ctx,'#report-date','2000-01-01');submit(ctx,'#report-form');await tick();assert.ok(ctx.state.formErrors.visitDate);
input(ctx,'#report-date',ctx.state.today);input(ctx,'#report-progress','۷۵');
input(ctx,'#report-title','بازدید تأسیسات سالن‌ها');
ctx.state.saveDraft();
input(ctx,'#report-stage','1','change');await tick();assert.equal(ctx.state.activeDraftStage,'1');assert.equal(ctx.state.draft.body,'');
input(ctx,'#report-body','پیش‌نویس جداگانه مربوط به بازدید جانمایی.');
input(ctx,'#report-stage','3','change');await tick();assert.equal(ctx.state.draft.body,'مشاهدات بازدید از تکمیل سالن‌ها و تأسیسات واحد ثبت شد.');
assert.equal(ctx.state.draft.title,'بازدید تأسیسات سالن‌ها');assert.equal(ctx.state.draft.checked.length,0);
ctx.state.closeModal();await tick();assert.equal(ctx.state.hasDraft,true);
ctx.state.openReportForm('3');await tick();assert.equal(ctx.state.draft.progress,'۷۵');
pass('Stages unlock in order; invalid dates/progress/checklists are blocked; each stage has an independent recoverable draft.');

click(ctx,'input[name="outcome"][value="نیاز به پیگیری"]');await tick();
submit(ctx,'#report-form');await tick();assert.ok(ctx.state.formErrors.followUp);
input(ctx,'#report-followup','تکمیل مستندات نصب تجهیزات و بازدید مجدد مسیر آبرسانی انجام شود.');
const supervisorPhotos=ctx.d.querySelector('#report-photos');
Object.defineProperty(supervisorPhotos,'files',{value:[new ctx.w.File(['picture'],'equipment.png',{type:'image/png'})],configurable:true});
supervisorPhotos.dispatchEvent(new ctx.w.Event('change',{bubbles:true}));await tick();
assert.equal(ctx.state.draft.images.length,1);
submit(ctx,'#report-form');await tick();
assert.equal(ctx.state.modal,'');assert.equal(ctx.state.completedCount,3);assert.equal(ctx.state.nextStage.id,'4');assert.equal(ctx.state.physicalProgress,75);
assert.equal(ctx.state.reports.length,3);assert.equal(ctx.state.reports[0].outcome,'نیاز به پیگیری');assert.equal(ctx.state.reports[0].images.length,1);
assert.equal(ctx.state.reports[0].author,ctx.state.project.supervisor.name);assert.equal(ctx.state.citizenReports.length,2);
assert.equal(ctx.w.localStorage.getItem(prefix+'draft:09123456789:3'),null);
ctx.state.reportFilter='mine';await tick();assert.equal(ctx.state.filteredReports.length,1);
ctx.state.reportFilter='attention';await tick();assert.equal(ctx.state.filteredReports.length,1);
ctx.state.reportSearch='غیرموجود';await tick();assert.equal(ctx.state.filteredReports.length,0);
ctx.state.clearReportFilters();await tick();
ctx.state.openDocument(ctx.state.reports[0],'report');await tick();
assert.equal(ctx.d.querySelectorAll('.document-photos img').length,1);assert.match(ctx.d.querySelector('.document-body').textContent,/تأسیسات/);
ctx.state.closeModal();
pass('Follow-up details are required for issues; stage reports and photos persist under the single supervisor and update progress.');

ctx.state.openReportForm('4');await tick();input(ctx,'#report-title','گزارش بازدید نهایی واحد');input(ctx,'#report-progress','۱۰۰');input(ctx,'#report-body','بازدید نهایی فضاهای اصلی و خدماتی انجام و وضعیت تکمیل موارد پرونده در این گزارش نمونه جمع‌بندی شد.');
for(const el of ctx.d.querySelectorAll('#report-form .check-item input'))el.dispatchEvent(new ctx.w.MouseEvent('click',{bubbles:true}));
await tick();assert.equal(ctx.state.draft.checked.length,3);
submit(ctx,'#report-form');await tick();assert.equal(ctx.state.completedCount,4);assert.equal(ctx.state.nextStage,null);assert.equal(ctx.state.reportCompletion,100);assert.equal(ctx.state.physicalProgress,100);
assert.equal(ctx.state.reports.length,4);
ctx.state.openReportForm('1');await tick();input(ctx,'#report-title','گزارش تکمیلی جانمایی');input(ctx,'#report-date','2026-09-29');input(ctx,'#report-progress','۲۰');input(ctx,'#report-body','مشاهدات تکمیلی مربوط به بازدید جانمایی برای حفظ سوابق مرحله اول درج می‌شود.');
for(const el of ctx.d.querySelectorAll('#report-form .check-item input'))el.dispatchEvent(new ctx.w.MouseEvent('click',{bubbles:true}));
await tick();submit(ctx,'#report-form');await tick();
assert.equal(ctx.state.reports.filter(r=>r.stageId==='1').length,2);assert.equal(ctx.state.completedCount,4);
assert.equal(ctx.state.getStageReport('1').title,'گزارش تکمیلی جانمایی');assert.equal(ctx.state.physicalProgress,100);
const refreshed=await boot(snapshot(ctx));assert.equal(refreshed.state.completedCount,4);assert.equal(refreshed.state.reports.length,5);assert.equal(refreshed.state.citizenReports.length,2);
refreshed.state.enterControl();await tick();refreshed.state.logout();await tick();assert.equal(refreshed.state.phone,'');assert.equal(refreshed.state.reports.length,5);
refreshed.state.enterControl();await tick();input(refreshed,'#phone-input','+98 912 345 6780');submit(refreshed,'#phone-input');await tick();
refreshed.state.reportFilter='mine';assert.equal(refreshed.state.filteredReports.length,0);assert.equal(refreshed.state.hasDraft,false);
pass('All four stages can be completed; supplementary reports preserve history; backdated visits do not replace the latest physical progress; reload and accounts stay consistent.');

const photos=await boot();photos.state.openCitizen();await tick();const photoEl=photos.d.querySelector('#citizen-photos');
async function sendPhotos(context,files,target='citizen') { const el=context.d.querySelector(target==='citizen'?'#citizen-photos':'#report-photos');Object.defineProperty(el,'files',{value:files,configurable:true});await context.state.uploadPhotos({target:el},target);await tick(); }
await sendPhotos(photos,[new photos.w.File(['<svg/>'],'image.svg',{type:'image/svg+xml'})]);assert.match(photos.state.photoError,/JPG/);assert.equal(photos.state.citizenDraft.images.length,0);
await sendPhotos(photos,[{name:'big.jpg',type:'image/jpeg',size:9*1024*1024}]);assert.match(photos.state.photoError,/۸/);
await sendPhotos(photos,Array.from({length:4},()=>new photos.w.File(['x'],'x.jpg',{type:'image/jpeg'})));assert.match(photos.state.photoError,/۳/);
await sendPhotos(photos,[new photos.w.File(['x'],'one.webp',{type:'image/webp'})]);assert.equal(photos.state.citizenDraft.images.length,1);
photos.state.removePhoto('citizen',photos.state.citizenDraft.images[0].id);await tick();assert.equal(photos.state.citizenDraft.images.length,0);
photos.w.photoDataURL='data:image/jpeg;base64,'+'A'.repeat(350010);
await sendPhotos(photos,[new photos.w.File(['x'],'dense.jpg',{type:'image/jpeg'})]);assert.equal(photos.state.citizenDraft.images.length,0);assert.match(photos.state.photoError,/حجم/);
const failedImage=await boot({},false,{photoFails:true});failedImage.state.openCitizen();await tick();await sendPhotos(failedImage,[new failedImage.w.File(['bad'],'broken.jpg',{type:'image/jpeg'})]);assert.match(failedImage.state.photoError,/خواندن/);assert.equal(failedImage.state.photoUploadBusy,false);
const cancelled=await boot({},false,{photoDelay:200});cancelled.state.openCitizen();await tick();const cancelInput=cancelled.d.querySelector('#citizen-photos');Object.defineProperty(cancelInput,'files',{value:[new cancelled.w.File(['x'],'late.jpg',{type:'image/jpeg'})],configurable:true});const pendingPhoto=cancelled.state.uploadPhotos({target:cancelInput},'citizen');cancelled.state.closeModal();cancelled.state.openCitizen();await pendingPhoto;await tick();assert.equal(cancelled.state.citizenDraft.images.length,0);assert.equal(cancelled.state.photoUploadBusy,false);
pass('Photo type, count, size, decode failure, removal and cancelled uploads are handled without mixing drafts.');

const blocked=await boot({},true);
blocked.state.openCitizen();await tick();input(blocked,'#citizen-title','گزارش حفظ متن');input(blocked,'#citizen-body','اگر ذخیره مرورگر ممکن نباشد، متن این گزارش باید در فرم باقی بماند.');submit(blocked,'#citizen-form');await tick();assert.ok(blocked.state.citizenErrors.storage);assert.equal(blocked.state.citizenReceipt,null);assert.equal(blocked.state.citizenDraft.title,'گزارش حفظ متن');
blocked.state.closeModal();blocked.state.enterControl();await tick();input(blocked,'#phone-input','09123456789');submit(blocked,'#phone-input');await tick();blocked.state.openReportForm('3');await tick();
input(blocked,'#report-progress','۶۰');input(blocked,'#report-body','متن بازدید ناظر باید در صورت خطای ذخیره‌سازی حفظ شود.');for(const el of blocked.d.querySelectorAll('#report-form .check-item input'))el.dispatchEvent(new blocked.w.MouseEvent('click',{bubbles:true}));await tick();submit(blocked,'#report-form');await tick();assert.ok(blocked.state.formErrors.storage);assert.equal(blocked.state.modal,'report');assert.equal(blocked.state.reports.length,2);assert.match(blocked.state.draft.body,/حفظ شود/);
const corrupt=await boot({[prefix+'reports']:'{bad json',[prefix+'citizen-reports']:'{}',[prefix+'session']:'"invalid"','building-passport:BS-1184:reports':'[{"title":"old building"}]'});assert.equal(corrupt.state.reports.length,2);assert.equal(corrupt.state.citizenReports.length,0);assert.equal(corrupt.state.phone,'');
pass('Unavailable/corrupt storage gives honest errors and preserves unsaved text; old building reports never enter the agricultural project.');

const map=await boot();await finishTiles(map);
assert.equal(map.maps.length,1);assert.equal(map.state.mapConnection,'osm');
assert.deepEqual(Array.from(map.state.project.location.coordinates),farmPoint);
assert.equal(map.state.project.location.sourceUrl,'https://balad.ir/p/PXW3kWHIxTy5Jx');
assert.ok(map.maps[0].project(map.maps[0].getCenter()).distanceTo(map.maps[0].project(farmPoint))<1);
const marker=Object.values(map.maps[0]._layers).find(layer=>layer instanceof map.w.L.Marker);
assert.ok(marker.getLatLng().distanceTo(farmPoint)<0.01);
assert.equal(map.d.querySelector('.map-empty').style.display,'none');
assert.equal(map.d.querySelector('.location-address').textContent,'شهرستان ساری، میدان شهدا');
assert.match(map.d.querySelector('.leaflet-marker-icon').textContent,/مرغداری فخرالدین کشیری/);
assert.ok(map.d.querySelector('.location-copy a').href.endsWith('destination='+farmPoint.join(',')));
assert.equal(map.d.querySelector('#project-map .leaflet-control-attribution a').href,'https://www.openstreetmap.org/copyright');
assert.equal(map.maps[0].getZoom(),16);click(map,'#project-map .leaflet-control-zoom-in');await tick();assert.equal(map.maps[0].getZoom(),17);
map.maps[0].panTo([36.62,53.12],{animate:false});click(map,'.map-shell [aria-label="بازگشت نقشه به موقعیت واحد"]');await tick();assert.ok(map.maps[0].project(map.maps[0].getCenter()).distanceTo(map.maps[0].project(farmPoint))<1);
click(map,'#project-map .leaflet-marker-icon');await tick();assert.match(map.d.querySelector('.project-map-popup').textContent,/مرغداری.*میدان شهدا/);assert.ok(map.d.querySelector('.project-map-popup a').href.endsWith('destination='+farmPoint.join(',')));
const before=map.maps[0].getCenter();map.resizeMap('project-map',354,320);await tick();assert.ok(map.maps[0].project(map.maps[0].getCenter()).distanceTo(map.maps[0].project(before))<1);
map.state.openMap();await tick();await finishTiles(map,'osm','expanded-project-map');assert.ok(map.maps[1].project(map.maps[1].getCenter()).distanceTo(map.maps[1].project(farmPoint))<1);assert.ok(map.d.querySelector('.map-modal-footer a').href.endsWith('destination='+farmPoint.join(',')));assert.equal(map.d.querySelector('.map-modal-footer strong').textContent,'شهرستان ساری، میدان شهدا');map.state.closeModal();
map.state.openQr();await tick();assert.match(map.state.qrImage,/^data:image\/gif;base64,/);map.state.closeModal();
assert.doesNotMatch(mapScript,/cartocdn|basemaps\.carto|API_KEY|36\.57884|شهید بهشتی|محمد باقر/);
pass('Published farm map uses the Balad POI coordinates and address; pin, directions, fullscreen, zoom, recenter, resize and QR work.');

const mobile=await boot({},false,{point:testPoint,mobile:true});
const touch=(count,type='touchmove')=>{const e=new mobile.w.Event(type,{bubbles:true,cancelable:true});Object.defineProperty(e,'touches',{value:Array.from({length:count},()=>({clientX:100,clientY:100}))});mobile.d.querySelector('#project-map').dispatchEvent(e);};
touch(1);assert.equal(mobile.maps[0].dragging.enabled(),false);touch(2);assert.equal(mobile.maps[0].dragging.enabled(),true);touch(0,'touchend');
click(mobile,'.map-shell [aria-label="نمایش بزرگ نقشه"]');await tick();assert.equal(mobile.state.modal,'map');assert.equal(mobile.maps.length,2);assert.equal(mobile.maps[1].gestureHandling.enabled(),false);assert.equal(mobile.maps[1].getSize().x,390);
mobile.w.dispatchEvent(new mobile.w.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));await tick();assert.equal(mobile.state.modal,'');assert.equal(mobile.d.querySelector('#expanded-project-map .leaflet-pane'),null);
mobile.state.openMap();await tick();assert.equal(mobile.maps.length,3);mobile.state.closeModal();
const offline=await boot({},false,{point:testPoint,offline:true});await finishTiles(offline,'offline');assert.equal(offline.state.mapConnection,'offline');offline.state.openMap();await tick();await finishTiles(offline,'offline','expanded-project-map');assert.notEqual(offline.d.querySelector('.map-modal-footer button').style.display,'none');offline.state.closeModal();
Object.defineProperty(offline.w.navigator,'onLine',{value:true,configurable:true});offline.w.dispatchEvent(new offline.w.Event('online'));await tick();await finishTiles(offline);assert.equal(offline.state.mapConnection,'osm');
const partial=await boot({},false,{point:testPoint});await tick();liveTiles(partial)[0].onerror(new partial.w.Event('error'));await finishTiles(partial);assert.equal(partial.state.mapConnection,'partial');partial.state.retryMap();await tick();await finishTiles(partial);assert.equal(partial.state.mapConnection,'osm');
pass('Mobile two-finger map, fullscreen reopening, offline/reconnect and partial tile recovery work.');

const missing=await boot({},false,{point:null});assert.equal(missing.maps.length,0);assert.equal(missing.state.mapConnection,'pending');assert.notEqual(missing.d.querySelector('.map-empty').style.display,'none');assert.match(missing.state.directionsUrl,/maps\/search/);missing.state.openMap();assert.equal(missing.state.modal,'');
const sync=await boot();sync.w.localStorage.setItem(prefix+'citizen-reports',ctx.w.localStorage.getItem(prefix+'citizen-reports'));sync.w.dispatchEvent(new sync.w.StorageEvent('storage',{key:prefix+'citizen-reports'}));await tick();assert.equal(sync.state.citizenReports.length,2);assert.equal(sync.state.reports.length,2);
sync.w.localStorage.setItem(prefix+'reports',ctx.w.localStorage.getItem(prefix+'reports'));sync.w.dispatchEvent(new sync.w.StorageEvent('storage',{key:prefix+'reports'}));await tick();assert.equal(sync.state.completedCount,4);assert.equal(sync.state.citizenReports.length,2);
pass('Missing coordinates never produce a fabricated pin; public and inspector records sync independently between tabs.');

for(const match of html.matchAll(/(?:src|href)="\.\/([^"?]+)(?:\?[^"]*)?"/g))await stat(path.join('dist',match[1]));
const css=await readFile('dist/assets/styles.css','utf8');
for(const needle of ['.project-board','.stage-grid','.photo-lightbox','.citizen-type-options','prefers-reduced-motion'])assert.ok(css.includes(needle),needle);
for(const context of allContexts)assert.deepEqual(context.errors,[]);
for(const context of allContexts)context.dom.window.close();
pass('All local assets, responsive styles, image/report dialogs and Alpine expressions are valid.');
console.log('Completed '+checks+' integration checks. Browser visual QA and native image decoding remain unverified.');
