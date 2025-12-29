// ==UserScript==
// @name         PokéClicker 简体中文补全（全量翻译文件 + DOM 替换）
// @namespace    https://github.com/mianfeipiao123/pokeclicker-auto
// @version      0.1.0
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
    const TRANSLATIONS_PARAM_VALUE = 'github:mianfeipiao123/pokeclicker-auto/main/%E7%BF%BB%E8%AF%91';

    // 2) 源码写死文本替换词典（raw 链接）
    const HARDCODED_MAP_URL = 'https://raw.githubusercontent.com/mianfeipiao123/pokeclicker-auto/main/%E7%BF%BB%E8%AF%91/hardcoded/zh-Hans.map.json';

    const FORCE_LANG = 'zh-Hans';
    const TRANSLATIONS_QUERY_KEY = 'translations';

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
            window.location.replace(url.toString());
            return;
        }
    } catch {
        // ignore
    }

    const applyMapToRoot = (root, map) => {
        // Text nodes
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
        let node;
        // eslint-disable-next-line no-cond-assign
        while (node = walker.nextNode()) {
            if (shouldSkipNode(node)) continue;
            const raw = node.nodeValue;
            const key = normalizeText(raw);
            if (!key) continue;
            const zh = map[key];
            if (zh) node.nodeValue = zh;
        }

        // Common attributes
        const attrNames = ['title', 'placeholder', 'aria-label', 'alt', 'data-original-title'];
        root.querySelectorAll?.('*')?.forEach((el) => {
            for (const attr of attrNames) {
                if (!el.hasAttribute(attr)) continue;
                const raw = el.getAttribute(attr);
                const key = normalizeText(raw);
                const zh = map[key];
                if (zh) el.setAttribute(attr, zh);
            }
        });
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
                for (const n of m.addedNodes) {
                    if (!(n instanceof HTMLElement)) continue;
                    applyMapToRoot(n, map);
                }
                if (m.type === 'characterData' && m.target?.nodeType === Node.TEXT_NODE) {
                    applyMapToRoot(m.target.parentElement ?? document.documentElement, map);
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
