(function () {
  const SUPPORTED_SITES = [
    "youtube.com", "youtu.be", "facebook.com", "instagram.com", "tiktok.com","flickr.com",
    "twitter.com", "x.com", "vimeo.com", "twitch.tv", "soundcloud.com", "bilibili.com","pinterest.com",
    "dailymotion.com", "linkedin.com", "vk.com", "odysee.com", "rumble.com","video.kenh14.vn",
    "reddit.com", "ted.com", "bitchute.com", "mixcloud.com", "tunein.com", "douyin.com",
    "streamable.com", "liveleak.com", "vlive.tv", "imdb.com", "hotstar.com", "iqiyi.com",
    "nbc.com", "cnn.com", "zdf.de", "nhk.or.jp", "peertube.org", "archive.org", "qq.com",
    "coursera.org", "edx.org", "khanacademy.org", "openload.co", "zoom.com", "youku.com",
    "maclife.io", "thuvienhd.biz", "thuviencine.com", "hdvietnam.xyz", "drive.google.com"
  ];

  if (window.top !== window) return;

  const currentHost = location.hostname;
  if (!SUPPORTED_SITES.some(site => currentHost.includes(site))) return;
  const sentInstagramReels = new Set();
  const detectedReels = [];

  function hasVideoOnPage() {
    const currentHost = location.hostname;
  
    // 1. Nếu có video tag và src không phải blob → hợp lệ
    const videos = Array.from(document.querySelectorAll('video'));
    for (const video of videos) {
      if (video.src && !video.src.startsWith("blob:")) {
        return true;
      }
    }
  
    // 2. Nếu có các đuôi video phổ biến trong HTML → có thể là link m3u8/mp4
    const videoExtensions = [".mp4", ".webm", ".m3u8", ".mpd"];
    const html = document.documentElement.innerHTML;
    if (videoExtensions.some(ext => html.includes(ext))) return true;
  
    // 3. Một số site buộc hiển thị nút (dù chưa có video tag)
    const forceVideoSites = [
      "vimeo.com", "tiktok.com", "instagram.com", "youtube.com", "douyin.com",
      "facebook.com", "bilibili.com", "dailymotion.com", "zoom.com", , "drive.google.com",
      "maclife.io", "thuvienhd.biz", "thuviencine.com", "hdvietnam.xyz"
    ];
    if (forceVideoSites.some(site => currentHost.includes(site))) return true;
  
    // 4. Nếu có link fshare → hiển thị nút
    if (document.querySelector('a[href*="fshare.vn"]')) return true;
  
    return false;
  }
  
  

  function getCanonicalUrl() {
    try {
      if (window.top !== window) {
        return window.top.location.href;
      }
    } catch (e) {}
    const linkTag = document.querySelector('link[rel="canonical"]');
    if (linkTag && linkTag.href) return linkTag.href;
    return location.href;
  }

  function sendToApp(originalUrl) {
    if (!originalUrl || originalUrl.startsWith("blob:")) {
      alert("❌ This video uses blob URL and cannot be downloaded directly.");
      return;
    }

    chrome.runtime.sendMessage({ action: "getCookies", url: originalUrl }, (cookieHeader) => {
      const payload = originalUrl + ">⩊<" + (cookieHeader || "") + ">⩊<";

      fetch("http://localhost:8123/handle_url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          payload,
          type: "video"
        })
        
      })
        .then(() => alert("✅ Sent to MassDownloader!"))
        .catch(() => alert("❌ Failed to send to app. Open MassDownloader manually."));
    });
  }

  function sendHDVietnamThread() {
    const isHDVietnam = location.hostname.includes("hdvietnam.xyz");
    const isThread = location.pathname.includes("/threads/");
  
    if (!isHDVietnam || !isThread) return;
  
    const threadUrl = location.href.split("?")[0]; // Bỏ query string
    const payload = {
      payload: threadUrl + ">⩊<",  // Không cần cookie
      type: "hdvn"
    };
  
    console.log("[EXT] 📦 Sending HDVietnam payload:", payload);
  
    fetch("http://localhost:8123/handle_url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    })
      .then(() => {
        console.log("✅ Sent HDVietnam payload");
        alert("✅ Sent to MassDownloader: HDVietnam thread");
      })
      .catch((err) => {
        console.error("❌ Failed to send HDVietnam payload", err);
        alert("❌ Failed to send HDVietnam thread to app.");
      });
  }
  
  function sendFacebookReelIfValid() {
    const match = location.href.match(/^https:\/\/www\.facebook\.com\/reel\/(\d+)/);
    if (!match) return;
  
    const reelUrl = match[0];
    console.log("🎯 Detected Facebook Reel:", reelUrl);
  
    chrome.runtime.sendMessage({ action: "getCookies", url: reelUrl }, (cookieHeader) => {
      
      const payload = reelUrl + ">⩊<" + (cookieHeader || "") + ">⩊<";
      fetch("http://localhost:8123/handle_url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payload })
      }).then(() => {
        console.log("✅ Sent Facebook Reel:", reelUrl);
        alert("✅ Sent Facebook Reel to MassDownloader!");
      }).catch(() => {
        console.warn("❌ Failed to send Facebook Reel:", reelUrl);
        alert("❌ Failed to send Facebook Reel.");
      });
    });
  }
  
  
  
  function sendAllFacebookWatchLinks() {
    const anchors = Array.from(document.querySelectorAll('a[href*="/watch"], a[href*="/videos/"]'));
  
    const excludedPaths = [
      "/watch/live/",
      "/watch/shows/",
      "/watch/saved/",
      "/watch/topic/",
    ];
  
    const links = anchors
      .map(a => {
        try {
          const url = new URL(a.href, location.origin);
          const videoId = url.searchParams.get("v");
          if (videoId) {
            return `https://www.facebook.com/watch?v=${videoId}`;
          }
          return url.origin + url.pathname;
        } catch (e) {
          return null;
        }
      })
      .filter(Boolean)
      .filter(link => {
        // Bỏ các link rác
        return !excludedPaths.some(ex => link.includes(ex));
      })
      .filter(link =>
        /^https:\/\/www\.facebook\.com\/watch\?v=\d+$/.test(link) ||
        /^https:\/\/www\.facebook\.com\/[^/]+\/videos\/\d+/.test(link) ||
        /^https:\/\/www\.facebook\.com\/watch\/[^/?]+/.test(link)
      )
      .filter((link, idx, self) => self.indexOf(link) === idx); // unique
  
    // ✅ Luôn thêm URL hiện tại nếu hợp lệ
    const current = location.href;
    if (/^https:\/\/www\.facebook\.com\/watch\?v=\d+/.test(current)) {
      if (!links.includes(current)) {
        links.unshift(current);  // Ưu tiên lên đầu
      }
    }
  
    if (!links.length) {
      alert("❌ No Facebook video links found.");
      return;
    }
  
    if (links.length === 1) {
      sendToApp(links[0]);
      return;
    }
  
    showFacebookPopup(links);
  }
  
  
  
  
  
  
  function showFacebookPopup(links) {
    if (document.querySelector("#facebookPopup")) return;
  
    const popup = document.createElement("div");
    popup.id = "facebookPopup";
    popup.style.cssText = `
      position: fixed;
      top: 100px;
      right: 20px;
      z-index: 999999;
      background: white;
      border: 1px solid #ccc;
      padding: 16px;
      width: 380px;
      max-height: 500px;
      overflow-y: auto;
      box-shadow: 0 2px 10px rgba(0,0,0,0.2);
      border-radius: 10px;
      font-family: sans-serif;
    `;
  
    popup.innerHTML = `
      <h3 style="margin-top:0;font-size:16px;color:#000;">Select Facebook video links to send</h3>
      <div id="facebookOptions" style="margin-bottom:12px; color:#000; font-size:13px;"></div>
      <div style="text-align:right;">
        <button id="facebookCancel" style="margin-right:8px; padding:4px 10px; font-weight:bold;">Cancel</button>
        <button id="facebookSend" style="background:#e50914; color:white; padding:4px 10px; border:none; border-radius:4px; font-weight:bold;">Send</button>
      </div>
    `;
  
    document.body.appendChild(popup);
  
    const optionsDiv = document.getElementById("facebookOptions");
    links.forEach((link, idx) => {
      const id = "facebook_link_" + idx;
      const div = document.createElement("div");
      div.style.marginBottom = "6px";
      div.innerHTML = `
        <label style="color:#000;">
          <input type="checkbox" id="${id}" data-link="${link}" checked>
          ${link}
        </label>
      `;
      optionsDiv.appendChild(div);
    });
  
    document.getElementById("facebookCancel").addEventListener("click", () => {
      popup.remove();
    });
  
    document.getElementById("facebookSend").addEventListener("click", async () => {
      const selected = [...popup.querySelectorAll('input[type=checkbox]:checked')]
        .map(cb => cb.getAttribute("data-link"));
  
      if (!selected.length) {
        alert("❌ No link selected.");
        return;
      }
  
      for (const link of selected) {
        await new Promise(resolve => {
          chrome.runtime.sendMessage({ action: "getCookies", url: link }, (cookieHeader) => {
            const payload = link + ">⩊<" + (cookieHeader || "") + ">⩊<";
            fetch("http://localhost:8123/handle_url", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ payload })
            }).then(() => {
              console.log("✅ Sent Facebook:", link);
              resolve();
            }).catch(() => {
              console.warn("❌ Failed to send:", link);
              resolve(); // vẫn resolve để tiếp tục
            });
          });
        });
  
        await new Promise(r => setTimeout(r, 300)); // đợi giữa các lần gửi
      }
  
      alert(`✅ Sent ${selected.length} Facebook link(s) to MassDownloader.`);
      popup.remove();
    });
  }
  
  
  function extractFshareLinks() {
    const links = new Set();
  
    document.querySelectorAll('a[href*="fshare.vn/"]').forEach((a) => {
      let href = a.getAttribute("href"); // ✅ Lấy đúng raw href
  
      if (!href) return;
  
      // Bổ sung tự động domain nếu thiếu
      if (href.startsWith("/")) {
        href = location.origin + href;
      } else if (!href.startsWith("http")) {
        href = "https://www.fshare.vn" + (href.startsWith("/") ? "" : "/") + href;
      }
  
      // Xoá query string và fragment
      href = href.split("?")[0].split("#")[0];
  
      // ✅ Chỉ nhận đúng link file hoặc folder
      if (/^https:\/\/www\.fshare\.vn\/(file|folder)\/[A-Z0-9]{10,}$/i.test(href)) {
        links.add(href);
      }
    });
  
    return Array.from(links);
  }
  
  
  
  

  function promptFshareLinksAndSend() {
    const links = extractFshareLinks();
    if (!links.length) {
      alert("❌ No Fshare.vn links found on this page.");
      return;
    }
  
    if (document.querySelector("#fsharePopup")) return;
  
    // Tạo popup
    const popup = document.createElement("div");
    popup.id = "fsharePopup";
    popup.style.cssText = `
      position: fixed;
      top: 100px;
      right: 20px;
      z-index: 999999;
      background: white;
      border: 1px solid #ccc;
      padding: 16px;
      width: 320px;
      max-height: 400px;
      overflow-y: auto;
      box-shadow: 0 2px 10px rgba(0,0,0,0.2);
      border-radius: 10px;
      font-family: sans-serif;
    `;
  
    popup.innerHTML = `
      <h3 style="margin-top:0;font-size:16px;color:#000;">Select Fshare links to send</h3>
      <div id="fshareOptions" style="margin-bottom:12px; color:#000; font-size:13px;"></div>
      <div style="text-align:right;">
        <button id="fshareCancel" style="margin-right:8px; padding:4px 10px; font-weight:bold;">Cancel</button>
        <button id="fshareSend" style="background:#e50914; color:white; padding:4px 10px; border:none; border-radius:4px; font-weight:bold;">Send</button>
      </div>
    `;
  
    document.body.appendChild(popup);
  
    const optionsDiv = document.getElementById("fshareOptions");
    links.forEach((link, idx) => {
      const id = "fshare_link_" + idx;
      const div = document.createElement("div");
      div.style.marginBottom = "6px";
      div.innerHTML = `
        <label style="color:#000;">
          <input type="checkbox" id="${id}" data-link="${link}" checked>
          ${link}
        </label>
      `;
      optionsDiv.appendChild(div);
    });
  
    // Gắn sự kiện Cancel
    setTimeout(() => {
      const cancelBtn = document.getElementById("fshareCancel");
      if (cancelBtn) {
        cancelBtn.addEventListener("click", () => popup.remove());
      }
  
      const sendBtn = document.getElementById("fshareSend");
      if (sendBtn) {
        sendBtn.addEventListener("click", () => {
          const selected = [...popup.querySelectorAll('input[type=checkbox]:checked')]
            .map(cb => cb.getAttribute("data-link"));
  
          if (!selected.length) {
            alert("❌ No link selected.");
            return;
          }
  
          selected.forEach((link, idx) => {
            setTimeout(() => {
              chrome.runtime.sendMessage({ action: "getCookies", url: link }, (cookieHeader) => {
                const payload = originalUrl + ">⩊<" + (cookieHeader || "") + ">⩊<";
                fetch("http://localhost:8123/handle_url", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ payload })
                }).then(() => {
                  console.log("✅ Sent Fshare:", link);
                }).catch(() => {
                  console.warn("❌ Failed to send:", link);
                });
              });
            }, idx * 300);
          });
  
          alert(`✅ Sent ${selected.length} Fshare link(s) to MassDownloader.`);
          popup.remove();
        });
      }
    }, 50); // Delay nhẹ để chắc chắn DOM render xong
  }
  
  function extractGoogleDriveVideoLinks() {
    const anchors = Array.from(document.querySelectorAll('a[href*="drive.google.com/file/d/"]'));
  
    const links = anchors
      .map(a => {
        try {
          const url = new URL(a.href, location.origin);
          // Chỉ lấy link kiểu: /file/d/ID/view
          if (/\/file\/d\/[\w-]+\/view/.test(url.pathname)) {
            return url.origin + url.pathname;
          }
        } catch (e) {}
        return null;
      })
      .filter(Boolean);
  
    return [...new Set(links)];
  }
  
  function promptGoogleDriveVideoLinksAndSend() {
    const links = extractGoogleDriveVideoLinks();
    if (!links.length) {
      alert("❌ Can not scan google drive videos.");
      return;
    }
  
    if (links.length === 1) {
      sendToApp(links[0]);
      return;
    }
  
    if (document.querySelector("#drivePopup")) return;
  
    const popup = document.createElement("div");
    popup.id = "drivePopup";
    popup.style.cssText = `
      position: fixed;
      top: 100px;
      right: 20px;
      z-index: 999999;
      background: white;
      border: 1px solid #ccc;
      padding: 16px;
      width: 380px;
      max-height: 500px;
      overflow-y: auto;
      box-shadow: 0 2px 10px rgba(0,0,0,0.2);
      border-radius: 10px;
      font-family: sans-serif;
    `;
  
    popup.innerHTML = `
      <h3 style="margin-top:0;font-size:16px;color:#000;">Select Google Drive videos to send</h3>
      <div id="driveOptions" style="margin-bottom:12px; color:#000; font-size:13px;"></div>
      <div style="text-align:right;">
        <button id="driveCancel" style="margin-right:8px; padding:4px 10px; font-weight:bold;">Cancel</button>
        <button id="driveSend" style="background:#0F9D58; color:white; padding:4px 10px; border:none; border-radius:4px; font-weight:bold;">Send</button>
      </div>
    `;
  
    document.body.appendChild(popup);
  
    const optionsDiv = document.getElementById("driveOptions");
    links.forEach((link, idx) => {
      const id = "drive_link_" + idx;
      const div = document.createElement("div");
      div.style.marginBottom = "6px";
      div.innerHTML = `
        <label style="color:#000;">
          <input type="checkbox" id="${id}" data-link="${link}" checked>
          ${link}
        </label>
      `;
      optionsDiv.appendChild(div);
    });
  
    document.getElementById("driveCancel").addEventListener("click", () => popup.remove());
  
    document.getElementById("driveSend").addEventListener("click", () => {
      const selected = [...document.querySelectorAll('input[type=checkbox]:checked')]
        .map(cb => cb.getAttribute("data-link"));
      if (!selected.length) {
        alert("❌ No video selected.");
        return;
      }
  
      selected.forEach((link, idx) => {
        setTimeout(() => {
          chrome.runtime.sendMessage({ action: "getCookies", url: link }, (cookieHeader) => {
            const payload = originalUrl + ">⩊<" + (cookieHeader || "") + ">⩊<";
            fetch("http://localhost:8123/handle_url", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ payload, type: "video" })
            }).then(() => {
              console.log("✅ Sent Drive video:", link);
            }).catch(() => {
              console.warn("❌ Failed to send Drive video:", link);
            });
          });
        }, idx * 300);
      });
  
      alert(`✅ Sent ${selected.length} Google Drive video(s) to MassDownloader.`);
      popup.remove();
    });
  }
  

  function createFloatingButton() {
    if (document.querySelector("#massDownloaderBtn")) return;
  
    const button = document.createElement("div");
    button.id = "massDownloaderBtn";
    button.innerText = "⬇️ Download Videos";
    button.style.cssText = `
      position: fixed;
      top: 80px;
      right: 20px;
      z-index: 999999;
      padding: 10px 16px;
      background: #e50914;
      color: white;
      font-size: 14px;
      border-radius: 8px;
      box-shadow: 0 2px 6px rgba(0,0,0,0.3);
      cursor: pointer;
      font-weight: bold;
      user-select: none;
    `;
  
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
      if (isDragging) {
        const left = e.clientX - offsetX;
        const top = e.clientY - offsetY;
        button.style.left = `${left}px`;
        button.style.top = `${top}px`;
        button.style.right = "auto";
        wasDragged = true;
      }
    });
  
    document.addEventListener("mouseup", (e) => {
      if (isDragging) {
        isDragging = false;
        button.style.cursor = "pointer";
      }
    });
  
    button.addEventListener("click", (e) => {
      if (wasDragged) return; // không click khi vừa kéo
      const host = location.hostname;
  
      if (host.includes("hdvietnam.xyz") && location.pathname.includes("/threads/")) {
        sendHDVietnamThread();
      } else if (host.includes("facebook.com")) {
        if (location.pathname.startsWith("/reel/")) {
          sendFacebookReelIfValid();
        } else {
          sendAllFacebookWatchLinks();
        }
      } else if (host.includes("x.com")) {
        sendAllXComVideoLinks();
      } else if (host.includes("tiktok.com")) {
        sendAllTikTokVideoLinks();
      } else if (host.includes("youtube.com")) {
        sendAllYouTubeLinks();
      } else if (
        host.includes("maclife.io") ||
        host.includes("thuvienhd.biz") ||
        host.includes("thuviencine.com")
      ) {
        promptFshareLinksAndSend();
      } else if (
        host.includes("drive.google.com") &&
        location.pathname.includes("/folders/")
      ) {
        promptGoogleDriveVideoLinksAndSend();
      } else {
        const realUrl = getCanonicalUrl();
        sendToApp(realUrl);
      }
    });
  
    document.body.appendChild(button);
  }
  
  function extractYouTubeFromJSON() {
    const links = new Set();
    const scripts = [...document.querySelectorAll("script")];
    const ytScript = scripts.find(s => s.textContent.includes("ytInitialData"));
  
    if (!ytScript) {
      console.warn("❌ ytInitialData not found");
      return [];
    }
  
    try {
      const raw = ytScript.textContent;
      const match = raw.match(/ytInitialData\s*=\s*(\{.*?\});/s);
      if (!match) {
        console.warn("❌ Failed to match ytInitialData");
        return [];
      }
  
      const ytData = JSON.parse(match[1]);
  
      const items = ytData.contents?.twoColumnWatchNextResults?.playlist?.playlist?.contents;
      if (items && Array.isArray(items) && items.length > 1) {
        items.forEach(item => {
          const videoId = item?.playlistPanelVideoRenderer?.videoId;
          if (videoId) {
            links.add("https://www.youtube.com/watch?v=" + videoId);
          }
        });
      } else {
        // ✅ Không phải playlist thật, chỉ lấy video hiện tại
        const videoId = ytData.currentVideoEndpoint?.watchEndpoint?.videoId;
        if (videoId) {
          links.add("https://www.youtube.com/watch?v=" + videoId);
        }
      }
    } catch (err) {
      console.error("❌ Error parsing ytInitialData:", err);
    }
  
    return Array.from(links);
  }
  
  function sendAllTikTokVideoLinks() {
    const videoLinks = Array.from(document.querySelectorAll('a[href*="/video/"]'))
      .map(a => a.href.split("?")[0])
      .filter(link => /^https:\/\/www\.tiktok\.com\/@[^/]+\/video\/\d+$/i.test(link))
      .filter((link, index, self) => self.indexOf(link) === index); // unique
  
    if (!videoLinks.length) {
      alert("❌ No TikTok video links found.");
      return;
    }
  
    if (videoLinks.length === 1) {
      sendToApp(videoLinks[0]);
      return;
    }
  
    if (document.querySelector("#tiktokPopup")) return;
  
    const popup = document.createElement("div");
    popup.id = "tiktokPopup";
    popup.style.cssText = `
      position: fixed;
      top: 100px;
      right: 20px;
      z-index: 999999;
      background: white;
      border: 1px solid #ccc;
      padding: 16px;
      width: 380px;
      max-height: 500px;
      overflow-y: auto;
      box-shadow: 0 2px 10px rgba(0,0,0,0.2);
      border-radius: 10px;
      font-family: sans-serif;
    `;
  
    popup.innerHTML = `
      <h3 style="margin-top:0;font-size:16px;color:#000;">Select TikTok videos to send</h3>
      <div id="tiktokOptions" style="margin-bottom:12px; color:#000; font-size:13px;"></div>
      <div style="text-align:right;">
        <button id="tiktokCancel" style="margin-right:8px; padding:4px 10px; font-weight:bold;">Cancel</button>
        <button id="tiktokSend" style="background:#e50914; color:white; padding:4px 10px; border:none; border-radius:4px; font-weight:bold;">Send</button>
      </div>
    `;
  
    document.body.appendChild(popup);
  
    const optionsDiv = document.getElementById("tiktokOptions");
    videoLinks.forEach((link, idx) => {
      const id = "tiktok_link_" + idx;
      const div = document.createElement("div");
      div.style.marginBottom = "6px";
      div.innerHTML = `
        <label style="color:#000;">
          <input type="checkbox" id="${id}" data-link="${link}" checked>
          ${link}
        </label>
      `;
      optionsDiv.appendChild(div);
    });
  
    document.getElementById("tiktokCancel").addEventListener("click", () => {
      popup.remove();
    });
  
    document.getElementById("tiktokSend").addEventListener("click", () => {
      const selected = [...popup.querySelectorAll('input[type=checkbox]:checked')]
        .map(cb => cb.getAttribute("data-link"));
  
      if (!selected.length) {
        alert("❌ No link selected.");
        return;
      }
  
      selected.forEach((link, idx) => {
        setTimeout(() => {
          chrome.runtime.sendMessage({ action: "getCookies", url: link }, (cookieHeader) => {
            const payload = originalUrl + ">⩊<" + (cookieHeader || "") + ">⩊<";
            fetch("http://localhost:8123/handle_url", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ payload })
            }).then(() => {
              console.log("✅ Sent TikTok:", link);
            }).catch(() => {
              console.warn("❌ Failed to send:", link);
            });
          });
        }, idx * 300);
      });
  
      alert(`✅ Sent ${selected.length} TikTok video(s) to MassDownloader.`);
      popup.remove();
    });
  }
  function showFacebookPopup(links) {
    if (document.querySelector("#facebookPopup")) return;

    const popup = document.createElement("div");
    popup.id = "facebookPopup";
    popup.style.cssText = `
      position: fixed;
      top: 100px;
      right: 20px;
      z-index: 999999;
      background: white;
      border: 1px solid #ccc;
      padding: 16px;
      width: 380px;
      max-height: 500px;
      overflow-y: auto;
      box-shadow: 0 2px 10px rgba(0,0,0,0.2);
      border-radius: 10px;
      font-family: sans-serif;
    `;

    popup.innerHTML = `
      <h3 style="margin-top:0;font-size:16px;color:#000;">Select Facebook videos to send</h3>
      <div id="facebookOptions" style="margin-bottom:12px; color:#000; font-size:13px;"></div>
      <div style="text-align:right;">
        <button id="facebookCancel" style="margin-right:8px; padding:4px 10px; font-weight:bold;">Cancel</button>
        <button id="facebookSend" style="background:#1877f2; color:white; padding:4px 10px; border:none; border-radius:4px; font-weight:bold;">Send</button>
      </div>
    `;

    document.body.appendChild(popup);

    const optionsDiv = document.getElementById("facebookOptions");
    links.forEach((link, idx) => {
      const id = "fb_link_" + idx;
      const div = document.createElement("div");
      div.style.marginBottom = "6px";
      div.innerHTML = `
        <label style="color:#000;">
          <input type="checkbox" id="${id}" data-link="${link}" checked>
          ${link}
        </label>
      `;
      optionsDiv.appendChild(div);
    });

    document.getElementById("facebookCancel").addEventListener("click", () => {
      popup.remove();
    });

    setTimeout(() => {
      const sendBtn = document.getElementById("facebookSend");
      if (!sendBtn) return;

      sendBtn.addEventListener("click", () => {
        const selected = [...popup.querySelectorAll('input[type=checkbox]:checked')]
          .map(cb => cb.getAttribute("data-link"));

        if (!selected.length) {
          alert("❌ No link selected.");
          return;
        }

        selected.forEach((link, idx) => {
          setTimeout(() => {
            chrome.runtime.sendMessage({ action: "getCookies", url: link }, (cookieHeader) => {
              const payload = link + ">⩊<" + (cookieHeader || "") + ">⩊<";
              fetch("http://localhost:8123/handle_url", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ payload })
              }).then(() => {
                console.log("✅ Sent Facebook:", link);
              }).catch(() => {
                console.warn("❌ Failed to send:", link);
              });
            });
          }, idx * 300);
        });

        alert(`✅ Sent ${selected.length} Facebook video(s) to MassDownloader.`);
        popup.remove();
      });
    }, 100);
  }

  // Gọi tự động khi click
  window.addEventListener("load", () => {
    setTimeout(() => {
      if (location.hostname.includes("facebook.com")) {
        if (hasVideoOnPage()) createFloatingButton();
      }
      
    }, 1000);
  });

 
  
  
  
  

  function sendAllYouTubeLinks() {
    const links = extractYouTubeFromJSON();
    if (!links.length) {
      // ✅ Nếu không tìm thấy từ ytInitialData thì thử lấy từ URL hiện tại
      const videoMatch = location.href.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)([\w-]{11})/);

      if (videoMatch) {
        const url = "https://www.youtube.com/watch?v=" + videoMatch[1];  // convert shorts → watch?v=
        sendToApp(url);
        return;
      }
    
      alert("❌ No YouTube videos found.");
      return;
    }
    
  
    if (links.length === 1) {
      // Nếu chỉ có 1 video thì gửi luôn
      sendToApp(links[0]);
      return;
    }
  
    // Nếu có nhiều video → hiển thị popup chọn
    if (document.querySelector("#youtubePopup")) return;
  
    const popup = document.createElement("div");
    popup.id = "youtubePopup";
    popup.style.cssText = `
      position: fixed;
      top: 100px;
      right: 20px;
      z-index: 999999;
      background: white;
      border: 1px solid #ccc;
      padding: 16px;
      width: 380px;
      max-height: 500px;
      overflow-y: auto;
      box-shadow: 0 2px 10px rgba(0,0,0,0.2);
      border-radius: 10px;
      font-family: sans-serif;
    `;
  
    popup.innerHTML = `
      <h3 style="margin-top:0;font-size:16px;color:#000;">Select YouTube videos to send</h3>
      <div id="youtubeOptions" style="margin-bottom:12px; color:#000; font-size:13px;"></div>
      <div style="text-align:right;">
        <button id="youtubeCancel" style="margin-right:8px; padding:4px 10px; font-weight:bold;">Cancel</button>
        <button id="youtubeSend" style="background:#e50914; color:white; padding:4px 10px; border:none; border-radius:4px; font-weight:bold;">Send</button>
      </div>
    `;
  
    document.body.appendChild(popup);
  
    const optionsDiv = document.getElementById("youtubeOptions");
  
    links.forEach((link, idx) => {
      const id = "yt_link_" + idx;
      const div = document.createElement("div");
      div.style.marginBottom = "6px";
      div.innerHTML = `
        <label style="color:#000;">
          <input type="checkbox" id="${id}" data-link="${link}" checked>
          ${link}
        </label>
      `;
      optionsDiv.appendChild(div);
    });
  
    document.getElementById("youtubeCancel").addEventListener("click", () => {
      popup.remove();
    });
  
    document.getElementById("youtubeSend").addEventListener("click", () => {
      const popup = document.getElementById("youtubePopup");
      if (!popup) return;
  
      const selected = [...popup.querySelectorAll('input[type=checkbox]:checked')]
        .map(cb => cb.getAttribute("data-link"));
  
      if (!selected.length) {
        alert("❌ No link selected.");
        return;
      }
  
      selected.forEach((link, idx) => {
        setTimeout(() => {
          chrome.runtime.sendMessage({ action: "getCookies", url: link }, (cookieHeader) => {
            const payload = originalUrl + ">⩊<" + (cookieHeader || "") + ">⩊<";

            fetch("http://localhost:8123/handle_url", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ payload })
            }).then(() => {
              console.log("✅ Sent YouTube:", link);
            }).catch(() => {
              console.warn("❌ Failed to send:", link);
            });
          });
        }, idx * 300);
      });
  
      alert(`✅ Sent ${selected.length} YouTube video(s) to MassDownloader.`);
      popup.remove();
    });
  }
  
  function handleFshareFolderPage() {
    const isFolderPage = location.href.includes("fshare.vn/folder/");
    if (!isFolderPage) return;
  
    // Tìm các link file con hợp lệ
    const fileLinks = Array.from(document.querySelectorAll('a[href*="/file/"]'))
      .map(a => a.href.split("?")[0])
      .filter(link => /https:\/\/www\.fshare\.vn\/file\/[A-Z0-9]{10,}/.test(link))
      .filter((link, index, self) => self.indexOf(link) === index); // unique
  
    if (!fileLinks.length) return;
  
    if (document.querySelector("#fsharePopup")) return;
  
    // Tạo popup
    const popup = document.createElement("div");
    popup.id = "fsharePopup";
    popup.style.cssText = `
      position: fixed;
      top: 100px;
      right: 20px;
      z-index: 999999;
      background: white;
      border: 1px solid #ccc;
      padding: 16px;
      width: 380px;
      max-height: 500px;
      overflow-y: auto;
      box-shadow: 0 2px 10px rgba(0,0,0,0.2);
      border-radius: 10px;
      font-family: sans-serif;
    `;
  
    popup.innerHTML = `
      <h3 style="margin-top:0;font-size:16px;color:#000;">Select Fshare links to send</h3>
      <div id="fshareOptions" style="margin-bottom:12px; color:#000; font-size:13px;"></div>
      <div style="text-align:right;">
        <button id="fshareCancel" style="margin-right:8px; padding:4px 10px; font-weight:bold;">Cancel</button>
        <button id="fshareSend" style="background:#e50914; color:white; padding:4px 10px; border:none; border-radius:4px; font-weight:bold;">Send</button>
      </div>
    `;
  
    document.body.appendChild(popup);
  
    const optionsDiv = document.getElementById("fshareOptions");
    fileLinks.forEach((link, idx) => {
      const id = "fshare_link_" + idx;
      const div = document.createElement("div");
      div.style.marginBottom = "6px";
      div.innerHTML = `
        <label style="color:#000;">
          <input type="checkbox" id="${id}" data-link="${link}" checked>
          ${link}
        </label>
      `;
      optionsDiv.appendChild(div);
    });
  
    document.getElementById("fshareCancel").addEventListener("click", () => {
      popup.remove();
    });
  
    document.getElementById("fshareSend").addEventListener("click", () => {
      const popup = document.getElementById("fsharePopup");
      if (!popup) return;
  
      const selected = [...popup.querySelectorAll('input[type=checkbox]:checked')]
        .map(cb => cb.getAttribute("data-link"));
  
      if (!selected.length) {
        alert("❌ No link selected.");
        return;
      }
  
      selected.forEach((link, idx) => {
        setTimeout(() => {
          chrome.runtime.sendMessage({ action: "getCookies", url: link }, (cookieHeader) => {
            const payload = originalUrl + ">⩊<" + (cookieHeader || "") + ">⩊<";
            fetch("http://localhost:8123/handle_url", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ payload })
            }).then(() => {
              console.log("✅ Sent Fshare:", link);
            }).catch(() => {
              console.warn("❌ Failed to send:", link);
            });
          });
        }, idx * 300);
      });
  
      alert(`✅ Sent ${selected.length} Fshare link(s) to MassDownloader.`);
      popup.remove();
    });
  }
  
  

  const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;
  
    function observeUrlChange(callback) {
      let oldHref = location.href;
      const observer = new MutationObserver(() => {
        if (location.href !== oldHref) {
          oldHref = location.href;
          callback(location.href);
        }
      });
      observer.observe(document.body, { childList: true, subtree: true });
    }
    function getFinalDownloadUrlFromButton(buttonElement) {
      const observer = new MutationObserver((mutations, obs) => {
          for (const mutation of mutations) {
              const links = document.querySelectorAll("a[href*='v.ftcdn.net']");
              for (const link of links) {
                  const href = link.href;
                  if (href.match(/\.(mp4|mov|jpg|zip)(\?|$)/)) {
                      console.log("[EXT] 🎯 Final file URL:", href);
                      sendUrlToApp(href);
                      obs.disconnect();
                      return;
                  }
              }
          }
      });
  
      observer.observe(document.body, {
          childList: true,
          subtree: true,
      });
  
      // Kích hoạt click download nếu button trực tiếp trigger
      buttonElement.click();
  }
  function sendUrlToApp(url) {
    const cookies = document.cookie;
    const payload = `${url}>⩊<${cookies}`;
    fetch("http://localhost:8123", {
        method: "POST",
        headers: {
            "Content-Type": "text/plain"
        },
        body: payload
    });
}
function observeInstagramUrlChange() {
  let lastUrl = location.href;

  function handleUrlChange(url) {
    if (url === lastUrl) return;
    lastUrl = url;

    const match = url.match(/^https:\/\/www\.instagram\.com\/reel\/([\w-]+)\/?/);
    if (match) {
      console.log("🎯 Detected Instagram Reel URL:", url);

      chrome.runtime.sendMessage({ action: "getCookies", url }, (cookieHeader) => {
        const payload = url + ">⩊<" + (cookieHeader || "") + ">⩊<";
        fetch("http://localhost:8123/handle_url", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ payload })
        }).then(() => {
          console.log("✅ Sent Instagram Reel:", url);
        }).catch(() => {
          console.warn("❌ Failed to send Instagram Reel:", url);
        });
      });
    }
  }

  const observer = new MutationObserver(() => {
    handleUrlChange(location.href);
  });

  observer.observe(document.body, { childList: true, subtree: true });

  const originalPushState = history.pushState;
  const originalReplaceState = history.replaceState;

  history.pushState = function (...args) {
    setTimeout(() => handleUrlChange(location.href), 100);
    return originalPushState.apply(this, args);
  };

  history.replaceState = function (...args) {
    setTimeout(() => handleUrlChange(location.href), 100);
    return originalReplaceState.apply(this, args);
  };

  window.addEventListener("popstate", () => {
    handleUrlChange(location.href);
  });

  // Gọi lần đầu
  handleUrlChange(location.href);
}

    
    
    // Hook button Adobe (tuìy giao diện)
document.addEventListener("DOMContentLoaded", () => {
  setTimeout(() => {
      const dlBtn = document.querySelector("button[aria-label='Download']") || document.querySelector("a[href*='/Download/']");
      if (dlBtn) {
          console.log("[EXT] 🎯 Hooking Download button for Adobe Stock");
          dlBtn.addEventListener("click", (e) => {
              e.preventDefault();
              getFinalDownloadUrlFromButton(dlBtn);
          });
      }
  }, 2000);
});

    function getCurrentReelUrl() {
      const match = location.href.match(/^https:\/\/www\.instagram\.com\/reel\/([\w-]+)\/?/);
      return match ? match[0] : null;
    }
  
    function showInstagramReelPopup(links) {
      if (document.querySelector("#instagramPopup")) return;
  
      const popup = document.createElement("div");
      popup.id = "instagramPopup";
      popup.style.cssText = `
        position: fixed;
        top: 100px;
        right: 20px;
        z-index: 999999;
        background: white;
        border: 1px solid #ccc;
        padding: 16px;
        width: 380px;
        max-height: 500px;
        overflow-y: auto;
        box-shadow: 0 2px 10px rgba(0,0,0,0.2);
        border-radius: 10px;
        font-family: sans-serif;
      `;
  
      popup.innerHTML = `
        <h3 style="margin-top:0;font-size:16px;color:#000;">Select Instagram Reels to send</h3>
        <div id="instagramOptions" style="margin-bottom:12px; color:#000; font-size:13px;"></div>
        <div style="text-align:right;">
          <button id="igCancel" style="margin-right:8px; padding:4px 10px; font-weight:bold;">Cancel</button>
          <button id="igSend" style="background:#e50914; color:white; padding:4px 10px; border:none; border-radius:4px; font-weight:bold;">Send</button>
        </div>
      `;
  
      document.body.appendChild(popup);
  
      const optionsDiv = document.getElementById("instagramOptions");
  
      links.forEach((link, idx) => {
        const id = "ig_link_" + idx;
        const div = document.createElement("div");
        div.style.marginBottom = "6px";
        div.innerHTML = `
          <label style="color:#000;">
            <input type="checkbox" id="${id}" data-link="${link}" checked>
            ${link}
          </label>
        `;
        optionsDiv.appendChild(div);
      });
  
      document.getElementById("igCancel").addEventListener("click", () => popup.remove());
  
      document.getElementById("igSend").addEventListener("click", () => {
        const selected = [...document.querySelectorAll('input[type=checkbox]:checked')]
          .map(cb => cb.getAttribute("data-link"));
        if (!selected.length) {
          alert("❌ No link selected.");
          return;
        }
  
        selected.forEach((link, idx) => {
          setTimeout(() => {
            chrome.runtime.sendMessage({ action: "getCookies", url: link }, (cookieHeader) => {
              const payload = originalUrl + ">⩊<" + (cookieHeader || "") + ">⩊<";
              fetch("http://localhost:8123/handle_url", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ payload })
              });
            });
          }, idx * 300);
        });
  
        alert(`✅ Sent ${selected.length} Instagram reel(s) to MassDownloader.`);
        popup.remove();
      });
    }
  
    function watchInstagramReels() {
      const current = getCurrentReelUrl();
      if (current && !sentInstagramReels.has(current)) {
        sentInstagramReels.add(current);
        detectedReels.push(current);
        console.log("📹 Detected Instagram reel:", current);
        if (detectedReels.length >= 2) {
          showInstagramReelPopup(detectedReels);
        }
      }
    }
  
    const observer = new MutationObserver(watchInstagramReels);
    observer.observe(document.body, { childList: true, subtree: true });
  
    const originalPush = history.pushState;
    history.pushState = function (...args) {
      setTimeout(watchInstagramReels, 100);
      return originalPush.apply(this, args);
    };
  
    const originalReplace = history.replaceState;
    history.replaceState = function (...args) {
      setTimeout(watchInstagramReels, 100);
      return originalReplace.apply(this, args);
    };
  
    window.addEventListener("popstate", () => {
      setTimeout(watchInstagramReels, 100);
    });
    
    function hookHistoryForTikTok() {
      const originalPushState = history.pushState;
      const originalReplaceState = history.replaceState;
  
      function handleChange(url) {
        if (/\/@[^/]+\/video\/\d+/.test(url)) {
          console.log("🎯 Detected TikTok video:", url);
          chrome.runtime.sendMessage({ action: "getCookies", url }, (cookieHeader) => {
            const payload = url + ">⩊<" + (cookieHeader || "") + ">⩊<";
            fetch("http://localhost:8123/handle_url", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ payload })
            }).then(() => {
              console.log("✅ Sent to MassDownloader:", url);
            }).catch(() => {
              console.warn("❌ Failed to send TikTok:", url);
            });
          });
        }
      }
  
      history.pushState = function (...args) {
        setTimeout(() => handleChange(location.href), 100);
        return originalPushState.apply(this, args);
      };
  
      history.replaceState = function (...args) {
        setTimeout(() => handleChange(location.href), 100);
        return originalReplaceState.apply(this, args);
      };
  
      window.addEventListener("popstate", () => {
        handleChange(location.href);
      });
    }
  
    window.addEventListener("load", () => {
      setTimeout(() => {
        if (hasVideoOnPage() && !location.hostname.includes("dropbox.com")) {
          createFloatingButton();
        }
  
        observeUrlChange((newUrl) => {
          console.log("🔁 URL changed:", newUrl);
          if (document.getElementById("massDownloaderBtn")) return;
        
          if (
            hasVideoOnPage() ||
            newUrl.includes("fshare.vn/folder/") ||
            newUrl.includes("maclife.io") ||
            newUrl.includes("thuvienhd.biz") ||
            newUrl.includes("thuviencine.com")
          ) {
            createFloatingButton();
          }
        
          if (newUrl.includes("fshare.vn/folder/")) {
            handleFshareFolderPage(); // Hiển thị lại popup nếu đang ở folder
          }
        });
  
        if (location.hostname.includes("tiktok.com")) {
          hookHistoryForTikTok();
        }
        if (location.hostname.includes("fshare.vn")) {
          handleFshareFolderPage(); // ✅ xử lý folder
        }
        if (location.hostname.includes("instagram.com")) {
          observeInstagramUrlChange();
        }
        if (location.hostname.includes("drive.google.com") && location.pathname.includes("/folders/")) {
          setTimeout(() => {
            const links = Array.from(document.querySelectorAll('a[href*="/file/d/"]'))
              .map(a => a.href.split("?")[0])
              .filter(link => /^https:\/\/drive\.google\.com\/file\/d\/[\w-]{10,}/.test(link))
              .filter((link, i, arr) => arr.indexOf(link) === i); // unique
        
            if (!links.length) {
              console.log("❌ No Drive video file links found.");
              return;
            }
        
            // Gửi từng link về app
            links.forEach((link, idx) => {
              setTimeout(() => {
                chrome.runtime.sendMessage({ action: "getCookies", url: link }, (cookieHeader) => {
                  const payload = originalUrl + ">⩊<" + (cookieHeader || "") + ">⩊<";
                  fetch("http://localhost:8123/handle_url", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ payload, type: "video" })
                  }).then(() => {
                    console.log("✅ Sent Drive video link:", link);
                  }).catch(err => {
                    console.warn("❌ Failed to send Drive video:", link, err);
                  });
                });
              }, idx * 300);
            });
          }, 1500); // đợi DOM load xong
        }
        
      }, 1000);
    });

    function observeFacebookWatchUrlChange() {
      let lastUrl = location.href;
    
      function handleUrlChange(newUrl) {
        if (newUrl === lastUrl) return;
        lastUrl = newUrl;
    
        if (/https:\/\/www\.facebook\.com\/watch\?v=\d+/.test(newUrl)) {
          console.log("🎯 New Facebook Watch video:", newUrl);
          chrome.runtime.sendMessage({ action: "getCookies", url: newUrl }, (cookieHeader) => {
            const payload = newUrl + ">⩊<" + (cookieHeader || "") + ">⩊<";
            fetch("http://localhost:8123/handle_url", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ payload, type: "video" })
            }).then(() => {
              console.log("✅ Sent new FB Watch video:", newUrl);
            }).catch(() => {
              console.warn("❌ Failed to send FB Watch video:", newUrl);
            });
          });
        }
      }
    
      const pushState = history.pushState;
      history.pushState = function (...args) {
        setTimeout(() => handleUrlChange(location.href), 100);
        return pushState.apply(this, args);
      };
    
      const replaceState = history.replaceState;
      history.replaceState = function (...args) {
        setTimeout(() => handleUrlChange(location.href), 100);
        return replaceState.apply(this, args);
      };
    
      window.addEventListener("popstate", () => {
        setTimeout(() => handleUrlChange(location.href), 100);
      });
    
      // Lần đầu gọi
      handleUrlChange(location.href);
    }

    function extractAllFacebookVideoLinks() {
      const anchors = Array.from(document.querySelectorAll('a[href*="/watch"], a[href*="/videos/"]'));
      const links = anchors.map(a => {
        try {
          const url = new URL(a.href, location.origin);
          return url.toString().split("&")[0]; // bỏ bớt query phụ
        } catch (e) {
          return null;
        }
      }).filter(Boolean);
    
      // lọc URL hợp lệ
      const videoLinks = links.filter(link =>
        /^https:\/\/www\.facebook\.com\/watch\?v=\d+/.test(link) ||
        /^https:\/\/www\.facebook\.com\/[^/]+\/videos\/\d+/.test(link)
      );
    
      return [...new Set(videoLinks)];
    }
    
    
    function observeInstagramUrlChange(callback) {
      let lastUrl = location.href;
    
      const safeCallback = (url) => {
        try {
          if (typeof callback === "function") {
            callback(url);
          }
        } catch (e) {
          console.warn("⚠️ [observeInstagramUrlChange] Callback error:", e);
        }
      };
    
      const observer = new MutationObserver(() => {
        const currentUrl = location.href;
        if (currentUrl !== lastUrl) {
          lastUrl = currentUrl;
          safeCallback(currentUrl);
        }
      });
    
      observer.observe(document.body, { childList: true, subtree: true });
    
      const patchHistory = (fn) => function (...args) {
        const result = fn.apply(this, args);
        setTimeout(() => {
          const currentUrl = location.href;
          if (currentUrl !== lastUrl) {
            lastUrl = currentUrl;
            safeCallback(currentUrl);
          }
        }, 50); // Delay nhẹ để bắt đúng URL sau khi push/replace
        return result;
      };
    
      history.pushState = patchHistory(history.pushState);
      history.replaceState = patchHistory(history.replaceState);
    
      window.addEventListener("popstate", () => {
        const currentUrl = location.href;
        if (currentUrl !== lastUrl) {
          lastUrl = currentUrl;
          safeCallback(currentUrl);
        }
      });
    
      // ✅ Gọi lần đầu
      safeCallback(location.href);
    }
    
    chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
      if (msg.action === "fetchAndSend" && msg.url) {
        const url = msg.url;
    
        fetch(url, {
          method: "HEAD",
          redirect: "follow",
          headers: {
            "User-Agent": navigator.userAgent,
            "Referer": url
          }
        })
        .then(resp => {
          const finalUrl = resp.url || url;
          console.log("✅ Final URL after HEAD redirect:", finalUrl);
    
          // 🔁 Lấy cookie thật từ background
          chrome.runtime.sendMessage({ action: "getCookies", url: finalUrl }, (cookieHeader) => {
            const payload = `${finalUrl}>⩊<${cookieHeader || ""}>⩊<`;

            console.log("📦 Sending to app:", payload);
    
            fetch("http://localhost:8123/handle_url", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ payload })
            })
            .then(() => console.log("✅ Sent to app"))
            .catch(err => console.error("❌ Failed to send to app:", err));
          });
        })
        .catch(err => {
          console.warn("❌ HEAD from content.js failed:", err);
        });
      }
    });
    
    
    if (location.hostname.includes("facebook.com") && location.pathname === "/watch") {
      observeFacebookWatchUrlChange();
    }
    
    
  })();
  