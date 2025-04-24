(function () {
  if (!location.hostname.includes("dropbox.com")) return;

  let lastPath = "";
  let scrolled = false; // ✅ Đánh dấu người dùng đã scroll toàn trang hay chưa

  // 🔁 Auto scroll toàn trang để load hết file
  async function autoScrollToBottom() {
    return new Promise(resolve => {
      let lastLinkCount = 0;
      let attempts = 0;
      const maxAttempts = 10;

      const scrollAndCheck = () => {
        const currentLinks = document.querySelectorAll('a[href*="/scl/fo/"]');
        const currentCount = currentLinks.length;

        if (currentCount > lastLinkCount) {
          lastLinkCount = currentCount;
          scrolled = true; // ✅ Đã scroll ít nhất 1 lần
          attempts = 0;
          window.scrollTo(0, document.body.scrollHeight);
          setTimeout(scrollAndCheck, 600);
        } else if (attempts < maxAttempts) {
          attempts++;
          setTimeout(scrollAndCheck, 600);
        } else {
          resolve();
        }
      };

      scrollAndCheck();
    });
  }

  // 📥 Lấy danh sách link file Dropbox trong thư mục
  function extractDropboxFileLinks() {
    const anchors = Array.from(document.querySelectorAll('a[href*="/scl/fo/"]'));
    const links = anchors
      .map(a => a.href)
      .filter(link => {
        try {
          const url = new URL(link, location.origin);
          const path = url.pathname;
          return /^\/scl\/fo\/[^/]+\/[^/]+(?:\/[^/]+)*\/[^/]+\.[a-z0-9]+$/i.test(path);
        } catch {
          return false;
        }
      })
      .map(link => {
        try {
          const u = new URL(link, location.origin);
          u.searchParams.set("dl", "1");
          return u.href;
        } catch {
          return null;
        }
      })
      .filter(Boolean);

    return [...new Set(links)];
  }
  async function waitForFolderName(timeout = 1000) {
    return new Promise((resolve) => {
      const tryGet = () => {
        const container = document.querySelector('[data-testid="sl-folder-title"]');
        const target = container?.querySelector('[data-testid="digTruncateTooltipTrigger"]');
        const name = target?.innerText?.trim();
        return name || null;
      };
  
      const found = tryGet();
      if (found) return resolve(found);
  
      const observer = new MutationObserver(() => {
        const name = tryGet();
        if (name) {
          observer.disconnect();
          resolve(name);
        }
      });
  
      observer.observe(document.body, { childList: true, subtree: true });
  
      // Fallback sau timeout
      setTimeout(() => {
        observer.disconnect();
        resolve("UnknownFolder");
      }, timeout);
    });
  }
  
  
  

  
  // 📤 Gửi danh sách file về backend
  async function sendDropboxLinks() {
    await autoScrollToBottom(); // 🔥 Scroll thật sự đến hết
    const links = extractDropboxFileLinks();

    if (!links.length) {
      alert("❌ No Dropbox file links found.");
      return;
    }

    if (links.length < 5 && !scrolled) {
      alert("⚠️ Please scroll to the bottom of the page to ensure all files are loaded.");
      return;
    }
        // 📁 Lấy tên thư mục hiện tại
        const folderName = await waitForFolderName();


        
    try {
      chrome.runtime.sendMessage({
        action: "send_dropbox_links",
        links: links,
        folder: folderName  
      });
      
      alert(`✅ Sent ${links.length} Dropbox file(s) to MassDownloader.`);
    } catch (err) {
      console.warn("❌ Extension context invalidated. Reloading...", err);
      alert("⚠️ Extension expired. Page will reload...");
      setTimeout(() => location.reload(), 1000);
    }
  }

  // ⬇️ Gắn nút gửi
  function createDropboxButton() {
  if (document.querySelector("#dropboxBtn")) return;

  const btn = document.createElement("div");
  btn.id = "dropboxBtn";
  btn.innerText = "⬇️ Download Dropbox";
  btn.style.cssText = `
    position: fixed;
    top: 80px;
    right: 20px;
    z-index: 999999;
    padding: 10px 16px;
    background: #007ee5;
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

  btn.onclick = async () => {
    if (wasDragged) return;
  
    const originalText = btn.innerText;
    btn.innerText = "⏳ Extracting URLs...";
    btn.style.opacity = "0.6";
    btn.style.pointerEvents = "none";
  
    await sendDropboxLinks();
  
    btn.innerText = originalText;
    btn.style.opacity = "1";
    btn.style.pointerEvents = "auto";
  };
  

  document.body.appendChild(btn);
}


  // 🔁 Check khi URL thay đổi trong SPA
  function checkAndRescan() {
    const currentPath = location.pathname;
    if (currentPath !== lastPath) {
      lastPath = currentPath;
      scrolled = false; // reset scroll flag khi chuyển thư mục
      setTimeout(() => {
        createDropboxButton();
        const links = extractDropboxFileLinks();
        if (links.length) {
          console.log("📥 Found Dropbox links:", links);
        }
      }, 1000);
    }
  }

  // 📡 Hook SPA navigation
  const pushState = history.pushState;
  const replaceState = history.replaceState;
  history.pushState = function () {
    pushState.apply(history, arguments);
    checkAndRescan();
  };
  history.replaceState = function () {
    replaceState.apply(history, arguments);
    checkAndRescan();
  };
  window.addEventListener("popstate", checkAndRescan);

  // 🚀 Khởi chạy
  window.addEventListener("load", () => {
    checkAndRescan();

    const observer = new MutationObserver(() => {
      checkAndRescan();
    });

    observer.observe(document.body, { childList: true, subtree: true });
  });
})();
