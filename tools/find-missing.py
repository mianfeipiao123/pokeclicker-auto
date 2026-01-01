#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
缺失翻译检测脚本
扫描游戏源代码，找出所有需要翻译但还没有翻译的文本
"""

import json
import re
import sys
from pathlib import Path
from datetime import datetime
from collections import defaultdict

from common import (
    GAME_SRC_DIR, REPORTS_DIR, TRANSLATIONS_FILE,
    load_translations, extract_message_strings, is_translatable,
    find_source_files, convert_to_template, normalize_text, print_stats
)


def extract_all_strings_from_file(filepath: Path) -> list:
    """从单个文件中提取所有字符串"""
    results = []

    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
    except Exception as e:
        print(f"警告: 无法读取文件 {filepath}: {e}")
        return results

    # 提取 message: 字符串
    messages = extract_message_strings(content, str(filepath))
    for text, line, msg_type in messages:
        if is_translatable(text):
            results.append({
                'text': text,
                'template': convert_to_template(text),
                'file': str(filepath.relative_to(GAME_SRC_DIR.parent)),
                'line': line,
                'type': msg_type
            })

    # 额外提取 Notifier.notify 中的 title
    # 单引号版本: title: '...' (处理转义字符)
    title_single_pattern = re.compile(r"title:\s*'((?:[^'\\]|\\.)*)'")
    # 双引号版本: title: "..." (处理转义字符)
    title_double_pattern = re.compile(r'title:\s*"((?:[^"\\]|\\.)*)"')
    lines = content.split('\n')
    for i, line in enumerate(lines, 1):
        for match in title_single_pattern.finditer(line):
            text = match.group(1)
            if is_translatable(text):
                results.append({
                    'text': text,
                    'template': convert_to_template(text),
                    'file': str(filepath.relative_to(GAME_SRC_DIR.parent)),
                    'line': i,
                    'type': 'title'
                })
        for match in title_double_pattern.finditer(line):
            text = match.group(1)
            if is_translatable(text):
                results.append({
                    'text': text,
                    'template': convert_to_template(text),
                    'file': str(filepath.relative_to(GAME_SRC_DIR.parent)),
                    'line': i,
                    'type': 'title'
                })

    return results


def check_translation_exists(text: str, template: str, translations: dict) -> bool:
    """检查翻译是否存在"""
    # 直接匹配
    if text in translations:
        return True

    # 模板匹配
    if template in translations:
        return True

    # 标准化后匹配
    normalized = normalize_text(text)
    if normalized in translations:
        return True

    normalized_template = normalize_text(template)
    if normalized_template in translations:
        return True

    return False


def find_missing_translations():
    """查找缺失的翻译"""
    print("=" * 60)
    print("缺失翻译检测工具")
    print("=" * 60)

    # 检查目录
    if not GAME_SRC_DIR.exists():
        print(f"错误: 游戏源代码目录不存在: {GAME_SRC_DIR}")
        sys.exit(1)

    # 加载现有翻译
    print(f"\n正在加载翻译文件: {TRANSLATIONS_FILE}")
    translations = load_translations()
    print(f"已加载 {len(translations)} 条翻译")

    # 查找源文件
    print(f"\n正在扫描源代码目录: {GAME_SRC_DIR}")
    source_files = find_source_files(GAME_SRC_DIR)
    print(f"找到 {len(source_files)} 个源文件")

    # 提取所有字符串
    all_strings = []
    for filepath in source_files:
        strings = extract_all_strings_from_file(filepath)
        all_strings.extend(strings)

    print(f"\n提取到 {len(all_strings)} 个可翻译字符串")

    # 去重
    seen_templates = set()
    unique_strings = []
    for item in all_strings:
        template = item['template']
        if template not in seen_templates:
            seen_templates.add(template)
            unique_strings.append(item)

    print(f"去重后 {len(unique_strings)} 个唯一字符串")

    # 检查缺失翻译
    missing = []
    translated = []
    for item in unique_strings:
        if check_translation_exists(item['text'], item['template'], translations):
            translated.append(item)
        else:
            missing.append(item)

    # 按类型分组
    missing_by_type = defaultdict(list)
    for item in missing:
        missing_by_type[item['type']].append(item)

    # 生成报告
    report = {
        'generated_at': datetime.now().isoformat(),
        'stats': {
            'total_strings': len(unique_strings),
            'translated': len(translated),
            'missing': len(missing),
            'coverage': f"{len(translated) / len(unique_strings) * 100:.1f}%" if unique_strings else "N/A",
            'existing_translations': len(translations)
        },
        'missing_by_type': {k: len(v) for k, v in missing_by_type.items()},
        'missing': missing
    }

    # 保存报告
    REPORTS_DIR.mkdir(exist_ok=True)
    report_file = REPORTS_DIR / 'missing-translations.json'
    with open(report_file, 'w', encoding='utf-8') as f:
        json.dump(report, f, ensure_ascii=False, indent=2)

    print(f"\n报告已保存到: {report_file}")

    # 打印统计
    print_stats(report['stats'])

    # 打印缺失翻译类型分布
    print("\n缺失翻译类型分布:")
    for msg_type, items in sorted(missing_by_type.items(), key=lambda x: -len(x[1])):
        print(f"  {msg_type}: {len(items)}")

    # 打印部分缺失翻译示例
    print("\n缺失翻译示例 (前20条):")
    print("-" * 60)
    for i, item in enumerate(missing[:20], 1):
        print(f"{i}. {item['template']}")
        print(f"   文件: {item['file']}:{item['line']}")
        print()

    # 生成简单的待翻译列表
    templates_file = REPORTS_DIR / 'missing-templates.txt'
    with open(templates_file, 'w', encoding='utf-8') as f:
        for item in missing:
            f.write(f"{item['template']}\n")

    print(f"\n待翻译模板列表已保存到: {templates_file}")

    return report


if __name__ == '__main__':
    find_missing_translations()
