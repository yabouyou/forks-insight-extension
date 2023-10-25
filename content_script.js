window.addEventListener('load', function() {
    chrome.runtime.sendMessage({ action: 'clearPopupState' });
    
});