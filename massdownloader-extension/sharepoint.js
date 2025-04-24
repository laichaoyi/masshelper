// ==SharePoint Video Extractor==
(function () {
    if (!location.hostname.includes("sharepoint.com")) return;
  
    function createSharePointButton() {
      if (document.querySelector("#sharepointBtn")) return;
  
      // 📥 Hàm lấy filename từ phần tử tiêu đề video
      function getVideoFilename() {
        const label = document.querySelector('label[data-automationid="aboutVideoTitleView"]');
        if (!label) return "";
        const raw = label.innerText?.trim() || "";
        const clean = raw.split(".mp4")[0] + ".mp4";  // loại bỏ đuôi dư như .mp4.mp4_2
        return clean;
      }
  
      const btn = document.createElement("div");
      btn.id = "sharepointBtn";
      btn.innerText = "⬇️ Download SharePoint Video";
      btn.style.cssText = `
        position: fixed;
        top: 80px;
        right: 20px;
        z-index: 999999;
        padding: 10px 16px;
        background: #0086e6;
        color: white;
        font-size: 14px;
        border-radius: 8px;
        box-shadow: 0 2px 6px rgba(0,0,0,0.3);
        cursor: pointer;
        font-weight: bold;
        user-select: none;
      `;
  
      let offsetX = 0, offsetY = 0;
      let isDragging = false, wasDragged = false;
  
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
          btn.style.left = `${e.clientX - offsetX}px`;
          btn.style.top = `${e.clientY - offsetY}px`;
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
  
        btn.innerText = "⏳ Scanning...";
        btn.style.opacity = "0.6";
        btn.style.pointerEvents = "none";
  
        const allRequests = performance.getEntriesByType("resource");
        const videoUrls = allRequests.map(r => r.name).filter(url =>
          url.includes("videomanifest?provider=spo") && url.includes("format=dash")
        );
  
        const uniqueUrls = [...new Set(videoUrls)];
        const finalUrl = uniqueUrls.length ? uniqueUrls[0].split("&useScf=")[0] : null;
  
        if (!finalUrl) {
          alert("❌ No video URL found. Play the video first then try again.");
          btn.innerText = "⬇️ Download SharePoint Video";
          btn.style.opacity = "1";
          btn.style.pointerEvents = "auto";
          return;
        }
  
        const videoFilename = getVideoFilename();
  
        chrome.runtime.sendMessage({ action: "getCookies", url: finalUrl }, (cookieHeader) => {
          const payload = `${finalUrl}>⩊<${cookieHeader || ""}>⩊<video>⩊<${videoFilename}`;

          fetch("http://localhost:8123/handle_url", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ payload })
          }).then(() => {
            alert("✅ Video link sent to MassDownloader.");
          }).catch(() => {
            alert("❌ Failed to send video link.");
          }).finally(() => {
            btn.innerText = "⬇️ Download SharePoint Video";
            btn.style.opacity = "1";
            btn.style.pointerEvents = "auto";
          });
        });
      };
  
      document.body.appendChild(btn);
    }
  
    window.addEventListener("load", () => {
      setTimeout(createSharePointButton, 1000);
    });
  })();
  