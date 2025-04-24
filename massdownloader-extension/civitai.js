const OPT_IMAGE_FILE_ONLY = true;
const API_MODEL_VERSIONS = "https://civitai.com/api/v1/model-versions/";
const API_MODELS = "https://civitai.com/api/v1/models/";
const INTERVAL = 500;

(function () {
    'use strict';
    injectCSS();

    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
        if (args[0] && typeof args[0] === 'string' && args[0].startsWith("/api/trpc/track.addView")) {
            bind();
        }
        return originalFetch(...args);
    };

    if (document.location.pathname.match(/^\/models\/\d+\//)) {
        bind();
    }
})();

function injectCSS() {
    const GRADIENT_STYLE = {
        "background-image": "linear-gradient(45deg, rgb(106, 232, 247) 10%, rgb(54, 153, 219) 25%, rgb(49, 119, 193) 40%, rgb(149, 86, 243) 57%, rgb(131, 26, 176) 75%, rgb(139, 5, 151) 86%)",
    };
    const BUTTON_STYLE = {
        ...GRADIENT_STYLE,
        "border-width": "0",
        "position": "relative"
    };
    const BUTTON_BEFORE_STYLE = {
        "content": "''",
        "position": "absolute",
        "top": "0px",
        "left": "0px",
        "width": "100%",
        "height": "100%",
        ...GRADIENT_STYLE,
        "border-width": "0",
        "filter": "blur(4px)",
        "animation": "3s alternate-reverse infinite ease blink"
    };
    const BUTTON_AFTER_STYLE = {
        "content": "''",
        "position": "absolute",
        "top": "0px",
        "left": "0px",
        "width": "calc(100% - 4px)",
        "height": "calc(100% - 4px)",
        "margin": "2px",
        "background-color": "#000000AA",
        "border-radius": "4px",
    };

    const createCssSyntax = (selector, dic) =>
        `${selector} { ${Object.entries(dic).flatMap(kv => kv.join(":")).join(";")}; }`;
    const style = document.createElement("style");
    style.textContent =
        createCssSyntax(".downloader-effect", BUTTON_STYLE) +
        createCssSyntax(".downloader-effect::before", BUTTON_BEFORE_STYLE) +
        createCssSyntax(".downloader-effect::after", BUTTON_AFTER_STYLE) +
        "@keyframes blink { 0% { opacity: 0; } 100% { opacity: 1; } }";
    document.head.appendChild(style);
}

function bind() {
    const mainContents = document.querySelector(".mantine-ContainerGrid-root");
    if (!mainContents) return;

    const intervalId = setInterval(() => {
        document.querySelectorAll(".mantine-Button-root[type=button]:not(.downloader-binded)").forEach(link => {
            const text = link.textContent.trim();
            const hasDownloadIcon = [...link.querySelectorAll("svg")].some(svg => svg.classList.contains("tabler-icon-download"));
            link.classList.add("downloader-binded");

            if (!hasDownloadIcon && text !== "Download") return;

            link.classList.add("downloader-effect");
            link.firstElementChild?.style.setProperty("z-index", "1000");

            link.addEventListener("click", async (e) => {
                e.stopPropagation();
                const modelId = await getModelId();
                downloadAll(modelId);
            }, { once: true });
        });

        if (document.querySelectorAll(".mantine-Button-root[type=button]:not(.downloader-binded)").length === 0) {
            clearInterval(intervalId);
        }
    }, INTERVAL);
}

function getId() {
    return document.location.pathname.split(/[\/\?]/)[2];
}

async function getModelId() {
    const match = document.location.search.match(/modelVersionId=(\d+)/);
    if (match) return match[1];

    const id = getId();
    const res = await fetch(API_MODELS + id);
    const json = await res.json();
    return json.modelVersions[0].id;
}

async function downloadAll(modelId) {
    const res = await fetch(API_MODEL_VERSIONS + modelId);
    const json = await res.json();

    const modelInfo = json.files.find(f => f.type !== "Training Data");
    if (!modelInfo) return;

    const descriptionDiv = document.querySelector(
        ".mantine-ContainerGrid-root > :last-child > :last-child > :last-child > div:last-of-type > :last-child > :first-child > :first-child"
    );
    const description = descriptionDiv?.innerText;
    const fileNameBase = modelInfo.name.replace(/\.[^\.]+$/, "");

    await downloadImageFile(json, fileNameBase, 0);
    downloadMetaFile(json, fileNameBase);
    if (description) downloadDescriptionFile(description, fileNameBase);
}

async function downloadImageFile(modelVersionInfo, fileNameBase, imgIdx) {
    let imgs = modelVersionInfo.images;
    if (OPT_IMAGE_FILE_ONLY) imgs = imgs.filter(img => img.type === "image");
    if (!imgs.length) return;

    const img = imgs[imgIdx];
    let imgUrl = img.url;
    if (img.width) {
        imgUrl = imgUrl.replace(/\/width=\d+/, `/width=${img.width}`);
    }

    const res = await fetch(imgUrl);
    const blob = await res.blob();
    const ext = img.type === "image" ? "png" : "mp4";
    download(blob, `${fileNameBase}.preview.${ext}`);
}

function downloadMetaFile(modelVersionInfo, fileNameBase) {
    const json = JSON.stringify(modelVersionInfo, null, 4);
    const blob = new Blob([json], { type: "application/json" });
    download(blob, `${fileNameBase}.civitai.info`);
}

function downloadDescriptionFile(description, fileNameBase) {
    const blob = new Blob([description], { type: "text/plain" });
    download(blob, `${fileNameBase}.description.txt`);
}

function download(blob, fileName) {
    const reader = new FileReader();
    reader.onload = function () {
        const base64 = reader.result;
        chrome.runtime.sendMessage({
            type: "download-blob",
            filename: fileName,
            dataUrl: base64
        });
    };
    reader.readAsDataURL(blob);
}

