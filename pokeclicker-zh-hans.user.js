// ==UserScript==
// @name         PokéClicker 简体中文补全（全量翻译文件 + DOM 替换）
// @namespace    https://github.com/mianfeipiao123/pokeclicker-auto
// @version      0.1.8
// @description  从你自己的 GitHub 加载 zh-Hans 翻译文件，并把页面上仍写死的英文替换为中文
// @match        https://pokeclicker.com/*
// @match        https://www.pokeclicker.com/*
// @match        http://localhost:*/*
// @match        http://127.0.0.1:*/*
// @updateURL    https://raw.githubusercontent.com/mianfeipiao123/pokeclicker-auto/main/pokeclicker-zh-hans.user.js
// @downloadURL  https://raw.githubusercontent.com/mianfeipiao123/pokeclicker-auto/main/pokeclicker-zh-hans.user.js
// @run-at       document-start
// @grant        none
// ==/UserScript==

(() => {
    'use strict';

    // 1) i18n 翻译源（github: 语法会被游戏自动转成 raw.githubusercontent.com）
    const TRANSLATIONS_PARAM_VALUE = 'github:mianfeipiao123/pokeclicker-auto/main';

    // 2) 源码写死文本替换词典（raw 链接）
    const HARDCODED_MAP_URL = 'https://raw.githubusercontent.com/mianfeipiao123/pokeclicker-auto/main/hardcoded/zh-Hans.map.json';

    const FORCE_LANG = 'zh-Hans';
    const TRANSLATIONS_QUERY_KEY = 'translations';

    const TRANSLATIONS_BASE_URL = (() => {
        if (TRANSLATIONS_PARAM_VALUE.startsWith('github:')) {
            return `https://raw.githubusercontent.com/${TRANSLATIONS_PARAM_VALUE.split(':')[1]}`;
        }
        return TRANSLATIONS_PARAM_VALUE;
    })();

    const POKEMON_TRANSLATIONS_URL = `${TRANSLATIONS_BASE_URL}/locales/${FORCE_LANG}/pokemon.json`;

    const INLINE_OVERRIDES = {
        // Intro.js / common UI
        Next: '下一步',
        Back: '上一步',
        Skip: '跳过',
        Done: '完成',
        Close: '关闭',
        Cancel: '取消',
        OK: '确定',
        Yes: '是',
        No: '否',
    };

    /** @type {Record<string,string>} */
    let pokemonTranslations = {};

    let DEBUG = false;
    try {
        DEBUG = localStorage.getItem('pokeclickerZhHansDebug') === '1';
    } catch {
        DEBUG = false;
    }

    const missingSet = new Set();
    const recordMissing = (key) => {
        if (!DEBUG) return;
        if (!key || missingSet.has(key)) return;
        missingSet.add(key);
        // eslint-disable-next-line no-console
        console.warn('[PokéClicker zh-Hans missing]', key);
    };
    // Quick way to export missing strings from console.
    // Example: `copy(PokeClickerZhHans.dumpMissing().join('\\n'))`
    // eslint-disable-next-line no-undef
    window.PokeClickerZhHans = {
        dumpMissing: () => Array.from(missingSet).sort((a, b) => a.localeCompare(b)),
    };

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

    const splitOuterWhitespace = (text) => {
        const s = String(text ?? '').replace(/\u00A0/g, ' ');
        const m = s.match(/^(\s*)([\s\S]*?)(\s*)$/);
        return {
            leading: m?.[1] ?? '',
            core: m?.[2] ?? s,
            trailing: m?.[3] ?? '',
        };
    };

    const shouldUseHardcodedMap = (text) => {
        const s = String(text ?? '');
        const latinCount = (s.match(/[A-Za-z]/g) || []).length;
        const hanCount = (s.match(/[\u4E00-\u9FFF]/g) || []).length;
        // Only apply the hardcoded map to strings that are mostly Latin-script (i.e. likely untranslated English).
        // This prevents bad map entries from rewriting already-translated Chinese Pokémon names.
        return latinCount >= 2 && latinCount >= hanCount;
    };

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

    const attrNames = ['title', 'placeholder', 'aria-label', 'alt', 'data-original-title', 'data-content', 'data-intro'];

    const escapeRegExp = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    const TYPE_TRANSLATIONS = {
        None: '无属性',
        Normal: '一般系',
        Fire: '火系',
        Water: '水系',
        Grass: '草系',
        Electric: '电系',
        Ice: '冰系',
        Fighting: '格斗系',
        Poison: '毒系',
        Ground: '地面系',
        Flying: '飞行系',
        Psychic: '超能力系',
        Bug: '虫系',
        Rock: '岩石系',
        Ghost: '幽灵系',
        Dragon: '龙系',
        Dark: '恶系',
        Steel: '钢系',
        Fairy: '妖精系',
    };

    const resolveI18NextNesting = (text, dict) => {
        let out = String(text ?? '');
        for (let i = 0; i < 6; i += 1) {
            const next = out.replace(/\[\[([^[\]]+?)\]\]/g, (_, key) => dict?.[key] ?? key);
            if (next === out) break;
            out = next;
        }
        return out;
    };

    const translateDynamicSegment = (segment, map) => {
        const key = normalizeText(segment);
        if (!key) return segment;

        const pokemon = pokemonTranslations?.[key];
        if (typeof pokemon === 'string') {
            return resolveI18NextNesting(pokemon, pokemonTranslations);
        }

        const mapped = shouldUseHardcodedMap(key) ? map?.[key] : undefined;
        if (typeof mapped === 'string' && !mapped.includes('${...}')) {
            return mapped;
        }

        const gymAtMatch = key.match(/^(.+?)'s Gym at (.+)$/);
        if (gymAtMatch) {
            const leader = gymAtMatch[1];
            const town = gymAtMatch[2];
            const leaderGymKey = `${leader}'s Gym`;
            const leaderGym = translateDynamicSegment(leaderGymKey, map);
            const townName = translateDynamicSegment(town, map);
            return `${leaderGym}（${townName}）`;
        }

        const trialAtMatch = key.match(/^(.+? Trial) at (.+)$/);
        if (trialAtMatch) {
            const trialName = translateDynamicSegment(trialAtMatch[1], map);
            const trialTown = translateDynamicSegment(trialAtMatch[2], map);
            return `${trialName}（${trialTown}）`;
        }

        const type = TYPE_TRANSLATIONS[key];
        if (type) return type;

        const routeMatch = key.match(/^Route\s+(\d+)(?:\s+in\s+(.+))?$/);
        if (routeMatch) {
            const routeNumber = routeMatch[1];
            const regionOrSub = routeMatch[2] ? translateDynamicSegment(routeMatch[2], map) : '';
            return regionOrSub ? `${routeNumber}号道路（${regionOrSub}）` : `${routeNumber}号道路`;
        }

        return segment;
    };

    const buildPatterns = (map) => {
        const placeholder = '${...}';
        const patterns = [];
        for (const [en, zh] of Object.entries(map)) {
            if (!en.includes(placeholder)) continue;
            if (typeof zh !== 'string' || !zh.includes(placeholder)) continue;
            const enParts = en.split(placeholder);
            const zhParts = zh.split(placeholder);
            if (enParts.length <= 1) continue;
            // Allow translations to omit placeholders (e.g. plural "s") by using fewer `${...}`.
            // We only support consuming placeholders from left to right.
            if (zhParts.length <= 1) continue;
            if (zhParts.length > enParts.length) continue;
            const re = new RegExp(`^${enParts.map(escapeRegExp).join('(.+?)')}$`);
            patterns.push({ re, zhParts });
        }
        // Longer regex first to reduce accidental matches
        patterns.sort((a, b) => b.re.source.length - a.re.source.length);
        return patterns;
    };

    const applyPatterns = (text, patterns, map) => {
        for (const p of patterns) {
            const m = text.match(p.re);
            if (!m) continue;
            let out = p.zhParts[0] ?? '';
            for (let i = 1; i < p.zhParts.length; i += 1) {
                out += translateDynamicSegment(m[i] ?? '', map) + (p.zhParts[i] ?? '');
            }
            return out;
        }
        return null;
    };

    const applyMapToTextNode = (textNode, map, patterns, cache) => {
        if (!textNode || textNode.nodeType !== Node.TEXT_NODE) return;
        if (shouldSkipNode(textNode)) return;
        const raw = String(textNode.nodeValue ?? '');
        const { leading, core, trailing } = splitOuterWhitespace(raw);
        const key = normalizeText(core);
        if (!key) return;
        const useMap = shouldUseHardcodedMap(key);

        const cached = cache.get(key);
        if (cached != null) {
            if (cached) {
                const out = `${leading}${cached}${trailing}`;
                if (out !== raw) textNode.nodeValue = out;
            }
            return;
        }

        let zh = INLINE_OVERRIDES[key];
        if (useMap) {
            const pokemon = pokemonTranslations?.[key];
            if (!zh && typeof pokemon === 'string') {
                zh = resolveI18NextNesting(pokemon, pokemonTranslations);
            }
            zh = zh ?? map[key];
        }
        if (!zh && useMap && patterns.length) {
            zh = applyPatterns(key, patterns, map);
        }

        cache.set(key, zh ?? '');
        if (!zh) recordMissing(key);
        if (zh) {
            const out = `${leading}${zh}${trailing}`;
            if (out !== raw) textNode.nodeValue = out;
        }
    };

    const applyMapToElementAttributes = (element, map, patterns, cache) => {
        if (!element || element.nodeType !== Node.ELEMENT_NODE) return;
        for (const attr of attrNames) {
            if (!element.hasAttribute(attr)) continue;
            const raw = element.getAttribute(attr);
            if (raw == null) continue;

            if (attr === 'data-intro') {
                try {
                    const template = document.createElement('template');
                    template.innerHTML = raw;
                    applyMapToNode(template.content, map, patterns, cache);
                    const out = template.innerHTML;
                    if (out && out !== raw) element.setAttribute(attr, out);
                } catch {
                    // ignore
                }
                continue;
            }

            const { leading, core, trailing } = splitOuterWhitespace(raw);
            const key = normalizeText(core);
            if (!key) continue;
            const useMap = shouldUseHardcodedMap(key);

            const cached = cache.get(key);
            if (cached != null) {
                if (cached) {
                    const out = `${leading}${cached}${trailing}`;
                    if (out !== raw) element.setAttribute(attr, out);
                }
                continue;
            }

            let zh = INLINE_OVERRIDES[key];
            if (useMap) {
                const pokemon = pokemonTranslations?.[key];
                if (!zh && typeof pokemon === 'string') {
                    zh = resolveI18NextNesting(pokemon, pokemonTranslations);
                }
                zh = zh ?? map[key];
            }
            if (!zh && useMap && patterns.length) {
                zh = applyPatterns(key, patterns, map);
            }

            cache.set(key, zh ?? '');
            if (!zh) recordMissing(key);
            if (zh) {
                const out = `${leading}${zh}${trailing}`;
                if (out !== raw) element.setAttribute(attr, out);
            }
        }
    };

    const applyMapToRoot = (root, map, patterns, cache) => {
        if (!root) return;
        if (root.nodeType === Node.TEXT_NODE) {
            applyMapToTextNode(root, map, patterns, cache);
            return;
        }

        // Text nodes
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
        let node;
        // eslint-disable-next-line no-cond-assign
        while (node = walker.nextNode()) {
            applyMapToTextNode(node, map, patterns, cache);
        }

        // Common attributes (root + descendants)
        if (root.nodeType === Node.ELEMENT_NODE) {
            applyMapToElementAttributes(root, map, patterns, cache);
        }
        root.querySelectorAll?.('*')?.forEach((el) => applyMapToElementAttributes(el, map, patterns, cache));
    };

    const applyMapToNode = (node, map, patterns, cache) => {
        if (!node) return;
        if (node.nodeType === Node.TEXT_NODE) {
            applyMapToTextNode(node, map, patterns, cache);
            return;
        }
        if (node.nodeType === Node.ELEMENT_NODE) {
            applyMapToRoot(node, map, patterns, cache);
            return;
        }
        if (node.nodeType === Node.DOCUMENT_FRAGMENT_NODE) {
            node.childNodes?.forEach((c) => applyMapToNode(c, map, patterns, cache));
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

        try {
            const res = await fetch(POKEMON_TRANSLATIONS_URL, { cache: 'no-cache' });
            if (res.ok) {
                const json = await res.json();
                const dict = {};
                for (const [k, v] of Object.entries(json ?? {})) {
                    if (k === 'alt') continue;
                    if (typeof v === 'string') dict[k] = v;
                }
                pokemonTranslations = dict;
            }
        } catch {
            // ignore
        }

        const map = mapData?.entries ?? {};
        const patterns = buildPatterns(map);
        const cache = new Map();

        applyMapToRoot(document.documentElement, map, patterns, cache);

        const observer = new MutationObserver((mutations) => {
            for (const m of mutations) {
                if (m.type === 'childList') {
                    for (const n of m.addedNodes) {
                        applyMapToNode(n, map, patterns, cache);
                    }
                } else if (m.type === 'characterData') {
                    applyMapToTextNode(m.target, map, patterns, cache);
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
