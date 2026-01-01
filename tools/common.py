#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
翻译工具共用函数库
"""

import json
import re
import os
from pathlib import Path
from typing import Dict, List, Set, Tuple, Optional

# 项目根目录
SCRIPT_DIR = Path(__file__).parent
PROJECT_ROOT = SCRIPT_DIR.parent
GAME_SRC_DIR = PROJECT_ROOT.parent / "pokeclicker-develop" / "src"
TRANSLATIONS_FILE = PROJECT_ROOT / "hardcoded" / "zh-Hans.map.json"
REPORTS_DIR = PROJECT_ROOT / "reports"


def load_translations() -> Dict[str, str]:
    """加载翻译映射文件"""
    if not TRANSLATIONS_FILE.exists():
        print(f"警告: 翻译文件不存在: {TRANSLATIONS_FILE}")
        return {}

    with open(TRANSLATIONS_FILE, 'r', encoding='utf-8') as f:
        data = json.load(f)

    return data.get('entries', {})


def save_translations(entries: Dict[str, str], indent: int = 2):
    """保存翻译映射文件"""
    data = {
        "version": 1,
        "generatedAt": "generatedAt",
        "normalize": "collapseWhitespaceAndTrim",
        "entries": entries
    }

    with open(TRANSLATIONS_FILE, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=indent)

    print(f"已保存翻译文件: {TRANSLATIONS_FILE}")


def normalize_text(text: str) -> str:
    """标准化文本（去除多余空格）"""
    text = text.replace('\u00A0', ' ')  # 不换行空格
    text = re.sub(r'\s+', ' ', text)
    return text.strip()


def convert_to_template(text: str) -> str:
    """
    将动态内容转换为模板占位符
    例如: "You captured a Pikachu!" -> "You captured a ${...}!"
    """
    # 替换模板字符串中的变量
    # ${variable} 或 ${expression}
    template = re.sub(r'\$\{[^}]+\}', '${...}', text)

    # 替换常见的动态数字
    # template = re.sub(r'\b\d{1,10}\b', '${...}', template)

    return template


def extract_message_strings(content: str, filename: str) -> List[Tuple[str, int, str]]:
    """
    从源代码中提取消息字符串
    返回: [(text, line_number, type), ...]
    """
    results = []
    lines = content.split('\n')

    # 模式1: message: `...` (模板字符串)
    # 模板字符串中可能包含 ${} 表达式，但不会有转义的反引号
    template_pattern = re.compile(r"message:\s*`([^`]+)`")

    # 模式2: message: '...' (单引号字符串)
    # 使用 (?:[^'\]|\.)* 来正确处理转义字符如 \'
    single_quote_pattern = re.compile(r"message:\s*'((?:[^'\\]|\\.)*)'")

    # 模式3: message: "..." (双引号字符串)
    # 使用 (?:[^"\]|\.)* 来正确处理转义字符如 \"
    double_quote_pattern = re.compile(r'message:\s*"((?:[^"\\]|\\.)*)"')

    for i, line in enumerate(lines, 1):
        # 检查模板字符串
        for match in template_pattern.finditer(line):
            text = match.group(1)
            # 清理模板字符串中的换行
            text = text.replace('\n', '\n')
            results.append((text, i, 'template'))

        # 检查单引号字符串
        for match in single_quote_pattern.finditer(line):
            text = match.group(1)
            results.append((text, i, 'single_quote'))

        # 检查双引号字符串
        for match in double_quote_pattern.finditer(line):
            text = match.group(1)
            results.append((text, i, 'double_quote'))

    return results


def is_translatable(text: str) -> bool:
    """判断文本是否需要翻译"""
    # 跳过空字符串
    if not text or not text.strip():
        return False

    # 跳过纯数字
    if text.strip().isdigit():
        return False

    # 跳过纯符号
    if re.match(r'^[\s\W]+$', text):
        return False

    # 跳过已经是中文的
    if re.search(r'[\u4e00-\u9fff]', text) and not re.search(r'[a-zA-Z]', text):
        return False

    # 跳过变量名/代码模式
    if re.match(r'^[a-z_][a-zA-Z0-9_]*$', text.strip()):
        return False

    # 跳过CSS类名
    if text.startswith('.') or text.startswith('#'):
        return False

    # 跳过URL
    if text.startswith('http://') or text.startswith('https://') or text.startswith('./'):
        return False

    # 跳过文件路径
    if re.match(r'^[\w./\-]+\.(png|jpg|svg|css|js|html|ts)$', text):
        return False

    return True


def find_source_files(src_dir: Path, extensions: List[str] = None) -> List[Path]:
    """查找源代码文件"""
    if extensions is None:
        extensions = ['.ts', '.html']

    files = []
    for ext in extensions:
        files.extend(src_dir.rglob(f'*{ext}'))

    return sorted(files)


def print_stats(stats: dict):
    """打印统计信息"""
    print("\n" + "=" * 50)
    print("翻译统计")
    print("=" * 50)
    for key, value in stats.items():
        print(f"  {key}: {value}")
    print("=" * 50)
