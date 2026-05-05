'use strict';

// Loads the generated report HTML from chrome.storage.local and shows it
// inside an iframe (srcdoc). The print button prints the iframe content.
//
// We MUST use an external script + iframe (rather than inline <script> +
// document.write) because chrome-extension:// pages enforce a strict default
// CSP that blocks inline scripts and inline event handlers.

(function () {
  const frame  = document.getElementById('report-frame');
  const empty  = document.getElementById('empty');
  const btn    = document.getElementById('print-btn');

  function showEmpty() {
    if (frame) frame.style.display = 'none';
    if (empty) empty.style.display = 'block';
    if (btn)   btn.disabled = true;
  }

  chrome.storage.local.get(['reportHtml'], (result) => {
    if (chrome.runtime.lastError || !result || !result.reportHtml) {
      showEmpty();
      return;
    }
    // srcdoc renders the complete HTML document inside the iframe with its
    // own about:srcdoc origin — outside the extension page's CSP.
    frame.srcdoc = result.reportHtml;
  });

  btn?.addEventListener('click', () => {
    try {
      if (frame && frame.contentWindow) {
        frame.contentWindow.focus();
        frame.contentWindow.print();
      } else {
        window.print();
      }
    } catch (e) {
      window.print();
    }
  });
})();
