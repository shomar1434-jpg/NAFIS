(function () {
  'use strict';
  const PROFILE_KEY = 'safa_nafs_student_v1';
  const PROGRESS_KEY = 'safa_nafs_progress_v1';
  const config = window.NAFS_TEST_CONFIG || {};
  const read = (key, fallback) => {
    try { return JSON.parse(localStorage.getItem(key)) || fallback; } catch (_) { return fallback; }
  };
  const write = (key, value) => localStorage.setItem(key, JSON.stringify(value));
  const profile = read(PROFILE_KEY, null);

  if (!profile) {
    location.replace('../index.html?return=' + encodeURIComponent('tests/' + location.pathname.split('/').pop()));
    return;
  }

  const progress = read(PROGRESS_KEY, {});
  const current = progress[config.id] || {};
  if (!current.completed) {
    current.startedAt = current.startedAt || new Date().toISOString();
    current.title = config.title;
    current.grade = config.grade;
    progress[config.id] = current;
    write(PROGRESS_KEY, progress);
  }

  window.SafaProgress = {
    recordResult(result) {
      const all = read(PROGRESS_KEY, {});
      const old = all[config.id] || {};
      const percent = Math.max(0, Math.min(100, Number(result.percent || 0)));
      const timestamp = new Date().toISOString();
      all[config.id] = {
        ...old,
        title: config.title,
        grade: config.grade,
        attempts: Number(old.attempts || 0) + 1,
        completed: true,
        latestPercent: percent,
        bestPercent: Math.max(Number(old.bestPercent || 0), percent),
        correct: Number(result.correct || 0),
        total: Number(result.total || 0),
        lastCompletedAt: timestamp,
        level: percent >= 90 ? 'متميز' : percent >= 80 ? 'متقن' : percent >= 60 ? 'مجتاز' : 'يحتاج إلى مزيد من التدريب'
      };
      write(PROGRESS_KEY, all);
      setTimeout(addCertificateAction, 250);
    }
  };

  function addStudentBar() {
    const bar = document.createElement('div');
    bar.className = 'safa-student-bar';
    bar.innerHTML = '<div><strong>مدرسة الصفا المتوسطة بجازان</strong><span>الطالب: ' + escapeHtml(profile.name) + ' · ' + escapeHtml(config.title || '') + '</span></div><a href="../index.html">العودة إلى بوابة التدريبات</a>';
    document.body.prepend(bar);
    const style = document.createElement('style');
    style.textContent = '.safa-student-bar{position:sticky;top:0;z-index:999;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 18px;color:#fff;background:linear-gradient(135deg,#124f46,#0d7668);box-shadow:0 5px 18px rgba(0,0,0,.18);font-family:Tajawal,Cairo,Arial,sans-serif}.safa-student-bar strong,.safa-student-bar span{display:block}.safa-student-bar span{margin-top:2px;color:#d8eee9;font-size:12px}.safa-student-bar a{padding:8px 12px;border-radius:999px;color:#124f46;background:#fff;font-size:12px;font-weight:800;text-decoration:none;white-space:nowrap}.safa-certificate-link{display:inline-flex!important;align-items:center;justify-content:center;min-height:44px;margin:12px 6px;padding:10px 18px!important;border:0!important;border-radius:999px!important;color:#fff!important;background:#b28332!important;font:inherit!important;font-weight:900!important;text-decoration:none!important;box-shadow:0 8px 20px rgba(125,88,26,.25)}@media(max-width:560px){.safa-student-bar{align-items:flex-start;padding:9px 11px}.safa-student-bar strong{font-size:13px}.safa-student-bar a{padding:7px 9px;font-size:11px}}@media print{.safa-student-bar{display:none!important}}';
    document.head.appendChild(style);
  }

  function fillName() {
    ['playerName', 'nm'].forEach(id => {
      const input = document.getElementById(id);
      if (!input) return;
      input.value = profile.name;
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
  }

  function addCertificateAction() {
    if (document.querySelector('.safa-certificate-link')) return;
    const target = document.querySelector('#screenResults.active, #screen-result.active, #result.active, #screenResults, #screen-result, #result') || document.body;
    const link = document.createElement('a');
    link.className = 'safa-certificate-link';
    link.href = '../certificate.html?test=' + encodeURIComponent(config.id);
    const latest = read(PROGRESS_KEY, {})[config.id];
    link.textContent = latest?.latestPercent >= 60 ? 'عرض شهادة الاجتياز' : 'عرض شهادة التحفيز';
    target.appendChild(link);
  }

  function escapeHtml(value) {
    return String(value || '').replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
  }

  document.title = 'تدريبات نافس | ' + (config.title || '') + ' | مدرسة الصفا المتوسطة بجازان';
  addStudentBar();
  fillName();
})();
