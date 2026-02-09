// ==UserScript==
// @name         PokeClicker 宝可梦点击 简体中文补全
// @namespace    https://github.com/mianfeipiao123/pokeclicker-auto
// @version      0.1.56
// @description  PokeClicker 宝可梦点击 全面汉化
// @homepageURL  https://github.com/mianfeipiao123/pokeclicker-auto
// @supportURL   https://github.com/mianfeipiao123/pokeclicker-auto/issues
// @match        https://www.pokeclicker.com/*
// @match        https://g8hh.github.io/pokeclicker/*
// @match        https://pokeclicker.g8hh.com/*
// @match        https://pokeclicker.g8hh.com.cn/*
// @match        https://yx.g8hh.com/pokeclicker/*
// @match        https://dreamnya.github.io/pokeclicker/*
// @updateURL    https://raw.githubusercontent.com/mianfeipiao123/pokeclicker-auto/main/pokeclicker-zh-hans.user.js
// @downloadURL  https://raw.githubusercontent.com/mianfeipiao123/pokeclicker-auto/main/pokeclicker-zh-hans.user.js
// @run-at       document-start
// @grant        none
// ==/UserScript==

(() => {
    'use strict';

    // 拦截 Notifier.notify，用于替换“翻译资源已加载”的提示（文案从外置配置加载）
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
    if (!hookNotifier()) {
        const interval = setInterval(() => {
            if (hookNotifier()) clearInterval(interval);
        }, 50);
        setTimeout(() => clearInterval(interval), 10000);
    }

    const SCRIPT_VERSION = '0.1.56';

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

    const uniqueStrings = (arr) => Array.from(new Set((arr ?? []).filter((v) => typeof v === 'string' && v)));
    const joinUrl = (base, path) => {
        const b = String(base ?? '').replace(/\/+$/, '');
        const p = String(path ?? '').replace(/^\/+/, '');
        if (!b) return p;
        if (!p) return b;
        return `${b}/${p}`;
    };

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
            translationsBaseUrlCandidates: TRANSLATIONS_BASE_URL_CANDIDATES,
            fetchTimeoutRawMs: RAW_FETCH_TIMEOUT_MS,
            fetchTimeoutFallbackMs: FALLBACK_FETCH_TIMEOUT_MS,
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

    const normalizeText = (text) =>
        String(text ?? '')
            .replace(/\u00A0/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();

    const normalizeForLookup = (text) => {
        let s = String(text ?? '');
        try {
            s = s.normalize('NFC');
        } catch {
            // ignore
        }
        s = s
            .replace(/\u00A0/g, ' ')
            .replace(/，/g, ',')
            .replace(/。/g, '.')
            .replace(/：/g, ':')
            .replace(/；/g, ';');
        s = s.replace(/\s*,\s*/g, ', ');
        return normalizeText(s);
    };

    const foldPunctuationForLookup = (text) =>
        String(text ?? '')
            // Curly quotes/apostrophes → ASCII
            .replace(/[\u2018\u2019\u02BC]/g, "'")
            .replace(/[\u201C\u201D]/g, '"')
            // Dashes/minus → ASCII hyphen
            .replace(/[\u2013\u2014\u2212]/g, '-');

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
    const ATTR_SELECTOR = attrNames.map((a) => `[${a}]`).join(',');

    const escapeRegExp = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    class LruCache extends Map {
        constructor(limit) {
            super();
            this.limit = Number.isFinite(limit) && limit > 0 ? limit : 20000;
        }

        get(key) {
            if (!super.has(key)) return undefined;
            const value = super.get(key);
            super.delete(key);
            super.set(key, value);
            return value;
        }

        set(key, value) {
            if (super.has(key)) super.delete(key);
            super.set(key, value);
            if (this.size > this.limit) {
                const firstKey = this.keys().next().value;
                super.delete(firstKey);
            }
            return this;
        }
    }

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

    const fetchJsonWithFallback = async (urls, init) => {
        let lastError = null;
        for (let i = 0; i < urls.length; i += 1) {
            const url = urls[i];
            const timeoutMs = i === 0 ? RAW_FETCH_TIMEOUT_MS : FALLBACK_FETCH_TIMEOUT_MS;
            try {
                const json = await fetchJsonWithTimeout(url, init, timeoutMs);
                if (DEBUG && url !== urls[0]) {
                    // eslint-disable-next-line no-console
                    console.info('[PokéClicker zh-Hans] Loaded from fallback:', url);
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

    const formatTemplate = (tmpl, vars) =>
        String(tmpl ?? '').replace(/\{\{(\w+)\}\}/g, (m, k) => {
            const v = vars?.[k];
            return typeof v === 'string' || typeof v === 'number' ? String(v) : m;
        });

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

        const mapped = shouldUseHardcodedMap(key) ? map?.[key] : undefined;
        if (typeof mapped === 'string' && !mapped.includes('${...}')) {
            return finalizeTranslation(mapped, map);
        }

        // Dynamic enum names often appear humanified (spaces instead of underscores), e.g. "Spike Shell".
        // Try lookup variants against the loaded map (which contains enum keys like "Spike_Shell").
        if (shouldUseHardcodedMap(key) && (key.includes(' ') || key.includes('-'))) {
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
            patterns.push({ re, zhParts, literalLen });
        }
        // Prefer patterns with more literal anchor text, then longer regex.
        patterns.sort((a, b) => (b.literalLen - a.literalLen) || (b.re.source.length - a.re.source.length));
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
            if (out && out !== text) return out;
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
            if (typeof inline === 'string' && inline) return finalizeTranslation(inline, map);
        }

        for (const k of candidates) {
            const direct = map?.[k];
            if (typeof direct === 'string' && direct) return finalizeTranslation(direct, map);
        }

        // Case-insensitive fallback for DOM strings that differ only by capitalization.
        // Uses a precomputed index built from non-colliding keys.
        const casefoldIndex = map?.__pkcZhHansCasefoldIndex;
        if (casefoldIndex && typeof casefoldIndex.get === 'function') {
            for (const k of candidates) {
                if (!k) continue;
                const v = casefoldIndex.get(String(k).toLowerCase());
                if (typeof v === 'string' && v) return finalizeTranslation(v, map);
            }
        }

        // Punctuation-folded fallback for typographic variants (e.g. "It’s" vs "It's").
        // Uses a precomputed index built from non-colliding folded keys.
        const punctFoldIndex = map?.__pkcZhHansPunctFoldIndex;
        if (punctFoldIndex && typeof punctFoldIndex.get === 'function') {
            for (const k of candidates) {
                if (!k) continue;
                const lk = foldPunctuationForLookup(normalizeForLookup(k)).toLowerCase();
                if (!lk) continue;
                const v = punctFoldIndex.get(lk);
                if (typeof v === 'string' && v) return finalizeTranslation(v, map);
            }
        }

        const useMap = candidates.some((k) => shouldUseHardcodedMap(k));
        if (!useMap) return null;

        for (const k of candidates) {
            const pokemon = pokemonTranslations?.[k];
            if (typeof pokemon === 'string') {
                return finalizeTranslation(pokemon, map);
            }
        }

        // Humanified enum names often appear in DOM text (spaces instead of underscores), e.g. "Melemele Stamp".
        // Try lookup variants against the loaded map (which contains enum keys like "Melemele_Stamp").
        for (const k of candidates) {
            if (!shouldUseHardcodedMap(k)) continue;
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

        if (patterns.length) {
            for (const k of candidates) {
                const matched = applyPatterns(k, patterns, map);
                if (typeof matched === 'string' && matched) return finalizeTranslation(matched, map);

                // Pattern keys usually use ASCII punctuation, but upstream strings sometimes contain typographic variants
                // (e.g. "I’ve" vs "I've"). Try a folded variant to improve match rate for dynamic templates.
                const folded = foldPunctuationForLookup(k);
                if (folded && folded !== k) {
                    const matchedFolded = applyPatterns(folded, patterns, map);
                    if (typeof matchedFolded === 'string' && matchedFolded) return finalizeTranslation(matchedFolded, map);
                }
            }
        }

        // Handle dynamic badge names that are not present as full strings in translation maps,
        // e.g. "Spike Shell Badge" / "BoulderBadge".
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

        // Many settings/labels are rendered as `${displayName}:` in templates.
        // If the only difference is a trailing colon, try translating without it and re-append.
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
                const resolved = resolveTranslation(pieceKey, map, patterns);
                cache.set(pieceKey, resolved ?? '');
                cached = resolved ?? '';
            }
            if (!cached) return piece;

            const out = `${l}${cached}${t}`;
            return out === piece ? piece : out;
        };

        const englishRunRe = /[A-Za-zÉé][A-Za-z0-9Éé\s,.%\"'’!?():/\\-]*/g;
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

        // In a few places, the game builds English plurals by appending a separate "s" node.
        // When the base word is translated to Chinese (e.g. "Dungeon" -> "迷宫"), the leftover "s" becomes visible ("迷宫s").
        // Strip such orphan plural suffixes when they directly follow a CJK text node.
        try {
            const rawNode = String(textNode.nodeValue ?? '');
            const rawTrimmed = rawNode.replace(/\u00A0/g, ' ').trim();
            if (rawTrimmed === 's') {
                const prev = textNode.previousSibling;
                if (prev?.nodeType === Node.TEXT_NODE) {
                    const prevText = String(prev.nodeValue ?? '').replace(/\u00A0/g, ' ').trim();
                    if (/[\u4E00-\u9FFF]$/.test(prevText)) {
                        textNode.nodeValue = rawNode.replace(/s/g, '');
                        return;
                    }
                }
            }
        } catch {
            // ignore
        }

        const raw = String(textNode.nodeValue ?? '');
        const { leading, core, trailing } = splitOuterWhitespace(raw);
        const key = normalizeText(core);
        if (!key) return;

        // Context override:
        // Underground → Treasures groups "Gem" valueType items, which are actually Arceus Plates.
        // Keep global "Gem" (= 属性宝石) intact, but show "石板" for this specific group title.
        try {
            if (key === 'Gem') {
                const parent = textNode.parentElement;
                if (
                    parent
                    && parent.tagName === 'SPAN'
                    && parent.classList?.contains('font-weight-bold')
                    && parent.closest?.('#treasures')
                    && parent.closest?.('.card-header')
                ) {
                    const out = `${leading}石板${trailing}`;
                    if (out !== raw) textNode.nodeValue = out;
                    return;
                }
            }
        } catch {
            // ignore
        }

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
        const bootstrapToggle = (element.getAttribute('data-bs-toggle') || element.getAttribute('data-toggle') || '').toLowerCase();
        const isBootstrapTooltipOrPopover = bootstrapToggle === 'tooltip' || bootstrapToggle === 'popover';
        for (const attr of attrNames) {
            if (!element.hasAttribute(attr)) continue;
            const raw = element.getAttribute(attr);
            if (raw == null) continue;

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

    const start = async () => {
        if (DEBUG) {
            // eslint-disable-next-line no-console
            console.info('[PokéClicker zh-Hans]', window.PokeClickerZhHans.getConfig());
        }

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
            injectCssOverrides(config.css);
        } else {
            injectCssOverrides(null);
        }

        /** @type {Record<string,string>} */
        let map = {};

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
                const json = await fetchJsonWithFallback(
                    buildUrlCandidates(`${FORCE_LANG}/bundle.json`),
                    { cache: 'no-cache' },
                );
                let count = 0;
                count += ingestEntriesToMap(json?.entries);
                count += ingestEntriesToMap(json?.entriesCaseSensitive);
                if (DEBUG) {
                    // eslint-disable-next-line no-console
                    console.info('[PokéClicker zh-Hans] Loaded bundle:', count, 'entries');
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
                        // eslint-disable-next-line no-console
                        console.info('[PokéClicker zh-Hans] Loaded split translations:', files.length, 'files,', Object.keys(map).length, 'entries');
                    }
                } catch {
                    console.error('[PokéClicker zh-Hans] Failed to load translations index.');
                }
            }
        } catch (e) {
            console.error('[PokéClicker zh-Hans] Failed to load translation resources:', e);
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
        const cache = new LruCache(20000);

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
        window.PokeClickerZhHans.getBundleMeta = () => bundle?._meta ?? null;

        // Patch the Knockout tooltip binding so titles are translated before Bootstrap renders them.
        // This covers dynamic HTML tooltips like DayCycle.tooltip() in `townMap.html`.
        const tryPatchKoTooltipBinding = () => {
            try {
                const ko = window.ko;
                const handler = ko?.bindingHandlers?.tooltip;
                if (!handler || handler.__pkcZhHansTitlePatched) return false;

                const wrapValueAccessor = (valueAccessor) => () => {
                    const local = ko.utils.unwrapObservable(valueAccessor());
                    if (!local || typeof local !== 'object') return local;
                    const out = { ...local };
                    if (typeof out.title === 'string') {
                        const t = translateForNotifierImpl(out.title);
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
                            wrapValueAccessor(valueAccessor),
                            allBindings,
                            viewModel,
                            bindingContext,
                        );
                    };
                }
                if (typeof handler.update === 'function') {
                    const originalUpdate = handler.update;
                    handler.update = function (element, valueAccessor) {
                        return originalUpdate.call(this, element, wrapValueAccessor(valueAccessor));
                    };
                }

                Object.defineProperty(handler, '__pkcZhHansTitlePatched', { value: true });
                return true;
            } catch {
                return false;
            }
        };
        if (!tryPatchKoTooltipBinding()) {
            const interval = setInterval(() => {
                if (tryPatchKoTooltipBinding()) clearInterval(interval);
            }, 200);
            setTimeout(() => clearInterval(interval), 15000);
        }

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
        if (!tryPatchBootstrapTooltip()) {
            const interval = setInterval(() => {
                if (tryPatchBootstrapTooltip()) clearInterval(interval);
            }, 200);
            setTimeout(() => clearInterval(interval), 15000);
        }

        if (DEBUG) {
            // eslint-disable-next-line no-console
            console.info('[PokéClicker zh-Hans] bundle meta:', bundle?._meta ?? null);
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
        if (!tryPatchSpecialEvents()) {
            const interval = setInterval(() => {
                if (tryPatchSpecialEvents()) clearInterval(interval);
            }, 200);
            setTimeout(() => clearInterval(interval), 15000);
        }

        applyMapToRoot(document.documentElement, map, patterns, cache);

        const pendingRoots = new Set();
        const pendingAttrs = new Set();
        const pendingText = new Set();
        let scheduled = false;

        const addRoot = (node) => {
            if (!node) return;
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

            const raf = window.requestAnimationFrame?.bind(window);
            if (raf) raf(flush);
            else setTimeout(flush, 16);
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
