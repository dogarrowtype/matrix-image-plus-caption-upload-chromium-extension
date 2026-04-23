'use strict';

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'open-matrix-popup',
    title: 'Matrix Image + Caption',
    contexts: ['all']
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === 'open-matrix-popup') {
    // Get the current window to position the popup near it
    const currentWindow = await chrome.windows.getCurrent();
    const width = 400;
    const height = 600;
    const left = Math.round((currentWindow.width - width) / 2 + currentWindow.left);
    const top = Math.round((currentWindow.height - height) / 2 + currentWindow.top);

    await chrome.windows.create({
      url: chrome.runtime.getURL('popup.html'),
      type: 'popup',
      width: width,
      height: height,
      left: left,
      top: top
    });
  }
});
