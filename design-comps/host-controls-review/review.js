(() => {
  const params = new URLSearchParams(location.search);
  const phases = {
    between: ['Between rounds', 'Choose, then prepare.', 'Contestant and tier choice lead. Display setup and score history no longer sit between you and Prepare.'],
    ready: ['Screenshot ready', 'Ready means one next action.', 'The private answer and primary readiness are visible beside Reveal. The clue stays hidden until you start.'],
    guessing: ['Guessing', 'Judge without scrolling past setup.', 'Time, answer and large Correct / Incorrect controls lead. Pause is separate; Skip / Void sits under Round options.'],
    expired: ['Time expired', 'No ambiguous late Correct.', 'Time stays at zero. Crediting an answer requires the explicit before-buzzer attestation.'],
    recovery: ['Screenshot ready · blocked', 'The blocker lives beside the button.', 'Primary readiness, host connection loss and pending command review are shown together. Reveal stays disabled.'],
    paused: ['Round paused', 'Resume the saved remainder.', 'Readiness and preserved time precede Resume. Nothing automatically restarts.'],
    saved: ['Judgment saved', 'Keep the suspense.', 'Saved points appear privately. Reveal Result is a separate action; the contestant still sees the frozen clue.'],
    revealed: ['Result revealed', 'Advance deliberately.', 'The result is already public. Advance returns to contestant/tier choice without automatically preparing another screenshot.']
  };
  if (!params.has('frame')) {
    const phase = document.querySelector('#phase');
    const viewport = document.querySelector('#viewport');
    const text = document.querySelector('#large-text');
    const frame = document.querySelector('#preview');
    const update = () => {
      const [width, height] = viewport.value.split(',');
      frame.style.width = width + 'px'; frame.style.height = height + 'px';
      frame.src = `review.html?frame=1&phase=${phase.value}${text.checked ? '&large=1' : ''}`;
      document.querySelector('#note-title').textContent = phases[phase.value][1];
      document.querySelector('#note-body').textContent = phases[phase.value][2];
    };
    [phase, viewport, text].forEach(control => control.addEventListener('change', update));
    window.addEventListener('message', event => {
      if (event.source === frame.contentWindow && event.data === 'preview-action') {
        document.querySelector('#preview-feedback').textContent = 'Sample action selected. No game command was sent. Use Game state above to preview the next phase.';
      }
    });
    return;
  }
  document.querySelector('#review').hidden = true;
  const root = document.querySelector('#host-preview'); root.hidden = false;
  const phase = Object.hasOwn(phases, params.get('phase')) ? params.get('phase') : 'between';
  if (params.has('large')) document.documentElement.classList.add('large-text');
  const button = (label, kind = '', disabled = false) => `<button type="button" class="${kind}" ${disabled ? 'disabled' : ''}>${label}</button>`;
  const scores = '<div class="score-strip" aria-label="Sample scores"><span>WoodTheRef <b>4 pts</b></span><span>Alex <b>2 pts</b></span></div>';
  const answer = `<div class="private-answer"><p class="eyebrow">Private host answer</p><strong>Chris Jericho vs HOOK</strong><p class="muted">AEW · All In · 2024</p><details><summary>Full match details / filming preview</summary><p>FTW Championship · Frozen answer from this sample round. Full optional details stay here.</p></details></div>`;
  const roundOptions = `<details class="round-options"><summary>Round options · Skip / Void</summary><div class="disclosure-content"><label class="field">Reason<select><option>Skip · contestant passed</option><option>Void · invalid clue</option></select></label>${button('Skip / Void · zero points')}</div></details>`;
  let content;
  if (phase === 'between') {
    content = `<label class="field">Active contestant<select><option>WoodTheRef</option><option>Alex</option></select></label>
      <fieldset class="tier-choices"><legend>Choose game tier</legend>${[['Easy', '1 point', '3 screenshots · 1 match'], ['Medium', '2 points', '6 screenshots · 2 matches'], ['Hard', '3 points', '4 screenshots · 1 match']].map(([name, points, count], i) => `<label class="tier-option"><input type="radio" name="tier" ${i === 1 ? 'checked' : ''}><span><strong>${name} · ${points}</strong><small>${count}</small></span></label>`).join('')}</fieldset>
      <p class="muted">Eligible unseen content · last server assessment. Counts are not guaranteed future rounds.</p>
      <div class="action-area">${button('Prepare screenshot', 'primary')}${button('Refresh availability')}</div>`;
  } else {
    const time = phase === 'expired' ? '00:00' : ['guessing', 'paused', 'saved', 'revealed'].includes(phase) ? '00:18' : null;
    const timingLabel = phase === 'guessing' ? 'Server time · sample frozen for layout review' : phase === 'paused' ? 'Paused · preserved remainder' : phase === 'expired' ? 'Time up · waiting for host judgment' : 'Stopped at judgment';
    content = `${time ? `<div class="timer"><b>${time}</b><span>${timingLabel}</span></div>` : '<p class="muted">Screenshot stays hidden until Reveal &amp; start.</p>'}${answer}`;
    if (phase === 'recovery') content += `<div class="recovery" id="blocker"><strong>Host connection lost</strong><p>Primary display: connected, decoded and synchronized.</p><p>A previous command needs review. New commands are blocked until its outcome is resolved.</p>${button('Take host control / reconnect')}${button('Check command status')}<p>Retry and dismissal appear only when receipt review permits them.</p></div>`;
    else if (phase === 'ready' || phase === 'paused') content += '<p class="good muted">✓ Primary connected · decoded and synchronized</p>';
    if (phase === 'ready' || phase === 'recovery') content += `<div class="action-area">${button('Reveal &amp; start', 'primary', phase === 'recovery')}${button('Cancel preparation', '', phase === 'recovery')}</div>`;
    if (phase === 'guessing') content += `<div class="action-area"><div class="judgment-pair">${button('✓ Correct', 'correct')}${button('✕ Incorrect', 'incorrect')}</div>${button('Pause')}</div>${roundOptions}`;
    if (phase === 'expired') content += `<p class="muted">Was an answer spoken before the buzzer?</p><div class="action-area">${button('Correct before buzzer — I confirm a timely answer', 'correct')}${button('Confirm timeout · no credit')}</div>${roundOptions}`;
    if (phase === 'paused') content += `<div class="action-area">${button('Resume · remaining time only', 'primary')}</div>${roundOptions}`;
    if (phase === 'saved') content += `<p class="good">Correct · 2 points saved</p><p class="muted">Contestant still sees the clue and frozen time. Result and answer stay concealed.</p><div class="action-area">${button('Reveal Result', 'primary')}</div>`;
    if (phase === 'revealed') content += `<p class="good">Correct · 2 points · result revealed</p><div class="action-area">${button('Advance', 'primary')}</div>`;
  }
  const support = `<aside class="support" aria-label="Supporting controls">
    <details><summary>Display connection · ${phase === 'recovery' ? 'primary ready / host offline' : 'Primary ready'}</summary><div class="disclosure-content">
      <p>Display 1 · Primary · Connected<br>Decoded and synchronized</p>
      <label><input type="checkbox" checked disabled> Use new link as the primary display</label>
      ${button('Create contestant display link', '', phase !== 'between' && phase !== 'paused')}
      ${button('Open contestant display')}
      <p class="sample-link">Sample contestant URL appears here. No real viewer token is stored in this preview.</p>
      <div class="qr-placeholder">QR code area<br>Sample placeholder only</div>
      ${button('Refresh LAN address')}
      <p>Manual LAN origin and validated configuration controls remain here.</p>
    </div></details>
    <details><summary>Score details · WoodTheRef 4 / Alex 2</summary><div class="disclosure-content"><div class="score-row"><strong>WoodTheRef</strong><span>4 points</span></div><div class="score-row"><strong>Alex</strong><span>2 points</span></div><p>Latest turn outcomes and committed host totals remain available here.</p></div></details>
    <details><summary>Game options</summary><div class="disclosure-content"><p class="muted">Sample session identity</p>${button('End game', '', !['between', 'saved', 'revealed'].includes(phase))}<p>End game asks for confirmation; resolve or cancel an active attempt first.</p>${button('Release host control', '', phase === 'recovery')}<p>Release does not turn this tab into a contestant display.</p></div></details>
  </aside>`;
  root.innerHTML = `<main class="host-shell"><header class="host-header"><img class="brand" src="../../public/images/name-that-match-horizontal-logo.png" alt="Name That Match"><details class="navigation"><summary>Menu</summary><nav class="navigation-content" aria-label="Preview navigation">${button('Play')}${button('Image Library')}${button('System')}</nav></details></header>
    <p class="connection-strip ${phase === 'recovery' ? 'warning-text' : ''}">${phase === 'recovery' ? 'Host offline · request needs review' : 'Host connected · primary ready'} · Sample</p>
    <div class="host-layout"><section class="console" aria-label="Host round console"><p class="eyebrow">Play · host controls</p><h1>${phases[phase][0]}</h1>${phase !== 'between' ? '<div class="round-identity"><strong>WoodTheRef</strong><span class="tier-label">Medium · 2 points</span></div>' : ''}${scores}${content}</section>${support}</div><p class="preview-caption">Design preview · sample data · no game connection</p></main>`;
  root.addEventListener('click', event => {
    if (event.target.closest('button')) window.parent.postMessage('preview-action', '*');
  });
})();
