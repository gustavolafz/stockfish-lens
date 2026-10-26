import { DEFAULTS, normalizeSettings, ARROW_SETTINGS, arrowPreference } from './settings.js';
import { renderPiece } from './pieces.js';
import { resetPanelLayout } from './panel-layout.js';

async function main() {
  document.getElementById('version').textContent = `Lens ${chrome.runtime.getManifest().version}`;
  document.querySelector('header > span').replaceChildren(renderPiece(document, 'N', 'w'));
  let noticeTimer;
  function notify(message, error = false) {
    clearTimeout(noticeTimer);
    const notice = document.getElementById('saved');
    notice.textContent = message;
    notice.dataset.error = String(error);
    noticeTimer = setTimeout(() => { notice.textContent = ''; }, 3200);
  }
  document.getElementById('customizeShortcuts').onclick = () => chrome.tabs.create({ url: 'chrome://extensions/shortcuts' });
  document.getElementById('resetLayout').onclick = async () => {
    try { await resetPanelLayout(); notify('Posição e tamanho restaurados.'); }
    catch { notify('Não foi possível restaurar o painel. Tente novamente.', true); }
  };
  const [shortcuts, stored] = await Promise.all([
    chrome.commands.getAll(), chrome.storage.local.get(DEFAULTS)
  ]);
  for (const name of ['toggle-arrow-1', 'toggle-arrow-2', 'toggle-arrow-3', 'toggle-all-arrows']) {
    const command = shortcuts.find(item => item.name === name);
    const dt = document.createElement('dt'), dd = document.createElement('dd'), key = document.createElement('kbd');
    dt.textContent = { 'toggle-arrow-1': '1º lance', 'toggle-arrow-2': '2º lance', 'toggle-arrow-3': '3º lance', 'toggle-all-arrows': 'Três melhores' }[name];
    key.textContent = command?.shortcut || 'Não definido';
    dd.append(key); document.getElementById('shortcutList').append(dt, dd);
  }
  let settings = normalizeSettings(stored);
  function sync() {
    document.documentElement.style.setProperty('--sf-font-scale', settings.fontScale / 100);
    for (const key of Object.keys(DEFAULTS)) {
      const input = document.getElementById(key);
      if (input.type === 'checkbox') input.checked = settings[key];
      else input.value = settings[key];
    }
    document.getElementById('enabledHint').textContent = settings.enabled ? 'Atualiza a cada posição do tabuleiro.' : 'Análise pausada. Seus ajustes continuam salvos.';
    document.getElementById('arrowHint').textContent = !settings.enabled ? 'Análise pausada. Retome para ver as setas.' :
      settings.mode === 'panel' ? 'Modo só painel. Selecione uma seta para exibi-la.' :
      !settings.showArrows ? 'Setas ocultas. Selecione um lance para mostrar.' : 'Escolha os lances que quer acompanhar.';
  }
  sync();
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !Object.keys(DEFAULTS).some(key => changes[key])) return;
    for (const key of Object.keys(DEFAULTS)) if (changes[key]) settings[key] = changes[key].newValue ?? DEFAULTS[key];
    settings = normalizeSettings(settings); sync();
  });
  for (const key of Object.keys(DEFAULTS)) {
    const input = document.getElementById(key);
    input.addEventListener('change', async () => {
      const patch = ARROW_SETTINGS.includes(key) ? arrowPreference(settings, key, input.checked) :
        { [key]: input.type === 'checkbox' ? input.checked : ['ms', 'multipv', 'fontScale', 'arrowScale'].includes(key) ? Number(input.value) : input.value };
      try { await chrome.storage.local.set(patch); notify('Preferências salvas.'); }
      catch { sync(); notify('Não foi possível salvar. Tente novamente.', true); }
    });
  }
}
main();
