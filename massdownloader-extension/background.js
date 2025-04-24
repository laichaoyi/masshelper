// Bộ nhớ tạm để tránh gửi trùng
const sentUrls = new Set();

// Kiểm tra ảnh theo đuôi file
function isImage(url) {
  return /\.(jpe?g|png|webp|gif|bmp|tiff)(\?|$)/i.test(url);
}

// Khi download mới được tạo
chrome.downloads.onCreated.addListener((item) => {
  const originalUrl = item.url;
  // ✅ Bỏ blob URL hoặc giá trị không hợp lệ
  if (!originalUrl || typeof originalUrl !== "string" || !originalUrl.startsWith("http")) {
    console.warn("❌ Skipping invalid URL:", originalUrl);
    return;
  }
  
  // Bỏ blob URL
  if (originalUrl.startsWith("blob:")) return;

  // ✅ Cho phép Dropbox tự tải
  if (originalUrl.includes("dropboxusercontent.com")) {
    console.log("✅ Allowing Dropbox direct link to download via browser:", originalUrl);
    return;
  }

  // ✅ Cho phép Adobe direct download tự tải (KHÔNG gửi về backend)
  if (
    originalUrl.includes("stock.adobe.com") &&
    (originalUrl.includes("/Download/DownloadFileDirectly/") ||
     originalUrl.includes("/Rest/Libraries/Download/"))
  ) {
    console.log("✅ Allowing Adobe direct download:", originalUrl);
    return;
  }

  // Nếu URL đã gửi rồi thì bỏ qua
  if (sentUrls.has(originalUrl)) return;
  sentUrls.add(originalUrl);

  let baseUrl = new URL(originalUrl).origin;

  // 🔄 Điều chỉnh base URL lấy cookie
  if (originalUrl.includes("fbcdn.net")) {
    baseUrl = "https://facebook.com";
  } else if (originalUrl.includes("dropboxusercontent.com")) {
    baseUrl = "https://www.dropbox.com";
  }

  chrome.cookies.getAll({ url: baseUrl }, (cookies) => {
    if (!cookies || !Array.isArray(cookies)) {
      console.warn("⚠️ No cookies found for", baseUrl);
      return;
    }
  
    const cookieHeader = cookies.map(c => `${c.name}=${c.value}`).join("; ");
    const payload = `${originalUrl}>⩊<${cookieHeader || ""}`;

    const endpoint = "http://localhost:8123/handle_url";
    let type = "";
  
    // ✅ Gán type cho Adobe asset gốc
    if (originalUrl.includes("stock.adobe.com")) {
      type = "stockAdobe";
    } else if (originalUrl.includes("freepik.com")) {
      type = "freepik";
    } else if (originalUrl.includes("drive.google.com/file/")) {
      type = "video"; // ✅ Gán type cho video từ Google Drive
    }
  
    console.log("📤 Sending to:", endpoint, "| Type:", type);
    fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ payload, ...(type ? { type } : {}) })
    }).then(() => {
      console.log("✅ Sent to backend:", originalUrl);
  
      if (!originalUrl.includes("dropboxusercontent.com")) {
        chrome.downloads.cancel(item.id);
        chrome.downloads.erase({ id: item.id });
      }
    }).catch((e) => {
      console.error("❌ Send failed", e);
    });
  });
  
});


  

// (Không gửi gì ở đây nữa - chỉ suggest tên nếu cần)
chrome.downloads.onDeterminingFilename.addListener((item, suggest) => {
  console.log("📥 Intercepted download filename for:", item.url);
  suggest({ filename: item.filename, conflictAction: "uniquify" });
  return true;
});

// Nhận dữ liệu từ content.js
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {

  if (msg.action === "send_adobe_url") {
    const payload = msg.payload;
    fetch("http://localhost:8123/handle_url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ payload, type: "stockAdobe" })
    })
      .then(() => {
        console.log("✅ [BG] Sent Adobe URL:", payload);
        sendResponse({ ok: true });
      })
      .catch((err) => {
        console.warn("❌ [BG] Failed to send Adobe URL:", err);
        sendResponse({ ok: false });
      });
    return true;
  }
  
  // Gửi danh sách link
 if (msg.action === "send_dropbox_links") {
  const links = msg.links || [];
  const folderName = msg.folder || "UnknownFolder";


  links.forEach((link, idx) => {
    const payload = `${link}>⩊<>⩊<dropbox>⩊<${folderName}`;




    setTimeout(() => {
      fetch("http://localhost:8123/handle_url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payload })
      })
        .then(() => console.log("✅ [BG] Sent Dropbox:", payload))
        .catch(e => console.warn("❌ [BG] Failed:", payload, e));
    }, idx * 200);
  });

  return true;
}


  if (msg.action === "sendLinksToBackend") {
    const data = msg.payload;
    fetch("http://localhost:8123/api", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    })
      .then(() => {
        console.log("✅ Backend accepted links");
        sendResponse({ ok: true });
      })
      .catch((err) => {
        console.error("❌ Error sending links:", err);
        sendResponse({ ok: false });
      });

    return true;
  }

  // Hỗ trợ lấy cookie
  if (msg.action === "getCookies" && msg.url) {
    (async () => {
      try {
        let cookieUrl = msg.url;
        const parsed = new URL(msg.url);

        if (parsed.hostname.includes("fbcdn.net")) {
          cookieUrl = "https://facebook.com";
        } else if (parsed.hostname.includes("dropboxusercontent.com")) {
          cookieUrl = "https://www.dropbox.com";
        }

        console.log("🔍 Getting cookies for:", cookieUrl);
        const cookies = await chrome.cookies.getAll({ url: cookieUrl });
        const cookieStr = cookies.map(c => `${c.name}=${c.value}`).join("; ");
        sendResponse(cookieStr);
      } catch (e) {
        console.error("❌ Error getting cookies:", e);
        sendResponse("");
      }
    })();
    return true;
  }

  // Hỗ trợ tải blob
  if (msg.type === "download-blob") {
    const { filename, dataUrl } = msg;
    chrome.downloads.download({
      url: dataUrl,
      filename: filename,
      saveAs: false
    });
  }
});
