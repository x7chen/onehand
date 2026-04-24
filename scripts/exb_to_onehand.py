#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
印象笔记 EXB 数据库解析工具
直接从印象笔记的 SQLite 数据库 (.exb) 中提取笔记内容

使用方法:
    python exb_to_onehand.py <input.exb> [output_dir] [options]

参数:
    input.exb     - 印象笔记数据库文件路径
    output_dir    - 输出目录，默认为当前目录下的 onehand_notebooks

选项:
    -i, --images      提取图片和附件
    -d, --by-date     按日期（年月）分组到不同笔记本
    --list-tables     列出数据库中的所有表（用于调试）

示例:
    python exb_to_onehand.py blocks/x8chen#app.yinxiang.com.exb
    python exb_to_onehand.py blocks/x8chen#app.yinxiang.com.exb ./output -i
    python exb_to_onehand.py blocks/x8chen#app.yinxiang.com.exb --list-tables
"""

import sqlite3
import json
import os
import sys
import re
import base64
import hashlib
import uuid
import argparse
import zlib
from datetime import datetime, timedelta
from html.parser import HTMLParser
from typing import List, Dict, Optional, Tuple
from pathlib import Path
from collections import defaultdict


class HTMLToMarkdown(HTMLParser):
    """将 HTML 转换为 Markdown 格式"""

    def __init__(self):
        super().__init__()
        self.result = []
        self.list_stack = []
        self.ignore_tags = {'style', 'script', 'head'}
        self.current_ignore = False
        self.in_codeblock = False
        self.codeblock_lines = []
        self.in_list_item = False
        self.list_item_content = []

    def handle_starttag(self, tag: str, attrs: List[Tuple[str, str]]):
        if tag in self.ignore_tags:
            self.current_ignore = True
            return

        attrs_dict = dict(attrs)

        if tag == 'div':
            style = attrs_dict.get('style', '')
            if '-en-codeblock' in style and 'true' in style:
                self.in_codeblock = True
                self.codeblock_lines = []
                return

        if self.in_codeblock:
            return

        if tag == 'h1':
            self.result.append('\n# ')
        elif tag == 'h2':
            self.result.append('\n## ')
        elif tag == 'h3':
            self.result.append('\n### ')
        elif tag == 'h4':
            self.result.append('\n#### ')
        elif tag == 'h5':
            self.result.append('\n##### ')
        elif tag == 'h6':
            self.result.append('\n###### ')
        elif tag == 'p':
            self.result.append('\n\n')
        elif tag == 'br':
            if self.in_list_item:
                self.list_item_content.append('\n')
            else:
                self.result.append('\n')
        elif tag == 'hr':
            self.result.append('\n---\n')
        elif tag == 'strong' or tag == 'b':
            if self.in_list_item:
                self.list_item_content.append('**')
            else:
                self.result.append('**')
        elif tag == 'em' or tag == 'i':
            if self.in_list_item:
                self.list_item_content.append('*')
            else:
                self.result.append('*')
        elif tag == 'code':
            if self.in_list_item:
                self.list_item_content.append('`')
            else:
                self.result.append('`')
        elif tag == 'pre':
            self.result.append('\n```\n')
        elif tag == 'blockquote':
            self.result.append('\n> ')
        elif tag == 'a':
            href = attrs_dict.get('href', '')
            if self.in_list_item:
                self.list_item_content.append('[')
                self.list_item_href = href
            else:
                self.result.append('[')
                self.link_href = href
        elif tag == 'img':
            src = attrs_dict.get('src', '')
            alt = attrs_dict.get('alt', '')
            self.result.append(f'![{alt}]({src})')
        elif tag == 'ul':
            self.list_stack.append('ul')
            self.result.append('\n')
        elif tag == 'ol':
            self.list_stack.append(('ol', 1))
            self.result.append('\n')
        elif tag == 'li':
            self.in_list_item = True
            self.list_item_content = []
            indent = '  ' * (len(self.list_stack) - 1)
            if self.list_stack:
                last = self.list_stack[-1]
                if last == 'ul':
                    self.list_item_content.append(f'{indent}- ')
                elif isinstance(last, tuple) and last[0] == 'ol':
                    num = last[1]
                    self.list_item_content.append(f'{indent}{num}. ')
                    self.list_stack[-1] = ('ol', num + 1)
        elif tag == 'span':
            pass
        elif tag == 'en-todo':
            checked = attrs_dict.get('checked', 'false')
            if checked == 'true':
                self.result.append('- [x] ')
            else:
                self.result.append('- [ ] ')
        elif tag == 'en-media':
            pass

    def handle_endtag(self, tag: str):
        if tag in self.ignore_tags:
            self.current_ignore = False
            return

        if tag == 'div' and self.in_codeblock:
            self.in_codeblock = False
            self.result.append('\n```\n')
            for line in self.codeblock_lines:
                self.result.append(line)
            self.result.append('\n```\n')
            self.codeblock_lines = []
            return

        if tag == 'div' and not self.in_list_item:
            self.result.append('  \n')

        if self.in_codeblock:
            return

        if tag in ('h1', 'h2', 'h3', 'h4', 'h5', 'h6'):
            self.result.append('\n')
        elif tag == 'strong' or tag == 'b':
            if self.in_list_item:
                self.list_item_content.append('**')
            else:
                self.result.append('**')
        elif tag == 'em' or tag == 'i':
            if self.in_list_item:
                self.list_item_content.append('*')
            else:
                self.result.append('*')
        elif tag == 'code':
            if self.in_list_item:
                self.list_item_content.append('`')
            else:
                self.result.append('`')
        elif tag == 'pre':
            self.result.append('\n```\n')
        elif tag == 'a':
            if self.in_list_item:
                href = getattr(self, 'list_item_href', '')
                self.list_item_content.append(f']({href})')
                self.list_item_href = ''
            else:
                href = getattr(self, 'link_href', '')
                self.result.append(f']({href})')
                self.link_href = ''
        elif tag in ('ul', 'ol'):
            if self.list_stack:
                self.list_stack.pop()
            self.result.append('\n')
        elif tag == 'li':
            self.in_list_item = False
            content = ''.join(self.list_item_content).strip()
            self.result.append(content)
            self.result.append('  \n')
            self.list_item_content = []

    def handle_data(self, data: str):
        if self.current_ignore:
            return

        if self.in_codeblock:
            self.codeblock_lines.append(data)
            return

        if self.in_list_item:
            self.list_item_content.append(data)
        else:
            self.result.append(data)

    def get_markdown(self) -> str:
        result = ''.join(self.result)
        result = re.sub(r'\n{3,}', '\n\n', result)
        return result.strip()


def html_to_markdown(html_content: str) -> str:
    """将 HTML 内容转换为 Markdown"""
    if not html_content:
        return ''
    parser = HTMLToMarkdown()
    try:
        parser.feed(html_content)
        return parser.get_markdown()
    except Exception as e:
        print(f"HTML 解析错误: {e}")
        return html_content


def parse_evernote_timestamp(ts: float) -> int:
    """
    解析印象笔记时间戳
    印象笔记使用从 0001-01-01 开始的天数（带小数部分表示时间）
    转换为毫秒级 Unix 时间戳
    """
    if not ts:
        return int(datetime.now().timestamp() * 1000)

    try:
        # 印象笔记时间戳是从 0001-01-01 开始的天数
        base_date = datetime(1, 1, 1)
        actual_date = base_date + timedelta(days=ts)

        # 转换为毫秒级 Unix 时间戳
        timestamp_ms = int(actual_date.timestamp() * 1000)
        return timestamp_ms
    except (OverflowError, OSError, ValueError):
        # 如果时间戳无效，返回当前时间
        return int(datetime.now().timestamp() * 1000)


def generate_id() -> str:
    """生成唯一ID（UUID格式）"""
    return str(uuid.uuid4())


def binary_guid_to_uuid(binary_guid: bytes) -> str:
    """
    将印象笔记的二进制 GUID 转换为标准 UUID 字符串格式
    印象笔记使用混合字节序存储 GUID:
    - 前 4 字节 (UInt32): 小端序
    - 接下来 2 字节 (UInt16): 小端序
    - 再接下来 2 字节 (UInt16): 小端序
    - 后 8 字节: 大端序
    """
    if not binary_guid or len(binary_guid) != 16:
        return str(uuid.uuid4())

    # 解析各部分（按印象笔记的字节序）
    # 前 4 字节：小端序转大端序
    part1 = binary_guid[0:4][::-1].hex()  # 反转字节
    # 接下来 2 字节：小端序转大端序
    part2 = binary_guid[4:6][::-1].hex()
    # 再接下来 2 字节：小端序转大端序
    part3 = binary_guid[6:8][::-1].hex()
    # 后 8 字节：大端序（不变）
    part4 = binary_guid[8:10].hex()
    part5 = binary_guid[10:16].hex()

    # 格式化为标准 UUID: 8-4-4-4-12
    return f"{part1}-{part2}-{part3}-{part4}-{part5}"


def decompress_content(data: bytes) -> str:
    """
    解压缩印象笔记内容
    印象笔记使用 zlib 压缩存储内容
    """
    if not data:
        return ''
    try:
        # 尝试解压缩
        decompressed = zlib.decompress(data)
        return decompressed.decode('utf-8', errors='ignore')
    except:
        # 如果解压缩失败，可能是未压缩的文本
        try:
            return data.decode('utf-8', errors='ignore')
        except:
            return ''


def extract_note_content(content_xml: str) -> str:
    """
    从印象笔记 XML 内容中提取纯文本/Markdown
    """
    if not content_xml:
        return ''

    # 移除 CDATA 标记
    content = re.sub(r'<!\[CDATA\[|\]\]>', '', content_xml)

    # 移除 en-note 标签，保留内容
    content = re.sub(r'<en-note[^>]*>|</en-note>', '', content)

    # 处理 en-todo 标签
    content = re.sub(r'<en-todo\s+checked="true"\s*/>', '- [x] ', content)
    content = re.sub(r'<en-todo\s+checked="false"\s*/>', '- [ ] ', content)
    content = re.sub(r'<en-todo\s*/>', '- [ ] ', content)

    # 转换 HTML 为 Markdown
    markdown = html_to_markdown(content)

    # 移除空字符和零宽字符
    markdown = markdown.replace('\x00', '')  # \u0000
    markdown = markdown.replace('\ufeff', '')  # 零宽无连字符
    markdown = markdown.replace('\u200b', '')  # 零宽空格

    return markdown


def get_db_schema(conn: sqlite3.Connection) -> Dict[str, List[str]]:
    """获取数据库表结构"""
    cursor = conn.cursor()
    tables = {}

    # 使用简单的查询避免 FTS 分词器问题
    cursor.execute("SELECT name, sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
    for row in cursor.fetchall():
        table_name = row[0]
        sql = row[1] or ''

        # 从 CREATE TABLE 语句中解析字段名
        columns = []
        if sql:
            # 提取括号内的字段定义
            match = re.search(r'\((.*)\)', sql, re.DOTALL)
            if match:
                fields_str = match.group(1)
                # 解析每个字段定义
                for line in fields_str.split(','):
                    line = line.strip()
                    # 匹配字段名（第一个单词）
                    col_match = re.match(r'(\w+)', line)
                    if col_match:
                        col_name = col_match.group(1)
                        # 排除关键字
                        if col_name.upper() not in ('PRIMARY', 'FOREIGN', 'UNIQUE', 'CHECK', 'CONSTRAINT'):
                            columns.append(col_name)

        tables[table_name] = columns

    return tables


def list_tables(conn: sqlite3.Connection):
    """列出数据库中的所有表"""
    print("\n数据库表结构:")
    print("=" * 60)

    cursor = conn.cursor()
    cursor.execute("SELECT name, sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name")

    for row in cursor.fetchall():
        table_name, sql = row
        print(f"\n表: {table_name}")

        # 尝试解析字段
        if sql:
            # 提取括号内的内容
            match = re.search(r'\((.*)\)', sql, re.DOTALL)
            if match:
                fields_str = match.group(1)
                print("  字段:")
                for line in fields_str.split(','):
                    line = line.strip()
                    if line and not line.upper().startswith(('PRIMARY', 'FOREIGN', 'UNIQUE', 'CHECK', 'CONSTRAINT')):
                        col_match = re.match(r'(\w+)\s+(\w+)', line)
                        if col_match:
                            print(f"    - {col_match.group(1)} ({col_match.group(2)})")

    print("\n" + "=" * 60)


def extract_notes_from_exb(exb_path: str) -> List[Dict]:
    """
    从 EXB 数据库中提取笔记
    """
    # 注册自定义 collation 处理印象笔记的 NOCASEUTF8
    def nocaseutf8_collation(x, y):
        x = (x or '').lower()
        y = (y or '').lower()
        if x < y:
            return -1
        elif x > y:
            return 1
        return 0

    conn = sqlite3.connect(exb_path)
    conn.create_collation('NOCASEUTF8', nocaseutf8_collation)
    cursor = conn.cursor()

    notes = []

    try:
        # 根据实际数据库结构调整查询
        # - note_attr: 笔记属性（uid, title, date_created, date_updated, notebook_uid, tags等）
        # - items: 笔记GUID和类型信息
        # - 笔记内容需要从 attrs 表或单独获取

        # 检查必要表是否存在
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='note_attr'")
        if not cursor.fetchone():
            print("错误: 无法找到 note_attr 表，数据库结构可能不兼容")
            return []

        # 查询笔记基本信息 - 匹配实际表结构
        # is_deleted IS NULL 表示未删除，is_deleted=1 表示已删除
        # JOIN items 表获取 GUID
        query = """
            SELECT
                na.uid,
                na.title,
                na.author,
                na.notebook,
                na.notebook_uid,
                na.tags,
                na.date_created,
                na.date_updated,
                na.source_url,
                na.is_deleted,
                i.guid
            FROM note_attr na
            JOIN items i ON i.uid = na.uid AND i.type = 1
            WHERE na.is_deleted IS NULL OR na.is_deleted = 0
            ORDER BY na.date_created DESC
        """

        cursor.execute(query)
        rows = cursor.fetchall()

        print(f"找到 {len(rows)} 条笔记")

        for row in rows:
            (uid, title, author, notebook_name, notebook_uid,
             tags_str, date_created, date_updated, source_url, is_deleted, guid) = row

            # 将二进制 GUID 转换为标准 UUID 格式
            note_guid = binary_guid_to_uuid(guid) if guid else str(uuid.uuid4())

            note_data = {
                'note_id': uid,
                'guid': note_guid,  # 原始 GUID
                'title': title or '无标题',
                'created': parse_evernote_timestamp(date_created),
                'updated': parse_evernote_timestamp(date_updated),
                'notebook_uid': notebook_uid,
                'notebook_name': notebook_name or '默认笔记本',
                'source_url': source_url,
                'content': '',
                'tags': [],
                'resources': []
            }

            # 解析标签（逗号分隔）
            if tags_str:
                tags = [tag.strip() for tag in tags_str.split(',') if tag.strip()]
                note_data['tags'] = tags

            # 获取笔记内容 - 从 attrs 表获取
            # attrs 表中 afl=65538 存储笔记内容，uid 字段对应 note_attr.uid
            try:
                cursor.execute(
                    "SELECT data FROM attrs WHERE uid = ? AND afl = 65538",
                    (uid,)
                )
                attrs_row = cursor.fetchone()

                if attrs_row and attrs_row[0]:
                    content_data = attrs_row[0]
                    # 内容直接是 XML 文本，不是压缩的
                    try:
                        content_xml = content_data.decode('utf-8', errors='ignore')
                        note_data['content'] = extract_note_content(content_xml)
                        note_data['raw_content'] = content_xml
                    except:
                        # 如果解码失败，尝试解压缩
                        content_xml = decompress_content(content_data)
                        note_data['content'] = extract_note_content(content_xml)
                        note_data['raw_content'] = content_xml

            except Exception as e:
                # 内容获取失败不影响基本笔记信息
                pass

            notes.append(note_data)

    except Exception as e:
        print(f"读取数据库错误: {e}")
        import traceback
        traceback.print_exc()

    finally:
        conn.close()

    return notes


def extract_resources_from_exb(exb_path: str) -> Dict[str, List[Dict]]:
    """
    从 EXB 数据库中提取资源（图片、附件）
    返回: {note_id: [resource_list]}
    """
    conn = sqlite3.connect(exb_path)
    cursor = conn.cursor()
    resources_by_note = defaultdict(list)

    try:
        # 检查资源表
        cursor.execute("""
            SELECT name FROM sqlite_master
            WHERE type='table' AND name IN ('resource_attr', 'resources')
        """)
        tables = [row[0] for row in cursor.fetchall()]

        if 'resource_attr' not in tables:
            return resources_by_note

        # 查询资源信息 - 根据实际表结构调整
        # resource_attr: uid, note, mime, width, height, hash, file_name等
        query = """
            SELECT
                ra.uid,
                ra.note,
                ra.mime,
                ra.width,
                ra.height,
                ra.hash,
                ra.file_name,
                ra.is_attachment
            FROM resource_attr ra
        """

        cursor.execute(query)
        rows = cursor.fetchall()

        for row in rows:
            (resource_uid, note_uid, mime, width, height,
             hash_val, file_name, is_attachment) = row

            resource_data = {
                'resource_id': resource_uid,
                'mime': mime,
                'width': width,
                'height': height,
                'hash': hash_val,
                'filename': file_name,
                'is_attachment': is_attachment
            }

            # 获取资源数据
            if 'resources' in tables:
                try:
                    cursor.execute(
                        "SELECT data FROM resources WHERE uid = ?",
                        (resource_uid,)
                    )
                    res_row = cursor.fetchone()
                    if res_row and res_row[0]:
                        resource_data['data'] = res_row[0]
                except:
                    pass

            resources_by_note[note_uid].append(resource_data)

    except Exception as e:
        print(f"读取资源错误: {e}")

    finally:
        conn.close()

    return resources_by_note


TAG_COLORS = [
    '#66bb6a', '#4299e1', '#ed8936', '#e53e3e',
    '#9f7aea', '#ed64a6', '#38b2ac', '#ecc94b',
]


def get_next_tag_color(used_colors: set) -> str:
    """获取下一个可用的标签颜色"""
    for color in TAG_COLORS:
        if color not in used_colors:
            return color
    return TAG_COLORS[0]


def collect_all_tags(notes: List[Dict]) -> Dict[str, Dict]:
    """从所有笔记中收集标签"""
    all_tags = {}
    used_colors = set()

    for note in notes:
        for tag in note.get('tags', []):
            if tag and tag not in all_tags:
                color = get_next_tag_color(used_colors)
                used_colors.add(color)
                all_tags[tag] = {
                    'id': f'tag-{hashlib.md5(tag.encode()).hexdigest()[:12]}',
                    'name': tag,
                    'color': color,
                    'createdAt': int(datetime.now().timestamp() * 1000),
                    'updatedAt': int(datetime.now().timestamp() * 1000)
                }

    return all_tags


def create_node_from_note(note: Dict) -> Dict:
    """从笔记创建节点（V2格式），使用原始 GUID 作为 id"""
    # 使用印象笔记的原始 GUID 作为节点 ID
    node_id = note.get('guid') or generate_id()

    return {
        'id': node_id,
        'type': 'text-note',
        'title': note['title'][:100] if len(note['title']) > 100 else note['title'],
        'transcript': note['content'],
        'transcriptStatus': 'done',
        'agentResult': None,
        'agentStatus': 'pending',
        'isFavorite': False,
        'createdAt': note['created'],
        'tags': note.get('tags', [])
    }


def create_onehand_notebook_v2(
    notes: List[Dict],
    notebook_name: str,
    notebook_id: str = None
) -> Dict:
    """创建 OneHand 笔记本格式 (V2)"""
    now = int(datetime.now().timestamp() * 1000)
    if notebook_id is None:
        notebook_id = str(now)

    # 创建节点
    nodes = []
    for note in notes:
        node = create_node_from_note(note)
        nodes.append(node)

    # 按创建时间排序
    nodes.sort(key=lambda n: n['createdAt'])

    return {
        'id': notebook_id,
        'name': notebook_name,
        'createdAt': now,
        'updatedAt': now,
        'nodes': nodes
    }


def convert_exb_to_onehand(
    exb_path: str,
    output_dir: str,
    by_date: bool = False,
    by_notebook: bool = True  # 新增参数：按笔记本分组
) -> List[str]:
    """
    将 EXB 文件转换为 OneHand 格式
    默认按笔记本分组导出
    """
    print(f"正在解析数据库: {exb_path}")

    # 提取笔记
    notes = extract_notes_from_exb(exb_path)

    if not notes:
        print("没有找到任何笔记")
        return []

    # 提取资源信息
    print("正在提取资源信息...")
    resources = extract_resources_from_exb(exb_path)

    # 将资源关联到笔记
    for note in notes:
        note['resources'] = resources.get(note['note_id'], [])

    print(f"总共找到 {len(notes)} 条笔记")

    # 收集标签
    tags_dict = collect_all_tags(notes)
    tag_count = len(tags_dict)
    if tag_count > 0:
        print(f"发现 {tag_count} 个标签")

    # 确保输出目录存在
    os.makedirs(output_dir, exist_ok=True)

    output_paths = []

    if by_date:
        # 按日期分组
        notes_by_month = defaultdict(list)
        for note in notes:
            dt = datetime.fromtimestamp(note['created'] / 1000)
            month_key = dt.strftime('%Y-%m')
            notes_by_month[month_key].append(note)

        # 为每个月份创建笔记本
        for month_key in sorted(notes_by_month.keys()):
            month_notes = notes_by_month[month_key]
            notebook_id = f"{month_key.replace('-', '')}-{int(datetime.now().timestamp() * 1000)}"
            notebook = create_onehand_notebook_v2(
                month_notes,
                f"笔记 {month_key}",
                notebook_id
            )

            output_path = os.path.join(output_dir, f"{notebook_id}.json")
            with open(output_path, 'w', encoding='utf-8') as f:
                json.dump(notebook, f, ensure_ascii=False, indent=2)
            output_paths.append(output_path)
            print(f"已创建笔记本: {output_path} ({len(month_notes)} 条笔记)")

    elif by_notebook:
        # 按笔记本分组导出（默认行为）
        notes_by_notebook = defaultdict(list)
        for note in notes:
            notebook_name = note.get('notebook_name') or '默认笔记本'
            notes_by_notebook[notebook_name].append(note)

        print(f"发现 {len(notes_by_notebook)} 个笔记本")

        # 为每个笔记本创建单独的 JSON 文件
        for notebook_name in sorted(notes_by_notebook.keys()):
            notebook_notes = notes_by_notebook[notebook_name]

            # 清理文件名中的非法字符
            safe_name = re.sub(r'[<>:"/\\|?*]', '_', notebook_name)
            notebook_id = f"{safe_name}-{int(datetime.now().timestamp() * 1000)}"

            notebook = create_onehand_notebook_v2(
                notebook_notes,
                notebook_name,
                notebook_id
            )

            output_path = os.path.join(output_dir, f"{safe_name}.json")
            with open(output_path, 'w', encoding='utf-8') as f:
                json.dump(notebook, f, ensure_ascii=False, indent=2)
            output_paths.append(output_path)
            print(f"  - {notebook_name}: {len(notebook_notes)} 条笔记 -> {safe_name}.json")

    else:
        # 创建单个笔记本（旧行为）
        notebook_id = str(int(datetime.now().timestamp() * 1000))
        exb_name = Path(exb_path).stem
        notebook = create_onehand_notebook_v2(
            notes,
            f"{exb_name} 导入",
            notebook_id
        )

        output_path = os.path.join(output_dir, f"{notebook_id}.json")
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(notebook, f, ensure_ascii=False, indent=2)
        output_paths.append(output_path)
        print(f"已创建笔记本: {output_path}")
        print(f"笔记本名称: {exb_name} 导入")
        print(f"包含 {len(notes)} 条笔记")

    # 写入标签文件
    if tag_count > 0:
        tags_path = os.path.join(output_dir, 'tags.json')
        existing_tags = []
        if os.path.exists(tags_path):
            try:
                with open(tags_path, 'r', encoding='utf-8') as f:
                    existing_tags = json.load(f)
            except:
                existing_tags = []

        # 合并标签
        existing_tag_names = {t['name'] for t in existing_tags}
        for tag_name, tag_def in tags_dict.items():
            if tag_name not in existing_tag_names:
                existing_tags.append(tag_def)

        with open(tags_path, 'w', encoding='utf-8') as f:
            json.dump(existing_tags, f, ensure_ascii=False, indent=2)
        print(f"标签已写入: {tags_path}")

    return output_paths


def main():
    parser = argparse.ArgumentParser(
        description='印象笔记 EXB 数据库解析工具',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例:
    python exb_to_onehand.py blocks/x8chen#app.yinxiang.com.exb
    python exb_to_onehand.py blocks/x8chen#app.yinxiang.com.exb ./output
    python exb_to_onehand.py blocks/x8chen#app.yinxiang.com.exb ./output -d
    python exb_to_onehand.py blocks/x8chen#app.yinxiang.com.exb ./output -s
    python exb_to_onehand.py blocks/x8chen#app.yinxiang.com.exb --list-tables
        """
    )
    parser.add_argument('input', help='印象笔记数据库文件 (.exb) 路径')
    parser.add_argument('output', nargs='?', default='./onehand_notebooks',
                        help='输出目录，默认为 ./onehand_notebooks')
    parser.add_argument('-d', '--by-date', action='store_true',
                        help='按日期（年月）分组到不同笔记本')
    parser.add_argument('-s', '--single-file', action='store_true',
                        help='导出为单个文件（不按笔记本分组）')
    parser.add_argument('--list-tables', action='store_true',
                        help='列出数据库中的所有表（用于调试）')

    args = parser.parse_args()

    # 检查输入文件
    if not os.path.exists(args.input):
        print(f"错误: 文件不存在: {args.input}")
        sys.exit(1)

    # 连接数据库并列出表结构（调试模式）
    if args.list_tables:
        conn = sqlite3.connect(args.input)
        conn.create_collation('NOCASEUTF8', lambda x, y: (x or '').lower().__cmp__((y or '').lower()) if hasattr(str, '__cmp__') else ((x or '').lower() > (y or '').lower()) - ((x or '').lower() < (y or '').lower()))
        list_tables(conn)
        conn.close()
        return

    # 执行转换（默认按笔记本分组）
    output_paths = convert_exb_to_onehand(
        args.input,
        args.output,
        by_date=args.by_date,
        by_notebook=not args.single_file
    )

    if output_paths:
        print(f"\n转换完成！输出文件:")
        for path in output_paths:
            print(f"  - {path}")
    else:
        print("\n转换失败，没有生成输出文件")


if __name__ == '__main__':
    main()
