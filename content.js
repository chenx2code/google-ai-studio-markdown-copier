(function() {
  'use strict';

  let conversationHistory = null;
  let promptTitle = chrome.i18n.getMessage('promptTitleDefault');

  /**
   * PART 1: 脚本注射器
   */
  const s = document.createElement('script');
  s.src = chrome.runtime.getURL('interceptor.js');
  s.onload = function() { this.remove(); };
  (document.head || document.documentElement).appendChild(s);

  /**
   * PART 2: 消息监听器
   */
  window.addEventListener('message', function(event) {
    if (event.source === window && event.data && event.data.type === 'FROM_INTERCEPTOR') {
      
      const data = event.data.payload;
      const apiKeyword = event.data.apiKeyword;

      try {
        let turns = null;
        let promptData = null;

        if (apiKeyword === 'ResolveDriveResource') {
          turns = data?.[0]?.[13]?.[0];
          promptData = data?.[0]?.[4];
        } else if (apiKeyword === 'UpdatePrompt' || apiKeyword === 'CreatePrompt') {
          turns = data?.[13]?.[0];
          promptData = data?.[4];
        }

        // 提取对话历史
        if (turns && Array.isArray(turns)) {
          conversationHistory = turns;
        }

        // 提取标题
        if (promptData && promptData[0]) {
          promptTitle = promptData[0];
        }

      } catch (e) {
        console.error('处理接收到的数据时出错:', e);
      }
    }
  });

  /**
   * PART 3: 核心导出功能 
   */
  function exportToMarkdown() {
    if (!conversationHistory) {
      alert(chrome.i18n.getMessage('errorNoDataSource'));
      return;
    }
    let markdownOutput = `# ${promptTitle}\n\n`;
    conversationHistory.forEach(turn => {
        if (!Array.isArray(turn) || turn.length < 9) return;
        const content = turn[0] || '';
        const role = turn[8];
        const finalContent = turn[2] && typeof turn[2] === 'string' ? turn[2] : content;
        if (role === 'user' && content) markdownOutput += `## ${content}\n\n`;
        else if (role === 'model' && finalContent) markdownOutput += `${finalContent}\n\n---\n\n`;
    });
    navigator.clipboard.writeText(markdownOutput.trim()).then(() => {
      alert(chrome.i18n.getMessage('successCopied'));
    }).catch(err => {
      console.error('Failed to copy text: ', err);
    });
  }

  /**
   * PART 4: UI注入逻辑
   */
    function checkAndInjectButton() {
      const targetUrlPattern = /^https:\/\/aistudio\.google\.com\/prompts\/.+$/;
      const currentUrl = window.location.href;
      const existingButton = document.getElementById('export-markdown-btn');

      if (!targetUrlPattern.test(currentUrl)) {
        if (existingButton) {
          existingButton.remove();
        }
        return;
      }

      if (existingButton) {
        // Button already exists and URL matches, no need to re-inject
        return;
      }

      const tooltipText = chrome.i18n.getMessage('tooltipCopyMarkdown');
      const injectionInterval = setInterval(() => {
        const toolbar = document.querySelector('ms-toolbar .toolbar-container');
        if (toolbar) {
            clearInterval(injectionInterval);
            const exportButton = document.createElement('button');
            exportButton.id = 'export-markdown-btn';
            exportButton.setAttribute('aria-label', tooltipText);
            exportButton.setAttribute('aria-describedby', 'export-markdown-tooltip');

            const icon = document.createElement('span');
            icon.className = 'material-symbols-outlined';
            icon.innerText = 'markdown_copy';
            
            const tooltip = document.createElement('span');
            tooltip.id = 'export-markdown-tooltip';
            tooltip.className = 'custom-tooltip-text';
            tooltip.setAttribute('role', 'tooltip');
            tooltip.innerText = tooltipText;
            
            exportButton.appendChild(icon);
            exportButton.appendChild(tooltip);
            exportButton.addEventListener('click', exportToMarkdown);
            const moreButton = toolbar.querySelector('button[aria-label="View more actions"]');
            if (moreButton) toolbar.insertBefore(exportButton, moreButton);
            else toolbar.appendChild(exportButton);
        }
      }, 500);
    }

    function initialize() {
      checkAndInjectButton();

      // Monitor URL changes for single-page applications
      let lastUrl = window.location.href;
      const observer = new MutationObserver(() => {
        if (window.location.href !== lastUrl) {
          lastUrl = window.location.href;
          checkAndInjectButton();
        }
      });
      observer.observe(document.body, { childList: true, subtree: true });
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initialize);
    } else {
      initialize();
    }
})();