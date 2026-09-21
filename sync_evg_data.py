#!/usr/bin/env python3
"""本地同步 EVG Data 公共契约。

源文件：
    evg-editor/src/shared/evgData.ts

同步目标：
    evg-runtime/src/evg/evg-data.ts（runtime 源码的一部分，
    不进官方 @avg-studio/sdk 副本——sdk 目录只读，脚本绝不写入）

用法：
    python sync_evg_data.py
    python sync_evg_data.py --check
    python sync_evg_data.py --target path/to/evg-data.ts

这个脚本放在工作目录根部，不进入 evg-editor 发布内容。
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path


def configure_stdio() -> None:
    """避免 Windows 控制台把 UTF-8 中文输出按 GBK 误解。"""
    for stream in (sys.stdout, sys.stderr):
        reconfigure = getattr(stream, "reconfigure", None)
        if reconfigure is not None:
            reconfigure(encoding="utf-8")


configure_stdio()

WORKSPACE_ROOT = Path(__file__).resolve().parent
SOURCE_PATH = WORKSPACE_ROOT / "evg-editor" / "src" / "shared" / "evgData.ts"
DEFAULT_TARGET_PATH = (
    WORKSPACE_ROOT / "evg-runtime" / "src" / "evg" / "evg-data.ts"
)


def display(path: Path) -> str:
    try:
        return str(path.relative_to(WORKSPACE_ROOT))
    except ValueError:
        return str(path)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="把 evg-editor 的 EVG Data 公共契约同步到 evg-runtime。"
    )
    parser.add_argument(
        "--check",
        action="store_true",
        help="只检查目标是否与源文件一致，不写入。",
    )
    parser.add_argument(
        "--target",
        type=Path,
        default=DEFAULT_TARGET_PATH,
        help=f"目标 TS 文件路径，默认 {display(DEFAULT_TARGET_PATH)}",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()

    if not SOURCE_PATH.is_file():
        print(f"[sync-evg-data] 找不到源文件：{display(SOURCE_PATH)}")
        return 1

    target_path = args.target
    if not target_path.is_absolute():
        target_path = (Path.cwd() / target_path).resolve()

    source_text = SOURCE_PATH.read_text(encoding="utf-8")
    target_text = (
        target_path.read_text(encoding="utf-8") if target_path.is_file() else None
    )

    if target_text == source_text:
        print(f"[sync-evg-data] 已是最新：{display(target_path)}")
        return 0

    if args.check:
        print(f"[sync-evg-data] 契约不一致：{display(target_path)}")
        print("运行 python sync_evg_data.py 进行同步。")
        return 1

    target_path.parent.mkdir(parents=True, exist_ok=True)
    target_path.write_text(source_text, encoding="utf-8", newline="")
    print(f"[sync-evg-data] 已同步：{display(target_path)}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
