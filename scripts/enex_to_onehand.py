#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
印象笔记 ENEX 格式转换工具
将 Evernote 导出的 .enex 文件转换为 OneHand 用户数据格式

使用方法:
    python enex_to_onehand.py <input.enex> [output_dir] [options]

参数:
    input.enex    - 印象笔记导出的 enex 文件路径
    output_dir    - 输出目录，默认为当前目录下的 onehand_projects

选项:
    -m, --by-month  按创建时间的月份分到不同画布页

示例:
    python enex_to_onehand.py my_notes.enex
    python enex_to_onehand.py my_notes.enex ./output
    python enex_to_onehand.py my_notes.enex ./output -m
"""

import xml.etree.ElementTree as ET
import json
import os
import sys
import re
import base64
import hashlib
import argparse
from datetime import datetime
from html.parser import HTMLParser
from typing import List, Dict, Optional, Tuple
from pathlib import Path
from collections import defaultdict


class HTMLToMarkdown(HTMLParser):
    """将 HTML 转换为 Markdown 格式"""

    def __init__(self):
        super().__init__()
        self.result = []
        self.list_stack = []  # 跟踪列表类型和层级
        self.ignore_tags = {'style', 'script', 'head'}
        self.current_ignore = False
        self.in_codeblock = False  # 跟踪代码块状态
        self.codeblock_lines = []  # 代码块内容收集
        self.in_list_item = False  # 跟踪是否在列表项内
        self.list_item_content = []  # 收集列表项内容

    def handle_starttag(self, tag: str, attrs: List[Tuple[str, str]]):
        if tag in self.ignore_tags:
            self.current_ignore = True
            return

        attrs_dict = dict(attrs)

        # 检查是否是代码块 (印象笔记用 style="-en-codeblock: true" 标记)
        if tag == 'div':
            style = attrs_dict.get('style', '')
            if '-en-codeblock' in style and 'true' in style:
                self.in_codeblock = True
                self.codeblock_lines = []
                return
            # div 开始时不添加换行，在结束时处理

        if self.in_codeblock:
            return  # 代码块内不处理其他标签

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
            pass  # span 只是一个容器，不处理

    def handle_endtag(self, tag: str):
        if tag in self.ignore_tags:
            self.current_ignore = False
            return

        # 结束代码块
        if tag == 'div' and self.in_codeblock:
            self.in_codeblock = False
            # 输出代码块
            self.result.append('\n```\n')
            for line in self.codeblock_lines:
                self.result.append(line)
            self.result.append('\n```\n')
            self.codeblock_lines = []
            return

        # div 结束时添加硬换行（用于 checkbox 等）
        if tag == 'div' and not self.in_list_item:
            self.result.append('  \n')

        if self.in_codeblock:
            return  # 代码块内不处理结束标签

        if tag in ('h1', 'h2', 'h3', 'h4', 'h5', 'h6'):
            self.result.append('\n')
        elif tag == 'p':
            pass  # 已经在 starttag 处理
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
            # 结束列表项，输出收集的内容
            self.in_list_item = False
            content = ''.join(self.list_item_content).strip()
            self.result.append(content)
            self.result.append('  \n')  # Markdown 硬换行：两个空格 + 换行
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
        # 清理多余空行
        result = re.sub(r'\n{3,}', '\n\n', result)
        return result.strip()


def html_to_markdown(html_content: str) -> str:
    """将 HTML 内容转换为 Markdown"""
    parser = HTMLToMarkdown()
    try:
        parser.feed(html_content)
        return parser.get_markdown()
    except Exception as e:
        print(f"HTML 解析错误: {e}")
        return html_content


def parse_evernote_time(time_str: str) -> int:
    """
    解析印象笔记时间格式
    格式: 20231215T123000Z 或 20231215T123000+0800
    """
    if not time_str:
        return int(datetime.now().timestamp() * 1000)
        
    try:
        # 移除时区后缀
        time_str = time_str.replace('Z', '')
        if '+' in time_str:
            time_str = time_str.split('+')[0]
            
        dt = datetime.strptime(time_str, '%Y%m%dT%H%M%S')
        return int(dt.timestamp() * 1000)
    except ValueError:
        return int(datetime.now().timestamp() * 1000)


def generate_id() -> str:
    """生成唯一ID"""
    return str(int(datetime.now().timestamp() * 1000))


def calculate_node_position(index: int, total: int) -> Dict[str, int]:
    """
    计算节点在画布上的位置（瀑布式布局）
    """
    column_count = 3
    node_width = 400
    column_gap = 40
    row_gap = 30
    start_x = 100
    start_y = 100
    
    column = index % column_count
    row = index // column_count
    
    x = start_x + column * (node_width + column_gap)
    y = start_y + row * 300  # 估算行高
    
    return {'x': x, 'y': y}


def extract_text_content(content: str) -> str:
    """
    从印象笔记内容中提取纯文本
    印象笔记的内容通常被 CDATA 包裹，包含 HTML
    """
    # 移除 CDATA 标记
    content = re.sub(r'<!\[CDATA\[|\]\]>', '', content)

    # 移除印象笔记特定的 XML 标记
    content = re.sub(r'<en-note[^>]*>|</en-note>', '', content)

    # 处理 en-todo 标签 (checkbox) - 转换为 GitHub 风格任务列表
    # 注意：先处理 checked="true"，再处理其他的，避免顺序问题
    content = re.sub(r'<en-todo\s+checked="true"\s*/>', '- [x] ', content)
    content = re.sub(r'<en-todo\s+checked="false"\s*/>', '- [ ] ', content)
    content = re.sub(r'<en-todo\s*/>', '- [ ] ', content)

    # 转换 HTML 为 Markdown
    markdown = html_to_markdown(content)

    return markdown


def parse_enex(enex_path: str) -> List[Dict]:
    """
    解析 ENEX 文件，返回笔记列表
    """
    tree = ET.parse(enex_path)
    root = tree.getroot()
    
    notes = []
    
    for note in root.findall('.//note'):
        note_data = {}
        
        # 标题
        title_elem = note.find('title')
        note_data['title'] = title_elem.text if title_elem is not None else '无标题'
        
        # 创建时间
        created_elem = note.find('created')
        note_data['created'] = parse_evernote_time(created_elem.text if created_elem is not None else None)
        
        # 更新时间
        updated_elem = note.find('updated')
        note_data['updated'] = parse_evernote_time(updated_elem.text if updated_elem is not None else None)
        
        # 内容
        content_elem = note.find('content')
        if content_elem is not None and content_elem.text:
            note_data['content'] = extract_text_content(content_elem.text)
        else:
            note_data['content'] = ''
            
        # 标签
        tags = []
        for tag_elem in note.findall('tag'):
            if tag_elem.text:
                tags.append(tag_elem.text)
        note_data['tags'] = tags
        
        # 资源（附件）
        resources = []
        for resource in note.findall('resource'):
            resource_data = {}
            
            # MIME 类型
            mime_elem = resource.find('mime')
            if mime_elem is not None:
                resource_data['mime'] = mime_elem.text
                
            # 文件名
            filename_elem = resource.find('resource-attributes/file-name')
            if filename_elem is not None:
                resource_data['filename'] = filename_elem.text
                
            # 数据
            data_elem = resource.find('data')
            if data_elem is not None and data_elem.text:
                resource_data['data'] = data_elem.text
                
            if resource_data:
                resources.append(resource_data)
                
        note_data['resources'] = resources
        
        notes.append(note_data)
        
    return notes


def create_onehand_project(notes: List[Dict], project_name: str, by_month: bool = False) -> Dict:
    """
    创建 OneHand 项目格式

    Args:
        notes: 笔记列表
        project_name: 项目名称
        by_month: 是否按月份分到不同画布
    """
    now = int(datetime.now().timestamp() * 1000)
    project_id = str(now)

    if by_month:
        return create_onehand_project_by_month(notes, project_name, now)

    # 创建节点
    nodes = []
    for i, note in enumerate(notes):
        # 使用笔记创建时间作为节点ID，确保唯一性
        node_id = str(note['created']) + str(i)
        position = calculate_node_position(i, len(notes))

        node = {
            'id': node_id,
            'type': 'text-note',
            'title': note['title'][:100] if len(note['title']) > 100 else note['title'],
            'position': position,
            'transcript': note['content'],
            'selectedAsContext': False,
            'isFavorite': False,
            'createdAt': note['created']
        }

        # 添加标签作为内容的一部分
        if note['tags']:
            tags_text = '\n\n---\n**标签:** ' + ', '.join(note['tags'])
            node['transcript'] += tags_text

        nodes.append(node)

    # 创建画布页
    canvas_page = {
        'id': f'canvas-{now}',
        'type': 'infinite',
        'viewport': {'x': 0, 'y': 0, 'zoom': 1},
        'nodes': nodes,
        'createdAt': now
    }

    # 创建项目
    project = {
        'id': project_id,
        'name': project_name,
        'createdAt': now,
        'updatedAt': now,
        'canvases': [canvas_page],
        'currentCanvasIndex': 0
    }

    return project


def create_onehand_project_by_month(notes: List[Dict], project_name: str, now: int) -> Dict:
    """
    按创建时间的月份创建 OneHand 项目，每个月份一个画布页
    """
    project_id = str(now)

    # 按月份分组笔记
    notes_by_month = defaultdict(list)
    for note in notes:
        # 从时间戳获取年月
        dt = datetime.fromtimestamp(note['created'] / 1000)
        month_key = dt.strftime('%Y-%m')
        notes_by_month[month_key].append(note)

    # 按月份排序（从早到晚）
    sorted_months = sorted(notes_by_month.keys())

    # 为每个月份创建画布
    canvases = []
    for month_idx, month_key in enumerate(sorted_months):
        month_notes = notes_by_month[month_key]

        # 创建该月份的节点
        nodes = []
        for i, note in enumerate(month_notes):
            node_id = str(note['created']) + str(i)
            position = calculate_node_position(i, len(month_notes))

            node = {
                'id': node_id,
                'type': 'text-note',
                'title': note['title'][:100] if len(note['title']) > 100 else note['title'],
                'position': position,
                'transcript': note['content'],
                'selectedAsContext': False,
                'isFavorite': False,
                'createdAt': note['created']
            }

            if note['tags']:
                tags_text = '\n\n---\n**标签:** ' + ', '.join(note['tags'])
                node['transcript'] += tags_text

            nodes.append(node)

        # 创建画布页，名称为月份
        canvas = {
            'id': f'canvas-{now}-{month_idx}',
            'type': 'infinite',
            'name': month_key,
            'viewport': {'x': 0, 'y': 0, 'zoom': 1},
            'nodes': nodes,
            'createdAt': now
        }
        canvases.append(canvas)

    # 创建项目
    project = {
        'id': project_id,
        'name': project_name,
        'createdAt': now,
        'updatedAt': now,
        'canvases': canvases,
        'currentCanvasIndex': 0
    }

    return project


def convert_enex_to_onehand(enex_path: str, output_dir: str, by_month: bool = False) -> str:
    """
    将 ENEX 文件转换为 OneHand 格式
    返回输出的项目文件路径
    """
    # 解析 ENEX
    print(f"正在解析: {enex_path}")
    notes = parse_enex(enex_path)
    print(f"找到 {len(notes)} 条笔记")

    if not notes:
        print("没有找到任何笔记")
        return None

    # 生成项目名称
    enex_name = Path(enex_path).stem
    project_name = f"印象笔记_{enex_name}"

    # 创建 OneHand 项目
    project = create_onehand_project(notes, project_name, by_month=by_month)

    # 确保输出目录存在
    os.makedirs(output_dir, exist_ok=True)

    # 写入项目文件
    output_path = os.path.join(output_dir, f"{project['id']}.json")
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(project, f, ensure_ascii=False, indent=2)

    print(f"已创建项目: {output_path}")
    print(f"项目名称: {project_name}")
    print(f"包含 {len(notes)} 条笔记")
    if by_month:
        print(f"按月份分为 {len(project['canvases'])} 个画布页")

    return output_path


def main():
    parser = argparse.ArgumentParser(
        description='印象笔记 ENEX 格式转换工具',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例:
    python enex_to_onehand.py my_notes.enex
    python enex_to_onehand.py my_notes.enex ./output
    python enex_to_onehand.py my_notes.enex ./output -m
        """
    )
    parser.add_argument('input', help='印象笔记导出的 enex 文件路径')
    parser.add_argument('output', nargs='?', default='./onehand_projects',
                        help='输出目录，默认为 ./onehand_projects')
    parser.add_argument('-m', '--by-month', action='store_true',
                        help='按创建时间的月份分到不同画布页')

    args = parser.parse_args()

    if not os.path.exists(args.input):
        print(f"错误: 文件不存在: {args.input}")
        sys.exit(1)

    # 执行转换
    try:
        output_path = convert_enex_to_onehand(args.input, args.output, by_month=args.by_month)
        if output_path:
            print(f"\n转换完成!")
            print(f"请将生成的项目文件复制到 OneHand 用户数据目录:")
            print(f"  Windows: %APPDATA%\\OneHand\\projects\\")
            print(f"  macOS: ~/Library/Application Support/OneHand/projects/")
    except Exception as e:
        print(f"转换失败: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == '__main__':
    main()