(() => {
  'use strict';
  const types = {
    broiler: { name: 'مرغداری گوشتی', title: 'احداث واحد مرغداری گوشتی', capacityUnit: 'قطعه در هر دوره', spacesLabel: 'تعداد سالن‌ها', spaceNoun: 'سالن' },
    dairy: { name: 'گاوداری شیری', title: 'احداث واحد گاوداری شیری', capacityUnit: 'رأس', spacesLabel: 'تعداد جایگاه‌ها', spaceNoun: 'جایگاه' },
    livestock: { name: 'پرواربندی دام', title: 'احداث واحد پرواربندی دام', capacityUnit: 'رأس در هر دوره', spacesLabel: 'تعداد جایگاه‌ها', spaceNoun: 'جایگاه' },
  };
  const project = {
    id: 'AG-1405-001', number: 'AG–1405–001', kind: 'broiler',
    name: 'مرغداری فخرالدین کشیری', owner: 'فخرالدین کشیری', category: 'کشاورزی و دامپروری',
    license: 'DEMO–1405–02187', capacity: 30000, spaces: 3, landArea: 12000, builtArea: 3800,
    supervisingAgency: 'سازمان نظام مهندسی کشاورزی و منابع طبیعی مازندران',
    startDate: '2026-09-23', duration: '۶ ماه', state: 'در حال احداث',
    supervisor: { name: 'مهندس رضا شریفی', role: 'ناظر ساخت', specialty: 'مهندسی کشاورزی', license: 'DEMO–AG–۱۰۴۸۷۱', initials: 'ر ش' },
    location: {
      coordinates: [36.6106937, 53.1022981],
      address: 'شهرستان ساری، میدان شهدا',
      sourceUrl: 'https://balad.ir/p/PXW3kWHIxTy5Jx',
      zoom: 16,
    },
  };
  const unit = types[project.kind];
  const stages = [
    { id: '1', shortTitle: 'جانمایی و آماده‌سازی', title: 'جانمایی و آماده‌سازی زمین', description: 'بررسی محل استقرار واحد، جانمایی فضاها و آماده‌سازی محوطه.', icon: 'scan-line', checks: [
      { id: 'site', label: 'محدوده زمین و محل استقرار واحد بررسی شد' },
      { id: 'layout', label: `جانمایی ${unit.spaceNoun}‌ها و فضاهای خدماتی بررسی شد` },
      { id: 'access', label: 'دسترسی و مسیرهای ورود و خروج بررسی شد' },
    ] },
    { id: '2', shortTitle: 'پی و اسکلت', title: `پی و اسکلت ${unit.spaceNoun}‌ها`, description: 'بازدید از عملیات پی، کف، اسکلت و پوشش سقف فضاهای اصلی.', icon: 'construction', checks: [
      { id: 'foundation', label: 'جانمایی و ابعاد پی‌ها و پایه‌ها بررسی شد' },
      { id: 'frame', label: `اجرای کف و اسکلت ${unit.spaceNoun}‌ها بررسی شد` },
      { id: 'roof', label: 'پوشش سقف و اتصالات اجراشده بررسی شد' },
    ] },
    { id: '3', shortTitle: 'فضاها و تأسیسات', title: `${unit.spaceNoun}‌ها و تأسیسات`, description: 'بررسی تکمیل فضاها، تأسیسات و تجهیزات متناسب با نوع واحد.', icon: 'settings-2', checks: [
      { id: 'enclosure', label: 'دیوارها، بازشوها و فضاهای خدماتی بررسی شد' },
      { id: 'equipment', label: project.kind === 'broiler' ? 'جانمایی تهویه، دانخوری و آبخوری بررسی شد' : 'جانمایی تجهیزات، آخورها و آبشخورها بررسی شد' },
      { id: 'utilities', label: 'آبرسانی، برق و سامانه‌های گرمایش و تهویه بررسی شد' },
    ] },
    { id: '4', shortTitle: 'بازدید نهایی', title: 'بازدید نهایی و جمع‌بندی ساخت', description: 'جمع‌بندی عملیات اجرایی، مدارک و موارد باقی‌مانده پیش از بهره‌برداری.', icon: 'clipboard-check', checks: [
      { id: 'completion', label: `وضعیت تکمیل ${unit.spaceNoun}‌ها و فضاهای خدماتی بررسی شد` },
      { id: 'readiness', label: 'وضعیت آماده‌سازی تأسیسات و تجهیزات بررسی شد' },
      { id: 'closeout', label: 'مدارک، نواقص و اقدامات باقی‌مانده جمع‌بندی شد' },
    ] },
  ];
  const report = (id, stageId, visitDate, progress, body) => ({
    id, code: `AG–R0${stageId}–001`, stageId, title: `گزارش ${stages[Number(stageId) - 1].title}`,
    author: project.supervisor.name, role: project.supervisor.role, date: `${visitDate}T09:00:00+03:30`, visitDate, progress,
    outcome: 'بدون مغایرت', checked: stages[Number(stageId) - 1].checks.map(item => item.id), body, followUp: '', ownerPhone: '',
  });
  const seedReports = [
    report('SEED-02', '2', '2026-10-10', 45, `عملیات پی و اسکلت ${unit.spaceNoun}‌های واحد در بازدید نمونه بررسی شد.\n\nجانمایی پایه‌ها، اجرای کف و وضعیت پوشش سقف با مدارک نمونه پرونده تطبیق داده شد. نتیجه این بازدید نمایشی بدون مغایرت ثبت شده است.\n\nاین متن، گزارش واقعی این مرکز یا تأیید فنی عملیات اجرایی نیست.`),
    report('SEED-01', '1', '2026-09-28', 15, `محدوده استقرار واحد و جانمایی ${unit.spaceNoun}‌ها، انبار و فضاهای خدماتی در بازدید نمونه بررسی شد.\n\nمسیر دسترسی و ورودی‌های محوطه در نقشه جانمایی مرور و صورت‌جلسه آغاز نظارت در پرونده نمونه ثبت شد.\n\nاین متن صرفاً برای نمایش جریان ثبت گزارش ناظر ساخت است.`),
  ];
  const documents = [
    { id: 'DOC-01', code: project.license, title: 'پروانه تأسیس واحد', author: 'مرجع صدور پروانه ـ نمونه', date: '2026-09-16', subject: 'مجوز تأسیس', icon: 'badge-check', description: 'مشخصات و ظرفیت پرونده نمونه', body: `عنوان طرح: ${unit.title}\nنام واحد: ${project.name}\nکارفرما: ${project.owner}\nشماره پروانه نمایشی: ${project.license}\nظرفیت نمونه: ${project.capacity} ${unit.capacityUnit}\n\nاین سند صرفاً نمونه نمایشی است؛ پروانه واقعی صادرشده برای این مرکز نیست و اعتبار اداری ندارد.` },
    { id: 'DOC-02', code: 'DEMO–SITE–001', title: 'طرح جانمایی واحد', author: 'پرونده نمونه پروژه', date: '2026-09-20', subject: 'جانمایی و استقرار فضاها', icon: 'map', description: `${project.spaces} ${unit.spaceNoun} و فضاهای خدماتی`, body: `طرح جانمایی نمونه ${project.name}\n\nاجزای پیش‌بینی‌شده برای نمایش:\n• ${project.spaces} ${unit.spaceNoun} اصلی\n• انبار و فضای نگهداری نهاده\n• فضای خدماتی و تأسیسات\n• مسیرهای ورود و خروج و محوطه\n\nاین مدرک توضیح متنی نمونه است؛ نقشه اجرایی یا پیوست واقعی ندارد.` },
    { id: 'DOC-03', code: 'DEMO–PLAN–001', title: 'برنامه زمان‌بندی اجرا', author: 'کارفرما ـ پرونده نمونه', date: '2026-09-23', subject: 'برنامه ساخت و بازدیدها', icon: 'calendar-range', description: 'اجرای نمونه در چهار مرحله نظارت', body: `مدت اجرای پیش‌بینی‌شده: ${project.duration}\nشروع پروژه نمونه: ۱ مهر ۱۴۰۵\n\nچهار مرحله ثبت گزارش:\n${stages.map((stage, i) => `${i + 1}. ${stage.title}`).join('\n')}\n\nاین زمان‌بندی و عنوان مراحل برای این نمونه تنظیم شده‌اند و جایگزین برنامه یا فرم مصوب دستگاه نظارت نیستند.` },
  ];
  const letters = [
    { id: 'LET-03', number: 'نمونه–۱۴۰۵/۰۲۸', title: 'هماهنگی بازدید فضاها و تأسیسات', author: 'دستگاه نظارت ـ نمونه', recipient: 'ناظر ساخت', subject: 'بازدید مرحله سوم', date: '2026-10-15', body: `ناظر ساخت محترم ${project.name}\n\nزمان بازدید از فضاها، تأسیسات و تجهیزات واحد با کارفرما هماهنگ و نتیجه بازدید در گزارش مرحله سوم ثبت شود. موارد باقی‌مانده و اقدامات پیگیری نیز در گزارش درج گردد.\n\nاین نامه نمونه است و اعتبار اداری ندارد.` },
    { id: 'LET-02', number: 'نمونه–۱۴۰۵/۰۱۹', title: 'اعلام آمادگی برای بازدید پی و اسکلت', author: 'کارفرما ـ نمونه', recipient: 'ناظر ساخت', subject: 'درخواست بازدید مرحله دوم', date: '2026-10-08', body: `ناظر ساخت محترم\n\nعملیات پی و اسکلت ${unit.spaceNoun}‌های پروژه نمونه برای بازدید آماده اعلام می‌شود. خواهشمند است بازدید مرحله دوم انجام و مشاهدات در پرونده ثبت شود.\n\nاین مکاتبه صرفاً داده نمونه رابط کاربری است.` },
    { id: 'LET-01', number: 'نمونه–۱۴۰۵/۰۰۷', title: 'معرفی ناظر ساخت و آغاز نظارت', author: 'دستگاه نظارت ـ نمونه', recipient: project.owner, subject: 'معرفی ناظر ساخت', date: '2026-09-23', body: `کارفرمای محترم ${project.name}\n\nدر پرونده نمایشی، ${project.supervisor.name} با تخصص ${project.supervisor.specialty} به‌عنوان ناظر ساخت معرفی شده است. هماهنگی بازدیدها و ثبت گزارش هر چهار مرحله از طریق پرونده پروژه انجام می‌شود.\n\nنام ناظر، شماره‌ها و این نامه نمونه‌اند و انتصاب واقعی ایجاد نمی‌کنند.` },
  ];
  window.AgriProject = { project, unit, stages, seedReports, documents, letters };
})();
