const root = document.getElementById('root');
const countEl = document.getElementById('count');
const langBtn = document.getElementById('lang-btn');

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
    helpTip: '<strong>💡 Tips:</strong> ピン留めを外すと固定URLも自動削除されます。ブラウザを再起動しても固定URLは保持されます。',
    update: '更新',
    fix: '固定',
    remove: '解除',
    alreadyFixed: 'すでに現在のURLが固定されています',
    noTitle: '(タイトルなし)',
    langLabel: 'EN',
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
    helpTip: '<strong>💡 Tips:</strong> Unpinning a tab also removes its fixed URL. Fixed URLs are preserved across browser restarts.',
    update: 'Update',
    fix: 'Pin',
    remove: 'Remove',
    alreadyFixed: 'Already pinned to current URL',
    noTitle: '(No title)',
    langLabel: '日本語',
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
  const [pinnedMap, pinnedTabs] = await Promise.all([
    sendMessage({ type: 'GET_PINNED_MAP' }),
    chrome.tabs.query({ pinned: true }),
  ]);

  countEl.textContent = pinnedTabs.length > 0 ? `${pinnedTabs.length} ${t('pinned')}` : '';
  langBtn.textContent = t('langLabel');

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

    let dotClass = 'gray';
    if (fixedUrl && currentUrl === fixedUrl) dotClass = 'green';
    else if (fixedUrl && currentUrl !== fixedUrl) dotClass = 'amber';

    const row = document.createElement('div');
    row.className = 'row';

    const fav = document.createElement('div');
    fav.className = 'fav';
    if (tab.favIconUrl) {
      const img = document.createElement('img');
      img.src = tab.favIconUrl;
      img.onerror = () => { fav.textContent = getInitial(tab.title, currentUrl); };
      fav.appendChild(img);
    } else {
      fav.textContent = getInitial(tab.title, currentUrl);
    }

    const info = document.createElement('div');
    info.className = 'info';

    const titleEl = document.createElement('div');
    titleEl.className = 'title';
    titleEl.title = tab.title || '';
    titleEl.innerHTML = `<span class="sdot ${dotClass}"></span>`;
    titleEl.appendChild(document.createTextNode(tab.title || t('noTitle')));

    info.appendChild(titleEl);

    const acts = document.createElement('div');
    acts.className = 'acts';

    const btnLabel = fixedUrl ? t('update') : t('fix');
    const isAlreadyFixed = fixedUrl && currentUrl === fixedUrl;

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

langBtn.addEventListener('click', async () => {
  await setLang(currentLang === 'ja' ? 'en' : 'ja');
  await render();
});

// --- Init ---

loadLang().then(render);
