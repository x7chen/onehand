#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
印象笔记 ENEX 格式转换工具
将 Evernote 导出的 .enex 文件转换为 OneHand 用户数据格式

使用方法:
    python enex_to_onehand.py <input.enex> [output_dir] [options]

参数:
    input.enex    - 印象笔记导出的 enex 文件路径
    output_dir    - 输出目录，默认为当前目录下的 onehand_notebooks

选项:
    -m, --by-month  按创建时间的月份分到不同画布页
    -w, --by-week   按创建时间的星期（周一开始）分到不同画布页
    -d, --by-day    按创建时间的天分到不同画布页
    -i, --images    提取图片到单独的images文件夹，并转换为markdown图片引用

示例:
    python enex_to_onehand.py my_notes.enex
    python enex_to_onehand.py my_notes.enex ./output
    python enex_to_onehand.py my_notes.enex ./output -m
    python enex_to_onehand.py my_notes.enex ./output -w
    python enex_to_onehand.py my_notes.enex ./output -d
    python enex_to_onehand.py my_notes.enex ./output -i
"""

import xml.etree.ElementTree as ET
import json
import os
import sys
import re
import base64
import hashlib
import argparse
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


def process_images_in_content(content: str, resources: List[Dict], images_dir: str, notebook_id: str, image_counter: List[int] = None) -> Tuple[str, List[Dict]]:
    """
    处理内容中的图片，保存到指定目录，并替换为markdown图片引用

    Args:
        content: 原始HTML内容
        resources: 资源列表
        images_dir: 图片保存目录
        notebook_id: 笔记本ID
        image_counter: 全局图片计数器 [count]，用于生成唯一文件名

    Returns:
        Tuple[处理后的内容, 保存的图片信息列表]
    """
    if not content:
        return content, []

    # 初始化计数器
    if image_counter is None:
        image_counter = [0]

    saved_images = []

    # 移除 CDATA 标记
    content = re.sub(r'<!\[CDATA\[|\]\]>', '', content)

    # 处理 <en-media> 标签（印象笔记的图片嵌入方式）
    # 格式: <en-media type="image/png" hash="xxxxx" />
    def replace_en_media(match):
        nonlocal saved_images

        tag = match.group(0)
        # 提取属性
        type_match = re.search(r'type="([^"]+)"', tag)
        hash_match = re.search(r'hash="([^"]+)"', tag)

        if not type_match or not hash_match:
            return tag

        mime_type = type_match.group(1)
        content_hash = hash_match.group(1)

        # 只处理图片类型
        if not mime_type.startswith('image/'):
            return tag

        # 查找匹配的资源
        matched_resource = None
        for resource in resources:
            if resource.get('hash') == content_hash or resource.get('mime') == mime_type:
                matched_resource = resource
                break

        if not matched_resource and resources:
            # 如果没找到精确匹配，尝试用同类型的第一个图片资源
            for resource in resources:
                if resource.get('mime', '').startswith('image/'):
                    matched_resource = resource
                    break

        if not matched_resource or 'data' not in matched_resource:
            return '[图片]'

        # 保存图片
        try:
            # 确定文件扩展名
            ext = mime_type.split('/')[-1]
            if ext == 'jpeg':
                ext = 'jpg'

            # 使用全局计数器生成唯一文件名
            image_counter[0] += 1
            image_id = f"img-{image_counter[0]}"
            filename = f"{image_id}.{ext}"
            image_path = os.path.join(images_dir, filename)

            # 解码并保存图片
            binary_data = base64.b64decode(matched_resource['data'].strip())
            with open(image_path, 'wb') as f:
                f.write(binary_data)

            # 记录保存的图片
            relative_path = f"images/{filename}"
            saved_images.append({
                'path': image_path,
                'relative_path': relative_path,
                'filename': filename
            })

            # 返回 markdown 图片语法
            alt = matched_resource.get('filename', 'image')
            return f"\n![{alt}]({relative_path})\n"

        except Exception as e:
            print(f"  警告: 保存图片失败: {e}")
            return '[图片]'

    # 替换 en-media 标签
    content = re.sub(r'<en-media[^>]*/>', replace_en_media, content)

    # 处理普通 img 标签中的 data URL
    def replace_img_data_url(match):
        nonlocal saved_images

        full_tag = match.group(0)

        # 提取 src 属性
        src_match = re.search(r'src="data:image/([^;]+);base64,([^"]+)"', full_tag)
        if not src_match:
            return full_tag

        ext = src_match.group(1)
        if ext == 'jpeg':
            ext = 'jpg'
        base64_data = src_match.group(2)

        try:
            # 使用全局计数器生成唯一文件名
            image_counter[0] += 1
            image_id = f"img-{image_counter[0]}"
            filename = f"{image_id}.{ext}"
            image_path = os.path.join(images_dir, filename)

            # 解码并保存图片
            binary_data = base64.b64decode(base64_data)
            with open(image_path, 'wb') as f:
                f.write(binary_data)

            relative_path = f"images/{filename}"
            saved_images.append({
                'path': image_path,
                'relative_path': relative_path,
                'filename': filename
            })

            # 提取 alt 属性
            alt_match = re.search(r'alt="([^"]*)"', full_tag)
            alt = alt_match.group(1) if alt_match else 'image'

            return f"![{alt}]({relative_path})"

        except Exception as e:
            print(f"  警告: 保存图片失败: {e}")
            return '[图片]'

    content = re.sub(r'<img[^>]*src="data:image[^"]*"[^>]*/?>', replace_img_data_url, content)

    # 处理普通 img 标签（非 data URL）
    def replace_img_tag(match):
        full_tag = match.group(0)

        # 提取 src 和 alt
        src_match = re.search(r'src="([^"]+)"', full_tag)
        alt_match = re.search(r'alt="([^"]*)"', full_tag)

        if src_match:
            src = src_match.group(1)
            alt = alt_match.group(1) if alt_match else ''
            return f"![{alt}]({src})"

        return full_tag

    content = re.sub(r'<img[^>]*src="(?!data:)[^"]*"[^>]*/?>', replace_img_tag, content)

    # 转换剩余的 HTML 为 Markdown
    content = html_to_markdown(content)

    return content, saved_images


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

        # 原始内容（用于图片处理）
        note_data['raw_content'] = content_elem.text if content_elem is not None else None

        # 标签
        tags = []
        for tag_elem in note.findall('tag'):
            if tag_elem.text:
                tags.append(tag_elem.text)
        note_data['tags'] = tags

        # 资源（附件/图片）
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

            # 资源ID（用于在内容中引用）
            resource_id_elem = resource.find('resource-attributes/source-url')
            if resource_id_elem is not None and resource_id_elem.text:
                # 提取 hash，格式如 "evernote://view/xxxx/xxxx/xxxx/"
                resource_data['source_url'] = resource_id_elem.text

            # 计算 hash（印象笔记用 hash 来匹配内容和资源）
            if data_elem is not None and data_elem.text:
                # 计算 base64 数据的 MD5
                try:
                    binary_data = base64.b64decode(data_elem.text.strip())
                    resource_data['hash'] = hashlib.md5(binary_data).hexdigest()
                except:
                    pass

            if resource_data:
                resources.append(resource_data)

        note_data['resources'] = resources

        notes.append(note_data)

    return notes


TAG_COLORS = [
    '#66bb6a',  # 绿色
    '#4299e1',  # 蓝色
    '#ed8936',  # 橙色
    '#e53e3e',  # 红色
    '#9f7aea',  # 紫色
    '#ed64a6',  # 粉色
    '#38b2ac',  # 青色
    '#ecc94b',  # 黄色
]


def get_next_tag_color(used_colors: set) -> str:
    """获取下一个可用的标签颜色"""
    for color in TAG_COLORS:
        if color not in used_colors:
            return color
    return TAG_COLORS[0]


def collect_all_tags(notes: List[Dict]) -> Dict[str, Dict]:
    """
    从所有笔记中收集标签，返回标签定义字典

    Returns:
        Dict[tag_name, tag_definition]: 标签名称到标签定义的映射
    """
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


def create_onehand_notebook(notes: List[Dict], notebook_name: str, by_month: bool = False, by_week: bool = False, by_day: bool = False, extract_images: bool = False, output_dir: str = None, notebook_id: str = None, tags_dict: Dict[str, Dict] = None) -> Dict:
    """
    创建 OneHand 笔记本格式

    Args:
        notes: 笔记列表
        notebook_name: 笔记本名称
        by_month: 是否按月份分到不同画布
        by_week: 是否按星期（周一开始）分到不同画布
        by_day: 是否按天分到不同画布
        extract_images: 是否提取图片到单独文件夹
        output_dir: 输出目录（用于创建图片文件夹）
        notebook_id: 笔记本ID（用于创建图片文件夹名称）
    """
    now = int(datetime.now().timestamp() * 1000)
    if notebook_id is None:
        notebook_id = str(now)

    # 如果需要提取图片，创建 images 目录（使用笔记本ID作为文件夹名）
    images_dir = None
    if extract_images and output_dir and notebook_id:
        images_dir = os.path.join(output_dir, notebook_id, 'images')
        os.makedirs(images_dir, exist_ok=True)

    # 全局图片计数器，确保所有笔记的图片名唯一
    image_counter = [0]

    if by_month:
        return create_onehand_notebook_by_month(notes, notebook_name, notebook_id, extract_images=extract_images, images_dir=images_dir, image_counter=image_counter)

    if by_week:
        return create_onehand_notebook_by_week(notes, notebook_name, notebook_id, extract_images=extract_images, images_dir=images_dir, image_counter=image_counter)

    if by_day:
        return create_onehand_notebook_by_day(notes, notebook_name, notebook_id, extract_images=extract_images, images_dir=images_dir, image_counter=image_counter)

    # 创建节点
    nodes = []
    for i, note in enumerate(notes):
        # 使用笔记创建时间作为节点ID，确保唯一性
        node_id = str(note['created']) + str(i)
        position = calculate_node_position(i, len(notes))

        # 处理内容
        content = note['content']
        if extract_images and note.get('raw_content') and note.get('resources'):
            # 重新处理内容，提取图片
            content, saved_images = process_images_in_content(
                note['raw_content'],
                note['resources'],
                images_dir,
                notebook_id,
                image_counter
            )
            if saved_images:
                print(f"  笔记 '{note['title'][:30]}...' 提取了 {len(saved_images)} 张图片")

        node = {
            'id': node_id,
            'type': 'text-note',
            'title': note['title'][:100] if len(note['title']) > 100 else note['title'],
            'position': position,
            'transcript': content,
            'selectedAsContext': False,
            'isFavorite': False,
            'createdAt': note['created']
        }

        # 添加标签到节点的 tags 字段
        if note['tags']:
            node['tags'] = note['tags']

        nodes.append(node)

    # 创建画布页
    canvas_page = {
        'id': f'canvas-{now}',
        'type': 'infinite',
        'viewport': {'x': 0, 'y': 0, 'zoom': 1},
        'nodes': nodes,
        'createdAt': now
    }

    # 创建笔记本
    notebook = {
        'id': notebook_id,
        'name': notebook_name,
        'createdAt': now,
        'updatedAt': now,
        'canvases': [canvas_page],
        'currentCanvasIndex': 0
    }

    return notebook


def create_onehand_notebook_by_month(notes: List[Dict], notebook_name: str, notebook_id: str, extract_images: bool = False, images_dir: str = None, image_counter: List[int] = None) -> Dict:
    """
    按创建时间的月份创建 OneHand 笔记本，每个月份一个画布页
    """
    now = int(datetime.now().timestamp() * 1000)

    # 初始化图片计数器
    if image_counter is None:
        image_counter = [0]

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

            # 处理内容
            content = note['content']
            if extract_images and note.get('raw_content') and note.get('resources'):
                content, saved_images = process_images_in_content(
                    note['raw_content'],
                    note['resources'],
                    images_dir,
                    notebook_id,
                    image_counter
                )
                if saved_images:
                    print(f"  笔记 '{note['title'][:30]}...' 提取了 {len(saved_images)} 张图片")

            node = {
                'id': node_id,
                'type': 'text-note',
                'title': note['title'][:100] if len(note['title']) > 100 else note['title'],
                'position': position,
                'transcript': content,
                'selectedAsContext': False,
                'isFavorite': False,
                'createdAt': note['created']
            }

            # 添加标签到节点的 tags 字段
            if note['tags']:
                node['tags'] = note['tags']

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

    # 创建笔记本
    notebook = {
        'id': notebook_id,
        'name': notebook_name,
        'createdAt': now,
        'updatedAt': now,
        'canvases': canvases,
        'currentCanvasIndex': 0
    }

    return notebook


def get_week_key(dt: datetime) -> Tuple[str, str]:
    """
    获取日期的星期 key（周一开始）

    Returns:
        Tuple[week_key, week_name]: 用于分组的 key 和显示名称
        例如: ('2024-03-11', '2024-03-11 ~ 2024-03-17')
    """
    # 计算周一的日期（iso weekday: 1=周一, 7=周日）
    monday = dt - timedelta(days=dt.isoweekday() - 1)
    sunday = monday + timedelta(days=6)

    week_key = monday.strftime('%Y-%m-%d')
    week_name = f"{monday.strftime('%Y-%m-%d')} ~ {sunday.strftime('%Y-%m-%d')}"

    return week_key, week_name


def create_onehand_notebook_by_week(notes: List[Dict], notebook_name: str, notebook_id: str, extract_images: bool = False, images_dir: str = None, image_counter: List[int] = None) -> Dict:
    """
    按创建时间的星期（周一开始）创建 OneHand 笔记本，每星期一个画布页
    """
    now = int(datetime.now().timestamp() * 1000)

    # 初始化图片计数器
    if image_counter is None:
        image_counter = [0]

    # 按星期分组笔记
    notes_by_week = defaultdict(list)
    for note in notes:
        dt = datetime.fromtimestamp(note['created'] / 1000)
        week_key, week_name = get_week_key(dt)
        notes_by_week[week_key].append((note, week_name))

    # 按星期排序（从早到晚）
    sorted_weeks = sorted(notes_by_week.keys())

    # 为每星期创建画布
    canvases = []
    for week_idx, week_key in enumerate(sorted_weeks):
        week_items = notes_by_week[week_key]
        week_name = week_items[0][1]  # 获取显示名称
        week_notes = [item[0] for item in week_items]  # 提取笔记

        # 创建该星期的节点
        nodes = []
        for i, note in enumerate(week_notes):
            node_id = str(note['created']) + str(i)
            position = calculate_node_position(i, len(week_notes))

            # 处理内容
            content = note['content']
            if extract_images and note.get('raw_content') and note.get('resources'):
                content, saved_images = process_images_in_content(
                    note['raw_content'],
                    note['resources'],
                    images_dir,
                    notebook_id,
                    image_counter
                )
                if saved_images:
                    print(f"  笔记 '{note['title'][:30]}...' 提取了 {len(saved_images)} 张图片")

            node = {
                'id': node_id,
                'type': 'text-note',
                'title': note['title'][:100] if len(note['title']) > 100 else note['title'],
                'position': position,
                'transcript': content,
                'selectedAsContext': False,
                'isFavorite': False,
                'createdAt': note['created']
            }

            # 添加标签到节点的 tags 字段
            if note['tags']:
                node['tags'] = note['tags']

            nodes.append(node)

        # 创建画布页，名称为星期范围
        canvas = {
            'id': f'canvas-{now}-{week_idx}',
            'type': 'infinite',
            'name': week_name,
            'viewport': {'x': 0, 'y': 0, 'zoom': 1},
            'nodes': nodes,
            'createdAt': now
        }
        canvases.append(canvas)

    # 创建笔记本
    notebook = {
        'id': notebook_id,
        'name': notebook_name,
        'createdAt': now,
        'updatedAt': now,
        'canvases': canvases,
        'currentCanvasIndex': 0
    }

    return notebook


def create_onehand_notebook_by_day(notes: List[Dict], notebook_name: str, notebook_id: str, extract_images: bool = False, images_dir: str = None, image_counter: List[int] = None) -> Dict:
    """
    按创建时间的天创建 OneHand 笔记本，每天一个画布页
    """
    now = int(datetime.now().timestamp() * 1000)

    # 初始化图片计数器
    if image_counter is None:
        image_counter = [0]

    # 按天分组笔记
    notes_by_day = defaultdict(list)
    for note in notes:
        dt = datetime.fromtimestamp(note['created'] / 1000)
        day_key = dt.strftime('%Y-%m-%d')
        notes_by_day[day_key].append(note)

    # 按天排序（从早到晚）
    sorted_days = sorted(notes_by_day.keys())

    # 为每天创建画布
    canvases = []
    for day_idx, day_key in enumerate(sorted_days):
        day_notes = notes_by_day[day_key]

        # 创建该天的节点
        nodes = []
        for i, note in enumerate(day_notes):
            node_id = str(note['created']) + str(i)
            position = calculate_node_position(i, len(day_notes))

            # 处理内容
            content = note['content']
            if extract_images and note.get('raw_content') and note.get('resources'):
                content, saved_images = process_images_in_content(
                    note['raw_content'],
                    note['resources'],
                    images_dir,
                    notebook_id,
                    image_counter
                )
                if saved_images:
                    print(f"  笔记 '{note['title'][:30]}...' 提取了 {len(saved_images)} 张图片")

            node = {
                'id': node_id,
                'type': 'text-note',
                'title': note['title'][:100] if len(note['title']) > 100 else note['title'],
                'position': position,
                'transcript': content,
                'selectedAsContext': False,
                'isFavorite': False,
                'createdAt': note['created']
            }

            # 添加标签到节点的 tags 字段
            if note['tags']:
                node['tags'] = note['tags']

            nodes.append(node)

        # 创建画布页，名称为日期
        canvas = {
            'id': f'canvas-{now}-{day_idx}',
            'type': 'infinite',
            'name': day_key,
            'viewport': {'x': 0, 'y': 0, 'zoom': 1},
            'nodes': nodes,
            'createdAt': now
        }
        canvases.append(canvas)

    # 创建笔记本
    notebook = {
        'id': notebook_id,
        'name': notebook_name,
        'createdAt': now,
        'updatedAt': now,
        'canvases': canvases,
        'currentCanvasIndex': 0
    }

    return notebook


def convert_enex_to_onehand(enex_path: str, output_dir: str, by_month: bool = False, by_week: bool = False, by_day: bool = False, extract_images: bool = False) -> str:
    """
    将 ENEX 文件转换为 OneHand 格式
    返回输出的笔记本文件路径
    """
    # 解析 ENEX
    print(f"正在解析: {enex_path}")
    notes = parse_enex(enex_path)
    print(f"找到 {len(notes)} 条笔记")

    if not notes:
        print("没有找到任何笔记")
        return None

    # 生成笔记本名称和ID
    enex_name = Path(enex_path).stem
    notebook_name = f"印象笔记_{enex_name}"
    notebook_id = str(int(datetime.now().timestamp() * 1000))

    # 收集所有标签并生成标签定义
    tags_dict = collect_all_tags(notes)
    tag_count = len(tags_dict)
    if tag_count > 0:
        print(f"发现 {tag_count} 个标签")

    # 创建 OneHand 笔记本
    notebook = create_onehand_notebook(
        notes, notebook_name,
        by_month=by_month, by_week=by_week, by_day=by_day,
        extract_images=extract_images,
        output_dir=output_dir,
        notebook_id=notebook_id,
        tags_dict=tags_dict
    )

    # 确保输出目录存在
    os.makedirs(output_dir, exist_ok=True)

    # 写入笔记本文件
    output_path = os.path.join(output_dir, f"{notebook['id']}.json")
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(notebook, f, ensure_ascii=False, indent=2)

    # 写入标签文件（如果有标签）
    if tag_count > 0:
        tags_path = os.path.join(output_dir, 'tags.json')
        # 检查是否已有标签文件，如果有则合并
        existing_tags = []
        if os.path.exists(tags_path):
            try:
                with open(tags_path, 'r', encoding='utf-8') as f:
                    existing_tags = json.load(f)
            except:
                existing_tags = []

        # 合并标签（避免重复）
        existing_tag_names = {t['name'] for t in existing_tags}
        for tag_name, tag_def in tags_dict.items():
            if tag_name not in existing_tag_names:
                existing_tags.append(tag_def)

        # 写入合并后的标签文件
        with open(tags_path, 'w', encoding='utf-8') as f:
            json.dump(existing_tags, f, ensure_ascii=False, indent=2)
        print(f"标签已写入: {tags_path}")

    print(f"已创建笔记本: {output_path}")
    print(f"笔记本名称: {notebook_name}")
    print(f"包含 {len(notes)} 条笔记")
    if tag_count > 0:
        print(f"包含 {tag_count} 个标签")
    if by_month:
        print(f"按月份分为 {len(notebook['canvases'])} 个画布页")
    if by_week:
        print(f"按星期分为 {len(notebook['canvases'])} 个画布页")
    if by_day:
        print(f"按天分为 {len(notebook['canvases'])} 个画布页")
    if extract_images:
        # 检查是否有图片目录
        images_dir = os.path.join(output_dir, notebook['id'], 'images')
        if os.path.exists(images_dir):
            image_count = len([f for f in os.listdir(images_dir) if os.path.isfile(os.path.join(images_dir, f))])
            print(f"提取了 {image_count} 张图片到: {images_dir}")

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
    python enex_to_onehand.py my_notes.enex ./output -w
    python enex_to_onehand.py my_notes.enex ./output -d
    python enex_to_onehand.py my_notes.enex ./output -i
    python enex_to_onehand.py my_notes.enex ./output -m -i
        """
    )
    parser.add_argument('input', help='印象笔记导出的 enex 文件路径')
    parser.add_argument('output', nargs='?', default='./onehand_notebooks',
                        help='输出目录，默认为 ./onehand_notebooks')
    parser.add_argument('-m', '--by-month', action='store_true',
                        help='按创建时间的月份分到不同画布页')
    parser.add_argument('-w', '--by-week', action='store_true',
                        help='按创建时间的星期（周一开始）分到不同画布页')
    parser.add_argument('-d', '--by-day', action='store_true',
                        help='按创建时间的天分到不同画布页')
    parser.add_argument('-i', '--images', action='store_true',
                        help='提取图片到单独的images文件夹，并转换为markdown图片引用')

    args = parser.parse_args()

    if not os.path.exists(args.input):
        print(f"错误: 文件不存在: {args.input}")
        sys.exit(1)

    # 执行转换
    try:
        output_path = convert_enex_to_onehand(
            args.input, args.output,
            by_month=args.by_month,
            by_week=args.by_week,
            by_day=args.by_day,
            extract_images=args.images
        )
        if output_path:
            print(f"\n转换完成!")
            print(f"请将生成的文件复制到 OneHand 用户数据目录:")
            print(f"  Windows: %APPDATA%\\OneHand\\")
            print(f"  macOS: ~/Library/Application Support/OneHand/")
            print(f"\n文件说明:")
            print(f"  - 笔记本文件 ({os.path.basename(output_path)}) 放入 notebooks/ 目录")
            print(f"  - 标签文件 (tags.json) 放入用户数据根目录")
            if args.images:
                # 获取笔记本ID（文件名不含扩展名）
                notebook_id = os.path.basename(output_path).replace('.json', '')
                print(f"\n注意: 如果使用了 -i 参数提取图片，请将笔记本JSON文件和同名的图片文件夹一起复制:")
                print(f"  笔记本文件: {os.path.basename(output_path)}")
                print(f"  图片文件夹: {notebook_id}/")
    except Exception as e:
        print(f"转换失败: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == '__main__':
    main()