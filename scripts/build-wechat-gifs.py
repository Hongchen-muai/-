"""Compose article GIFs from real browser screenshots and capture metadata."""
import argparse
import json
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

parser = argparse.ArgumentParser()
parser.add_argument("input", type=Path)
parser.add_argument("output", type=Path)
parser.add_argument("--font", default="/System/Library/Fonts/STHeiti Medium.ttc")
args = parser.parse_args()
args.output.mkdir(parents=True, exist_ok=True)
font = ImageFont.truetype(args.font, 24)
small = ImageFont.truetype(args.font, 20)
titles = {
    "01-projection-process": "从球面到平面：圆柱等面积投影",
    "02-linked-parameters": "调节标准纬线，观察双视图联动",
    "03-equal-earth": "平等地球：保持面积，不保持形状",
}

def crop(image, rect, top=0):
    x, y, w, h = (rect[k] for k in ("x", "y", "width", "height"))
    return image.crop((round(x), round(y + top), round(x + w), round(y + h)))

for name, title in titles.items():
    directory = args.input / name
    metadata = json.loads((directory / "frames.json").read_text())
    frames, durations = [], []
    records = metadata["frames"]
    for i, record in enumerate(records):
        screenshot = Image.open(directory / record["file"]).convert("RGB")
        scene = crop(screenshot, metadata["rects"]["scene"])
        paired = name != "01-projection-process"
        if paired:
            map_image = crop(screenshot, metadata["rects"]["map"], 64)
            width = scene.width + map_image.width + 16
            height = max(scene.height, map_image.height)
            content = Image.new("RGB", (width, height), "#f7f9f8")
            content.paste(scene, (0, (height - scene.height) // 2))
            content.paste(map_image, (scene.width + 16, (height - map_image.height) // 2))
        else:
            content = scene
        width = 1000 if paired else 640
        height = round(content.height * width / content.width)
        content = content.resize((width, height), Image.Resampling.LANCZOS)
        image = Image.new("RGB", (width, height + 114), "#ffffff")
        draw = ImageDraw.Draw(image)
        draw.rectangle((0, 0, width, 4), fill="#3c5b4c")
        draw.text((18, 14), title, font=font, fill="#333333")
        if paired:
            draw.text((18, 47), "三维空间", font=small, fill="#416f8b")
            draw.text((width // 2 + 15, 47), "二维地图", font=small, fill="#3c5b4c")
        image.paste(content, (0, 76))
        stages = ["球面坐标与数学平面", "等面积数学映射", "平面结果"] if name == "03-equal-earth" else ["球面与辅助面", "投影映射", "平面结果"]
        caption = record.get("caption") or record.get("phase") or stages[record["step"]]
        draw.text((18, height + 83), caption, font=small, fill="#555555")
        frames.append(image)
        duration = records[i + 1]["at"] - record["at"] if i + 1 < len(records) else 1100
        durations.append(max(30, round(duration / 10) * 10))
    # A shared palette avoids color flicker between frames.
    samples = frames[::max(1, len(frames) // 12)]
    mosaic = Image.new("RGB", (240 * len(samples), 180))
    for i, frame in enumerate(samples):
        mosaic.paste(frame.resize((240, 180)), (240 * i, 0))
    palette = mosaic.quantize(colors=192, method=Image.Quantize.MEDIANCUT)
    indexed = [f.quantize(palette=palette, dither=Image.Dither.NONE) for f in frames]
    output = args.output / f"{name}.gif"
    indexed[0].save(output, save_all=True, append_images=indexed[1:], duration=durations, loop=0, optimize=True, disposal=2)
    with Image.open(output) as gif:
        assert gif.n_frames > 10
        print(f"{output.name}: {gif.n_frames} frames, {gif.size}, {output.stat().st_size / 1024 / 1024:.2f} MiB")
    preview = Image.new("RGB", (frames[0].width * 3, frames[0].height))
    for j, index in enumerate([0, len(frames) // 2, len(frames) - 1]):
        preview.paste(frames[index], (j * frames[0].width, 0))
    preview.save(directory / "preview.png")
