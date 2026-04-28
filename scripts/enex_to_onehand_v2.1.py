#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
印象笔记 ENEX 格式转换工具 V2
将 Evernote 导出的 .enex 文件转换为 OneHand 新版用户数据格式

使用方法:
    python enex_to_onehand_v2.py <input.enex> [output_dir] [options]
    python enex_to_onehand_v2.py <input_folder> [output_dir] -r [options]

参数:
    input.enex    - 印象笔记导出的 enex 文件路径
    input_folder  - 包含 enex 文件的文件夹路径（需配合 -r 使用）
    output_dir    - 输出目录，默认为当前目录下的 onehand_notebooks

选项:
    -i, --images    提取图片到单独的images文件夹，并转换为markdown图片引用
    -r, --recursive 递归处理文件夹中的所有 enex 文件

示例:
    python enex_to_onehand_v2.py my_notes.enex
    python enex_to_onehand_v2.py my_notes.enex ./output
    python enex_to_onehand_v2.py my_notes.enex ./output -i
    python enex_to_onehand_v2.py ./enex_folder -r
    python enex_to_onehand_v2.py ./enex_folder ./output -r -i

数据格式变化 (V2):
    - 笔记本结构: nodes 数组直接在笔记本下，不再使用 canvases 结构
    - 节点字段: 移除 position 和 selectedAsContext（运行时字段）
"""

import xml.etree.ElementTree as ET
import json
import os
import sys
import re
import base64
import hashlib
import uuid
import argparse
from datetime import datetime
from html.parser import HTMLParser
from typing import List, Dict, Optional, Tuple
from pathlib import Path


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
        self.div_has_content = False  # 跟踪当前 div 是否有实际文本内容
        self.div_depth = 0  # 跟踪 div 嵌套层级

    def handle_starttag(self, tag: str, attrs: List[Tuple[str, str]]):
        if tag in self.ignore_tags:
            self.current_ignore = True
            return

        attrs_dict = dict(attrs)

        # 检查是否是代码块 (印象笔记用 style="-en-codeblock: true" 标记)
        if tag == 'div':
            self.div_depth += 1
            self.div_has_content = False  # 重置内容标记
            style = attrs_dict.get('style', '')
            if '-en-codeblock' in style and 'true' in style:
                self.in_codeblock = True
                self.codeblock_lines = []
                return
            # div 开始时不添加任何内容

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
            self.div_depth -= 1
            return

        # div 结束时只在有实际内容时添加换行
        if tag == 'div':
            self.div_depth -= 1
            if self.div_has_content and not self.in_list_item:
                self.result.append('\n')
            self.div_has_content = False

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

        # 检查是否有实际文本内容（非空白）
        stripped = data.strip()
        if stripped:
            self.div_has_content = True

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


class WebClipProcessor:
    """专门处理剪藏网页内容的处理器"""

    def __init__(self):
        self.ignore_style_patterns = [
            # 剪藏相关的 CSS 变量
            r'--en-clipped[^:]*:[^;]+;?',
            # 布局相关的样式
            r'min-height:\s*\d+px;?',
            r'min-width:\s*[^;]+;?',
            r'position:\s*[^;]+;?',
            r'display:\s*[^;]+;?',
            # WebKit 相关样式
            r'-webkit-[^:]+:[^;]+;?',
            r'appearance:[^;]+;?',
            r'outline:[^;]+;?',
            r'transition:[^;]+;?',
            r'user-select:[^;]+;?',
            r'text-size-adjust:[^;]+;?',
            r'tap-highlight-color:[^;]+;?',
            # 其他噪音样式
            r'box-sizing:[^;]+;?',
            r'overflow-wrap:[^;]+;?',
            r'hyphens:[^;]+;?',
            r'text-decoration-skip-ink:[^;]+;?',
            r'text-underline-offset:[^;]+;?',
            r'text-underline-position:[^;]+;?',
            r'letter-spacing:[^;]+;?',
            r'white-space:[^;]+;?',
            r'text-overflow:[^;]+;?',
        ]

    def clean_style(self, style: str) -> str:
        """清理内联样式，只保留有用的样式"""
        if not style:
            return ''

        cleaned = style
        for pattern in self.ignore_style_patterns:
            cleaned = re.sub(pattern, '', cleaned, flags=re.IGNORECASE)

        # 清理多余的分号和空格
        cleaned = re.sub(r';\s*;', ';', cleaned)
        cleaned = re.sub(r'^\s*;\s*', '', cleaned)
        cleaned = cleaned.strip()

        return cleaned

    def extract_source_info(self, html: str) -> Tuple[str, str]:
        """从剪藏 HTML 中提取来源信息"""
        source_url = ''
        source_title = ''

        # 查找剪藏标记的 style
        match = re.search(r'--en-clipped-source-url:\s*([^;]+)', html)
        if match:
            source_url = match.group(1).strip()
            # 清理 URL 编码
            source_url = source_url.replace('&amp;', '&')

        match = re.search(r'--en-clipped-source-title:\s*([^;]+)', html)
        if match:
            source_title = match.group(1).strip()

        return source_url, source_title

    def simplify_html(self, html: str) -> str:
        """简化剪藏 HTML 结构"""
        # 移除 CDATA 标记
        html = re.sub(r'<!\[CDATA\[|\]\]>', '', html)

        # 移除 XML 声明和 DOCTYPE
        html = re.sub(r'<\?xml[^>]*\?>', '', html)
        html = re.sub(r'<!DOCTYPE[^>]*>', '', html)

        # 移除 en-note 标签，保留内容
        html = re.sub(r'<en-note[^>]*>|</en-note>', '', html)

        # 处理剪藏外层容器 div
        # 移除带有剪藏标记的 div 标签，保留内容
        html = re.sub(r'<div\s+style="--en-clipped[^>]*>', '<div>', html)

        # 清理所有 div 的内联样式（剪藏网页样式太多）
        # 直接移除所有 div 的样式，只保留结构
        html = re.sub(r'<div[^>]*>', '<div>', html)

        # 移除空的 div 标签和只包含空白/br 的 div
        html = re.sub(r'<div>\s*</div>', '', html)
        html = re.sub(r'<div>\s*<br\s*/?>\s*</div>', '', html)

        # 移除所有 span 标签，只保留内容（span 在剪藏中主要是样式）
        html = re.sub(r'<span[^>]*>', '', html)
        html = re.sub(r'</span>', '', html)

        # 处理 a 标签：移除无效链接（href="#"）
        html = re.sub(r'<a\s+href="#"[^>]*>([^<]*)</a>', r'\1', html)

        # 移除 em 标签，只保留内容（em 在剪藏中主要用于布局而非斜体）
        html = re.sub(r'<em[^>]*>', '', html)
        re.sub(r'</em>', '', html)

        # 处理 br 标签：转换为换行
        html = re.sub(r'<br\s*/?>', '\n', html)

        # 处理 en-todo 标签（checkbox）
        html = re.sub(r'<en-todo\s+checked="true"\s*/>', '- [x] ', html)
        html = re.sub(r'<en-todo\s+checked="false"\s*/>', '- [ ] ', html)
        html = re.sub(r'<en-todo\s*/>', '- [ ] ', html)

        # 清理标签内的空白字符（如 h1 内的前导空白）
        html = re.sub(r'>(\s{2,})', '>', html)  # 标签开始后的空白
        html = re.sub(r'(\s{2,})<', '<', html)  # 标签前的空白

        # 移除只包含空白的内容
        html = re.sub(r'>\s+</', '><', html)

        return html

    def process(self, html: str, source_url: str = None, source_title: str = None,
                resources: List[Dict] = None, images_dir: str = None,
                notebook_id: str = None, image_counter: List[int] = None) -> str:
        """
        处理剪藏网页内容，生成 Markdown

        Args:
            html: 剪藏 HTML 内容
            source_url: 来源 URL（从 note-attributes 获取）
            source_title: 来源标题
            resources: 资源列表（图片等）
            images_dir: 图片保存目录
            notebook_id: 笔记本 ID
            image_counter: 图片计数器

        Returns:
            处理后的 Markdown 内容
        """
        if not html:
            return ''

        # 尝试从 HTML 中提取来源信息（如果没有提供）
        if not source_url:
            extracted_url, extracted_title = self.extract_source_info(html)
            source_url = extracted_url
            if not source_title:
                source_title = extracted_title

        # 简化 HTML 结构
        simplified_html = self.simplify_html(html)

        # 处理图片（如果有资源和图片目录）
        if resources and images_dir and notebook_id:
            simplified_html, _ = process_images_in_content(
                simplified_html, resources, images_dir, notebook_id, image_counter
            )

        # 转换为 Markdown
        markdown = html_to_markdown(simplified_html)

        # 深度清理多余空行和空白
        markdown = re.sub(r'\n{3,}', '\n\n', markdown)  # 多个换行合并为两个
        markdown = re.sub(r'[ \t]+\n', '\n', markdown)  # 行尾空白
        markdown = re.sub(r'\n[ \t]+', '\n', markdown)  # 行首空白
        markdown = re.sub(r'\n{2,}', '\n\n', markdown)  # 再次合并多余换行
        markdown = markdown.strip()

        # 添加来源链接在开头
        if source_url:
            if source_title:
                source_line = f"> 来源：[{source_title}]({source_url})"
            else:
                source_line = f"> 来源：[原文链接]({source_url})"
            markdown = source_line + '\n\n' + markdown

        return markdown


def process_webclip_content(html: str, source_url: str = None, resources: List[Dict] = None,
                             images_dir: str = None, notebook_id: str = None,
                             image_counter: List[int] = None) -> str:
    """处理剪藏网页内容的便捷函数"""
    processor = WebClipProcessor()
    return processor.process(html, source_url, None, resources, images_dir, notebook_id, image_counter)


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
    """生成唯一ID（UUID格式）"""
    return str(uuid.uuid4())


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
            now = int(datetime.now().timestamp() * 1000)
            filename = f"img-{now}-{image_counter[0]}.{ext}"
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

    # 替换 en-media 标签（支持自闭合和闭合两种形式）
    content = re.sub(r'<en-media[^>]*/?>(?:</en-media>)?', replace_en_media, content)

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
            now = int(datetime.now().timestamp() * 1000)
            filename = f"img-{now}-{image_counter[0]}.{ext}"
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

        # 笔记属性（检测剪藏笔记）
        note_attrs = note.find('note-attributes')
        note_data['is_webclip'] = False
        note_data['source_url'] = None

        if note_attrs is not None:
            # 检测剪藏笔记（source 字段包含 "clip"）
            source_elem = note_attrs.find('source')
            if source_elem is not None and source_elem.text and 'clip' in source_elem.text.lower():
                note_data['is_webclip'] = True

            # 提取来源 URL
            source_url_elem = note_attrs.find('source-url')
            if source_url_elem is not None and source_url_elem.text:
                note_data['source_url'] = source_url_elem.text

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


def create_node_from_note(note: Dict, extract_images: bool = False, images_dir: str = None, notebook_id: str = None, image_counter: List[int] = None) -> Dict:
    """
    从笔记创建节点（V2格式）

    V2格式节点字段变化：
    - 移除 position 字段（画布位置由运行时布局计算）
    - 移除 selectedAsContext 字段（运行时状态，不保存）
    """
    node_id = generate_id()

    # 处理内容：根据笔记类型选择处理方式
    content = ''

    if note.get('is_webclip') and note.get('raw_content'):
        # 剪藏笔记：使用专门的剪藏处理器
        if extract_images:
            content = process_webclip_content(
                note['raw_content'],
                note.get('source_url'),
                note.get('resources'),
                images_dir,
                notebook_id,
                image_counter
            )
        else:
            content = process_webclip_content(
                note['raw_content'],
                note.get('source_url')
            )
        print(f"  笔记 '{note['title'][:30]}...' 是剪藏网页，已优化处理")
    elif extract_images and note.get('raw_content') and note.get('resources'):
        # 普通笔记：提取图片
        content, saved_images = process_images_in_content(
            note['raw_content'],
            note['resources'],
            images_dir,
            notebook_id,
            image_counter
        )
        if saved_images:
            print(f"  笔记 '{note['title'][:30]}...' 提取了 {len(saved_images)} 张图片")
    else:
        # 普通笔记：标准处理
        if note.get('raw_content'):
            content = extract_text_content(note['raw_content'])
        else:
            content = note['content']

    # V2格式节点
    node = {
        'id': node_id,
        'type': 'text-note',
        'title': note['title'][:100] if len(note['title']) > 100 else note['title'],
        'transcript': content,
        'transcriptStatus': 'done',  # 直接设为完成状态
        'agentResult': None,
        'agentStatus': 'pending',
        'isFavorite': False,
        'createdAt': note['created']
    }

    # 添加标签到节点的 tags 字段
    if note['tags']:
        node['tags'] = note['tags']

    return node


def create_onehand_notebook_v2(notes: List[Dict], notebook_name: str, extract_images: bool = False, output_dir: str = None, notebook_id: str = None) -> Dict:
    """
    创建 OneHand 笔记本格式 (V2)

    V2格式变化：
    - nodes 数组直接在笔记本下，不再使用 canvases 结构
    - 移除 currentCanvasIndex

    Args:
        notes: 笔记列表
        notebook_name: 笔记本名称
        extract_images: 是否提取图片到单独文件夹
        output_dir: 输出目录（用于创建图片文件夹）
        notebook_id: 笔记本ID（用于创建图片文件夹名称）
    """
    now = int(datetime.now().timestamp() * 1000)
    if notebook_id is None:
        notebook_id = str(now)

    # 如果需要提取图片，创建 images 目录
    images_dir = None
    if extract_images and output_dir and notebook_id:
        images_dir = os.path.join(output_dir, notebook_id, 'images')
        os.makedirs(images_dir, exist_ok=True)

    # 全局图片计数器，确保所有笔记的图片名唯一
    image_counter = [0]

    # 创建节点（所有节点在同一数组中）
    nodes = []
    for note in notes:
        node = create_node_from_note(
            note,
            extract_images=extract_images,
            images_dir=images_dir,
            notebook_id=notebook_id,
            image_counter=image_counter
        )
        nodes.append(node)

    # 按创建时间排序节点
    nodes.sort(key=lambda n: n['createdAt'])

    # 创建笔记本 (V2格式)
    notebook = {
        'id': notebook_id,
        'name': notebook_name,
        'createdAt': now,
        'updatedAt': now,
        'nodes': nodes
    }

    return notebook


def convert_enex_to_onehand(enex_path: str, output_dir: str, extract_images: bool = False) -> List[str]:
    """
    将 ENEX 文件转换为 OneHand 格式 (V2)
    返回输出的笔记本文件路径列表
    """
    # 解析 ENEX
    print(f"正在解析: {enex_path}")
    notes = parse_enex(enex_path)
    print(f"找到 {len(notes)} 条笔记")

    if not notes:
        print("没有找到任何笔记")
        return []

    # 生成笔记本名称
    enex_name = Path(enex_path).stem
    base_name = f"{enex_name}"

    # 收集所有标签并生成标签定义
    tags_dict = collect_all_tags(notes)
    tag_count = len(tags_dict)
    if tag_count > 0:
        print(f"发现 {tag_count} 个标签")

    # 确保输出目录存在
    os.makedirs(output_dir, exist_ok=True)

    output_paths = []

    # 创建单个笔记本
    notebook_id = str(int(datetime.now().timestamp() * 1000))
    notebook = create_onehand_notebook_v2(
        notes, base_name,
        extract_images=extract_images,
        output_dir=output_dir,
        notebook_id=notebook_id
    )

    output_path = os.path.join(output_dir, f"{notebook['id']}.json")
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(notebook, f, ensure_ascii=False, indent=2)
    output_paths.append(output_path)

    print(f"已创建笔记本: {output_path}")
    print(f"笔记本名称: {base_name}")
    print(f"包含 {len(notes)} 条笔记")

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

    if extract_images:
        # 统计提取的图片总数
        total_images = 0
        for notebook_id in [os.path.basename(p).replace('.json', '') for p in output_paths]:
            images_dir = os.path.join(output_dir, notebook_id, 'images')
            if os.path.exists(images_dir):
                image_count = len([f for f in os.listdir(images_dir) if os.path.isfile(os.path.join(images_dir, f))])
                total_images += image_count
                print(f"  笔记本 {notebook_id}: 提取了 {image_count} 张图片")
        print(f"总共提取了 {total_images} 张图片")

    return output_paths


def main():
    parser = argparse.ArgumentParser(
        description='印象笔记 ENEX 格式转换工具 V2（适配新版笔记本格式）',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例:
    python enex_to_onehand_v2.py my_notes.enex
    python enex_to_onehand_v2.py my_notes.enex ./output
    python enex_to_onehand_v2.py my_notes.enex ./output -i
    python enex_to_onehand_v2.py ./enex_folder -r
    python enex_to_onehand_v2.py ./enex_folder ./output -r -i

V2格式变化:
    - 笔记本结构: nodes 数组直接在笔记本下，不再使用 canvases 结构
    - 节点字段: 移除 position（画布位置）和 selectedAsContext（运行时状态）
        """
    )
    parser.add_argument('input', help='印象笔记导出的 enex 文件路径或包含 enex 文件的文件夹路径')
    parser.add_argument('output', nargs='?', default='./onehand_notebooks',
                        help='输出目录，默认为 ./onehand_notebooks')
    parser.add_argument('-i', '--images', action='store_true',
                        help='提取图片到单独的images文件夹，并转换为markdown图片引用')
    parser.add_argument('-r', '--recursive', action='store_true',
                        help='递归处理文件夹中的所有 enex 文件')

    args = parser.parse_args()

    # 检查输入路径是否存在
    if not os.path.exists(args.input):
        print(f"错误: 文件/文件夹不存在: {args.input}")
        sys.exit(1)

    # 收集所有需要处理的 enex 文件
    enex_files = []
    if os.path.isfile(args.input):
        if args.input.lower().endswith('.enex'):
            enex_files.append(args.input)
        else:
            print(f"错误: 输入文件不是 .enex 文件: {args.input}")
            sys.exit(1)
    elif os.path.isdir(args.input):
        # 处理文件夹
        if args.recursive:
            # 递归查找所有 enex 文件
            for root, dirs, files in os.walk(args.input):
                for file in sorted(files):
                    if file.lower().endswith('.enex'):
                        enex_files.append(os.path.join(root, file))
        else:
            # 只处理当前目录下的 enex 文件
            for file in sorted(os.listdir(args.input)):
                file_path = os.path.join(args.input, file)
                if os.path.isfile(file_path) and file.lower().endswith('.enex'):
                    enex_files.append(file_path)

        if not enex_files:
            print(f"错误: 文件夹中没有找到 .enex 文件: {args.input}")
            sys.exit(1)

        print(f"在文件夹 {args.input} 中找到 {len(enex_files)} 个 enex 文件")

    # 执行转换
    total_success = 0
    total_failed = 0

    for enex_path in enex_files:
        print(f"\n{'='*60}")
        print(f"正在处理: {os.path.basename(enex_path)}")
        print(f"{'='*60}")

        try:
            output_paths = convert_enex_to_onehand(
                enex_path, args.output,
                extract_images=args.images
            )
            if output_paths:
                total_success += 1
                print(f"\n✓ 转换成功: {os.path.basename(enex_path)}")
                for output_path in output_paths:
                    notebook_id = os.path.basename(output_path).replace('.json', '')
                    print(f"  笔记本文件: {os.path.basename(output_path)}")
                    if args.images:
                        print(f"  图片文件夹: {notebook_id}/images/")
        except Exception as e:
            total_failed += 1
            print(f"\n✗ 转换失败: {os.path.basename(enex_path)}")
            print(f"  错误: {e}")
            import traceback
            traceback.print_exc()

    # 打印总结
    print(f"\n{'='*60}")
    print(f"批量转换完成!")
    print(f"成功: {total_success} 个, 失败: {total_failed} 个")
    print(f"{'='*60}")

    if total_success > 0:
        print(f"\n请将生成的文件复制到 OneHand 用户数据目录:")
        print(f"  Windows: %APPDATA%\\OneHand\\notebooks\\")
        print(f"  macOS: ~/Library/Application Support/OneHand/notebooks/")
        print(f"\n文件说明:")
        print(f"  - 笔记本文件 (*.json) 放入 notebooks/ 目录")
        print(f"  - 标签文件 (tags.json) 放入用户数据根目录")
        if args.images:
            print(f"\n注意: 如果使用了 -i 参数提取图片，请将笔记本JSON文件和同名的文件夹一起复制到 notebooks/ 目录")
        print(f"\nV2格式说明:")
        print(f"  - 笔记本文件中的 nodes 数组直接包含所有笔记节点")
        print(f"  - 不再使用 canvases 结构")

    if total_failed > 0:
        sys.exit(1)


if __name__ == '__main__':
    main()