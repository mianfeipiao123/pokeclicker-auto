import fs from 'node:fs/promises';
import path from 'node:path';

const INPUT_ROOT = path.resolve('加工');
const OUTPUT_ROOT = path.resolve('翻译');
const CACHE_DIR = path.join(OUTPUT_ROOT, '.cache');
const CACHE_PATH = path.join(CACHE_DIR, 'gtx.en-zh-CN.json');

const LANG_EN = 'en';
const LANG_ZH = 'zh-Hans';
const TARGET_TL = 'zh-CN';
const NAMESPACES = /** @type {const} */ (['pokemon', 'logbook', 'settings', 'questlines']);
const CONCURRENCY = 16;
const SAVE_CACHE_EVERY = 1000;

const containsAsciiLetter = (text) => /[A-Za-z]/.test(text);

const postProcessZh = (text) => {
    if (typeof text !== 'string' || !text) {
        return text;
    }
    let out = text;
    // Align with existing zh-Hans wording in this project
    out = out.replaceAll('神奇宝贝', '宝可梦');
    out = out.replaceAll('Pokérus', '宝可病毒').replaceAll('Pokerus', '宝可病毒');
    out = out.replace(/\bPokémon\b/g, '宝可梦').replace(/\bPokemon\b/g, '宝可梦');
    out = out.replace(/\bEVs\b/g, '努力值').replace(/\bEV\b/g, '努力值');
    out = out.replace(/\bBerry Masters\b/g, '树果大师');
    return out;
};

const OVERRIDES = new Map([
    ['M', '男'],
    ['F', '女'],
    ['OK', '确定'],
    ['FAQ', '常见问题'],
    ['NEW', '新'],
    ['NPC', 'NPC'],
    ['AZ', 'AZ'],
    // Keep single-letter grades/labels as-is (Google 会把 A 翻成“一个”)
    ['A', 'A'],
    ['B', 'B'],
    ['C', 'C'],
    ['D', 'D'],
    ['E', 'E'],
    ['H', 'H'],
    ['I', 'I'],
    ['K', 'K'],
    ['L', 'L'],
    ['O', 'O'],
    ['P', 'P'],
    ['Q', 'Q'],
    ['R', 'R'],
    ['S', 'S'],
    ['T', 'T'],
    ['U', 'U'],
    ['W', 'W'],
    ['X', 'X'],
    ['Y', 'Y'],
]);

const ensureDir = async (dirPath) => {
    await fs.mkdir(dirPath, { recursive: true });
};

const readJson = async (filePath) => {
    const raw = await fs.readFile(filePath, 'utf8');
    return JSON.parse(raw);
};

const writeJson = async (filePath, data) => {
    await ensureDir(path.dirname(filePath));
    await fs.writeFile(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const normalizeText = (text) =>
    String(text ?? '')
        .replaceAll('\u00A0', ' ')
        .replace(/\s+/g, ' ')
        .trim();

const translateViaGoogle = async (text) => {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=${TARGET_TL}&dt=t&q=${encodeURIComponent(text)}`;
    const res = await fetch(url);
    if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new Error(`translate failed: ${res.status} ${res.statusText} body=${body.slice(0, 200)}`);
    }
    const body = await res.text();
    const data = JSON.parse(body);
    const segments = Array.isArray(data?.[0]) ? data[0] : [];
    return segments.map((s) => s?.[0] ?? '').join('');
};

const translateWithRetry = async (text, attempt = 1) => {
    try {
        return await translateViaGoogle(text);
    } catch (err) {
        if (attempt >= 6) {
            throw err;
        }
        const backoff = Math.min(15_000, 400 * (2 ** (attempt - 1))) + Math.floor(Math.random() * 250);
        await sleep(backoff);
        return translateWithRetry(text, attempt + 1);
    }
};

const translatePreserveWhitespace = async (text, cache) => {
    if (text == null) {
        return text;
    }
    if (typeof text !== 'string') {
        return text;
    }

    // Preserve newlines exactly: translate line-by-line
    if (text.includes('\n')) {
        const lines = text.split('\n');
        const out = [];
        for (const line of lines) {
            out.push(await translatePreserveWhitespace(line, cache));
        }
        return out.join('\n');
    }

    const leading = (text.match(/^\s+/) ?? [''])[0];
    const trailing = (text.match(/\s+$/) ?? [''])[0];
    const core = text.slice(leading.length, text.length - trailing.length);

    if (!core) {
        return text;
    }
    if (!containsAsciiLetter(core)) {
        return text;
    }

    const override = OVERRIDES.get(core);
    if (override != null) {
        return `${leading}${postProcessZh(override)}${trailing}`;
    }

    const cacheKey = core;
    const cached = cache.get(cacheKey);
    if (cached != null) {
        const processed = postProcessZh(cached);
        if (processed !== cached) {
            cache.set(cacheKey, processed);
        }
        return `${leading}${processed}${trailing}`;
    }

    // Avoid very long single requests; split at sentence-ish boundaries if needed
    if (core.length > 4500) {
        const parts = core.split(/(?<=[.!?。！？])\s+/);
        const translatedParts = [];
        for (const p of parts) {
            const tp = await translatePreserveWhitespace(p, cache);
            translatedParts.push(tp.trim());
        }
        const joined = postProcessZh(translatedParts.join(' '));
        cache.set(cacheKey, joined);
        return `${leading}${joined}${trailing}`;
    }

    const translated = await translateWithRetry(core);
    const cleaned = postProcessZh(String(translated ?? '').trim());
    cache.set(cacheKey, cleaned);
    return `${leading}${cleaned}${trailing}`;
};

const loadCache = async () => {
    await ensureDir(CACHE_DIR);
    try {
        const raw = await fs.readFile(CACHE_PATH, 'utf8');
        const obj = JSON.parse(raw);
        return new Map(Object.entries(obj));
    } catch {
        return new Map();
    }
};

const saveCache = async (cache) => {
    const obj = Object.create(null);
    const entries = Array.from(cache.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    for (const [k, v] of entries) {
        obj[k] = v;
    }
    await ensureDir(path.dirname(CACHE_PATH));
    await fs.writeFile(CACHE_PATH, JSON.stringify(obj, null, 2) + '\n', 'utf8');
};

const isPlainObject = (v) => v != null && typeof v === 'object' && !Array.isArray(v);

const collectCoresFromText = (text, outSet) => {
    if (typeof text !== 'string') {
        return;
    }
    if (!containsAsciiLetter(text)) {
        return;
    }
    if (text.includes('\n')) {
        text.split('\n').forEach((line) => collectCoresFromText(line, outSet));
        return;
    }
    const leading = (text.match(/^\s+/) ?? [''])[0];
    const trailing = (text.match(/\s+$/) ?? [''])[0];
    const core = text.slice(leading.length, text.length - trailing.length);
    if (!core) {
        return;
    }
    if (!containsAsciiLetter(core)) {
        return;
    }
    if (OVERRIDES.has(core)) {
        return;
    }
    outSet.add(core);
};

const collectI18nCores = (enNode, zhTemplateNode, outSet) => {
    if (typeof enNode === 'string') {
        if (typeof zhTemplateNode === 'string' && zhTemplateNode !== '') {
            return;
        }
        collectCoresFromText(enNode, outSet);
        return;
    }
    if (Array.isArray(enNode)) {
        const zhArr = Array.isArray(zhTemplateNode) ? zhTemplateNode : [];
        for (let i = 0; i < enNode.length; i += 1) {
            collectI18nCores(enNode[i], zhArr[i], outSet);
        }
        return;
    }
    if (isPlainObject(enNode)) {
        const zhObj = isPlainObject(zhTemplateNode) ? zhTemplateNode : {};
        for (const [k, v] of Object.entries(enNode)) {
            collectI18nCores(v, zhObj[k], outSet);
        }
    }
};

const fillCacheForCores = async (cache, cores) => {
    const all = Array.from(cores);
    const missing = all.filter((c) => !cache.has(c) && !OVERRIDES.has(c));
    if (!missing.length) {
        return;
    }

    let index = 0;
    let done = 0;
    let failed = 0;

    const total = missing.length;
    // eslint-disable-next-line no-console
    console.log(`[translate] need ${total} strings (concurrency=${CONCURRENCY})`);

    const workers = Array.from({ length: CONCURRENCY }, async () => {
        while (true) {
            const core = missing[index];
            index += 1;
            if (!core) {
                return;
            }
            try {
                const translated = await translateWithRetry(core);
                cache.set(core, postProcessZh(String(translated ?? '').trim()));
            } catch (err) {
                failed += 1;
                // Keep original so generation can proceed; rerun later to retry.
                cache.set(core, core);
            }

            done += 1;
            if (done % 200 === 0 || done === total) {
                // eslint-disable-next-line no-console
                console.log(`[translate] ${done}/${total} (${Math.round((done / total) * 100)}%)`);
            }
            if (done % SAVE_CACHE_EVERY === 0) {
                await saveCache(cache);
            }
        }
    });

    await Promise.all(workers);
    await saveCache(cache);

    if (failed) {
        // eslint-disable-next-line no-console
        console.warn(`[translate] failed ${failed}/${total} (kept English for those keys)`);
    }
};

const translateI18nTree = async (enNode, zhTemplateNode, cache) => {
    if (typeof enNode === 'string') {
        if (typeof zhTemplateNode === 'string' && zhTemplateNode !== '') {
            return zhTemplateNode;
        }
        return translatePreserveWhitespace(enNode, cache);
    }
    if (typeof enNode === 'number' || typeof enNode === 'boolean') {
        return (zhTemplateNode == null) ? enNode : zhTemplateNode;
    }
    if (Array.isArray(enNode)) {
        const zhArr = Array.isArray(zhTemplateNode) ? zhTemplateNode : [];
        const out = [];
        for (let i = 0; i < enNode.length; i += 1) {
            out.push(await translateI18nTree(enNode[i], zhArr[i], cache));
        }
        return out;
    }
    if (isPlainObject(enNode)) {
        const zhObj = isPlainObject(zhTemplateNode) ? zhTemplateNode : {};
        const out = Object.create(null);
        for (const [k, v] of Object.entries(enNode)) {
            out[k] = await translateI18nTree(v, zhObj[k], cache);
        }
        return out;
    }
    return enNode;
};

const loadI18nInputs = async () => {
    const inputs = [];
    for (const ns of NAMESPACES) {
        const enPath = path.join(INPUT_ROOT, 'locales', LANG_EN, `${ns}.json`);
        const zhTemplatePath = path.join(INPUT_ROOT, 'locales', LANG_ZH, `${ns}.json`);
        const [en, zhTemplate] = await Promise.all([readJson(enPath), readJson(zhTemplatePath)]);
        inputs.push({ ns, en, zhTemplate });
    }
    return inputs;
};

const writeI18nOutputs = async (i18nInputs, cache) => {
    for (const { ns, en, zhTemplate } of i18nInputs) {
        const zhFull = await translateI18nTree(en, zhTemplate, cache);
        await writeJson(path.join(OUTPUT_ROOT, 'locales', LANG_EN, `${ns}.json`), en);
        await writeJson(path.join(OUTPUT_ROOT, 'locales', LANG_ZH, `${ns}.json`), zhFull);
    }
};

const loadHardcodedInput = async () => {
    const dictPath = path.join(INPUT_ROOT, 'hardcoded', `${LANG_ZH}.dict.json`);
    return readJson(dictPath);
};

const collectHardcodedCores = (dict, outSet) => {
    const items = dict.items ?? [];
    for (const item of items) {
        const en = item.normEn ?? normalizeText(item.en);
        const zh = item.zh ?? '';
        if (zh) {
            continue;
        }
        if (!containsAsciiLetter(en)) {
            continue;
        }
        if (OVERRIDES.has(en)) {
            continue;
        }
        outSet.add(en);
    }
};

const generateHardcoded = async (dict, cache) => {
    const items = dict.items ?? [];

    const outItems = [];
    /** @type {Record<string,string>} */
    const map = Object.create(null);

    for (const item of items) {
        const en = item.normEn ?? normalizeText(item.en);
        let zh = item.zh ?? '';
        if (!zh) {
            zh = await translatePreserveWhitespace(en, cache);
        }
        const out = { ...item, zh };
        outItems.push(out);
        map[en] = zh;
    }

    await writeJson(path.join(OUTPUT_ROOT, 'hardcoded', `${LANG_ZH}.dict.json`), {
        ...dict,
        generatedAt: new Date().toISOString(),
        total: outItems.length,
        items: outItems,
    });

    await writeJson(path.join(OUTPUT_ROOT, 'hardcoded', `${LANG_ZH}.map.json`), {
        version: 1,
        generatedAt: new Date().toISOString(),
        normalize: 'collapseWhitespaceAndTrim',
        entries: map,
    });
};

const writeStatus = async (cache) => {
    const dictPath = path.join(OUTPUT_ROOT, 'hardcoded', `${LANG_ZH}.dict.json`);
    const i18nStatusPath = path.join('加工', 'i18n_status.json');
    const [dict, i18nStatus] = await Promise.all([
        readJson(dictPath),
        readJson(i18nStatusPath).catch(() => null),
    ]);

    await writeJson(path.join(OUTPUT_ROOT, 'status.json'), {
        generatedAt: new Date().toISOString(),
        i18n: i18nStatus,
        hardcoded: { total: dict.total ?? (dict.items?.length ?? 0) },
        cacheSize: cache.size,
    });
};

const main = async () => {
    await ensureDir(OUTPUT_ROOT);

    const cache = await loadCache();

    const coresToTranslate = new Set();

    const i18nInputs = await loadI18nInputs();
    i18nInputs.forEach(({ en, zhTemplate }) => collectI18nCores(en, zhTemplate, coresToTranslate));

    const hardcodedInput = await loadHardcodedInput();
    collectHardcodedCores(hardcodedInput, coresToTranslate);

    await fillCacheForCores(cache, coresToTranslate);

    await writeI18nOutputs(i18nInputs, cache);
    await generateHardcoded(hardcodedInput, cache);
    await saveCache(cache);

    await writeStatus(cache);
};

main().catch((err) => {
    console.error(err);
    process.exitCode = 1;
});
