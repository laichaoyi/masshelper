// == image-content.js ==

const SUPPORTED_IMG_SITES = [
  "artstation.com", "deviantart.com", "danbooru.donmai.us", "gelbooru.com", "imgbb.com","facebook.com",
  "flickr.com", "imgur.com", "instagram.com", "twitter.com", "pixiv.net", "discord.com", "tiktok.com",
  "tumblr.com", "zerochan.net", "yande.re", "rule34.xxx", "e621.net", "500px.com", "smugmug.com",
  "x.com", "fbcdn.net", "facebook.com", "civitai.com", "weibo.com", "behance.net","imgbox.com","webtoons.com",
  "unsplash.com", "wikimedia.org","myportfolio.com","deviantart.com","pinterest.com","vsco.co"
];

function isImageSite() {
  return SUPPORTED_IMG_SITES.some(site => {
    const host = location.hostname;
    return host === site || host.endsWith("." + site);
  });
}


function getCookies(url) {
  return new Promise(resolve => {
    chrome.runtime.sendMessage({ action: "getCookies", url }, resolve);
  });
}

function sendCurrentPageToApp() {
  const currentUrl = location.href;
  getCookies(currentUrl).then(cookieHeader => {
    const payload = `${currentUrl}>⩊<${cookieHeader || ""}`;

    fetch("http://localhost:8123/handle_url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        payload,
        type: "image"  // 👈 xác định rõ là image
      })
    })
    .then(() => alert("✅ Sent to MassDownloader!"))
    .catch(() => alert("❌ Failed to send current URL."));
  });
}

function createImageDownloadButton() {
  if (document.getElementById("mass-img-btn")) return;

  const button = document.createElement("div");
  button.id = "mass-img-btn";
  button.innerHTML = "📷 Download Images";

  Object.assign(button.style, {
    position: "fixed",
    top: "140px",
    right: "20px",
    zIndex: 2147483647,
    background: "#2d8f90",
    color: "#fff",
    fontSize: "16px",
    padding: "10px 20px",
    borderRadius: "12px",
    fontWeight: "bold",
    cursor: "pointer",
    boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
    userSelect: "none",
    pointerEvents: "auto"
  });

  document.body.appendChild(button);

  let offsetX = 0, offsetY = 0;
  let isDragging = false;
  let wasDragged = false;

  button.addEventListener("mousedown", (e) => {
    isDragging = true;
    wasDragged = false;
    offsetX = e.clientX - button.getBoundingClientRect().left;
    offsetY = e.clientY - button.getBoundingClientRect().top;
    button.style.cursor = "move";
    e.preventDefault();
  });

  document.addEventListener("mousemove", (e) => {
    if (!isDragging) return;
    const left = e.clientX - offsetX;
    const top = e.clientY - offsetY;
    button.style.left = `${left}px`;
    button.style.top = `${top}px`;
    button.style.right = "auto";
    wasDragged = true;
  });

  document.addEventListener("mouseup", () => {
    if (isDragging) {
      isDragging = false;
      button.style.cursor = "pointer";
    }
  });

  button.addEventListener("click", () => {
    if (!wasDragged) sendCurrentPageToApp();
  });

  // 🛡️ Flickr SPA: Re-inject nếu mất nút
  const reinject = () => {
    if (!document.body.contains(button)) {
      console.log("[🔁] Re-inserting Download button...");
      document.body.appendChild(button);
    }
  };

  const observer = new MutationObserver(reinject);
  observer.observe(document.body, { childList: true, subtree: true });
}






// ✅ Chỉ tạo nút nếu là trang nằm trong danh sách hình ảnh
if (isImageSite()) {
  createImageDownloadButton();
}
