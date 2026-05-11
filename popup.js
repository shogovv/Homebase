const root = document.getElementById('root');
const countEl = document.getElementById('count');
const langSwitch = document.getElementById('lang-switch');

// --- i18n ---

const i18n = {
  ja: {
    pinned: 'pinned',
    emptyTitle: 'ピン留めタブがありません',
    emptyDesc: 'タブを右クリック → Pin Tab でピン留めすると<br>ここに表示されます',
    helpToggle: '使い方を見る',
    step1: 'タブを右クリック → <strong>「Pin Tab」</strong> でピン留めする',
    step2: 'そのまま他のURLへ自由に移動できる',
    step3: 'リロード（<strong>⌘R</strong>）すると固定URLに戻る',
    step4: '<strong>「更新」</strong> ボタンで、現在のURLを新しい固定URLに変更できる',
    step5: '<strong>「解除」</strong> ボタンで、そのタブの固定URLを解除できる',
    helpTip: '<strong>💡 Tips:</strong> ピン留めを外すと固定URLも自動削除されます。ブラウザを再起動しても固定URLは保持されます。タブ名はクリックで編集できます。',
    update: '更新',
    fix: '固定',
    remove: '解除',
    goHome: '戻る',
    alreadyFixed: 'すでに現在のURLが固定されています',
    noTitle: '(タイトルなし)',
  },
  en: {
    pinned: 'pinned',
    emptyTitle: 'No pinned tabs',
    emptyDesc: 'Right-click a tab → Pin Tab to pin it,<br>and it will appear here',
    helpToggle: 'How to use',
    step1: 'Right-click a tab → <strong>"Pin Tab"</strong> to pin it',
    step2: 'Browse freely to any URL',
    step3: 'Reload (<strong>⌘R</strong>) to return to the fixed URL',
    step4: 'Press <strong>"Update"</strong> to set the current URL as the new fixed URL',
    step5: 'Press <strong>"Remove"</strong> to unpin the fixed URL',
    helpTip: '<strong>💡 Tips:</strong> Unpinning a tab also removes its fixed URL. Fixed URLs are preserved across browser restarts. Click tab names to edit.',
    update: 'Update',
    fix: 'Pin',
    remove: 'Remove',
    goHome: 'Go home',
    alreadyFixed: 'Already pinned to current URL',
    noTitle: '(No title)',
  },
};

let currentLang = 'ja';

function t(key) {
  return i18n[currentLang][key] || key;
}

async function loadLang() {
  const { lang } = await chrome.storage.local.get('lang');
  currentLang = lang || 'ja';
}

async function setLang(lang) {
  currentLang = lang;
  await chrome.storage.local.set({ lang });
}

function updateLangButtons() {
  langSwitch.querySelectorAll('.lang-opt').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.lang === currentLang);
  });
}

// --- Helpers ---

async function sendMessage(message) {
  return chrome.runtime.sendMessage(message);
}

function displayUrl(url) {
  if (!url) return '';
  try {
    const u = new URL(url);
    return u.hostname + (u.pathname !== '/' ? u.pathname : '') + u.search;
  } catch {
    return url;
  }
}

function getInitial(title, url) {
  if (title && title.trim()) return title.trim()[0].toUpperCase();
  try { return new URL(url).hostname[0].toUpperCase(); } catch { return '?'; }
}

// --- Help section ---

function buildHelp() {
  const toggle = document.createElement('div');
  toggle.className = 'help-toggle';
  toggle.innerHTML = `<span>${t('helpToggle')}</span><span class="arrow">▾</span>`;

  const body = document.createElement('div');
  body.className = 'help-body';
  body.hidden = true;
  body.innerHTML = `
    <div class="step">
      <div class="step-num">1</div>
      <div>${t('step1')}</div>
    </div>
    <div class="step">
      <div class="step-num">2</div>
      <div>${t('step2')}</div>
    </div>
    <div class="step">
      <div class="step-num">3</div>
      <div>${t('step3')}</div>
    </div>
    <div class="step">
      <div class="step-num">4</div>
      <div>${t('step4')}</div>
    </div>
    <div class="step">
      <div class="step-num">5</div>
      <div>${t('step5')}</div>
    </div>
    <div class="help-tip">
      ${t('helpTip')}
    </div>
  `;

  toggle.addEventListener('click', () => {
    const open = !body.hidden;
    body.hidden = open;
    toggle.classList.toggle('open', !open);
  });

  return [toggle, body];
}

// --- Main render ---

async function render() {
  const [pinnedMap, pinnedTabs, tabNames] = await Promise.all([
    sendMessage({ type: 'GET_PINNED_MAP' }),
    chrome.tabs.query({ pinned: true }),
    sendMessage({ type: 'GET_TAB_NAMES' }),
  ]);

  countEl.textContent = pinnedTabs.length > 0 ? `${pinnedTabs.length} ${t('pinned')}` : '';
  updateLangButtons();

  root.innerHTML = '';

  if (pinnedTabs.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'empty';
    empty.innerHTML = `<strong>${t('emptyTitle')}</strong>${t('emptyDesc')}`;
    root.appendChild(empty);
    const [toggle, body] = buildHelp();
    root.appendChild(toggle);
    root.appendChild(body);
    return;
  }

  const list = document.createElement('div');
  list.className = 'tab-list';

  for (const tab of pinnedTabs) {
    const fixedUrl = pinnedMap[String(tab.id)];
    const currentUrl = tab.url || '';
    const customName = tabNames[String(tab.id)] || '';

    let dotClass = 'gray';
    if (fixedUrl && currentUrl === fixedUrl) dotClass = 'green';
    else if (fixedUrl && currentUrl !== fixedUrl) dotClass = 'amber';

    const row = document.createElement('div');
    row.className = 'row';

    // Favicon
    const fav = document.createElement('div');
    fav.className = 'fav';
    if (tab.favIconUrl) {
      const img = document.createElement('img');
      img.src = tab.favIconUrl;
      img.onerror = () => { fav.textContent = getInitial(customName || tab.title, currentUrl); };
      fav.appendChild(img);
    } else {
      fav.textContent = getInitial(customName || tab.title, currentUrl);
    }

    // Info (upper line: dot + title)
    const info = document.createElement('div');
    info.className = 'info';

    const titleEl = document.createElement('div');
    titleEl.className = 'title';
    titleEl.title = tab.title || '';
    titleEl.innerHTML = `<span class="sdot ${dotClass}"></span>`;
    const titleText = document.createTextNode(customName || tab.title || t('noTitle'));
    titleEl.appendChild(titleText);

    titleEl.addEventListener('click', () => {
      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'title-input';
      input.value = customName || tab.title || '';
      input.placeholder = tab.title || t('noTitle');

      const commit = async () => {
        const newName = input.value.trim();
        const nameToSave = (newName && newName !== tab.title) ? newName : '';
        await sendMessage({ type: 'UPDATE_TAB_NAME', tabId: tab.id, name: nameToSave });
        await render();
      };

      input.addEventListener('blur', commit);
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') input.blur();
        if (e.key === 'Escape') { input.removeEventListener('blur', commit); render(); }
      });

      info.replaceChild(input, titleEl);
      input.focus();
      input.select();
    });

    info.appendChild(titleEl);

    // Actions
    const acts = document.createElement('div');
    acts.className = 'acts';

    const btnLabel = fixedUrl ? t('update') : t('fix');
    const isAlreadyFixed = fixedUrl && currentUrl === fixedUrl;

    if (fixedUrl) {
      const btnHome = document.createElement('button');
      btnHome.className = 'btn-h';
      btnHome.textContent = t('goHome');
      btnHome.disabled = currentUrl === fixedUrl;
      btnHome.addEventListener('click', async () => {
        btnHome.disabled = true;
        await chrome.tabs.update(tab.id, { url: fixedUrl });
        setTimeout(render, 300);
      });
      acts.appendChild(btnHome);
    }

    const btnUpdate = document.createElement('button');
    btnUpdate.className = 'btn-p';
    btnUpdate.textContent = btnLabel;
    btnUpdate.disabled = isAlreadyFixed;
    if (isAlreadyFixed) btnUpdate.title = t('alreadyFixed');
    btnUpdate.addEventListener('click', async () => {
      btnUpdate.disabled = true;
      await sendMessage({ type: 'UPDATE_FIXED_URL', tabId: tab.id, url: currentUrl });
      await render();
    });
    acts.appendChild(btnUpdate);

    if (fixedUrl) {
      const btnRemove = document.createElement('button');
      btnRemove.className = 'btn-g';
      btnRemove.textContent = t('remove');
      btnRemove.addEventListener('click', async () => {
        await sendMessage({ type: 'REMOVE_FIXED_URL', tabId: tab.id });
        await render();
      });
      acts.appendChild(btnRemove);
    }

    // URL (lower line: full-width)
    const urlEl = document.createElement('div');
    urlEl.className = 'url';
    urlEl.textContent = displayUrl(fixedUrl || currentUrl);

    row.appendChild(fav);
    row.appendChild(info);
    row.appendChild(acts);
    row.appendChild(urlEl);
    list.appendChild(row);
  }

  root.appendChild(list);

  const [toggle, body] = buildHelp();
  root.appendChild(toggle);
  root.appendChild(body);
}

// --- Language toggle ---

langSwitch.addEventListener('click', async (e) => {
  const btn = e.target.closest('.lang-opt');
  if (!btn || btn.dataset.lang === currentLang) return;
  await setLang(btn.dataset.lang);
  await render();
});

// --- Init ---

loadLang().then(render);
