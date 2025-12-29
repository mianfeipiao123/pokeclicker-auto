// ==UserScript==
// @name         PokéClicker 简体中文补全（全量翻译文件 + DOM 替换）
// @namespace    https://github.com/mianfeipiao123/pokeclicker-auto
// @version      0.1.2
// @description  从你自己的 GitHub 加载 zh-Hans 翻译文件，并把页面上仍写死的英文替换为中文
// @match        https://pokeclicker.com/*
// @match        https://www.pokeclicker.com/*
// @match        http://localhost:*/*
// @match        http://127.0.0.1:*/*
// @updateURL    https://raw.githubusercontent.com/mianfeipiao123/pokeclicker-auto/main/%E7%BF%BB%E8%AF%91/tampermonkey/pokeclicker-zh-hans.user.js
// @downloadURL  https://raw.githubusercontent.com/mianfeipiao123/pokeclicker-auto/main/%E7%BF%BB%E8%AF%91/tampermonkey/pokeclicker-zh-hans.user.js
// @run-at       document-start
// @grant        none
// ==/UserScript==

(() => {
    'use strict';

    // 1) i18n 翻译源（github: 语法会被游戏自动转成 raw.githubusercontent.com）
    const TRANSLATIONS_PARAM_VALUE = 'github:mianfeipiao123/pokeclicker-auto/main/翻译';

    // 2) 源码写死文本替换词典（raw 链接）
    const HARDCODED_MAP_URL = 'https://raw.githubusercontent.com/mianfeipiao123/pokeclicker-auto/main/%E7%BF%BB%E8%AF%91/hardcoded/zh-Hans.map.json';

    const FORCE_LANG = 'zh-Hans';
    const TRANSLATIONS_QUERY_KEY = 'translations';

    const CSS_OVERRIDES = `
@media (min-width: 768px) {
  #left-column:empty::after,
  #middle-sort-column:empty::after,
  #right-column:empty::after {
    content: '将模块拖拽到此处' !important;
  }
}

.badgeEntry p::after {
  content: ' 徽章' !important;
}

.gender-toggle.toggler-wrapper .toggler-knob::after {
  content: '男' !important;
}

.gender-toggle.toggler-wrapper.style-1 input[type="checkbox"]:checked + .toggler-slider .toggler-knob::after {
  content: '女' !important;
}

.pokedexEntry span.attack::before {
  content: '攻击： ' !important;
}
`;

    const normalizeText = (text) =>
        String(text ?? '')
            .replace(/\u00A0/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();

    const shouldSkipNode = (node) => {
        if (!node) return true;
        const parent = node.parentElement;
        if (!parent) return false;
        const tag = parent.tagName?.toLowerCase();
        return tag === 'script' || tag === 'style' || tag === 'textarea' || tag === 'code' || tag === 'pre';
    };

    // Force i18next language early
    try {
        localStorage.setItem('i18nextLng', FORCE_LANG);
    } catch {
        // ignore
    }

    // Ensure translations override is present
    try {
        const url = new URL(window.location.href);
        const current = url.searchParams.get(TRANSLATIONS_QUERY_KEY);
        if (current !== TRANSLATIONS_PARAM_VALUE) {
            url.searchParams.set(TRANSLATIONS_QUERY_KEY, TRANSLATIONS_PARAM_VALUE);
            history.replaceState(null, '', url.toString());
        }
    } catch {
        // ignore
    }

    // CSS pseudo-element content can't be replaced via DOM text nodes.
    try {
        const style = document.createElement('style');
        style.id = 'pokeclicker-zh-hans-css-overrides';
        style.textContent = CSS_OVERRIDES;
        (document.head || document.documentElement).appendChild(style);
    } catch {
        // ignore
    }

    const attrNames = ['title', 'placeholder', 'aria-label', 'alt', 'data-original-title'];

    const applyMapToTextNode = (textNode, map) => {
        if (!textNode || textNode.nodeType !== Node.TEXT_NODE) return;
        if (shouldSkipNode(textNode)) return;
        const raw = textNode.nodeValue;
        const key = normalizeText(raw);
        if (!key) return;
        const zh = map[key];
        if (zh && zh !== raw) textNode.nodeValue = zh;
    };

    const applyMapToElementAttributes = (element, map) => {
        if (!element || element.nodeType !== Node.ELEMENT_NODE) return;
        for (const attr of attrNames) {
            if (!element.hasAttribute(attr)) continue;
            const raw = element.getAttribute(attr);
            const key = normalizeText(raw);
            const zh = map[key];
            if (zh && zh !== raw) element.setAttribute(attr, zh);
        }
    };

    const applyMapToRoot = (root, map) => {
        if (!root) return;
        if (root.nodeType === Node.TEXT_NODE) {
            applyMapToTextNode(root, map);
            return;
        }

        // Text nodes
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
        let node;
        // eslint-disable-next-line no-cond-assign
        while (node = walker.nextNode()) {
            applyMapToTextNode(node, map);
        }

        // Common attributes (root + descendants)
        if (root.nodeType === Node.ELEMENT_NODE) {
            applyMapToElementAttributes(root, map);
        }
        root.querySelectorAll?.('*')?.forEach((el) => applyMapToElementAttributes(el, map));
    };

    const applyMapToNode = (node, map) => {
        if (!node) return;
        if (node.nodeType === Node.TEXT_NODE) {
            applyMapToTextNode(node, map);
            return;
        }
        if (node.nodeType === Node.ELEMENT_NODE) {
            applyMapToRoot(node, map);
            return;
        }
        if (node.nodeType === Node.DOCUMENT_FRAGMENT_NODE) {
            node.childNodes?.forEach((c) => applyMapToNode(c, map));
        }
    };

    const start = async () => {
        /** @type {{ entries?: Record<string,string> }} */
        let mapData;
        try {
            const res = await fetch(HARDCODED_MAP_URL, { cache: 'no-cache' });
            if (res.ok) mapData = await res.json();
        } catch {
            // ignore
        }

        const map = mapData?.entries ?? {};

        applyMapToRoot(document.documentElement, map);

        const observer = new MutationObserver((mutations) => {
            for (const m of mutations) {
                if (m.type === 'childList') {
                    for (const n of m.addedNodes) {
                        applyMapToNode(n, map);
                    }
                } else if (m.type === 'characterData') {
                    applyMapToTextNode(m.target, map);
                }
            }
        });

        observer.observe(document.documentElement, {
            subtree: true,
            childList: true,
            characterData: true,
        });
    };

    window.addEventListener('DOMContentLoaded', () => void start(), { once: true });
})();
