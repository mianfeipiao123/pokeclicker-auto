// ==UserScript==
// @name         PokeClicker 宝可梦点击 简体中文补全
// @namespace    https://github.com/mianfeipiao123/pokeclicker-auto
// @version      0.1.77
// @description  为 PokéClicker 提供全面的简体中文翻译，覆盖界面、对话、物品等内容
// @homepageURL  https://github.com/mianfeipiao123/pokeclicker-auto
// @supportURL   https://github.com/mianfeipiao123/pokeclicker-auto/issues
// @match        https://www.pokeclicker.com/*
// @match        https://g8hh.github.io/pokeclicker/*
// @match        https://pokeclicker.g8hh.com/*
// @match        https://pokeclicker.g8hh.com.cn/*
// @match        https://yx.g8hh.com/pokeclicker/*
// @match        https://dreamnya.github.io/pokeclicker/*
// @updateURL    https://raw.githubusercontent.com/mianfeipiao123/pokeclicker-auto/main/pokeclicker-zh-hans.bundle-only.user.js
// @downloadURL  https://raw.githubusercontent.com/mianfeipiao123/pokeclicker-auto/main/pokeclicker-zh-hans.bundle-only.user.js
// @run-at       document-start
// @grant        none
// ==/UserScript==

(() => {
    'use strict';

    // ═══════════════════════════════════════════════
    // 1. 配置与常量 (Configuration & Constants)
    // ═══════════════════════════════════════════════

    // 拦截 Notifier.notify，用于替换"翻译资源已加载"的提示（文案从外置配置加载）
    let notifierLoadedMessage = 'Translations loaded.';
    /** @type {null | ((s: string) => string | null)} */
    let translateForNotifier = null;
    const hookNotifier = () => {
        if (window.Notifier?.notify && !window.Notifier.__pkcZhHansPatched) {
            const originalNotify = window.Notifier.notify.bind(window.Notifier);
            const originalConfirm = window.Notifier.confirm?.bind(window.Notifier);
            window.Notifier.notify = (options) => {
                if (options?.message?.startsWith('Using ') && options.message.includes(' for translations')) {
                    options.message = notifierLoadedMessage;
                }
                if (translateForNotifier) {
                    if (typeof options?.title === 'string') {
                        const eventMatch = options.title.match(/^(\[EVENT\]\s+)(.+)$/);
                        if (eventMatch) {
                            const t = translateForNotifier(eventMatch[2]);
                            if (t) options.title = `${eventMatch[1]}${t}`;
                        } else {
                            const t = translateForNotifier(options.title);
                            if (t) options.title = t;
                        }
                    }
                    if (typeof options?.message === 'string') {
                        const t = translateForNotifier(options.message);
                        if (t) options.message = t;
                    }
                }
                return originalNotify(options);
            };
            if (originalConfirm) {
                window.Notifier.confirm = (options) => {
                    if (translateForNotifier) {
                        if (typeof options?.title === 'string') {
                            const t = translateForNotifier(options.title);
                            if (t) options.title = t;
                        }
                        if (typeof options?.message === 'string') {
                            const t = translateForNotifier(options.message);
                            if (t) options.message = t;
                        }
                    }
                    return originalConfirm(options);
                };
            }
            Object.defineProperty(window.Notifier, '__pkcZhHansPatched', { value: true });
            return true;
        }
        return false;
    };
    const pollUntil = (fn, intervalMs = 200, timeoutMs = 15000) => {
        if (fn()) return;
        const id = setInterval(() => {
            if (fn()) clearInterval(id);
        }, intervalMs);
        setTimeout(() => clearInterval(id), timeoutMs);
    };

    pollUntil(hookNotifier, 50, 10000);

    const SCRIPT_VERSION = '0.1.77';

    // 是否启用“分文件翻译”回退（当 bundle.json 加载失败时）
    // bundle-only 版本会将该项设为 false，以保证只使用 bundle.json。
    const ENABLE_SPLIT_TRANSLATIONS_FALLBACK = false;

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

    const parseBool = (value) => {
        const s = String(value ?? '').trim().toLowerCase();
        return s === '1' || s === 'true' || s === 'yes' || s === 'on';
    };

    // By default, do NOT interfere with the game's own i18next language/backend.
    // The userscript primarily translates rendered DOM text via our hardcoded map.
    //
    // Override game i18next translations with our repo by default.
    // Opt-out: localStorage.setItem('pokeclickerZhHansOverrideGameTranslations', '0')
    const OVERRIDE_GAME_TRANSLATIONS = (() => {
        try {
            const v = localStorage.getItem('pokeclickerZhHansOverrideGameTranslations');
            return v === null ? true : parseBool(v);
        } catch {
            return true;
        }
    })();
    // Force i18next language to zh-Hans by default.
    // Opt-out: localStorage.setItem('pokeclickerZhHansForceI18nextLang', '0')
    const FORCE_I18NEXT_LANG = (() => {
        try {
            const v = localStorage.getItem('pokeclickerZhHansForceI18nextLang');
            return v === null ? true : parseBool(v);
        } catch {
            return true;
        }
    })();

    const uniqueStrings = (arr) => Array.from(new Set((arr ?? []).filter((v) => typeof v === 'string' && v)));
    const joinUrl = (base, path) => {
        const b = String(base ?? '').replace(/\/+$/, '');
        const p = String(path ?? '').replace(/^\/+/, '');
        if (!b) return p;
        if (!p) return b;
        return `${b}/${p}`;
    };

    if (OVERRIDE_GAME_TRANSLATIONS) {
        // i18next uses XHR to load `.../locales/{{lng}}/{{ns}}.json`.
        // Rewrite zh/zh-Hans locale file requests to our translations repo so they always resolve.
        try {
            const XHR = window.XMLHttpRequest;
            if (typeof XHR === 'function' && !XHR.__pkcZhHansLocaleRewrite) {
                const originalOpen = XHR.prototype.open;
                const nsSet = new Set(['pokemon', 'logbook', 'settings', 'questlines']);
                const rewriteLocaleUrl = (url) => {
                    if (typeof url !== 'string' || !url) return null;
                    if (!TRANSLATIONS_BASE_URL) return null;
                    let u;
                    try {
                        u = new URL(url, window.location.href);
                    } catch {
                        return null;
                    }
                    const m = u.pathname.match(/\/locales\/(zh(?:-Hans)?|zh-Hans|zh)\/([^/]+)\.json$/);
                    if (!m) return null;
                    const lng = m[1];
                    const ns = m[2];
                    if (!nsSet.has(ns)) return null;
                    return joinUrl(TRANSLATIONS_BASE_URL, `zh-Hans/locales/${ns}.json`);
                };
                XHR.prototype.open = function (method, url, ...rest) {
                    try {
                        const rewritten = rewriteLocaleUrl(url);
                        if (rewritten) url = rewritten;
                    } catch {
                        // ignore
                    }
                    return originalOpen.call(this, method, url, ...rest);
                };
                Object.defineProperty(XHR, '__pkcZhHansLocaleRewrite', { value: true });
            }
        } catch {
            // ignore
        }
    }

    const JSDELIVR_BASE_URL = (() => {
        const fromGithubSpec = (spec) => {
            const parts = String(spec ?? '').split('/').filter(Boolean);
            if (parts.length < 3) return null;
            const owner = parts[0];
            const repo = parts[1];
            const ref = parts[2];
            const rest = parts.slice(3).join('/');
            return `https://cdn.jsdelivr.net/gh/${owner}/${repo}@${ref}${rest ? `/${rest}` : ''}`;
        };

        try {
            if (TRANSLATIONS_PARAM_VALUE.startsWith('github:')) {
                const spec = TRANSLATIONS_PARAM_VALUE.split(':')[1] ?? '';
                return fromGithubSpec(spec);
            }

            const m = String(TRANSLATIONS_BASE_URL).match(
                /^https?:\/\/raw\.githubusercontent\.com\/([^/]+)\/([^/]+)\/([^/]+)(?:\/(.*))?$/,
            );
            if (m) {
                const owner = m[1];
                const repo = m[2];
                const ref = m[3];
                const rest = m[4] || '';
                return `https://cdn.jsdelivr.net/gh/${owner}/${repo}@${ref}${rest ? `/${rest}` : ''}`;
            }
        } catch {
            // ignore
        }
        return null;
    })();

    const TRANSLATIONS_BASE_URL_CANDIDATES = uniqueStrings([TRANSLATIONS_BASE_URL, JSDELIVR_BASE_URL]);
    const buildUrlCandidates = (relPath) => TRANSLATIONS_BASE_URL_CANDIDATES.map((base) => joinUrl(base, relPath));

    // ═══════════════════════════════════════════════
    // 2. 网络与缓存 (Network & Cache)
    // ═══════════════════════════════════════════════

    const DEFAULT_FETCH_TIMEOUT_MS = 5000;
    const parseTimeoutMs = (value) => {
        const n = Number(value);
        if (!Number.isFinite(n) || n <= 0) return null;
        return Math.round(n);
    };

    let RAW_FETCH_TIMEOUT_MS = DEFAULT_FETCH_TIMEOUT_MS;
    let FALLBACK_FETCH_TIMEOUT_MS = DEFAULT_FETCH_TIMEOUT_MS;
    try {
        RAW_FETCH_TIMEOUT_MS = parseTimeoutMs(localStorage.getItem('pokeclickerZhHansTimeoutRawMs')) ?? DEFAULT_FETCH_TIMEOUT_MS;
        FALLBACK_FETCH_TIMEOUT_MS = parseTimeoutMs(localStorage.getItem('pokeclickerZhHansTimeoutFallbackMs')) ?? DEFAULT_FETCH_TIMEOUT_MS;
    } catch {
        RAW_FETCH_TIMEOUT_MS = DEFAULT_FETCH_TIMEOUT_MS;
        FALLBACK_FETCH_TIMEOUT_MS = DEFAULT_FETCH_TIMEOUT_MS;
    }

    const timeoutError = (ms, url) => {
        const err = new Error(`timeout after ${ms}ms`);
        err.code = 'TIMEOUT';
        err.timeoutMs = ms;
        err.url = url;
        return err;
    };

    const fetchJsonWithTimeout = async (url, init, timeoutMs) => {
        const ms = Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 0;
        const supportsAbort = typeof AbortController === 'function';
        const controller = supportsAbort ? new AbortController() : null;
        const signal = controller?.signal;
        let timeoutId = null;

        const workPromise = (async () => {
            const res = await fetch(url, signal ? { ...(init ?? {}), signal } : (init ?? {}));
            if (!res?.ok) throw new Error(`fetch failed: ${res?.status ?? 'unknown'}`);
            const json = await res.json();
            if (!json || typeof json !== 'object') throw new Error('json invalid');
            return json;
        })();

        if (!ms) return await workPromise;

        const timerPromise = new Promise((_, reject) => {
            timeoutId = setTimeout(() => {
                try {
                    controller?.abort();
                } catch {
                    // ignore
                }
                reject(timeoutError(ms, url));
            }, ms);
        });

        try {
            return await Promise.race([workPromise, timerPromise]);
        } finally {
            if (timeoutId) clearTimeout(timeoutId);
            if (!supportsAbort) workPromise.catch(() => {});
        }
    };

    // Keep script logic generic
    const INLINE_OVERRIDES = {};

    /** @type {Record<string,string>} */
    let pokemonTranslations = {};
    /** @type {Array<[string,string]>} */
    let reversePokemonTranslations = [];

    /** @type {Array<[string,string]>} */
    let demixReplacements = [];

    /** @type {string | null} */
    let treasuresGemOverride = null;

    const templates = {
        typePokemon: '{{type}}-type Pokémon',
        gymAt: '{{gym}} ({{town}})',
        trialAt: '{{trial}} ({{town}})',
        route: {
            noRegion: 'Route {{routeNumber}}',
            withRegion: 'Route {{routeNumber}} ({{regionOrSub}})',
        },
    };

    /** @type {{ badgeSuffix: string | null }} */
    let userscriptCssLabels = { badgeSuffix: null };

    let shortTimeLabels = {
        now: null,
        lessThanPrefix: null,
        units: {},
    };

    let DEBUG = false;
    try {
        DEBUG = localStorage.getItem('pokeclickerZhHansDebug') === '1';
    } catch {
        DEBUG = false;
    }

    const log = {
        info: (...args) => { if (DEBUG) console.info('[PokéClicker zh-Hans]', ...args); },
        warn: (...args) => { if (DEBUG) console.warn('[PokéClicker zh-Hans]', ...args); },
        error: (...args) => console.error('[PokéClicker zh-Hans]', ...args),
        swallow: (context, err) => { if (DEBUG) console.debug('[PokéClicker zh-Hans]', context, err); },
    };

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
            overrideGameTranslations: OVERRIDE_GAME_TRANSLATIONS,
            forceI18nextLang: FORCE_I18NEXT_LANG,
            splitFallbackEnabled: ENABLE_SPLIT_TRANSLATIONS_FALLBACK,
            translations: TRANSLATIONS_PARAM_VALUE,
            translationsBaseUrl: TRANSLATIONS_BASE_URL,
            translationsBaseUrlCandidates: TRANSLATIONS_BASE_URL_CANDIDATES,
            fetchTimeoutRawMs: RAW_FETCH_TIMEOUT_MS,
            fetchTimeoutFallbackMs: FALLBACK_FETCH_TIMEOUT_MS,
        }),
    };

    // Cache bundle.json in IndexedDB for faster startup + offline fallback.
    const BUNDLE_CACHE = (() => {
        const DB_NAME = 'pokeclicker-zh-hans';
        const STORE_NAME = 'bundle-cache';
        const DB_VERSION = 1;

        /** @type {Promise<IDBDatabase | null> | null} */
        let dbPromise = null;

        const openDb = () => {
            if (dbPromise) return dbPromise;
            if (!('indexedDB' in window)) return Promise.resolve(null);
            dbPromise = new Promise((resolve) => {
                try {
                    const req = indexedDB.open(DB_NAME, DB_VERSION);
                    req.onupgradeneeded = () => {
                        try {
                            const db = req.result;
                            if (!db.objectStoreNames.contains(STORE_NAME)) {
                                db.createObjectStore(STORE_NAME, { keyPath: 'key' });
                            }
                        } catch {
                            // ignore
                        }
                    };
                    req.onsuccess = () => resolve(req.result);
                    req.onerror = () => resolve(null);
                } catch {
                    resolve(null);
                }
            });
            return dbPromise;
        };

        const get = async (key) => {
            const db = await openDb();
            if (!db) return null;
            return await new Promise((resolve) => {
                try {
                    const tx = db.transaction(STORE_NAME, 'readonly');
                    const store = tx.objectStore(STORE_NAME);
                    const req = store.get(key);
                    req.onsuccess = () => resolve(req.result || null);
                    req.onerror = () => resolve(null);
                } catch {
                    resolve(null);
                }
            });
        };

        const put = async (record) => {
            const db = await openDb();
            if (!db) return false;
            return await new Promise((resolve) => {
                try {
                    const tx = db.transaction(STORE_NAME, 'readwrite');
                    const store = tx.objectStore(STORE_NAME);
                    const req = store.put(record);
                    req.onsuccess = () => resolve(true);
                    req.onerror = () => resolve(false);
                } catch {
                    resolve(false);
                }
            });
        };

        return { get, put };
    })();

    const BUNDLE_CACHE_KEY = `bundle:${TRANSLATIONS_BASE_URL}/${FORCE_LANG}/bundle.json`;
    const BUNDLE_CACHE_META_KEY = `pokeclickerZhHansBundleMeta:${BUNDLE_CACHE_KEY}`;
    const getCachedBundleMeta = () => {
        try {
            const raw = localStorage.getItem(BUNDLE_CACHE_META_KEY);
            if (!raw) return null;
            try {
                const meta = JSON.parse(raw);
                if (meta && typeof meta === 'object') return meta;
            } catch {
                // legacy: previously stored generatedAt as a plain string
            }
            return { generatedAt: raw, contentHash: null, scriptVersion: null };
        } catch {
            return null;
        }
    };
    const setCachedBundleMeta = (meta) => {
        try {
            localStorage.setItem(BUNDLE_CACHE_META_KEY, JSON.stringify(meta ?? null));
        } catch {
            // ignore
        }
    };

    const hashStringFNV1a = (input) => {
        const s = String(input ?? '');
        let h = 0x811c9dc5;
        for (let i = 0; i < s.length; i += 1) {
            h ^= s.charCodeAt(i);
            h = Math.imul(h, 0x01000193);
        }
        // unsigned 32-bit hex
        return (h >>> 0).toString(16).padStart(8, '0');
    };

    const computeBundleContentHash = (bundle) => {
        try {
            if (!bundle || typeof bundle !== 'object') return null;
            return hashStringFNV1a(JSON.stringify(bundle));
        } catch {
            return null;
        }
    };

    const loadBundleFromCache = async () => {
        try {
            const rec = await BUNDLE_CACHE.get(BUNDLE_CACHE_KEY);
            if (!rec?.bundle || typeof rec.bundle !== 'object') return null;
            // Invalidate cache automatically when the script updates.
            if (typeof rec.scriptVersion === 'string' && rec.scriptVersion && rec.scriptVersion !== SCRIPT_VERSION) {
                return null;
            }
            return rec;
        } catch {
            // ignore
        }
        return null;
    };

    const saveBundleToCache = async (bundle, prevRecord) => {
        try {
            const generatedAt = bundle?._meta?.generatedAt;
            const contentHash = computeBundleContentHash(bundle);

            const prevMeta = (() => {
                if (prevRecord && typeof prevRecord === 'object') {
                    return {
                        generatedAt: prevRecord.generatedAt ?? prevRecord?.bundle?._meta?.generatedAt ?? null,
                        contentHash: prevRecord.contentHash ?? null,
                        scriptVersion: prevRecord.scriptVersion ?? null,
                    };
                }
                return getCachedBundleMeta();
            })();

            // Skip write when bundle has not changed (even if generatedAt stays the same).
            if (prevMeta
                && (prevMeta.scriptVersion === null || prevMeta.scriptVersion === SCRIPT_VERSION)
                && typeof generatedAt === 'string'
                && generatedAt
                && prevMeta.generatedAt === generatedAt
                && typeof contentHash === 'string'
                && contentHash
                && prevMeta.contentHash === contentHash) {
                return { changed: false, generatedAt, contentHash };
            }

            const ok = await BUNDLE_CACHE.put({
                key: BUNDLE_CACHE_KEY,
                savedAt: Date.now(),
                generatedAt: typeof generatedAt === 'string' ? generatedAt : null,
                contentHash: typeof contentHash === 'string' ? contentHash : null,
                scriptVersion: SCRIPT_VERSION,
                bundle,
            });
            if (ok) {
                setCachedBundleMeta({
                    generatedAt: typeof generatedAt === 'string' ? generatedAt : null,
                    contentHash: typeof contentHash === 'string' ? contentHash : null,
                    scriptVersion: SCRIPT_VERSION,
                });
            }
            return { changed: ok, generatedAt, contentHash };
        } catch {
            // ignore
        }
        return { changed: false, generatedAt: null, contentHash: null };
    };

    // ═══════════════════════════════════════════════
    // 3. CSS 覆盖 (CSS Overrides)
    // ═══════════════════════════════════════════════

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

/* Badge suffix ("Badge" -> "徽章") – keep compatible with upstream selectors */
.badgeEntry p::after,
#badge-list .badge[data-badge-name]::after,
.badge[data-badge-name]::after {
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

    // ═══════════════════════════════════════════════
    // 4. 文本规范化与查找工具 (Text Normalization & Lookup Utilities)
    // ═══════════════════════════════════════════════

    /**
     * Normalize whitespace: collapse runs, trim, and replace NBSP.
     * @param {*} text - Input text (coerced to string).
     * @returns {string} Cleaned text.
     */
    const normalizeText = (text) =>
        String(text ?? '')
            .replace(/\u00A0/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();

    const CJK_PUNCT_MAP = { '\u00A0': ' ', '，': ',', '。': '.', '：': ':', '；': ';' };
    const CJK_PUNCT_RE = /[\u00A0，。：；]/g;

    /**
     * Normalize text for translation map lookup: NFC normalization, CJK punctuation
     * mapping, and whitespace cleanup. Results are cached (up to 10,000 entries).
     * @param {*} text - Input text (coerced to string).
     * @returns {string} Normalized lookup key.
     */
    const _normCache = new Map();
    const _NORM_CACHE_LIMIT = 10000;
    const normalizeForLookup = (text) => {
        const input = String(text ?? '');
        const cached = _normCache.get(input);
        if (cached !== undefined) return cached;

        let s = input;
        try {
            s = s.normalize('NFC');
        } catch {
            // ignore
        }
        s = s.replace(CJK_PUNCT_RE, (ch) => CJK_PUNCT_MAP[ch]);
        s = s.replace(/\s*,\s*/g, ', ');
        const result = normalizeText(s);

        if (_normCache.size >= _NORM_CACHE_LIMIT) {
            // Evict oldest 25% to amortize cost.
            const evictCount = Math.floor(_NORM_CACHE_LIMIT * 0.25);
            let removed = 0;
            for (const k of _normCache.keys()) {
                if (removed >= evictCount) break;
                _normCache.delete(k);
                removed++;
            }
        }
        _normCache.set(input, result);
        return result;
    };

    const foldPunctuationForLookup = (text) =>
        String(text ?? '')
            // Curly quotes/apostrophes → ASCII
            .replace(/[\u2018\u2019\u02BC]/g, "'")
            .replace(/[\u201C\u201D]/g, '"')
            // Dashes/minus → ASCII hyphen
            .replace(/[\u2013\u2014\u2212]/g, '-');

    /** @type {Map<string, Array<[string,string]>> | null} */
    let reverseByFirstChar = null;

    const demixForLookup = (text) => {
        let s = normalizeForLookup(text);
        if (!s) return s;
        if (!/[\u4E00-\u9FFF]/.test(s) || !/[A-Za-z]/.test(s)) return s;

        if (demixReplacements.length) {
            for (const [from, to] of demixReplacements) {
                if (!from) continue;
                if (s.includes(from)) s = s.split(from).join(to ?? '');
            }
        }

        if (reversePokemonTranslations.length) {
            if (!reverseByFirstChar) {
                reverseByFirstChar = new Map();
                for (const [zh, en] of reversePokemonTranslations) {
                    if (!zh || !en) continue;
                    const ch = zh[0];
                    if (!reverseByFirstChar.has(ch)) reverseByFirstChar.set(ch, []);
                    reverseByFirstChar.get(ch).push([zh, en]);
                }
            }
            const seen = new Set();
            for (let i = 0; i < s.length; i += 1) {
                const ch = s[i];
                if (seen.has(ch)) continue;
                const bucket = reverseByFirstChar.get(ch);
                if (!bucket) continue;
                seen.add(ch);
                for (const [zh, en] of bucket) {
                    if (s.includes(zh)) s = s.split(zh).join(en);
                }
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

    /**
     * Determine whether to apply hardcoded map translations to a string.
     * Returns true only when the text contains >=2 Latin characters and
     * the Latin count >= CJK count (i.e. likely untranslated English).
     * Uses fast charCode iteration instead of regex allocation.
     * @param {*} text - Input text (coerced to string).
     * @returns {boolean}
     */
    const shouldUseHardcodedMap = (text) => {
        const s = String(text ?? '');
        let latinCount = 0, hanCount = 0;
        for (let i = 0; i < s.length; i++) {
            const c = s.charCodeAt(i);
            if ((c >= 0x41 && c <= 0x5A) || (c >= 0x61 && c <= 0x7A)) latinCount++;
            else if (c >= 0x4E00 && c <= 0x9FFF) hanCount++;
        }
        // Only apply the hardcoded map to strings that are mostly Latin-script (i.e. likely untranslated English).
        // This prevents bad map entries from rewriting already-translated Chinese Pokémon names.
        return latinCount >= 2 && latinCount >= hanCount;
    };

    const shouldSkipNode = (node) => {
        if (!node) return true;
        // Skip translating code-ish UI where raw keys/values should remain untouched (e.g. hotkey <kbd>).
        let el = node.parentElement;
        for (let i = 0; i < 6 && el; i += 1) {
            const tag = el.tagName?.toLowerCase();
            if (!tag) break;
            if (tag === 'script' || tag === 'style' || tag === 'textarea' || tag === 'code' || tag === 'pre' || tag === 'kbd') {
                return true;
            }
            el = el.parentElement;
        }
        return false;
    };

    const isHotkeyValueNode = (textNode) => {
        try {
            const el = textNode?.parentElement;
            if (!el) return false;
            if (el.tagName?.toLowerCase() !== 'knockout') return false;
            const bind = el.getAttribute?.('data-bind') || '';
            return /\bhotkey\./i.test(bind);
        } catch {
            return false;
        }
    };

    const INLINE_WRAPPER_TAGS = new Set(['i', 'em', 'b', 'strong', 'u']);
    const buildInlineWrapperKey = (textNode, innerText) => {
        try {
            if (!textNode?.parentElement) return null;
            const tags = [];
            let el = textNode.parentElement;
            for (let i = 0; i < 4 && el; i += 1) {
                const tag = el.tagName?.toLowerCase();
                if (!tag || !INLINE_WRAPPER_TAGS.has(tag)) break;
                tags.push(tag);
                el = el.parentElement;
            }
            if (!tags.length) return null;
            const open = tags.slice().reverse().map((t) => `<${t}>`).join('');
            const close = tags.map((t) => `</${t}>`).join('');
            return `${open}${innerText}${close}`;
        } catch {
            return null;
        }
    };

    const extractTextFromHtml = (html) => {
        if (typeof html !== 'string' || !html) return null;
        if (!html.includes('<')) return html;
        try {
            const template = document.createElement('template');
            template.innerHTML = html;
            const text = template.content.textContent ?? '';
            return normalizeText(text);
        } catch {
            return null;
        }
    };

    const WEATHER_TYPE_KEY_PREFIX = 'weatherType::';
    let WEATHER_TYPE_KEYS = new Set([
        'Clear',
        'Overcast',
        'Rain',
        'Thunderstorm',
        'Snow',
        'Hail',
        'Blizzard',
        'Harsh Sunlight',
        'Sandstorm',
        'Fog',
        'Windy',
    ]);

    const isWeatherTypeTooltipTriggerElement = (element) => {
        try {
            if (!element || element.nodeType !== Node.ELEMENT_NODE) return false;
            if (element.classList?.contains('btn-weather-dock')) return true;
            if (element.closest?.('#weatherAppModal')) return true;
            const bind = element.getAttribute?.('data-bind') || '';
            return /\bWeatherType\s*\[/.test(bind);
        } catch {
            return false;
        }
    };

    const findBootstrapTooltipTriggerElement = (textNode) => {
        try {
            const el = textNode?.parentElement;
            const tooltip = el?.closest?.('.tooltip');
            const id = tooltip?.getAttribute?.('id') || '';
            if (!id) return null;
            const safe = id.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
            return document.querySelector?.(`[aria-describedby="${safe}"]`) || null;
        } catch {
            return null;
        }
    };

    const isWeatherTypeContextTextNode = (textNode) => {
        try {
            const el = textNode?.parentElement;
            if (!el) return false;
            if (el.closest?.('#weatherAppModal')) return true;
            if (el.closest?.('#ShipModal')) return true;
            const trigger = findBootstrapTooltipTriggerElement(textNode);
            return isWeatherTypeTooltipTriggerElement(trigger);
        } catch {
            return false;
        }
    };

    // Optional: force i18next language early
    if (FORCE_I18NEXT_LANG) {
        try {
            localStorage.setItem('i18nextLng', FORCE_LANG);
        } catch {
            // ignore
        }
    }

    // Guard the town "start" hotkey for edge cases where a non-dungeon town has no `content[0]`.
    // Otherwise the game key handler can throw: "Cannot read properties of undefined (reading 'protectedOnclick')".
    try {
        if (!window.__pkcZhHansTownHotkeyGuard) {
            Object.defineProperty(window, '__pkcZhHansTownHotkeyGuard', { value: true });
            document.addEventListener('keydown', (e) => {
                try {
                    if (!e || typeof e.key !== 'string') return;
                    const target = e.target;
                    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;

                    const Settings = window.Settings;
                    const App = window.App;
                    const GameConstants = window.GameConstants;
                    const player = window.player;
                    if (!Settings?.getSetting || !App?.game || !GameConstants?.GameState || !player?.town) return;
                    if (App.game.gameState !== GameConstants.GameState.town) return;

                    const startKey = Settings.getSetting('hotkey.town.start')?.value;
                    if (!startKey || e.key !== startKey) return;

                    const isDungeonTown = (() => {
                        try {
                            return typeof window.DungeonTown === 'function' && player.town instanceof window.DungeonTown;
                        } catch {
                            return false;
                        }
                    })();
                    if (isDungeonTown) return;

                    const first = player.town?.content?.[0];
                    if (!first || typeof first.protectedOnclick !== 'function') {
                        e.preventDefault();
                        e.stopImmediatePropagation();
                    }
                } catch {
                    // ignore
                }
            }, true);
        }
    } catch {
        // ignore
    }

    if (OVERRIDE_GAME_TRANSLATIONS) {
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
    }

    const attrNames = ['title', 'placeholder', 'aria-label', 'alt', 'data-original-title', 'data-content', 'data-intro'];
    const ATTR_SELECTOR = attrNames.map((a) => `[${a}]`).join(',');
    const LATIN_RE = /[A-Za-zÉé]/;
    const ENGLISH_RUN_RE = /[A-Za-zÉé][A-Za-z0-9Éé\s,.%"''!?():/\\-]*/g;

    /** @type {WeakMap<Node, string>} */
    const processedTextNodeValues = new WeakMap();
    /** @type {Record<string, WeakMap<Element, string>>} */
    const processedAttrValues = {};

    const getWeatherTypeLookupKey = (key, context) => {
        try {
            if (typeof key !== 'string' || !key) return key;
            if (!WEATHER_TYPE_KEYS.has(key)) return key;
            if (context?.textNode && isWeatherTypeContextTextNode(context.textNode)) return `${WEATHER_TYPE_KEY_PREFIX}${key}`;
            if (context?.element && isWeatherTypeTooltipTriggerElement(context.element)) return `${WEATHER_TYPE_KEY_PREFIX}${key}`;
        } catch {
            // ignore
        }
        return key;
    };

    // ═══════════════════════════════════════════════
    // 5. 翻译解析引擎 (Translation Resolution Engine)
    // ═══════════════════════════════════════════════

    const escapeRegExp = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    class TranslationCache extends Map {
        constructor(limit) {
            super();
            this.limit = Number.isFinite(limit) && limit > 0 ? limit : 30000;
            this._accessCount = 0;
            this._evictionCount = 0;
        }

        get(key) {
            return super.get(key);
        }

        set(key, value) {
            super.set(key, value);
            if (super.size > this.limit) {
                // Evict oldest 30% to amortize cost and reduce eviction frequency.
                const evictCount = Math.floor(this.limit * 0.30);
                let removed = 0;
                for (const k of super.keys()) {
                    if (removed >= evictCount) break;
                    super.delete(k);
                    removed += 1;
                }
                this._evictionCount += 1;
            }
            return this;
        }
    }

    // Negative cache: track text that doesn't need translation to avoid repeated lookups.
    // This significantly improves performance for English abbreviations, numbers, etc.
    const noTranslationNeeded = new Set();
    const NO_TRANSLATION_CACHE_LIMIT = 10000;
    let _negativeCacheHits = 0;

    /** @type {Record<string,string>} */
    let typeTranslations = {};

    let TYPE_KEYS = [
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

    const fetchJsonWithFallback = async (urls, init) => {
        let lastError = null;
        for (let i = 0; i < urls.length; i += 1) {
            const url = urls[i];
            const timeoutMs = i === 0 ? RAW_FETCH_TIMEOUT_MS : FALLBACK_FETCH_TIMEOUT_MS;
            try {
                const json = await fetchJsonWithTimeout(url, init, timeoutMs);
                if (DEBUG && url !== urls[0]) {
                    log.info('Loaded from fallback:', url);
                }
                return json;
            } catch (e) {
                lastError = e;
            }
        }
        throw lastError || new Error('fetch failed');
    };

    const loadUserscriptConfig = async () => {
        try {
            const json = await fetchJsonWithFallback(
                buildUrlCandidates(`${FORCE_LANG}/overrides/userscript.json`),
                { cache: 'no-cache' },
            );
            const entries = json?.entries ?? {};
            const getEntry = (k) => {
                const v = entries?.[k];
                if (typeof v === 'string') return v;
                if (v && typeof v === 'object' && typeof v.translation === 'string') return v.translation;
                return null;
            };

            const parseDemixReplacements = (raw) => {
                const out = [];
                if (typeof raw !== 'string' || !raw.trim()) return out;
                const lines = raw.split(/\r?\n/);
                for (const line of lines) {
                    if (!line || !line.trim()) continue;
                    const idx = line.indexOf('=');
                    if (idx <= 0) continue;
                    const from = line.slice(0, idx).trim();
                    const to = line.slice(idx + 1);
                    if (!from) continue;
                    out.push([from, to]);
                }
                return out;
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
                templates: {
                    typePokemon: getEntry('__userscript.template.typePokemon') ?? templates.typePokemon,
                    gymAt: getEntry('__userscript.template.gymAt') ?? templates.gymAt,
                    trialAt: getEntry('__userscript.template.trialAt') ?? templates.trialAt,
                    route: {
                        noRegion: getEntry('__userscript.template.route.noRegion') ?? templates.route.noRegion,
                        withRegion: getEntry('__userscript.template.route.withRegion') ?? templates.route.withRegion,
                    },
                },
                demixReplacements: parseDemixReplacements(getEntry('__userscript.demix.replacements')),
                types: {},
                context: {
                    treasuresGem: getEntry('__userscript.context.treasures.gem') ?? null,
                },
                time: {
                    now: getEntry('__userscript.time.now') ?? null,
                    lessThanPrefix: getEntry('__userscript.time.lessThanPrefix') ?? null,
                    units: {},
                },
            };

            // Extract TYPE_KEYS dynamically from __userscript.type.* entries
            const typeKeysFromConfig = [];
            for (const key of Object.keys(entries)) {
                if (!key.startsWith('__userscript.type.')) continue;
                const typeName = key.slice('__userscript.type.'.length);
                if (!typeName) continue;
                const v = getEntry(key);
                if (typeof v === 'string' && v) config.types[typeName] = v;
                typeKeysFromConfig.push(typeName);
            }
            if (typeKeysFromConfig.length > 0) {
                config.typeKeys = typeKeysFromConfig;
            }

            // Extract WEATHER_TYPE_KEYS dynamically from __userscript.weatherType.* entries
            const weatherKeysFromConfig = [];
            for (const key of Object.keys(entries)) {
                if (!key.startsWith('__userscript.weatherType.')) continue;
                const weatherName = key.slice('__userscript.weatherType.'.length);
                if (!weatherName) continue;
                weatherKeysFromConfig.push(weatherName);
            }
            if (weatherKeysFromConfig.length > 0) {
                config.weatherTypeKeys = weatherKeysFromConfig;
            }

            for (const key of Object.keys(entries)) {
                if (!key.startsWith('__userscript.time.unit.')) continue;
                const unitName = key.slice('__userscript.time.unit.'.length).toLowerCase();
                if (!unitName) continue;
                const v = getEntry(key);
                if (typeof v === 'string' && v) config.time.units[unitName] = v;
            }

            return config;
        } catch {
            return null;
        }
    };

    const formatTemplate = (tmpl, vars) =>
        String(tmpl ?? '').replace(/\{\{(\w+)\}\}/g, (m, k) => {
            const v = vars?.[k];
            return typeof v === 'string' || typeof v === 'number' ? String(v) : m;
        });

    const translateShortTimeWords = (segment) => {
        const key = normalizeText(segment);
        if (!key) return null;
        if (/^now$/i.test(key)) return shortTimeLabels.now;

        const shortTimeMatch = key.match(/^(<\s*)?(\d+)\s+(day|days|hour|hours|min|mins|minute|minutes|sec|secs|second|seconds|week|weeks)$/i);
        if (!shortTimeMatch) return null;

        const unit = shortTimeLabels.units?.[shortTimeMatch[3].toLowerCase()];
        if (!unit) return null;

        const prefix = shortTimeMatch[1] ? (shortTimeLabels.lessThanPrefix ?? '') : '';
        return `${prefix}${shortTimeMatch[2]}${unit}`;
    };

    const resolveI18NextNesting = (text, dict, fallbackDict) => {
        let out = String(text ?? '');
        for (let i = 0; i < 6; i += 1) {
            const next = out.replace(/\[\[([^[\]]+?)\]\]/g, (m, rawKey) => {
                const key = String(rawKey ?? '').trim();
                if (!key) return '';
                // Keep dynamic replacement templates like `[[pokemon::$1]]` intact.
                if (key.includes('$')) return m;

                const tryLookup = (k) => {
                    if (!k) return undefined;
                    const v = dict?.[k];
                    if (typeof v === 'string') return v;
                    const fv = fallbackDict?.[k];
                    if (typeof fv === 'string') return fv;
                    const casefoldIndex = fallbackDict?.__pkcZhHansCasefoldIndex;
                    if (casefoldIndex && typeof casefoldIndex.get === 'function') {
                        const cv = casefoldIndex.get(String(k).toLowerCase());
                        if (typeof cv === 'string') return cv;
                    }
                    return undefined;
                };

                // Support cross-namespace nesting used by the game, e.g. `[[pokemon::Bulbasaur]]`.
                if (/^pokemon::/i.test(key)) {
                    const v = tryLookup(key.replace(/^pokemon::/i, ''));
                    if (typeof v === 'string') return v;
                }

                const v = tryLookup(key);
                if (typeof v === 'string') return v;
                return key;
            });
            if (next === out) break;
            out = next;
        }
        return out;
    };

    const finalizeTranslation = (value, map) => {
        if (typeof value !== 'string') return value;
        if (!value.includes('[[')) return value;
        return resolveI18NextNesting(value, pokemonTranslations, map);
    };

    const translateDynamicSegment = (segment, map) => {
        const key = normalizeText(segment);
        if (!key) return segment;

        if (key === 'a' || key === 'an') {
            return '';
        }

        const shortTime = translateShortTimeWords(key);
        if (shortTime) return shortTime;

        // Weather enums are displayed via `humanifyString(WeatherType[...])`, which can collide with badges
        // (e.g. Rain/Fog). Prefer `weatherType::...` when available.
        try {
            if (WEATHER_TYPE_KEYS.has(key)) {
                const v = map?.[`${WEATHER_TYPE_KEY_PREFIX}${key}`];
                if (typeof v === 'string' && v) {
                    return finalizeTranslation(v, map);
                }
            }
        } catch {
            // ignore
        }

        // Type-restricted phrases are constructed dynamically, e.g. "an Electric-type Pokémon".
        // Translate them here so outer template translations don't leave English fragments.
        const typePokemonMatch = key.match(/^(?:(?:a|an)\s+)?(.+?)-type\s+Pok[eé]mon$/i);
        if (typePokemonMatch) {
            const typeName = normalizeText(typePokemonMatch[1]);
            if (typeName) {
                const typeZh = typeTranslations?.[typeName]
                    || (shouldUseHardcodedMap(typeName) ? map?.[typeName] : undefined)
                    || typeName;
                return formatTemplate(templates.typePokemon, { type: typeZh });
            }
        }

        const articleMatch = key.match(/^(?:a|an)\s+(.+)$/i);
        if (articleMatch) {
            const rest = normalizeText(articleMatch[1]);
            if (rest) {
                const t = translateDynamicSegment(rest, map);
                if (t && t !== rest) return t;
            }
        }

        const pokemon = pokemonTranslations?.[key];
        if (typeof pokemon === 'string') {
            return finalizeTranslation(pokemon, map);
        }

        const useMap = shouldUseHardcodedMap(key);
        const mapped = useMap ? map?.[key] : undefined;
        if (typeof mapped === 'string' && !mapped.includes('${...}')) {
            return finalizeTranslation(mapped, map);
        }

        // Dynamic enum names often appear humanified (spaces instead of underscores), e.g. "Spike Shell".
        // Try lookup variants against the loaded map (which contains enum keys like "Spike_Shell").
        if (useMap && (key.includes(' ') || key.includes('-'))) {
            const candidates = [];
            const underscored = key.replace(/\s+/g, '_');
            candidates.push(underscored);
            if (underscored.includes('-')) candidates.push(underscored.replace(/-/g, '_'));
            if (key.includes('-')) candidates.push(key.replace(/-/g, '_'));
            for (const c of candidates) {
                const v = map?.[c];
                if (typeof v === 'string' && v && !v.includes('${...}')) {
                    return v;
                }
            }
        }

        const gymAtMatch = key.match(/^(.+?)'s Gym at (.+)$/);
        if (gymAtMatch) {
            const leader = gymAtMatch[1];
            const town = gymAtMatch[2];
            const leaderGymKey = `${leader}'s Gym`;
            const leaderGym = translateDynamicSegment(leaderGymKey, map);
            const townName = translateDynamicSegment(town, map);
            return formatTemplate(templates.gymAt, { gym: leaderGym, town: townName });
        }

        const trialAtMatch = key.match(/^(.+? Trial) at (.+)$/);
        if (trialAtMatch) {
            const trialName = translateDynamicSegment(trialAtMatch[1], map);
            const trialTown = translateDynamicSegment(trialAtMatch[2], map);
            return formatTemplate(templates.trialAt, { trial: trialName, town: trialTown });
        }

        const type = typeTranslations?.[key];
        if (type) return type;

        const routeMatch = key.match(/^Route\s+(\d+)(?:\s+in\s+(.+))?$/);
        if (routeMatch) {
            const routeNumber = routeMatch[1];
            const regionOrSub = routeMatch[2] ? translateDynamicSegment(routeMatch[2], map) : '';
            if (regionOrSub) {
                return formatTemplate(templates.route.withRegion, { routeNumber, regionOrSub });
            }
            return formatTemplate(templates.route.noRegion, { routeNumber });
        }

        return segment;
    };

    /**
     * @typedef {Object} Pattern
     * @property {RegExp} re - Regex to match against English text.
     * @property {string[]} zhParts - Chinese template parts split by placeholders.
     * @property {number} literalLen - Length of literal (non-placeholder) anchor text.
     * @property {string} firstChar - First character of the leading literal prefix ('*' if none).
     */

    /**
     * Build regex-based translation patterns from map entries containing `${...}` placeholders.
     * @param {Record<string, string>} map - Translation map.
     * @returns {Pattern[]} Sorted patterns (most specific first).
     */
    const buildPatterns = (map) => {
        const placeholder = '${...}';
        const singleBracePlaceholderRe = /\{(?!\{)[A-Z][A-Z0-9_]+\}(?!\})/g;
        const patterns = [];
        for (const [en, zh] of Object.entries(map)) {
            if (typeof zh !== 'string' || !zh) continue;

            let enKey = en;
            let zhValue = zh;

            // Support dynamic placeholders from upstream code, e.g. `{ROUTE_NAME}` in RoamerNPC dialogs.
            // Normalize single-brace placeholders into the existing `${...}` pattern system.
            if (!(enKey.includes(placeholder) && zhValue.includes(placeholder)) && enKey.includes('{') && zhValue.includes('}')) {
                const enReplaced = enKey.replace(singleBracePlaceholderRe, placeholder);
                const zhReplaced = zhValue.replace(singleBracePlaceholderRe, placeholder);
                if (enReplaced !== enKey && zhReplaced !== zhValue) {
                    enKey = enReplaced;
                    zhValue = zhReplaced;
                }
            }

            if (!enKey.includes(placeholder)) continue;
            if (!zhValue.includes(placeholder)) continue;

            const enParts = enKey.split(placeholder);
            const zhParts = zhValue.split(placeholder);
            if (enParts.length <= 1) continue;
            // Allow translations to omit placeholders (e.g. plural "s") by using fewer `${...}`.
            // We only support consuming placeholders from left to right.
            if (zhParts.length <= 1) continue;
            if (zhParts.length > enParts.length) continue;
            // Avoid overly-generic patterns like "${...} ${...}" (no literal anchor text).
            const literal = enParts.join('');
            if (!literal || !literal.trim()) continue;

            // Smarter grouping when placeholders are separated only by whitespace.
            // Avoid splitting "the holding Pokémon" into "the" + "holding Pokémon 25%".
            const placeholderCount = enParts.length - 1;
            let reSource = `^${escapeRegExp(enParts[0])}`;
            for (let i = 1; i < enParts.length; i += 1) {
                const sep = enParts[i];
                const sepIsWhitespace = sep.length > 0 && sep.trim() === '';
                const isLastPlaceholder = i === placeholderCount;
                const group = sepIsWhitespace && !isLastPlaceholder ? '(.+)' : '(.+?)';
                reSource += group;
                reSource += sepIsWhitespace ? '\\s+' : escapeRegExp(sep);
            }
            reSource += '$';

            const re = new RegExp(reSource);
            const literalLen = literal.replace(/\s+/g, ' ').trim().length;
            // First char of the leading literal prefix (empty prefix → wildcard '*').
            const firstChar = enParts[0] ? enParts[0][0] : '*';
            patterns.push({ re, zhParts, literalLen, firstChar });
        }
        // Prefer patterns with more literal anchor text, then longer regex.
        patterns.sort((a, b) => (b.literalLen - a.literalLen) || (b.re.source.length - a.re.source.length));
        return patterns;
    };

    /**
     * Build a first-character index over sorted patterns for fast prefix-based filtering.
     * @param {Pattern[]} patterns - Sorted pattern array from buildPatterns().
     * @returns {Map<string, Pattern[]>} Map from first char (or '*') to matching patterns.
     */
    const buildPatternIndex = (patterns) => {
        const index = new Map();
        for (const p of patterns) {
            const ch = p.firstChar;
            if (!index.has(ch)) index.set(ch, []);
            index.get(ch).push(p);
        }
        return index;
    };

    /**
     * Apply regex-based patterns to translate a text string.
     * Uses patternIndex for fast first-char filtering when available.
     * @param {string} text - English text to match.
     * @param {Pattern[]} patterns - Full sorted pattern array.
     * @param {Record<string, string>} map - Translation map for dynamic segment lookup.
     * @param {Map<string, Pattern[]>|null} [patternIndex] - Optional first-char index.
     * @returns {string|null} Translated text, or null if no pattern matched.
     */
    const applyPatterns = (text, patterns, map, patternIndex) => {
        // If we have a first-char index, only test patterns whose first char matches or wildcard '*'.
        let candidates;
        if (patternIndex && text) {
            const ch = text[0];
            const exact = patternIndex.get(ch);
            const wild = patternIndex.get('*');
            if (exact && wild) {
                // Merge and re-sort to preserve the global literalLen ordering invariant.
                candidates = [...exact, ...wild].sort(
                    (a, b) => (b.literalLen - a.literalLen) || (b.re.source.length - a.re.source.length),
                );
            } else {
                candidates = exact || wild || patterns;
            }
        } else {
            candidates = patterns;
        }
        for (const p of candidates) {
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
            if (out && out !== text) return out;
        }
        return null;
    };

    /** Try inline overrides (hardcoded in-script). */
    const resolveFromInlineOverrides = (candidates, map) => {
        for (const k of candidates) {
            const inline = INLINE_OVERRIDES[k];
            if (typeof inline === 'string' && inline) return finalizeTranslation(inline, map);
        }
        return null;
    };

    /** Try direct map lookup (exact key match). */
    const resolveFromDirectMap = (candidates, map) => {
        for (const k of candidates) {
            const direct = map?.[k];
            if (typeof direct === 'string' && direct) return finalizeTranslation(direct, map);
        }
        return null;
    };

    /** Case-insensitive fallback using a precomputed lowercase index. */
    const resolveFromCasefoldIndex = (candidates, map) => {
        const casefoldIndex = map?.__pkcZhHansCasefoldIndex;
        if (!casefoldIndex || typeof casefoldIndex.get !== 'function') return null;
        for (const k of candidates) {
            if (!k) continue;
            const v = casefoldIndex.get(String(k).toLowerCase());
            if (typeof v === 'string' && v) return finalizeTranslation(v, map);
        }
        return null;
    };

    /** Punctuation-folded fallback for typographic variants (e.g. "It\u2019s" vs "It's"). */
    const resolveFromPunctFoldIndex = (candidates, map) => {
        const punctFoldIndex = map?.__pkcZhHansPunctFoldIndex;
        if (!punctFoldIndex || typeof punctFoldIndex.get !== 'function') return null;
        for (const k of candidates) {
            if (!k) continue;
            const lk = foldPunctuationForLookup(normalizeForLookup(k)).toLowerCase();
            if (!lk) continue;
            const v = punctFoldIndex.get(lk);
            if (typeof v === 'string' && v) return finalizeTranslation(v, map);
        }
        return null;
    };

    /** Try the dedicated Pok\u00e9mon dictionary. */
    const resolveFromPokemonDict = (candidates, map) => {
        for (const k of candidates) {
            const pokemon = pokemonTranslations?.[k];
            if (typeof pokemon === 'string') return finalizeTranslation(pokemon, map);
        }
        return null;
    };

    /** Humanified enum names (spaces/hyphens → underscores). */
    const resolveFromHumanifiedEnum = (candidates, useMapFlags, map) => {
        for (let i = 0; i < candidates.length; i += 1) {
            if (!useMapFlags[i]) continue;
            const k = candidates[i];
            if (!/[\s-]/.test(k)) continue;
            const variants = new Set();
            variants.add(k.replace(/\s+/g, '_'));
            variants.add(k.replace(/-/g, '_'));
            variants.add(k.replace(/\s+/g, '_').replace(/-/g, '_'));
            for (const vKey of variants) {
                const v = map?.[vKey];
                if (typeof v === 'string' && v && !v.includes('${...}')) return finalizeTranslation(v, map);
            }
        }
        return null;
    };

    /** Try pattern-based template matching (e.g. "${...} used ${...}!"). */
    const resolveFromPatterns = (candidates, patterns, map) => {
        if (!patterns.length) return null;
        const idx = patterns.__pkcIndex;
        for (const k of candidates) {
            const matched = applyPatterns(k, patterns, map, idx);
            if (typeof matched === 'string' && matched) return finalizeTranslation(matched, map);
            const folded = foldPunctuationForLookup(k);
            if (folded && folded !== k) {
                const matchedFolded = applyPatterns(folded, patterns, map, idx);
                if (typeof matchedFolded === 'string' && matchedFolded) return finalizeTranslation(matchedFolded, map);
            }
        }
        return null;
    };

    /** Handle dynamic badge names like "Spike Shell Badge". */
    const resolveFromBadgeSuffix = (candidates, map) => {
        const badgeWord = userscriptCssLabels.badgeSuffix || map?.Badge || 'Badge';
        for (const k of candidates) {
            const m = k.match(/^(.+?)\s*(?:Badge|badge)([.!?:,])?$/);
            if (!m) continue;
            const name = normalizeText(m[1]);
            if (!name) continue;
            const translatedName = translateDynamicSegment(name, map);
            if (!translatedName || translatedName === name) continue;
            const punct = m[2] || '';
            if (translatedName.endsWith(badgeWord)) return finalizeTranslation(`${translatedName}${punct}`, map);
            return finalizeTranslation(`${translatedName}${badgeWord}${punct}`, map);
        }
        return null;
    };

    /** Strip trailing colon and try translating the base, then re-append. */
    const resolveFromTrailingColon = (candidates, map, patterns) => {
        for (const k of candidates) {
            const m = k.match(/^(.*?)([:：])$/);
            if (!m) continue;
            const base = normalizeText(m[1]);
            if (!base) continue;
            const translatedBase = resolveTranslation(base, map, patterns);
            if (!translatedBase || translatedBase === base) continue;
            if (translatedBase.endsWith(':') || translatedBase.endsWith('：')) return translatedBase;
            return `${translatedBase}${m[2]}`;
        }
        return null;
    };

    /**
     * Resolve a translation key through a multi-strategy pipeline:
     * inline overrides → direct map → casefold → punctfold → pokémon dict →
     * humanified enum → patterns → badge suffix → trailing colon.
     * @param {string} key - English text to translate.
     * @param {Record<string, string>} map - Translation map.
     * @param {Pattern[]} patterns - Regex pattern array.
     * @returns {string|null} Translated text, or null if no strategy matched.
     */
    const resolveTranslation = (key, map, patterns) => {
        if (!key) return null;
        const shortTime = translateShortTimeWords(key);
        if (shortTime) return shortTime;
        const altKey = normalizeForLookup(key);
        const candidates = altKey && altKey !== key ? [key, altKey] : [key];
        const demixed = demixForLookup(altKey || key);
        if (demixed && !candidates.includes(demixed)) candidates.push(demixed);

        // Compute map-eligibility flags once, up front.
        const useMapFlags = candidates.map((k) => shouldUseHardcodedMap(k));
        const useMap = useMapFlags.some(Boolean);

        // Pipeline: try each strategy in order, return first non-null result.
        return resolveFromInlineOverrides(candidates, map)
            ?? resolveFromDirectMap(candidates, map)
            ?? resolveFromCasefoldIndex(candidates, map)
            ?? resolveFromPunctFoldIndex(candidates, map)
            ?? (useMap ? resolveFromPokemonDict(candidates, map) : null)
            ?? (useMap ? resolveFromHumanifiedEnum(candidates, useMapFlags, map) : null)
            ?? (useMap ? resolveFromPatterns(candidates, patterns, map) : null)
            ?? (useMap ? resolveFromBadgeSuffix(candidates, map) : null)
            ?? (useMap ? resolveFromTrailingColon(candidates, map, patterns) : null);
    };

    /**
     * Fallback translator for mixed English/Chinese text segments.
     * Splits input on English runs, resolves each piece independently.
     * @param {string} text - Text to translate.
     * @param {Record<string, string>} map - Translation map.
     * @param {Pattern[]} patterns - Regex pattern array.
     * @param {TranslationCache} cache - LRU-style translation cache.
     * @returns {string|null} Translated text, or null if nothing changed.
     */
    const translateSegmentsFallback = (text, map, patterns, cache) => {
        let input = String(text ?? '');
        if (!input) return null;
        try {
            input = input.normalize('NFC');
        } catch {
            // ignore
        }

        // Tooltip titles often look like `<u>${name}</u><br/>${descriptionHtml}`.
        // Translate the full HTML description suffix first (it may contain `<br/>`/`<i>` tags which would otherwise get split).
        const tooltipBreakMatch = input.match(/<\/u><br\s*\/?>/i);
        if (tooltipBreakMatch) {
            const sep = tooltipBreakMatch[0];
            const idx = input.toLowerCase().indexOf(sep.toLowerCase());
            if (idx >= 0) {
                const suffix = input.slice(idx + sep.length);
                const { leading, core, trailing } = splitOuterWhitespace(suffix);
                const rawSuffixKey = normalizeText(core);

                const canonicalizeTooltipKey = (s) => String(s)
                    .replace(/<br\s*\/?>/gi, '<br/>')
                    .replace(/\bPok[eé]mon\b/g, 'Pokémon')
                    .replace(/attack bonus\s*%/gi, 'attack bonus %');

                const candidates = [];
                if (rawSuffixKey) {
                    candidates.push(rawSuffixKey);
                    const canon = canonicalizeTooltipKey(rawSuffixKey);
                    if (canon !== rawSuffixKey) candidates.push(canon);
                    if (rawSuffixKey.endsWith('.')) candidates.push(rawSuffixKey.slice(0, -1));
                    if (canon.endsWith('.')) candidates.push(canon.slice(0, -1));
                }

                for (const c of candidates) {
                    const resolvedSuffix = resolveTranslation(c, map, patterns);
                    if (resolvedSuffix) {
                        input = `${input.slice(0, idx + sep.length)}${leading}${resolvedSuffix}${trailing}`;
                        break;
                    }
                }
            }
        }

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
                let resolved = resolveTranslation(pieceKey, map, patterns);
                // If lookup failed and key ends with punctuation, try stripping it.
                // This handles cases like "Rare Candy." where the dict has "Rare Candy".
                if (!resolved) {
                    const trailingPunctMatch = pieceKey.match(/^(.+?)([.!?,;:]+)$/);
                    if (trailingPunctMatch) {
                        const baseKey = trailingPunctMatch[1];
                        const punct = trailingPunctMatch[2];
                        const baseResolved = resolveTranslation(baseKey, map, patterns);
                        if (baseResolved) {
                            // Append the punctuation to the translated text
                            resolved = baseResolved + punct;
                        }
                    }
                }
                cache.set(pieceKey, resolved ?? '');
                cached = resolved ?? '';
            }
            if (!cached) return piece;

            const out = `${l}${cached}${t}`;
            return out === piece ? piece : out;
        };

        ENGLISH_RUN_RE.lastIndex = 0;
        let out = '';
        let lastIndex = 0;
        let changed = false;
        let m;
        // eslint-disable-next-line no-cond-assign
        while (m = ENGLISH_RUN_RE.exec(input)) {
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

    // ═══════════════════════════════════════════════
    // 6. DOM 翻译 (DOM Translation)
    // ═══════════════════════════════════════════════

    let _cacheHits = 0;
    let _cacheMisses = 0;

    /** Resolve a translation key through the cache, returning the result or null. */
    const cachedResolve = (lookupKey, map, patterns, cache) => {
        // Check negative cache first (text that doesn't need translation).
        if (noTranslationNeeded.has(lookupKey)) {
            _negativeCacheHits++;
            return null;
        }

        if (cache.has(lookupKey)) {
            _cacheHits++;
            const v = cache.get(lookupKey);
            return v || null;
        }
        _cacheMisses++;
        const resolved = resolveTranslation(lookupKey, map, patterns);

        if (resolved) {
            cache.set(lookupKey, resolved);
        } else {
            // Add to negative cache if no translation found and text looks like it doesn't need translation.
            // (pure numbers, short abbreviations, already translated, etc.)
            const isLikelyNoTranslation =
                /^[\d,.\s%+\-×/]+$/.test(lookupKey) ||  // Pure numbers/symbols
                /^[A-Z]{2,5}$/.test(lookupKey) ||       // Short abbreviations
                /^[\u4e00-\u9fa5]+$/.test(lookupKey);   // Pure Chinese

            if (isLikelyNoTranslation) {
                // Evict oldest entries if negative cache is full.
                if (noTranslationNeeded.size >= NO_TRANSLATION_CACHE_LIMIT) {
                    const evictCount = Math.floor(NO_TRANSLATION_CACHE_LIMIT * 0.25);
                    let removed = 0;
                    for (const k of noTranslationNeeded) {
                        if (removed >= evictCount) break;
                        noTranslationNeeded.delete(k);
                        removed++;
                    }
                }
                noTranslationNeeded.add(lookupKey);
            }
        }
        return resolved || null;
    };

    /**
     * Strip orphan plural "s" suffix that follows a CJK text node.
     * @returns {boolean} true if handled (caller should return early).
     */
    const stripOrphanPluralSuffix = (textNode) => {
        try {
            const rawNode = String(textNode.nodeValue ?? '');
            const rawTrimmed = rawNode.replace(/\u00A0/g, ' ').trim();
            if (rawTrimmed === 's') {
                const prev = textNode.previousSibling;
                if (prev?.nodeType === Node.TEXT_NODE) {
                    const prevText = String(prev.nodeValue ?? '').replace(/\u00A0/g, ' ').trim();
                    if (/[\u4E00-\u9FFF]$/.test(prevText)) {
                        textNode.nodeValue = rawNode.replace(/s/g, '');
                        processedTextNodeValues.set(textNode, String(textNode.nodeValue ?? ''));
                        return true;
                    }
                }
            }
        } catch {
            // ignore
        }
        return false;
    };

    /**
     * Context override for Underground → Treasures "Gem" group title.
     * @returns {boolean} true if handled.
     */
    const handleTreasuresGemOverride = (textNode, key, leading, trailing, raw) => {
        try {
            if (key === 'Gem' && treasuresGemOverride) {
                const parent = textNode.parentElement;
                if (
                    parent
                    && parent.tagName === 'SPAN'
                    && parent.classList?.contains('font-weight-bold')
                    && parent.closest?.('#treasures')
                    && parent.closest?.('.card-header')
                ) {
                    const out = `${leading}${treasuresGemOverride}${trailing}`;
                    if (out !== raw) {
                        textNode.nodeValue = out;
                        processedTextNodeValues.set(textNode, out);
                    }
                    return true;
                }
            }
        } catch {
            // ignore
        }
        return false;
    };

    /**
     * Translate a multi-line text node by resolving each line independently.
     * @returns {boolean} true if any translation was applied.
     */
    const translateMultilineTextNode = (textNode, core, leading, trailing, raw, lookupKey, map, patterns, cache) => {
        if (!/[\r\n]/.test(core)) return false;

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
            cache.set(lookupKey, newCore);
            const out = `${leading}${newCore}${trailing}`;
            if (out !== raw) {
                textNode.nodeValue = out;
                processedTextNodeValues.set(textNode, out);
            }
        }
        return changed;
    };

    /**
     * Try resolving via inline wrapper tags (e.g. `<i>text</i>` as map key).
     * @returns {boolean} true if handled.
     */
    const tryInlineWrapperFallback = (textNode, key, lookupKey, leading, trailing, raw, map, patterns, cache) => {
        try {
            const wrappedKey = buildInlineWrapperKey(textNode, key);
            if (wrappedKey) {
                const wrapped = resolveTranslation(wrappedKey, map, patterns);
                const wrappedText = extractTextFromHtml(wrapped);
                if (wrappedText) {
                    cache.set(lookupKey, wrappedText);
                    const out = `${leading}${wrappedText}${trailing}`;
                    if (out !== raw) {
                        textNode.nodeValue = out;
                        processedTextNodeValues.set(textNode, out);
                    }
                    return true;
                }
            }
        } catch {
            // ignore
        }
        return false;
    };

    const translateLogbookHybridCore = (core, map, patterns, cache) => {
        const translatePart = (value) => {
            if (typeof value !== 'string' || !value) return value;
            const normalized = normalizeText(value);
            if (!normalized) return value;
            const resolved = cachedResolve(normalized, map, patterns, cache);
            if (resolved) return resolved;
            return translateSegmentsFallback(value, map, patterns, cache) || value;
        };

        let match = core.match(/^获得成就"(.+)"[。.] ?$/);
        if (match) {
            const name = translatePart(match[1]);
            return `获得成就“${name}”。`;
        }

        match = core.match(/^已完成"(.+)"$/);
        if (match) {
            const quest = translatePart(match[1]);
            return `已完成“${quest}”`;
        }

        match = core.match(/^完成"(.+)"\s*[，,]?\s*获得\s*([^\s]+)\s*任务点数[。.] ?$/);
        if (match) {
            const quest = translatePart(match[1]);
            return `完成“${quest}”，获得 ${match[2]} 任务点数。`;
        }

        match = core.match(/^你捕捉到了\s+(.+)[。.] ?$/);
        if (match) {
            const pokemon = translatePart(match[1]);
            return `你捕获了 ${pokemon}。`;
        }

        match = core.match(/^你捕捉到了闪光\s*(.+)[!！] ?$/);
        if (match) {
            const pokemon = translatePart(match[1]);
            return `你捕获了闪光${pokemon}！`;
        }

        match = core.match(/^你捕捉到了暗影\s+(.+)[!！] ?$/);
        if (match) {
            const pokemon = translatePart(match[1]);
            return `你捕获了暗影 ${pokemon}！`;
        }

        match = core.match(/^【(.+)】你遇到了一只野生闪光\s*(.+)[。.] ?$/);
        if (match) {
            const location = translatePart(match[1]);
            const pokemon = translatePart(match[2]);
            return `【${location}】你遇到了一只野生闪光${pokemon}。`;
        }

        match = core.match(/^【(.+)】你遇到了一只野生\s+(.+)[。.] ?$/);
        if (match) {
            const location = translatePart(match[1]);
            const pokemon = translatePart(match[2]);
            return `【${location}】你遇到了一只野生 ${pokemon}。`;
        }

        match = core.match(/^【(.+)】你遇到了一只游走的闪光\s*(.+)[。.] ?$/);
        if (match) {
            const location = translatePart(match[1]);
            const pokemon = translatePart(match[2]);
            return `【${location}】你遇到了一只游走的闪光${pokemon}。`;
        }

        match = core.match(/^【(.+)】你遇到了一只游走的\s+(.+)[。.] ?$/);
        if (match) {
            const location = translatePart(match[1]);
            const pokemon = translatePart(match[2]);
            return `【${location}】你遇到了一只游走的 ${pokemon}。`;
        }

        match = core.match(/^野生\s+(.+)\s+挣脱了[!！] ?$/);
        if (match) {
            const pokemon = translatePart(match[1]);
            return `野生 ${pokemon} 逃走了！`;
        }

        match = core.match(/^闪光\s*(.+)\s+挣脱了[!！] ?$/);
        if (match) {
            const pokemon = translatePart(match[1]);
            return `闪光${pokemon} 逃走了！`;
        }

        match = core.match(/^一只野生\s+(.+)\s+来到了农场[!！] ?$/);
        if (match) {
            const pokemon = translatePart(match[1]);
            return `一只野生 ${pokemon} 来到了农场！`;
        }

        match = core.match(/^一只闪光\s*(.+)\s+来到了农场[!！] ?$/);
        if (match) {
            const pokemon = translatePart(match[1]);
            return `一只闪光${pokemon} 来到了农场！`;
        }

        match = core.match(/^你的\s*(.+)\s+进化为闪光\s*(.+)[!！] ?$/);
        if (match) {
            const basePokemon = translatePart(match[1]);
            const evolvedPokemon = translatePart(match[2]);
            return `你的${basePokemon}进化成了闪光${evolvedPokemon}！`;
        }

        match = core.match(/^任务等级提升为\s*(.+)\s*级[!！] ?$/);
        if (match) {
            return `任务等级提升至 ${match[1]} 级！`;
        }

        return null;
    };

    /**
     * Translate a single DOM text node in-place.
     * Tries full-key resolution, multi-line splitting, segment fallback,
     * and inline wrapper fallback before giving up.
     * @param {Text} textNode - DOM text node.
     * @param {Record<string, string>} map - Translation map.
     * @param {Pattern[]} patterns - Regex pattern array.
     * @param {TranslationCache} cache - LRU-style translation cache.
     */
    const applyMapToTextNode = (textNode, map, patterns, cache) => {
        if (!textNode || textNode.nodeType !== Node.TEXT_NODE) return;
        if (shouldSkipNode(textNode)) return;
        const rawNodeValue = String(textNode.nodeValue ?? '');
        if (processedTextNodeValues.get(textNode) === rawNodeValue) return;
        processedTextNodeValues.set(textNode, rawNodeValue);
        if (isHotkeyValueNode(textNode)) return;
        if (!LATIN_RE.test(rawNodeValue)) return;

        if (stripOrphanPluralSuffix(textNode)) return;

        const raw = String(textNode.nodeValue ?? '');
        const { leading, core, trailing } = splitOuterWhitespace(raw);
        const key = normalizeText(core);
        if (!key) return;

        if (handleTreasuresGemOverride(textNode, key, leading, trailing, raw)) return;

        const lookupKey = getWeatherTypeLookupKey(key, { textNode });

        const hybridOut = translateLogbookHybridCore(core, map, patterns, cache);
        if (hybridOut && hybridOut !== core) {
            cache.set(lookupKey, hybridOut);
            const out = `${leading}${hybridOut}${trailing}`;
            if (out !== raw) {
                textNode.nodeValue = out;
                processedTextNodeValues.set(textNode, out);
            }
            return;
        }

        const cached = cachedResolve(lookupKey, map, patterns, cache);
        if (cached) {
            const out = `${leading}${cached}${trailing}`;
            if (out !== raw) {
                textNode.nodeValue = out;
                processedTextNodeValues.set(textNode, out);
            }
            return;
        }

        if (translateMultilineTextNode(textNode, core, leading, trailing, raw, lookupKey, map, patterns, cache)) return;

        const segOut = translateSegmentsFallback(core, map, patterns, cache);
        if (segOut) {
            cache.set(lookupKey, segOut);
            const out = `${leading}${segOut}${trailing}`;
            if (out !== raw) {
                textNode.nodeValue = out;
                processedTextNodeValues.set(textNode, out);
            }
            return;
        }

        if (tryInlineWrapperFallback(textNode, key, lookupKey, leading, trailing, raw, map, patterns, cache)) return;

        if (shouldUseHardcodedMap(lookupKey)) recordMissing(lookupKey);
    };

    const applyMapToElementAttributes = (element, map, patterns, cache) => {
        if (!element || element.nodeType !== Node.ELEMENT_NODE) return;
        const bootstrapToggle = (element.getAttribute('data-bs-toggle') || element.getAttribute('data-toggle') || '').toLowerCase();
        const isBootstrapTooltipOrPopover = bootstrapToggle === 'tooltip' || bootstrapToggle === 'popover';
        for (const attr of attrNames) {
            if (!element.hasAttribute(attr)) continue;
            const raw = element.getAttribute(attr);
            if (raw == null) continue;

            if (!processedAttrValues[attr]) processedAttrValues[attr] = new WeakMap();
            const attrCache = processedAttrValues[attr];
            if (attrCache.get(element) === raw) continue;
            attrCache.set(element, raw);

            // Avoid fighting Bootstrap tooltip/popover internals.
            // Bootstrap frequently copies/mutates `title` <-> `data-original-title`/`data-content`,
            // and rewriting those attributes can cause UI flicker (e.g. map legend).
            if (
                isBootstrapTooltipOrPopover
                && (attr === 'title' || attr === 'data-original-title' || attr === 'data-content')
            ) {
                continue;
            }

            if (attr === 'data-intro') {
                try {
                    const template = document.createElement('template');
                    template.innerHTML = raw;
                    applyMapToNode(template.content, map, patterns, cache);
                    const out = template.innerHTML;
                    if (out && out !== raw) {
                        element.setAttribute(attr, out);
                        attrCache.set(element, out);
                    }
                } catch {
                    // ignore
                }
                continue;
            }

            if (!LATIN_RE.test(raw)) continue;

            const { leading, core, trailing } = splitOuterWhitespace(raw);
            const key = normalizeText(core);
            if (!key) continue;
            const useMap = shouldUseHardcodedMap(key);
            const lookupKey = getWeatherTypeLookupKey(key, { element });

            const cached = cachedResolve(lookupKey, map, patterns, cache);
            if (cached) {
                const out = `${leading}${cached}${trailing}`;
                if (out !== raw) {
                    element.setAttribute(attr, out);
                    attrCache.set(element, out);
                }
                continue;
            }

            const segOut = translateSegmentsFallback(core, map, patterns, cache);
            if (segOut) {
                cache.set(lookupKey, segOut);
                const out = `${leading}${segOut}${trailing}`;
                if (out !== raw) {
                    element.setAttribute(attr, out);
                    attrCache.set(element, out);
                }
                continue;
            }

            if (useMap) recordMissing(lookupKey);
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
        root.querySelectorAll?.(ATTR_SELECTOR)?.forEach((el) => applyMapToElementAttributes(el, map, patterns, cache));
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
            // Some environments may not support querySelectorAll on DocumentFragment.
            if (typeof node.querySelectorAll === 'function') {
                applyMapToRoot(node, map, patterns, cache);
            } else {
                node.childNodes?.forEach((c) => applyMapToNode(c, map, patterns, cache));
            }
        }
    };

    // ═══════════════════════════════════════════════
    // 7. 初始化与观察器 (Initialization & Observer)
    // ═══════════════════════════════════════════════

    const start = async () => {
        if (DEBUG) {
            log.info(window.PokeClickerZhHans.getConfig());
        }

        // Show a loading banner while translations are being fetched.
        let loadingBanner = null;
        try {
            loadingBanner = document.createElement('div');
            loadingBanner.id = 'pkc-zh-hans-loading';
            loadingBanner.textContent = '正在加载中文翻译...';
            loadingBanner.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:99999;' +
                'background:#1a73e8;color:#fff;text-align:center;padding:4px 0;font-size:13px;' +
                'font-family:system-ui,sans-serif;opacity:0.92;';
            (document.body || document.documentElement).appendChild(loadingBanner);
        } catch {
            loadingBanner = null;
        }

        const removeLoadingBanner = () => {
            try { loadingBanner?.remove(); } catch { /* ignore */ }
            loadingBanner = null;
        };

        const config = await loadUserscriptConfig();
        if (config) {
            notifierLoadedMessage = config.notifierLoadedMessage || notifierLoadedMessage;
            typeTranslations = config.types || typeTranslations;
            if (config?.css?.badgeSuffix) userscriptCssLabels.badgeSuffix = config.css.badgeSuffix;
            if (Array.isArray(config?.demixReplacements)) demixReplacements = config.demixReplacements;
            if (config?.templates) {
                templates.typePokemon = config.templates.typePokemon ?? templates.typePokemon;
                templates.gymAt = config.templates.gymAt ?? templates.gymAt;
                templates.trialAt = config.templates.trialAt ?? templates.trialAt;
                templates.route.noRegion = config.templates.route?.noRegion ?? templates.route.noRegion;
                templates.route.withRegion = config.templates.route?.withRegion ?? templates.route.withRegion;
            }
            if (Array.isArray(config.typeKeys) && config.typeKeys.length > 0) {
                TYPE_KEYS = config.typeKeys;
            }
            if (Array.isArray(config.weatherTypeKeys) && config.weatherTypeKeys.length > 0) {
                WEATHER_TYPE_KEYS = new Set(config.weatherTypeKeys);
            }
            if (typeof config.context?.treasuresGem === 'string' && config.context.treasuresGem) {
                treasuresGemOverride = config.context.treasuresGem;
            }
            if (config.time && typeof config.time === 'object') {
                shortTimeLabels = {
                    now: typeof config.time.now === 'string' && config.time.now ? config.time.now : null,
                    lessThanPrefix: typeof config.time.lessThanPrefix === 'string' ? config.time.lessThanPrefix : null,
                    units: config.time.units && typeof config.time.units === 'object' ? { ...config.time.units } : {},
                };
            }
            injectCssOverrides(config.css);
        } else {
            injectCssOverrides(null);
        }

        /** @type {Record<string,string>} */
        let map = {};
        let bundleMeta = null;

        const addEntryToMap = (key, value) => {
            if (typeof key !== 'string' || !key) return false;
            if (typeof value === 'string' && value) {
                map[key] = value;
                return true;
            }
            if (value && typeof value === 'object' && typeof value.translation === 'string' && value.translation) {
                map[key] = value.translation;
                return true;
            }
            return false;
        };

        const ingestEntriesToMap = (entriesLike) => {
            let count = 0;
            if (!entriesLike) return count;
            if (Array.isArray(entriesLike)) {
                for (const item of entriesLike) {
                    if (Array.isArray(item) && item.length >= 2) {
                        if (addEntryToMap(item[0], item[1])) count += 1;
                    } else if (item && typeof item === 'object' && 'key' in item && 'value' in item) {
                        if (addEntryToMap(item.key, item.value)) count += 1;
                    }
                }
                return count;
            }
            if (typeof entriesLike === 'object') {
                for (const [key, value] of Object.entries(entriesLike)) {
                    if (addEntryToMap(key, value)) count += 1;
                }
            }
            return count;
        };

        const loadMapFromBundle = async () => {
            try {
                // Cache-first: try IndexedDB cache before network.
                // If cache record is from an older script version or missing contentHash, prefer network once.
                const cachedRec = await loadBundleFromCache();
                const cachedBundle = cachedRec?.bundle ?? null;
                const cacheLooksLegacy = Boolean(cachedRec && typeof cachedRec.contentHash !== 'string');

                let json = null;
                let loadedFromCache = false;

                if (cachedBundle && !cacheLooksLegacy) {
                    json = cachedBundle;
                    loadedFromCache = true;
                    if (DEBUG) {
                        log.info('Loaded bundle from cache:', json?._meta ?? null);
                    }
                } else if (cachedBundle) {
                    // Prefer network once (but keep cache as fallback for offline)
                    json = await fetchJsonWithFallback(
                        buildUrlCandidates(`${FORCE_LANG}/bundle.json`),
                        { cache: 'no-cache' },
                    );
                    if (!json) {
                        json = cachedBundle;
                        loadedFromCache = true;
                        if (DEBUG) {
                            log.info('Loaded legacy bundle from cache:', json?._meta ?? null);
                        }
                    }
                } else {
                    json = await fetchJsonWithFallback(
                        buildUrlCandidates(`${FORCE_LANG}/bundle.json`),
                        { cache: 'no-cache' },
                    );
                }

                bundleMeta = json?._meta ?? null;
                let count = 0;
                count += ingestEntriesToMap(json?.entries);
                count += ingestEntriesToMap(json?.entriesCaseSensitive);
                if (DEBUG) {
                    log.info('Loaded bundle:', count, 'entries');
                }

                // Best-effort cache update
                if (!loadedFromCache) {
                    void saveBundleToCache(json);
                } else {
                    // Background refresh when loaded from cache
                    const currentGeneratedAt = cachedRec?.generatedAt ?? json?._meta?.generatedAt ?? null;
                    const currentContentHash = cachedRec?.contentHash ?? null;
                    const schedule = (fn) => {
                        const ric = window.requestIdleCallback?.bind(window);
                        if (ric) return ric(fn, { timeout: 5000 });
                        return setTimeout(fn, 2500);
                    };
                    schedule(async () => {
                        try {
                            const latest = await fetchJsonWithFallback(
                                buildUrlCandidates(`${FORCE_LANG}/bundle.json`),
                                { cache: 'no-cache' },
                            );
                            const saved = await saveBundleToCache(latest, cachedRec);
                            const latestGeneratedAt = saved?.generatedAt ?? latest?._meta?.generatedAt ?? null;
                            const latestContentHash = saved?.contentHash ?? null;
                            const changed = Boolean(saved?.changed);
                            const hasDifferentGeneratedAt = typeof latestGeneratedAt === 'string'
                                && latestGeneratedAt
                                && typeof currentGeneratedAt === 'string'
                                && currentGeneratedAt
                                && latestGeneratedAt !== currentGeneratedAt;
                            const hasDifferentContentHash = typeof latestContentHash === 'string'
                                && latestContentHash
                                && typeof currentContentHash === 'string'
                                && currentContentHash
                                && latestContentHash !== currentContentHash;
                            if (changed && (hasDifferentGeneratedAt || hasDifferentContentHash || !currentContentHash)) {
                                try {
                                    if (window.Notifier?.notify) {
                                        window.Notifier.notify({
                                            title: '翻译已更新',
                                            message: '已在后台下载新的中文翻译，刷新页面后生效。',
                                            timeout: 7000,
                                        });
                                    }
                                } catch {
                                    // ignore
                                }
                            }
                        } catch (e) {
                            if (DEBUG) {
                                log.warn('Background bundle refresh failed:', e);
                            }
                        }
                    });
                }

                return count > 0;
            } catch {
                return false;
            }
        };

        // 优先加载 bundle（发布用单文件），失败再回退到分文件索引
        try {
            const ok = await loadMapFromBundle();
            if (!ok && ENABLE_SPLIT_TRANSLATIONS_FALLBACK) {
                try {
                    const index = await fetchJsonWithFallback(
                        buildUrlCandidates(`${FORCE_LANG}/_index.json`),
                        { cache: 'no-cache' },
                    );
                    const files = Object.keys(index.files || {}).filter((f) =>
                        !f.includes('/code.json')
                        && !f.startsWith('locales/')
                        && f !== 'overrides/userscript.json'
                        && f !== 'bundle.json'
                    );
                    const results = await Promise.all(files.map(async (file) => {
                        try {
                            return await fetchJsonWithFallback(
                                buildUrlCandidates(`${FORCE_LANG}/${file}`),
                                { cache: 'no-cache' },
                            );
                        } catch {
                            return null;
                        }
                    }));
                    for (const data of results) {
                        ingestEntriesToMap(data?.entries);
                        ingestEntriesToMap(data?.entriesCaseSensitive);
                    }
                    if (DEBUG) {
                        log.info('Loaded split translations:', files.length, 'files,', Object.keys(map).length, 'entries');
                    }
                } catch {
                    log.error('Failed to load translations index.');
                }
            } else if (!ok) {
                log.error('Failed to load bundle.json and split fallback is disabled.');
            }
        } catch (e) {
            log.error('Failed to load translation resources:', e);
        }

        // Load user-defined translation overrides from localStorage.
        // Must run BEFORE casefold/punctfold index building so overrides are included.
        try {
            const raw = localStorage.getItem('pokeclickerZhHansUserOverrides');
            if (raw) {
                const overrides = JSON.parse(raw);
                if (overrides && typeof overrides === 'object') {
                    let count = 0;
                    for (const [k, v] of Object.entries(overrides)) {
                        if (typeof k === 'string' && k && typeof v === 'string' && v) {
                            map[k] = v;
                            count++;
                        }
                    }
                    if (DEBUG && count > 0) {
                        log.info('Loaded user overrides:', count, 'entries');
                    }
                }
            }
        } catch {
            // ignore invalid JSON
        }

        // Build a safe case-insensitive index for translation lookups.
        // If multiple keys collide case-insensitively, we skip the entire group.
        try {
            const index = new Map();
            const dup = new Set();
            for (const [k, v] of Object.entries(map)) {
                if (typeof k !== 'string' || !k) continue;
                if (typeof v !== 'string' || !v) continue;
                const lk = k.toLowerCase();
                if (dup.has(lk)) continue;
                if (index.has(lk)) {
                    index.delete(lk);
                    dup.add(lk);
                    continue;
                }
                index.set(lk, v);
            }
            Object.defineProperty(map, '__pkcZhHansCasefoldIndex', { value: index });
        } catch {
            // ignore
        }

        // Build a safe punctuation-folded index for translation lookups.
        // If multiple keys collide after folding, we skip the entire group.
        try {
            const index = new Map();
            const dup = new Set();
            for (const [k, v] of Object.entries(map)) {
                if (typeof k !== 'string' || !k) continue;
                if (typeof v !== 'string' || !v) continue;
                const lk = foldPunctuationForLookup(normalizeForLookup(k)).toLowerCase();
                if (!lk) continue;
                if (dup.has(lk)) continue;
                if (index.has(lk)) {
                    index.delete(lk);
                    dup.add(lk);
                    continue;
                }
                index.set(lk, v);
            }
            Object.defineProperty(map, '__pkcZhHansPunctFoldIndex', { value: index });
        } catch {
            // ignore
        }

        try {
            const json = await fetchJsonWithFallback(
                buildUrlCandidates(`${FORCE_LANG}/locales/pokemon.json`),
                { cache: 'no-cache' },
            );
            if (json) {
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
        Object.defineProperty(patterns, '__pkcIndex', { value: buildPatternIndex(patterns) });
        const cache = new TranslationCache(50000);

        const translateWithFallback = (text) => {
            const resolved = resolveTranslation(text, map, patterns);
            if (resolved) return resolved;
            return translateSegmentsFallback(text, map, patterns, cache);
        };

        const translateHtmlFragment = (html) => {
            const input = String(html ?? '');
            if (!input) return null;
            try {
                const container = document.createElement('div');
                container.innerHTML = input.replace(/\r?\n/g, '<br/>');
                applyMapToRoot(container, map, patterns, cache);
                return container.innerHTML;
            } catch {
                return null;
            }
        };

        const translateForNotifierImpl = (text) => {
            if (typeof text !== 'string' || !text) return null;
            const input = normalizeForLookup(text);
            const looksLikeHtml = /<[^>]+>/.test(text);
            if (looksLikeHtml) return translateHtmlFragment(text);

            const full = translateWithFallback(input);
            if (full) return full;

            const lines = text.split(/\r?\n/);
            if (lines.length <= 1) return null;
            let changed = false;
            const outLines = lines.map((line) => {
                const t = translateWithFallback(line);
                if (t && t !== line) {
                    changed = true;
                    return t;
                }
                return line;
            });
            return changed ? outLines.join('\n') : null;
        };

        translateForNotifier = translateForNotifierImpl;
        window.PokeClickerZhHans.lookup = translateForNotifierImpl;
        window.PokeClickerZhHans.getBundleMeta = () => bundleMeta;

        /**
         * Persist a user-defined translation override.
         * @param {string} en - English key.
         * @param {string} zh - Chinese translation value.
         */
        window.PokeClickerZhHans.setOverride = (en, zh) => {
            if (typeof en !== 'string' || !en) return;
            if (typeof zh !== 'string' || !zh) return;
            try {
                const raw = localStorage.getItem('pokeclickerZhHansUserOverrides');
                const overrides = raw ? JSON.parse(raw) : {};
                overrides[en] = zh;
                localStorage.setItem('pokeclickerZhHansUserOverrides', JSON.stringify(overrides));
                map[en] = zh;
                cache.delete(en);
                cache.delete(normalizeForLookup(en));
            } catch {
                // ignore
            }
        };

        /** Return translation runtime statistics. */
        window.PokeClickerZhHans.stats = () => ({
            mapSize: Object.keys(map).length,
            cacheSize: cache.size,
            cacheLimit: cache.limit,
            cacheEvictions: cache._evictionCount,
            cacheHits: _cacheHits,
            cacheMisses: _cacheMisses,
            cacheHitRate: (_cacheHits + _cacheMisses) > 0
                ? (_cacheHits / (_cacheHits + _cacheMisses) * 100).toFixed(1) + '%'
                : 'N/A',
            negativeCacheSize: noTranslationNeeded.size,
            negativeCacheHits: _negativeCacheHits,
            missingCount: missingSet.size,
            patternCount: patterns.length,
            normCacheSize: _normCache.size,
        });

        // Patch the Knockout tooltip binding so titles are translated before Bootstrap renders them.
        // This covers dynamic HTML tooltips like DayCycle.tooltip() in `townMap.html`.
        const tryPatchKoTooltipBinding = () => {
            try {
                const ko = window.ko;
                const handler = ko?.bindingHandlers?.tooltip;
                if (!handler || handler.__pkcZhHansTitlePatched) return false;

                const wrapValueAccessor = (element, valueAccessor) => () => {
                    const local = ko.utils.unwrapObservable(valueAccessor());
                    if (!local || typeof local !== 'object') return local;
                    const out = { ...local };
                    if (typeof out.title === 'string') {
                        const key = normalizeForLookup(out.title);
                        let t;
                        try {
                            const weatherKey = getWeatherTypeLookupKey(key, { element });
                            if (weatherKey !== key) {
                                t = translateForNotifierImpl(weatherKey);
                            }
                        } catch {
                            // ignore
                        }
                        if (!t) t = translateForNotifierImpl(out.title);
                        if (t) out.title = t;
                    }
                    return out;
                };

                if (typeof handler.init === 'function') {
                    const originalInit = handler.init;
                    handler.init = function (element, valueAccessor, allBindings, viewModel, bindingContext) {
                        return originalInit.call(
                            this,
                            element,
                            wrapValueAccessor(element, valueAccessor),
                            allBindings,
                            viewModel,
                            bindingContext,
                        );
                    };
                }
                if (typeof handler.update === 'function') {
                    const originalUpdate = handler.update;
                    handler.update = function (element, valueAccessor) {
                        return originalUpdate.call(this, element, wrapValueAccessor(element, valueAccessor));
                    };
                }

                Object.defineProperty(handler, '__pkcZhHansTitlePatched', { value: true });
                return true;
            } catch {
                return false;
            }
        };
        pollUntil(tryPatchKoTooltipBinding);

        // Patch Bootstrap's tooltip title getter so already-initialized tooltips also show Chinese.
        const tryPatchBootstrapTooltip = () => {
            try {
                const patchCtor = (Ctor) => {
                    const proto = Ctor?.prototype;
                    if (!proto || proto.__pkcZhHansTitlePatched) return false;
                    const methodName = typeof proto.getTitle === 'function'
                        ? 'getTitle'
                        : (typeof proto._getTitle === 'function' ? '_getTitle' : null);
                    if (!methodName) return false;
                    const original = proto[methodName];
                    proto[methodName] = function (...args) {
                        const title = original.apply(this, args);
                        if (typeof title !== 'string' || !title) return title;

                        try {
                            const key = normalizeForLookup(title);
                            const el = this?._element || this?.element;
                            const weatherKey = getWeatherTypeLookupKey(key, { element: el });
                            if (weatherKey !== key) {
                                const t = translateForNotifierImpl(weatherKey);
                                if (t) return t;
                            }
                        } catch {
                            // ignore
                        }

                        const t = translateForNotifierImpl(title);
                        return t || title;
                    };
                    Object.defineProperty(proto, '__pkcZhHansTitlePatched', { value: true });
                    return true;
                };

                const $ = window.jQuery || window.$;
                const jqCtor = $?.fn?.tooltip?.Constructor;
                const patchedJq = patchCtor(jqCtor);

                const bsCtor = window.bootstrap?.Tooltip;
                const patchedBs = patchCtor(bsCtor);

                return patchedJq || patchedBs;
            } catch {
                return false;
            }
        };
        pollUntil(tryPatchBootstrapTooltip);

        const LOGBOOK_POKEMON_VAR_KEYS = new Set(['pokemon', 'basePokemon', 'evolvedPokemon']);

        const translateLogbookString = (text) => {
            if (typeof text !== 'string' || !text) return text;
            const lookupKey = normalizeText(text);
            if (!lookupKey) return text;

            const resolved = cachedResolve(lookupKey, map, patterns, cache);
            if (resolved && resolved !== lookupKey) return resolved;

            const fallback = translateSegmentsFallback(text, map, patterns, cache);
            return fallback || text;
        };

        const translateLogbookRuntimeValue = (value, keyHint = '') => {
            if (typeof value === 'string') {
                if (LOGBOOK_POKEMON_VAR_KEYS.has(keyHint)) {
                    return { value, changed: false };
                }
                const translated = translateLogbookString(value);
                return {
                    value: translated,
                    changed: translated !== value,
                };
            }

            if (Array.isArray(value)) {
                let changed = false;
                const translatedArray = value.map((item) => {
                    const result = translateLogbookRuntimeValue(item, keyHint);
                    if (result.changed) changed = true;
                    return result.value;
                });
                return changed ? { value: translatedArray, changed: true } : { value, changed: false };
            }

            if (value && typeof value === 'object') {
                let changed = false;
                const translatedObject = {};
                for (const [nestedKey, nestedValue] of Object.entries(value)) {
                    const result = translateLogbookRuntimeValue(nestedValue, nestedKey);
                    translatedObject[nestedKey] = result.value;
                    if (result.changed) changed = true;
                }
                return changed ? { value: translatedObject, changed: true } : { value, changed: false };
            }

            return { value, changed: false };
        };

        const translateLogbookContentInPlace = (content) => {
            if (!content || typeof content !== 'object') return false;

            let changed = false;

            if (content.key === 'notTranslated' && typeof content.vars?.text === 'string') {
                const translatedText = translateLogbookString(content.vars.text);
                if (translatedText !== content.vars.text) {
                    content.vars.text = translatedText;
                    changed = true;
                }
            }

            if (content.vars && typeof content.vars === 'object') {
                for (const [varKey, varValue] of Object.entries(content.vars)) {
                    const result = translateLogbookRuntimeValue(varValue, varKey);
                    if (result.changed) {
                        content.vars[varKey] = result.value;
                        changed = true;
                    }
                }
            }

            return changed;
        };

        const refreshLogbookEntryDescription = (entry) => {
            if (!entry?.content) return;

            if (entry.content.key === 'notTranslated') {
                if (typeof entry.content.vars?.text === 'string') {
                    entry.description = entry.content.vars.text;
                }
                return;
            }

            if (window.App?.translation?.get) {
                entry.description = window.App.translation.get(entry.content.key, 'logbook', entry.content.vars);
            }
        };

        const sweepExistingLogbookEntries = (logbook) => {
            try {
                const entries = typeof logbook?.logs === 'function' ? logbook.logs() : [];
                if (!Array.isArray(entries) || !entries.length) return false;

                let changed = false;
                for (const entry of entries) {
                    if (!entry?.content) continue;
                    const entryChanged = translateLogbookContentInPlace(entry.content);
                    if (entryChanged) {
                        refreshLogbookEntryDescription(entry);
                        changed = true;
                    }
                }

                if (changed && typeof logbook.logs.valueHasMutated === 'function') {
                    logbook.logs.valueHasMutated();
                }
                return true;
            } catch {
                return false;
            }
        };

        // Patch App.translation.get to translate logbook variables recursively before rendering.
        const tryPatchAppTranslationGet = () => {
            try {
                if (!window.App?.translation?.get) return false;
                if (window.App.translation.get.__pkcZhHansPatched) return true;

                const originalGet = window.App.translation.get;

                const wrappedGet = function (key, namespace, vars) {
                    if (namespace === 'logbook' && vars && typeof vars === 'object') {
                        const translatedVars = translateLogbookRuntimeValue(vars);
                        if (translatedVars.changed) {
                            return originalGet.call(window.App.translation, key, namespace, translatedVars.value);
                        }
                    }

                    return originalGet.apply(window.App.translation, arguments);
                };

                Object.defineProperty(wrappedGet, '__pkcZhHansPatched', { value: true });
                window.App.translation.get = wrappedGet;

                if (DEBUG) {
                    log.info('Patched App.translation.get for logbook variable translation');
                }
                return true;
            } catch (e) {
                if (DEBUG) {
                    log.warn('Failed to patch App.translation.get:', e);
                }
                return false;
            }
        };
        pollUntil(tryPatchAppTranslationGet);

        const tryPatchLogbookRuntime = () => {
            try {
                const logbook = window.App?.game?.logbook;
                if (!logbook?.logs || typeof logbook.newLog !== 'function') return false;

                if (!logbook.__pkcZhHansPatched) {
                    const originalNewLog = logbook.newLog.bind(logbook);
                    logbook.newLog = function (type, content) {
                        translateLogbookContentInPlace(content);
                        const result = originalNewLog(type, content);
                        try {
                            const latestEntry = typeof logbook.logs === 'function' ? logbook.logs()[0] : null;
                            if (latestEntry) refreshLogbookEntryDescription(latestEntry);
                        } catch {
                            // ignore
                        }
                        return result;
                    };

                    if (typeof logbook.fromJSON === 'function') {
                        const originalFromJSON = logbook.fromJSON.bind(logbook);
                        logbook.fromJSON = function (json) {
                            const result = originalFromJSON(json);
                            sweepExistingLogbookEntries(logbook);
                            return result;
                        };
                    }

                    Object.defineProperty(logbook, '__pkcZhHansPatched', { value: true });
                }

                sweepExistingLogbookEntries(logbook);
                return true;
            } catch {
                return false;
            }
        };
        pollUntil(tryPatchLogbookRuntime);

        if (DEBUG) {
            log.info('bundle meta:', bundleMeta);
        }

        const tryPatchSpecialEvents = () => {
            try {
                const events = window.App?.game?.specialEvents?.events;
                if (!Array.isArray(events) || !events.length) return false;
                for (const event of events) {
                    if (!event || typeof event.description !== 'string') continue;
                    const t = resolveTranslation(event.description, map, patterns);
                    if (t) event.description = t;
                }
                return true;
            } catch {
                return false;
            }
        };
        pollUntil(tryPatchSpecialEvents);

        applyMapToRoot(document.documentElement, map, patterns, cache);
        removeLoadingBanner();

        const pendingRoots = new Set();
        const pendingAttrs = new Set();
        const pendingText = new Set();
        let scheduled = false;
        let lastFlushTime = 0;
        const MIN_DEBOUNCE_MS = 32; // Minimum 32ms between flushes (~30fps max)

        const addRoot = (node) => {
            if (!node) return;
            // If document.body is already queued, any child is redundant.
            if (pendingRoots.has(document.body) && document.body?.contains?.(node)) return;
            // Skip if an existing root already covers this node.
            for (const r of pendingRoots) {
                if (r === node) return;
                if (r?.contains?.(node)) return;
            }
            // If this node covers existing roots, drop them.
            for (const r of pendingRoots) {
                if (node?.contains?.(r)) pendingRoots.delete(r);
            }
            pendingRoots.add(node);
        };

        const scheduleFlush = () => {
            if (scheduled) return;
            scheduled = true;

            const flush = () => {
                scheduled = false;
                lastFlushTime = Date.now();

                // If pending items exceed a threshold, merge into a single full-document traversal.
                const totalPending = pendingRoots.size + pendingAttrs.size + pendingText.size;
                if (totalPending > 200) {
                    pendingRoots.clear();
                    pendingAttrs.clear();
                    pendingText.clear();
                    applyMapToRoot(document.documentElement, map, patterns, cache);
                    return;
                }

                const roots = Array.from(pendingRoots);
                const attrs = Array.from(pendingAttrs);
                const textNodes = Array.from(pendingText);
                pendingRoots.clear();
                pendingAttrs.clear();
                pendingText.clear();

                for (const n of roots) applyMapToNode(n, map, patterns, cache);

                const coveredByRoots = (n) => roots.some((r) => r?.contains?.(n));
                for (const el of attrs) {
                    if (!coveredByRoots(el)) applyMapToElementAttributes(el, map, patterns, cache);
                }
                for (const t of textNodes) {
                    if (!coveredByRoots(t)) applyMapToTextNode(t, map, patterns, cache);
                }
            };

            // Use debouncing to avoid excessive processing during rapid DOM changes.
            const now = Date.now();
            const timeSinceLastFlush = now - lastFlushTime;
            const delay = Math.max(0, MIN_DEBOUNCE_MS - timeSinceLastFlush);

            const raf = window.requestAnimationFrame?.bind(window);
            if (delay > 0) {
                // Debounce: wait before flushing to batch rapid mutations.
                setTimeout(() => {
                    if (raf) raf(flush);
                    else flush();
                }, delay);
            } else if (raf) {
                raf(flush);
            } else {
                setTimeout(flush, 16);
            }
        };

        const observer = new MutationObserver((mutations) => {
            for (const m of mutations) {
                if (m.type === 'childList') {
                    for (const n of m.addedNodes) {
                        if (!n) continue;
                        if (n.nodeType === Node.TEXT_NODE) {
                            pendingText.add(n);
                        } else if (n.nodeType === Node.ELEMENT_NODE || n.nodeType === Node.DOCUMENT_FRAGMENT_NODE) {
                            addRoot(n);
                        }
                    }
                } else if (m.type === 'attributes') {
                    pendingAttrs.add(m.target);
                } else if (m.type === 'characterData') {
                    if (m.target?.nodeType === Node.TEXT_NODE) pendingText.add(m.target);
                }
            }
            if (pendingRoots.size || pendingAttrs.size || pendingText.size) scheduleFlush();
        });

        observer.observe(document.documentElement, {
            subtree: true,
            childList: true,
            characterData: true,
            attributes: true,
            attributeFilter: attrNames,
        });
    };

    let started = false;
    const startOnce = () => {
        if (started) return;
        started = true;
        void start();
    };
    startOnce();
    window.addEventListener('DOMContentLoaded', startOnce, { once: true });
})();
