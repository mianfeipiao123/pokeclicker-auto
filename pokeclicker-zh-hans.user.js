// ==UserScript==
// @name         PokéClicker 简体中文补全（全量翻译文件 + DOM 替换）
// @namespace    https://github.com/mianfeipiao123/pokeclicker-auto
// @version      0.1.17
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

    // 拦截 Notifier.notify 替换翻译加载通知（文案从外置配置加载）
    let notifierLoadedMessage = 'Translations loaded';
    const hookNotifier = () => {
        if (window.Notifier?.notify) {
            const originalNotify = window.Notifier.notify.bind(window.Notifier);
            window.Notifier.notify = (options) => {
                if (options?.message?.startsWith('Using ') && options.message.includes(' for translations')) {
                    options.message = notifierLoadedMessage;
                }
                return originalNotify(options);
            };
            return true;
        }
        return false;
    };
    if (!hookNotifier()) {
        const interval = setInterval(() => {
            if (hookNotifier()) clearInterval(interval);
        }, 50);
        setTimeout(() => clearInterval(interval), 10000);
    }

    const SCRIPT_VERSION = '0.1.17';

    // 1) i18n 翻译源（github: 语法会被游戏自动转成 raw.githubusercontent.com）
    // You can override this per-browser via:
    // `localStorage.setItem('pokeclickerZhHansTranslations', 'github:...')`
    // or a custom URL base that hosts `/locales` and `/hardcoded`.
    const DEFAULT_TRANSLATIONS_PARAM_VALUE = 'github:mianfeipiao123/pokeclicker-auto/main';
    let TRANSLATIONS_PARAM_VALUE = DEFAULT_TRANSLATIONS_PARAM_VALUE;
    try {
        TRANSLATIONS_PARAM_VALUE = localStorage.getItem('pokeclickerZhHansTranslations') || DEFAULT_TRANSLATIONS_PARAM_VALUE;
    } catch {
        TRANSLATIONS_PARAM_VALUE = DEFAULT_TRANSLATIONS_PARAM_VALUE;
    }

    const FORCE_LANG = 'zh-Hans';
    const TRANSLATIONS_QUERY_KEY = 'translations';

    const TRANSLATIONS_BASE_URL = (() => {
        if (TRANSLATIONS_PARAM_VALUE.startsWith('github:')) {
            return `https://raw.githubusercontent.com/${TRANSLATIONS_PARAM_VALUE.split(':')[1]}`;
        }
        return TRANSLATIONS_PARAM_VALUE;
    })();

    const POKEMON_TRANSLATIONS_URL = `${TRANSLATIONS_BASE_URL}/${FORCE_LANG}/locales/pokemon.json`;
    const USERSCRIPT_CONFIG_URL = `${TRANSLATIONS_BASE_URL}/${FORCE_LANG}/overrides/userscript.json`;
    const BUNDLE_URL = `${TRANSLATIONS_BASE_URL}/${FORCE_LANG}/bundle.json`;

    // Keep script logic generic
    const INLINE_OVERRIDES = {};

    /** @type {Record<string,string>} */
    let pokemonTranslations = {};
    /** @type {Array<[string,string]>} */
    let reversePokemonTranslations = [];

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
        getConfig: () => ({
            scriptVersion: SCRIPT_VERSION,
            forceLang: FORCE_LANG,
            translations: TRANSLATIONS_PARAM_VALUE,
            translationsBaseUrl: TRANSLATIONS_BASE_URL,
        }),
    };

    const escapeCssContent = (s) =>
        String(s ?? '')
            .replace(/\\/g, '\\\\')
            .replace(/'/g, "\\'")
            .replace(/\r?\n/g, ' ');

    const buildCssOverrides = (labels) => {
        const dragModules = escapeCssContent(labels?.dragModules ?? 'Drag modules here');
        const badgeSuffix = escapeCssContent(labels?.badgeSuffix ?? ' Badge');
        const genderMale = escapeCssContent(labels?.genderMale ?? 'M');
        const genderFemale = escapeCssContent(labels?.genderFemale ?? 'F');
        const pokedexAttackPrefix = escapeCssContent(labels?.pokedexAttackPrefix ?? 'Attack: ');
        return `
@media (min-width: 768px) {
  #left-column:empty::after,
  #middle-sort-column:empty::after,
  #right-column:empty::after {
    content: '${dragModules}' !important;
  }
}

.badgeEntry p::after {
  content: '${badgeSuffix}' !important;
}

.gender-toggle.toggler-wrapper .toggler-knob::after {
  content: '${genderMale}' !important;
}

.gender-toggle.toggler-wrapper.style-1 input[type="checkbox"]:checked + .toggler-slider .toggler-knob::after {
  content: '${genderFemale}' !important;
}

.pokedexEntry span.attack::before {
  content: '${pokedexAttackPrefix}' !important;
}
`;
    };

    const injectCssOverrides = (labels) => {
        try {
            const css = buildCssOverrides(labels);
            let style = document.getElementById('pokeclicker-zh-hans-css-overrides');
            if (!style) {
                style = document.createElement('style');
                style.id = 'pokeclicker-zh-hans-css-overrides';
                (document.head || document.documentElement).appendChild(style);
            }
            if (style.textContent !== css) style.textContent = css;
        } catch {
            // ignore
        }
    };

    const normalizeText = (text) =>
        String(text ?? '')
            .replace(/\u00A0/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();

    const normalizeForLookup = (text) => {
        let s = String(text ?? '');
        s = s
            .replace(/\u00A0/g, ' ')
            .replace(/，/g, ',')
            .replace(/。/g, '.')
            .replace(/：/g, ':')
            .replace(/；/g, ';');
        s = s.replace(/\s*,\s*/g, ', ');
        return normalizeText(s);
    };

    const demixForLookup = (text) => {
        let s = normalizeForLookup(text);
        if (!s) return s;
        if (!/[\u4E00-\u9FFF]/.test(s) || !/[A-Za-z]/.test(s)) return s;

        // Common in-game terms that may already be translated but appear inside English sentences.
        s = s.replace(/图鉴/g, 'Pokédex');
        s = s.replace(/宝可梦币|宝可币/g, 'Poké Coins');
        s = s.replace(/超极巨化/g, 'Gigantamax');
        s = s.replace(/无极巨化/g, 'Eternamax');
        s = s.replace(/暗影/g, 'Shadow ');
        s = s.replace(/粉红/g, 'Pinkan');
        s = s.replace(/胆噬虫/g, 'Wimpod');

        if (reversePokemonTranslations.length) {
            for (const [zh, en] of reversePokemonTranslations) {
                if (!zh || !en) continue;
                if (s.includes(zh)) s = s.split(zh).join(en);
            }
        }

        s = s.replace(/Farfetch'd'd/g, "Farfetch'd");
        return normalizeText(s);
    };

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

    // Keep the address bar clean (no `?translations=...`) while still making the game read our translations override.
    // The game reads overrides via: `new URLSearchParams(window.location.search).get('translations')`.
    // We shim URLSearchParams to inject the parameter when it's built from `window.location.search`,
    // and then remove the parameter from the visible URL.
    try {
        const OriginalURLSearchParams = window.URLSearchParams;
        if (typeof OriginalURLSearchParams === 'function' && !OriginalURLSearchParams.__pkcZhHansShim) {
            const buildAugmentedSearch = (search) => {
                const s = String(search ?? '');
                if (!s.startsWith('?')) return s;
                if (s.includes(`${TRANSLATIONS_QUERY_KEY}=`)) return s;
                const sep = s.length > 1 ? '&' : '';
                return `${s}${sep}${TRANSLATIONS_QUERY_KEY}=${encodeURIComponent(TRANSLATIONS_PARAM_VALUE)}`;
            };

            // eslint-disable-next-line func-names
            const PatchedURLSearchParams = function (init) {
                const actual = (typeof init === 'string' && init === window.location.search)
                    ? buildAugmentedSearch(init)
                    : init;
                // Support being called with or without `new`
                // eslint-disable-next-line new-cap
                return new OriginalURLSearchParams(actual);
            };
            PatchedURLSearchParams.prototype = OriginalURLSearchParams.prototype;
            Object.setPrototypeOf(PatchedURLSearchParams, OriginalURLSearchParams);
            Object.defineProperty(PatchedURLSearchParams, '__pkcZhHansShim', { value: true });
            window.URLSearchParams = PatchedURLSearchParams;
        }

        const url = new URL(window.location.href);
        if (url.searchParams.has(TRANSLATIONS_QUERY_KEY)) {
            url.searchParams.delete(TRANSLATIONS_QUERY_KEY);
            history.replaceState(null, '', url.toString());
        }
    } catch {
        // ignore
    }

    const attrNames = ['title', 'placeholder', 'aria-label', 'alt', 'data-original-title', 'data-content', 'data-intro'];

    const escapeRegExp = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    /** @type {Record<string,string>} */
    let typeTranslations = {};

    const TYPE_KEYS = [
        'None',
        'Normal',
        'Fire',
        'Water',
        'Grass',
        'Electric',
        'Ice',
        'Fighting',
        'Poison',
        'Ground',
        'Flying',
        'Psychic',
        'Bug',
        'Rock',
        'Ghost',
        'Dragon',
        'Dark',
        'Steel',
        'Fairy',
    ];

    const loadUserscriptConfig = async () => {
        try {
            const res = await fetch(USERSCRIPT_CONFIG_URL, { cache: 'no-cache' });
            if (!res.ok) return null;
            const json = await res.json();
            const entries = json?.entries ?? {};
            const getEntry = (k) => {
                const v = entries?.[k];
                if (typeof v === 'string') return v;
                if (v && typeof v === 'object' && typeof v.translation === 'string') return v.translation;
                return null;
            };

            const config = {
                notifierLoadedMessage: getEntry('__userscript.notifier.loaded') ?? notifierLoadedMessage,
                css: {
                    dragModules: getEntry('__userscript.css.dragModules') ?? null,
                    badgeSuffix: getEntry('__userscript.css.badgeSuffix') ?? null,
                    genderMale: getEntry('__userscript.css.genderMale') ?? null,
                    genderFemale: getEntry('__userscript.css.genderFemale') ?? null,
                    pokedexAttackPrefix: getEntry('__userscript.css.pokedexAttackPrefix') ?? null,
                },
                types: {},
            };

            for (const key of TYPE_KEYS) {
                const v = getEntry(`__userscript.type.${key}`);
                if (typeof v === 'string' && v) config.types[key] = v;
            }

            return config;
        } catch {
            return null;
        }
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

        if (key === 'a' || key === 'an') {
            return '';
        }

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

        const type = typeTranslations?.[key];
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
                const segment = translateDynamicSegment(m[i] ?? '', map);
                let suffix = p.zhParts[i] ?? '';
                if (!segment) {
                    suffix = suffix.replace(/^\s+/, '');
                }
                out += segment + suffix;
            }
            return out;
        }
        return null;
    };

    const resolveTranslation = (key, map, patterns) => {
        if (!key) return null;
        const altKey = normalizeForLookup(key);
        const candidates = altKey && altKey !== key ? [key, altKey] : [key];
        const demixed = demixForLookup(altKey || key);
        if (demixed && !candidates.includes(demixed)) candidates.push(demixed);

        for (const k of candidates) {
            const inline = INLINE_OVERRIDES[k];
            if (typeof inline === 'string' && inline) return inline;
        }

        for (const k of candidates) {
            const direct = map?.[k];
            if (typeof direct === 'string' && direct) return direct;
        }

        const useMap = candidates.some((k) => shouldUseHardcodedMap(k));
        if (!useMap) return null;

        for (const k of candidates) {
            const pokemon = pokemonTranslations?.[k];
            if (typeof pokemon === 'string') {
                return resolveI18NextNesting(pokemon, pokemonTranslations);
            }
        }

        if (patterns.length) {
            for (const k of candidates) {
                const matched = applyPatterns(k, patterns, map);
                if (typeof matched === 'string' && matched) return matched;
            }
        }

        return null;
    };

    const translateSegmentsFallback = (text, map, patterns, cache) => {
        const input = String(text ?? '');
        if (!input) return null;

        const hasHan = /[\u4E00-\u9FFF]/.test(input);
        const hasLatin = /[A-Za-z]/.test(input);
        if (!hasHan && !hasLatin) return null;

        const translatePiece = (piece) => {
            if (!piece) return piece;
            const { leading: l, core: c, trailing: t } = splitOuterWhitespace(piece);
            const pieceKey = normalizeText(c);
            if (!pieceKey) return piece;

            // Handle leftover English articles (often appear as their own text node).
            if (pieceKey === 'a' || pieceKey === 'an') {
                return '';
            }

            let cached = cache.get(pieceKey);
            if (cached == null) {
                const resolved = resolveTranslation(pieceKey, map, patterns);
                cache.set(pieceKey, resolved ?? '');
                cached = resolved ?? '';
            }
            if (!cached) return piece;

            const out = `${l}${cached}${t}`;
            return out === piece ? piece : out;
        };

        const englishRunRe = /[A-Za-z][A-Za-z0-9\s,.\"'!?():/\\-]*/g;
        let out = '';
        let lastIndex = 0;
        let changed = false;
        let m;
        // eslint-disable-next-line no-cond-assign
        while (m = englishRunRe.exec(input)) {
            const before = input.slice(lastIndex, m.index);
            const beforeOut = translatePiece(before);
            if (beforeOut !== before) changed = true;
            out += beforeOut;

            const seg = m[0];
            const segOut = translatePiece(seg);
            if (segOut !== seg) changed = true;
            out += segOut;

            lastIndex = m.index + seg.length;
        }

        const tail = input.slice(lastIndex);
        const tailOut = translatePiece(tail);
        if (tailOut !== tail) changed = true;
        out += tailOut;

        return changed ? out : null;
    };

    const applyMapToTextNode = (textNode, map, patterns, cache) => {
        if (!textNode || textNode.nodeType !== Node.TEXT_NODE) return;
        if (shouldSkipNode(textNode)) return;
        const raw = String(textNode.nodeValue ?? '');
        const { leading, core, trailing } = splitOuterWhitespace(raw);
        const key = normalizeText(core);
        if (!key) return;

        if (cache.has(key)) {
            const cached = cache.get(key);
            if (cached) {
                const out = `${leading}${cached}${trailing}`;
                if (out !== raw) textNode.nodeValue = out;
                return;
            }
        }

        if (!cache.has(key)) {
            const resolved = resolveTranslation(key, map, patterns);
            cache.set(key, resolved ?? '');
        }

        const cached = cache.get(key);
        if (cached) {
            const out = `${leading}${cached}${trailing}`;
            if (out !== raw) textNode.nodeValue = out;
            return;
        }

        if (/[\r\n]/.test(core)) {
            const parts = core.split(/(\r?\n+)/);
            let changed = false;
            for (let i = 0; i < parts.length; i += 1) {
                const part = parts[i];
                if (!part || /^\r?\n+$/.test(part)) continue;
                const { leading: l, core: c, trailing: t } = splitOuterWhitespace(part);
                const partKey = normalizeText(c);
                if (!partKey) continue;

                let partCached = cache.get(partKey);
                if (partCached == null) {
                    const resolved = resolveTranslation(partKey, map, patterns);
                    cache.set(partKey, resolved ?? '');
                    partCached = resolved ?? '';
                }

                if (partCached) {
                    const outPart = `${l}${partCached}${t}`;
                    if (outPart !== part) {
                        parts[i] = outPart;
                        changed = true;
                    }
                    continue;
                }

                const segOut = translateSegmentsFallback(c, map, patterns, cache);
                if (segOut) {
                    const outPart = `${l}${segOut}${t}`;
                    if (outPart !== part) {
                        parts[i] = outPart;
                        changed = true;
                    }
                }
            }

            if (changed) {
                const newCore = parts.join('');
                cache.set(key, newCore);
                const out = `${leading}${newCore}${trailing}`;
                if (out !== raw) textNode.nodeValue = out;
                return;
            }
        }

        const segOut = translateSegmentsFallback(core, map, patterns, cache);
        if (segOut) {
            cache.set(key, segOut);
            const out = `${leading}${segOut}${trailing}`;
            if (out !== raw) textNode.nodeValue = out;
            return;
        }

        recordMissing(key);
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

            if (cache.has(key)) {
                const cached = cache.get(key);
                if (cached) {
                    const out = `${leading}${cached}${trailing}`;
                    if (out !== raw) element.setAttribute(attr, out);
                    continue;
                }
            }

            if (!cache.has(key)) {
                const resolved = resolveTranslation(key, map, patterns);
                cache.set(key, resolved ?? '');
            }

            const cached = cache.get(key);
            if (cached) {
                const out = `${leading}${cached}${trailing}`;
                if (out !== raw) element.setAttribute(attr, out);
                continue;
            }

            const segOut = translateSegmentsFallback(core, map, patterns, cache);
            if (segOut) {
                cache.set(key, segOut);
                const out = `${leading}${segOut}${trailing}`;
                if (out !== raw) element.setAttribute(attr, out);
                continue;
            }

            if (useMap) recordMissing(key);
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
        if (DEBUG) {
            // eslint-disable-next-line no-console
            console.info('[PokéClicker zh-Hans]', window.PokeClickerZhHans.getConfig());
        }

        const config = await loadUserscriptConfig();
        if (config) {
            notifierLoadedMessage = config.notifierLoadedMessage || notifierLoadedMessage;
            typeTranslations = config.types || typeTranslations;
            injectCssOverrides(config.css);
        } else {
            injectCssOverrides(null);
        }

        /** @type {Record<string,string>} */
        let map = {};

        const loadMapFromBundle = async () => {
            try {
                const res = await fetch(BUNDLE_URL, { cache: 'no-cache' });
                if (!res.ok) return false;
                const json = await res.json();
                const entries = json?.entries ?? {};
                if (!entries || typeof entries !== 'object') return false;
                let count = 0;
                for (const [key, value] of Object.entries(entries)) {
                    if (typeof value === 'string' && value) {
                        map[key] = value;
                        count += 1;
                        continue;
                    }
                    if (value && typeof value === 'object' && typeof value.translation === 'string' && value.translation) {
                        map[key] = value.translation;
                        count += 1;
                    }
                }
                if (DEBUG) {
                    // eslint-disable-next-line no-console
                    console.info('[PokéClicker zh-Hans] 已加载 bundle:', count, '条翻译');
                }
                return count > 0;
            } catch {
                return false;
            }
        };

        // 优先加载 bundle（发布用单文件），失败再回退到分文件索引
        try {
            const ok = await loadMapFromBundle();
            if (!ok) {
                const indexUrl = `${TRANSLATIONS_BASE_URL}/${FORCE_LANG}/_index.json`;
                const indexRes = await fetch(indexUrl, { cache: 'no-cache' });
                if (indexRes.ok) {
                    const index = await indexRes.json();
                    const files = Object.keys(index.files || {}).filter((f) =>
                        !f.includes('/code.json')
                        && !f.startsWith('locales/')
                        && f !== 'overrides/userscript.json'
                        && f !== 'bundle.json'
                    );
                    const results = await Promise.all(
                        files.map(file =>
                            fetch(`${TRANSLATIONS_BASE_URL}/${FORCE_LANG}/${file}`, { cache: 'no-cache' })
                                .then(r => r.ok ? r.json() : null)
                                .catch(() => null)
                        )
                    );
                    for (const data of results) {
                        if (data?.entries) {
                            for (const [key, value] of Object.entries(data.entries)) {
                                if (typeof value === 'string') {
                                    if (value) map[key] = value;
                                } else if (value?.translation) {
                                    map[key] = value.translation;
                                }
                            }
                        }
                    }
                    if (DEBUG) {
                        // eslint-disable-next-line no-console
                        console.info('[PokéClicker zh-Hans] 已加载分文件翻译:', files.length, '个文件,', Object.keys(map).length, '条翻译');
                    }
                } else {
                    console.error('[PokéClicker zh-Hans] 无法加载翻译索引文件');
                }
            }
        } catch (e) {
            console.error('[PokéClicker zh-Hans] 加载翻译失败:', e);
        }

        try {
            const res = await fetch(POKEMON_TRANSLATIONS_URL, { cache: 'no-cache' });
            if (res.ok) {
                const json = await res.json();
                const dict = {};
                for (const [k, v] of Object.entries(json ?? {})) {
                    if (k === 'alt' && v && typeof v === 'object') {
                        for (const [altKey, altValue] of Object.entries(v)) {
                            if (typeof altValue === 'string') dict[`alt.${altKey}`] = altValue;
                        }
                        continue;
                    }
                    if (typeof v === 'string') dict[k] = v;
                }
                pokemonTranslations = dict;

                const reverse = new Map();
                for (const [en, zhRaw] of Object.entries(dict)) {
                    if (typeof zhRaw !== 'string' || !zhRaw) continue;
                    if (en.startsWith('alt.')) continue;
                    const zh = resolveI18NextNesting(zhRaw, dict);
                    if (!zh || typeof zh !== 'string') continue;
                    if (zh.length < 2) continue;
                    if (!/[\u4E00-\u9FFF]/.test(zh)) continue;
                    if (!reverse.has(zh)) reverse.set(zh, en);
                }
                reversePokemonTranslations = Array.from(reverse.entries()).sort((a, b) => b[0].length - a[0].length);
            }
        } catch {
            // ignore
        }

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
