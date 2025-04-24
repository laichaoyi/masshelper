(function () {
  if (!location.hostname.includes("stock.adobe.com")) return;

  const adobeAssetRegex = /^https:\/\/stock\.adobe\.com\/[a-z]{2}\/[^/]+\/[^/]+\/\d+/i;

  function getCurrentAssetUrl() {
    const url = location.href.split("?")[0];
    if (adobeAssetRegex.test(url)) {
      return url;
    }
    return null;
  }

  function sendAdobeStockUrl() {
    const assetUrl = getCurrentAssetUrl();
    if (!assetUrl) {
      alert("❌ Not the Adobe Stock asset detail page");
      return;
    }

    chrome.runtime.sendMessage({ action: "getCookies", url: assetUrl }, (cookieHeader) => {
      const payload = assetUrl + "||" + (cookieHeader || "");

      chrome.runtime.sendMessage({
        action: "send_adobe_url",
        payload: payload
      }, (response) => {
        if (response && response.ok) {
          alert("✅ Sent Adobe Stock URL to MassDownloader!");
        } else {
          alert("❌ Sent failed. Try again later!");
        }
      });
    });
  }

  function createAdobeButton() {
    if (document.querySelector("#adobeStockBtn")) return;
  
    const btn = document.createElement("div");
    btn.id = "adobeStockBtn";
    btn.innerText = "⬇️ Download Stock Adobe";
    btn.style.cssText = `
      position: fixed;
      top: 80px;
      right: 20px;
      z-index: 999999;
      padding: 10px 16px;
      background: #da1b1b;
      color: white;
      font-size: 14px;
      border-radius: 8px;
      box-shadow: 0 2px 6px rgba(0,0,0,0.3);
      cursor: pointer;
      font-weight: bold;
      user-select: none;
    `;
  
    let isDragging = false;
    let wasDragged = false;
    let offsetX = 0, offsetY = 0;
  
    btn.addEventListener("mousedown", (e) => {
      isDragging = true;
      wasDragged = false;
      offsetX = e.clientX - btn.getBoundingClientRect().left;
      offsetY = e.clientY - btn.getBoundingClientRect().top;
      btn.style.cursor = "move";
      e.preventDefault();
    });
  
    document.addEventListener("mousemove", (e) => {
      if (isDragging) {
        const left = e.clientX - offsetX;
        const top = e.clientY - offsetY;
        btn.style.left = `${left}px`;
        btn.style.top = `${top}px`;
        btn.style.right = "auto";
        btn.style.bottom = "auto";
        wasDragged = true;
      }
    });
  
    document.addEventListener("mouseup", () => {
      if (isDragging) {
        isDragging = false;
        btn.style.cursor = "pointer";
      }
    });
  
    btn.onclick = () => {
      if (wasDragged) return;
      sendAdobeStockUrl();
    };
  
    document.body.appendChild(btn);
  }
  

  function checkAndInit() {
    const currentUrl = location.href.split("?")[0];
    if (adobeAssetRegex.test(currentUrl)) {
      createAdobeButton();
    }
  }

  const pushState = history.pushState;
  history.pushState = function () {
    pushState.apply(history, arguments);
    setTimeout(checkAndInit, 500);
  };

  const replaceState = history.replaceState;
  history.replaceState = function () {
    replaceState.apply(history, arguments);
    setTimeout(checkAndInit, 500);
  };

  window.addEventListener("popstate", checkAndInit);
  window.addEventListener("load", () => {
    setTimeout(checkAndInit, 500);
  });
})();








  