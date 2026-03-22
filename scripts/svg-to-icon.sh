#!/bin/bash

# SVG to ICO/ICNS Converter
# 将 SVG 图标转换为 macOS (.icns) 和 Windows (.ico) 图标格式
#
# 用法: ./svg-to-icon.sh <input.svg> [output_dir]
#
# 参数:
#   input.svg  - 输入的 SVG 文件路径
#   output_dir - 可选，输出目录（默认为输入文件所在目录）
#
# 输出:
#   icon.svg   - 复制的 SVG 源文件
#   icon.icns  - macOS 图标
#   icon.ico   - Windows 图标
#
# 依赖:
#   - qlmanage (macOS 系统自带)
#   - ImageMagick (magick 命令)
#   - iconutil (macOS 系统自带)

set -e

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 检查参数
if [ $# -lt 1 ]; then
    echo "用法: $0 <input.svg> [output_dir]"
    echo ""
    echo "示例:"
    echo "  $0 build/icon.svg"
    echo "  $0 build/icon.svg build/"
    exit 1
fi

INPUT_SVG="$1"
OUTPUT_DIR="${2:-$(dirname "$INPUT_SVG")}"

# 检查输入文件
if [ ! -f "$INPUT_SVG" ]; then
    log_error "输入文件不存在: $INPUT_SVG"
    exit 1
fi

# 检查依赖
check_dependencies() {
    local missing=0
    
    if ! command -v qlmanage &> /dev/null; then
        log_error "缺少 qlmanage (macOS 系统自带)"
        missing=1
    fi
    
    if ! command -v magick &> /dev/null; then
        log_error "缺少 ImageMagick，请安装: brew install imagemagick"
        missing=1
    fi
    
    if ! command -v iconutil &> /dev/null; then
        log_error "缺少 iconutil (macOS 系统自带)"
        missing=1
    fi
    
    if [ $missing -eq 1 ]; then
        exit 1
    fi
}

check_dependencies

# 创建临时目录
TEMP_DIR=$(mktemp -d)
trap "rm -rf $TEMP_DIR" EXIT

log_info "输入文件: $INPUT_SVG"
log_info "输出目录: $OUTPUT_DIR"

# 从 SVG 获取圆角半径（默认 108/512 ≈ 21%）
CORNER_RADIUS_RATIO=0.2109375  # 108/512

# 步骤 1: 使用 qlmanage 渲染 SVG（保留颜色）
log_info "渲染 SVG..."
cd "$TEMP_DIR"
qlmanage -t -s 1024 -o . "$INPUT_SVG" > /dev/null 2>&1

# 查找生成的 PNG 文件
GENERATED_PNG=$(ls *.png 2>/dev/null | head -1)
if [ -z "$GENERATED_PNG" ]; then
    log_error "qlmanage 未能生成 PNG 文件"
    exit 1
fi

mv "$GENERATED_PNG" icon_raw.png

# 步骤 2: 创建圆角蒙版并应用
log_info "应用圆角透明蒙版..."
SIZE=1024
CORNER=$(echo "$SIZE * $CORNER_RADIUS_RATIO" | bc | cut -d. -f1)

# 创建圆角矩形蒙版
magick -size ${SIZE}x${SIZE} xc:none \
    -fill white \
    -draw "roundrectangle 0,0 $((SIZE-1)),$((SIZE-1)) $CORNER,$CORNER" \
    mask.png

# 应用蒙版
magick icon_raw.png mask.png -compose DstIn -composite icon_1024.png

# 步骤 3: 生成 ICNS
log_info "生成 ICNS..."
mkdir -p icon.iconset

# macOS 图标所需尺寸
magick icon_1024.png -resize 16x16     icon.iconset/icon_16x16.png
magick icon_1024.png -resize 32x32     icon.iconset/icon_16x16@2x.png
magick icon_1024.png -resize 32x32     icon.iconset/icon_32x32.png
magick icon_1024.png -resize 64x64     icon.iconset/icon_32x32@2x.png
magick icon_1024.png -resize 128x128   icon.iconset/icon_128x128.png
magick icon_1024.png -resize 256x256   icon.iconset/icon_128x128@2x.png
magick icon_1024.png -resize 256x256   icon.iconset/icon_256x256.png
magick icon_1024.png -resize 512x512   icon.iconset/icon_256x256@2x.png
magick icon_1024.png -resize 512x512   icon.iconset/icon_512x512.png
magick icon_1024.png -resize 1024x1024 icon.iconset/icon_512x512@2x.png

iconutil -c icns icon.iconset -o icon.icns

# 步骤 4: 生成 ICO
log_info "生成 ICO..."

# Windows 图标所需尺寸
magick icon_1024.png -resize 256x256 icon_256.png
magick icon_1024.png -resize 128x128 icon_128.png
magick icon_1024.png -resize 64x64   icon_64.png
magick icon_1024.png -resize 48x48   icon_48.png
magick icon_1024.png -resize 32x32   icon_32.png
magick icon_1024.png -resize 16x16   icon_16.png

magick icon_256.png icon_128.png icon_64.png icon_48.png icon_32.png icon_16.png icon.ico

# 步骤 5: 复制到输出目录
log_info "复制文件到输出目录..."
mkdir -p "$OUTPUT_DIR"

cp "$INPUT_SVG" "$OUTPUT_DIR/icon.svg"
cp icon.icns "$OUTPUT_DIR/icon.icns"
cp icon.ico "$OUTPUT_DIR/icon.ico"

# 验证结果
log_info "验证图标..."
ICO_COLORSPACE=$(magick "$OUTPUT_DIR/icon.ico[0]" -format "%[colorspace]" info:)
ICO_ALPHA=$(magick "$OUTPUT_DIR/icon.ico[0]" -crop 10x10+0+0 -format "%[fx:mean.a]" info:)

log_info "ICO 颜色空间: $ICO_COLORSPACE"
log_info "ICO 圆角透明度: $ICO_ALPHA (0=透明, 1=不透明)"

if [ "$ICO_COLORSPACE" = "sRGB" ] && [ "$(echo "$ICO_ALPHA < 0.1" | bc)" = "1" ]; then
    log_info "✓ 图标生成成功！"
else
    log_warn "图标可能存在问题，请检查"
fi

# 输出文件信息
echo ""
log_info "输出文件:"
ls -lh "$OUTPUT_DIR"/icon.*

echo ""
log_info "完成！"