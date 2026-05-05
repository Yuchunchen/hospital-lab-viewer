'use strict';

const DEFAULTS = {
  baseUrl:     'http://ernode.vghb12.vhtt.gov.tw:8000',
  opsid:       '',
  reportTitle: '臺北榮民總醫院玉里分院門診報告',
};

function $(id) { return document.getElementById(id); }

// Load saved settings into the form
function loadSettings() {
  chrome.storage.sync.get(['baseUrl', 'opsid', 'reportTitle'], (result) => {
    $('base-url').value     = result.baseUrl     || DEFAULTS.baseUrl;
    $('opsid').value        = result.opsid        || DEFAULTS.opsid;
    $('report-title').value = result.reportTitle  || DEFAULTS.reportTitle;
  });
}

// Save settings
$('save-btn')?.addEventListener('click', () => {
  const baseUrl     = $('base-url').value.trim().replace(/\/+$/, '');  // strip trailing slash
  const opsid       = $('opsid').value.trim().toUpperCase();
  const reportTitle = $('report-title').value.trim() || DEFAULTS.reportTitle;

  if (!baseUrl) {
    $('status').textContent = '請輸入 API 網址';
    $('status').style.color = '#c0392b';
    return;
  }
  if (!opsid) {
    $('status').textContent = '請輸入操作人員代號';
    $('status').style.color = '#c0392b';
    return;
  }

  chrome.storage.sync.set({ baseUrl, opsid, reportTitle }, () => {
    $('status').textContent = '已儲存 ✓';
    $('status').style.color = '#1e8449';
    setTimeout(() => { $('status').textContent = ''; }, 2000);
  });
});

// Reset to defaults
$('reset-btn')?.addEventListener('click', () => {
  $('base-url').value     = DEFAULTS.baseUrl;
  $('opsid').value        = DEFAULTS.opsid;
  $('report-title').value = DEFAULTS.reportTitle;
  $('status').textContent = '已還原預設值（尚未儲存）';
  $('status').style.color = '#e67e22';
});

document.addEventListener('DOMContentLoaded', loadSettings);
