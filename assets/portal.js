(function () {
  'use strict';

  const PROFILE_KEY = 'safa_nafs_student_v1';
  const PROGRESS_KEY = 'safa_nafs_progress_v1';
  const TESTS = {
    'grade3-primary-arabic': { title: 'لغتي الجميلة', grade: 'الصف الثالث الابتدائي', path: 'tests/grade3-primary-arabic.html' },
    'grade3-primary-math': { title: 'الرياضيات', grade: 'الصف الثالث الابتدائي', path: 'tests/grade3-primary-math.html' },
    'grade6-primary-arabic': { title: 'لغتي الجميلة', grade: 'الصف السادس الابتدائي', path: 'tests/grade6-primary-arabic.html' },
    'grade6-primary-science': { title: 'العلوم', grade: 'الصف السادس الابتدائي', path: 'tests/grade6-primary-science.html' },
    'grade6-primary-math': { title: 'الرياضيات', grade: 'الصف السادس الابتدائي', path: 'tests/grade6-primary-math.html' },
    'grade3-middle-arabic': { title: 'لغتي الجميلة', grade: 'الصف الثالث المتوسط', path: 'tests/grade3-middle-arabic.html' },
    'grade3-middle-science': { title: 'العلوم', grade: 'الصف الثالث المتوسط', path: 'tests/grade3-middle-science.html' },
    'grade3-middle-math': { title: 'الرياضيات', grade: 'الصف الثالث المتوسط', path: 'tests/grade3-middle-math.html' }
  };

  const read = (key, fallback) => {
    try { return JSON.parse(localStorage.getItem(key)) || fallback; } catch (_) { return fallback; }
  };
  const write = (key, value) => localStorage.setItem(key, JSON.stringify(value));
  const gate = document.getElementById('studentGate');
  const form = document.getElementById('studentForm');
  const closeButton = document.getElementById('closeStudentGate');

  function openGate(canClose) {
    const profile = read(PROFILE_KEY, null);
    if (profile) {
      document.getElementById('studentName').value = profile.name || '';
      document.getElementById('studentGrade').value = profile.grade || '';
      document.getElementById('studentClass').value = profile.classRoom || '';
      document.getElementById('studentNumber').value = profile.studentNumber || '';
    }
    closeButton.hidden = !canClose;
    gate.classList.add('open');
    setTimeout(() => document.getElementById('studentName').focus(), 50);
  }

  function closeGate() { gate.classList.remove('open'); }

  function profileId(name, number) {
    const base = (number || name || 'student').trim().replace(/\s+/g, '-');
    let hash = 0;
    for (let i = 0; i < base.length; i++) hash = ((hash << 5) - hash + base.charCodeAt(i)) | 0;
    return Math.abs(hash).toString(36).toUpperCase();
  }

  function render() {
    const profile = read(PROFILE_KEY, null);
    const progress = read(PROGRESS_KEY, {});
    if (!profile) { openGate(false); return; }

    document.getElementById('studentDashboard').hidden = false;
    document.getElementById('studentGreeting').textContent = 'مرحبًا ' + profile.name;
    document.getElementById('studentMeta').textContent = [profile.grade, profile.classRoom ? 'الفصل ' + profile.classRoom : ''].filter(Boolean).join(' · ');
    document.getElementById('studentAvatar').textContent = profile.name.trim().charAt(0) || 'ط';

    const values = Object.values(progress);
    const completed = values.filter(item => item && item.completed).length;
    const attempts = values.reduce((sum, item) => sum + Number(item?.attempts || 0), 0);
    const best = values.reduce((max, item) => Math.max(max, Number(item?.bestPercent || 0)), 0);
    const certificates = values.filter(item => item && item.completed).length;
    document.getElementById('completedCount').textContent = completed + '/8';
    document.getElementById('attemptsCount').textContent = attempts;
    document.getElementById('bestScore').textContent = best + '%';
    document.getElementById('certificateCount').textContent = certificates;

    Object.entries(TESTS).forEach(([id, test]) => {
      const link = document.querySelector('a[href="' + test.path + '"]');
      const card = link?.closest('.test-card');
      if (!card) return;
      let badge = card.querySelector('.test-progress');
      if (!badge) {
        badge = document.createElement('div');
        badge.className = 'test-progress';
        card.appendChild(badge);
      }
      const item = progress[id];
      if (item?.completed) {
        const statusClass = item.bestPercent >= 60 ? 'passed' : 'in-progress';
        badge.innerHTML = '<span class="' + statusClass + '">' + (item.bestPercent >= 60 ? 'مكتمل' : 'يحتاج تدريبًا') + '</span><strong>أفضل نتيجة ' + item.bestPercent + '%</strong>';
      } else if (item?.startedAt) {
        badge.innerHTML = '<span class="in-progress">قيد التقدم</span><span>لم يُستكمل بعد</span>';
      } else {
        badge.innerHTML = '<span class="not-started">لم يبدأ</span><span>ابدأ التدريب</span>';
      }
    });

    const list = document.getElementById('certificateList');
    list.innerHTML = '';
    Object.entries(progress).filter(([, item]) => item?.completed).sort((a, b) => new Date(b[1].lastCompletedAt) - new Date(a[1].lastCompletedAt)).forEach(([id, item]) => {
      const test = TESTS[id];
      if (!test) return;
      const row = document.createElement('div');
      row.className = 'certificate-row';
      row.innerHTML = '<span>' + test.title + ' · ' + test.grade + ' · ' + item.bestPercent + '%</span><a href="certificate.html?test=' + encodeURIComponent(id) + '">عرض الشهادة</a>';
      list.appendChild(row);
    });
    document.getElementById('certificateSection').hidden = !list.children.length;
  }

  form.addEventListener('submit', function (event) {
    event.preventDefault();
    const name = document.getElementById('studentName').value.trim();
    const grade = document.getElementById('studentGrade').value;
    const classRoom = document.getElementById('studentClass').value.trim();
    const studentNumber = document.getElementById('studentNumber').value.trim();
    if (!name || !grade) return;
    write(PROFILE_KEY, { id: profileId(name, studentNumber), name, grade, classRoom, studentNumber, school: 'مدرسة الصفا المتوسطة بجازان', updatedAt: new Date().toISOString() });
    closeGate();
    render();
    const params = new URLSearchParams(location.search);
    const target = params.get('return');
    if (target && /^tests\/[a-z0-9-]+\.html$/.test(target)) location.href = target;
  });

  document.getElementById('editStudentProfile').addEventListener('click', () => openGate(true));
  closeButton.addEventListener('click', closeGate);
  document.querySelectorAll('a[href^="tests/"]').forEach(link => {
    link.addEventListener('click', event => {
      if (!read(PROFILE_KEY, null)) {
        event.preventDefault();
        history.replaceState(null, '', '?return=' + encodeURIComponent(link.getAttribute('href')));
        openGate(false);
      }
    });
  });

  render();
})();
