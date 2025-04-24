(function () {
  const SPECIAL_DOMAINS = {
    "fshare.vn": "fshare",
    "liblib.art": "liblib",
    "4share.vn": "fourshare",
    "shakker.ai": "shakker",
    "civitai.com": "civitai"
  };

  const host = location.hostname;
  const matched = Object.keys(SPECIAL_DOMAINS).find(domain => host.includes(domain));
  if (!matched) return;

  const type = SPECIAL_DOMAINS[matched];

  function sendAuthInfo() {
    chrome.runtime.sendMessage({ action: "getCookies", url: location.href }, (cookieHeader) => {
      const payload = {
        payload: location.href + ">⩊<" + (cookieHeader || ""),
        type: type
      };

      console.log(`[EXT] Sending auth info for ${type}:`, payload);

      fetch("http://localhost:8123/handle_url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      })
        .then(() => console.log(`✅ Auth info sent for ${type}`))
        .catch((e) => console.warn(`❌ Failed to send auth info for ${type}`, e));
    });
  }

  function createDownloadModelButton() {
    if (document.getElementById("downloadModelBtn")) return;
  
    const button = document.createElement("div");
    button.id = "downloadModelBtn";
    button.innerText = "⬇️ Download Model";
    button.style.cssText = `
      position: fixed;
      top: 120px;
      left: auto;
      right: 20px;
      z-index: 999999;
      padding: 10px 16px;
      background: #009688;
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
  
    // 🖱️ Khi nhấn chuột vào nút
    button.addEventListener("mousedown", (e) => {
      isDragging = true;
      wasDragged = false;
      offsetX = e.clientX - button.getBoundingClientRect().left;
      offsetY = e.clientY - button.getBoundingClientRect().top;
      button.style.cursor = "move";
      e.preventDefault();
    });
  
    // 🧲 Di chuyển nút theo chuột
    document.addEventListener("mousemove", (e) => {
      if (isDragging) {
        const left = e.clientX - offsetX;
        const top = e.clientY - offsetY;
        button.style.left = `${left}px`;
        button.style.top = `${top}px`;
        button.style.right = "auto";
        wasDragged = true;
      }
    });
  
    // 🛑 Kết thúc kéo
    document.addEventListener("mouseup", () => {
      if (isDragging) {
        isDragging = false;
        button.style.cursor = "pointer";
      }
    });
  
    // ⬇️ Gửi model URL khi click
    button.addEventListener("click", () => {
      if (wasDragged) return;
      sendAuthInfo();
      alert("✅ Model URL sent to MassDownloader.");
    });
  
    document.body.appendChild(button);
  }
  
  
  

  window.addEventListener("load", () => {
    setTimeout(() => {
      createDownloadModelButton();
    }, 1000);
  });
})();
