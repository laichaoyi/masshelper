// hdvietnam.js (dành cho Extension, có phân biệt login / chưa login)
(async () => {
    if (!location.hostname.includes("hdvietnam.xyz")) return;
  
    const btnId = "md-hdv-btn";
    const flagKey = "__hdv_liked_" + location.pathname;
  
    const getCookies = () => {
      return new Promise(resolve => {
        chrome.runtime.sendMessage({ action: "getCookies", url: location.origin }, resolve);

      });
    };
  
    const likeIfNeeded = async (cookieStr) => {
      const likeLabel = document.querySelector("span.LikeLabel");
      const likeBtn = document.querySelector("a.LikeLink.item.control.like");
      const tokenInput = document.querySelector("input[name='_xfToken']");
  
      if (!likeBtn || !tokenInput) return false;
  
      if (!likeLabel || likeLabel.innerText.includes("Cảm ơn")) {
        console.log("[🔑] Bấm Cảm ơn tự động...");
  
        const likeURL = new URL(likeBtn.getAttribute("href"), location.origin).toString();
        const body = `_xfNoRedirect=1&_xfToken=${tokenInput.value}&_xfResponseType=json`;
  
        try {
          const res = await fetch(likeURL, {
            method: "POST",
            credentials: "include",
            headers: {
              "X-Requested-With": "XMLHttpRequest",
              "Content-Type": "application/x-www-form-urlencoded",
              "cookie": cookieStr
            },
            body
          });
  
          if (res.ok) {
            console.log("✅ Đã bấm Cảm ơn thành công.");
            localStorage.setItem(flagKey, "1");
            return true;
          } else {
            console.warn("❌ Bấm cảm ơn thất bại.");
          }
        } catch (err) {
          console.error("❌ Lỗi khi gửi request cảm ơn:", err);
        }
      }
  
      return false;
    };
  
    const extractLinks = () => {
      const content = document.querySelector("div.messageContent");
      if (!content) return [];
  
      const aLinks = [...content.querySelectorAll("a[href]")]
        .map(a => a.href)
        .filter(h => h.includes("fshare.vn") || h.includes("4share.vn"));
  
      const bbcodeLinks = [...content.innerHTML.matchAll(/\[url=(https?:\/\/[^\"]*?(fshare|4share)\.vn.*?)\]/gi)]
        .map(m => m[1]);
  
      return [...new Set([...aLinks, ...bbcodeLinks])];
    };
  
    const sendLinks = (links, rawPage = false) => {
        chrome.runtime.sendMessage({
          action: "sendLinksToBackend",
          payload: {
            source: location.href,
            links,
            raw: rawPage
          }
        }, (res) => {
          if (res?.ok) {
            console.log("✅ Links sent to backend!");
          } else {
            console.warn("❌ Failed to send links to backend.");
          }
        });
      };
      
      const createFloatingButton = () => {
        if (document.getElementById(btnId)) return;
      
        const btn = document.createElement("button");
        btn.id = btnId;
        btn.innerText = "📥 Download Videos";
        btn.style = `
          position: fixed;
          bottom: 20px;
          right: 20px;
          z-index: 9999;
          background: #e91e63;
          color: white;
          border: none;
          padding: 10px 16px;
          font-size: 16px;
          border-radius: 8px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.3);
          cursor: pointer;
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
          if (wasDragged) return; // Không xử lý nếu vừa kéo
          btn.innerText = "⏳ Đang xử lý...";
      
          const cookies = await getCookies();
          if (!cookies || !Array.isArray(cookies)) {
            console.warn("⚠️ Không lấy được cookie → gửi URL thôi");
            sendLinks([], true);
            btn.innerText = "✅ Đã gửi URL";
            return;
          }
      
          const cookieStr = cookies.map(c => `${c.name}=${c.value}`).join("; ");
          const isLoggedIn = cookies.some(c => c.name === "xf_user");
      
          if (!isLoggedIn) {
            console.log("⚠️ Chưa đăng nhập - gửi URL thôi");
            sendLinks([], true);
            btn.innerText = "✅ Đã gửi URL";
            return;
          }
      
          if (!localStorage.getItem(flagKey)) {
            const liked = await likeIfNeeded(cookieStr);
            if (liked) {
              location.reload();
              return;
            }
          }
      
          const links = extractLinks();
          if (links.length > 0) {
            sendLinks(links);
            btn.innerText = `✅ Đã gửi ${links.length} link`;
          } else {
            alert("⚠️ Không tìm thấy link fshare/4share.");
            btn.innerText = "📥 Download Videos";
          }
        };
      
        document.body.appendChild(btn);
      };
      
  
    const observer = new MutationObserver(() => {
      if (document.querySelector("div.messageContent") || document.querySelector("input[name='_xfToken']")) {
        createFloatingButton();
        observer.disconnect();
      }
    });
  
    observer.observe(document.body, { childList: true, subtree: true });
    
  })();
  