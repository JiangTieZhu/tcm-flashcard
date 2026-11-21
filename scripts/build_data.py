#!/usr/bin/env python3
"""合并分组中药数据，校验字段并输出前端使用的 data/herbs.json。"""
from __future__ import annotations

import json
import re
import sys
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
PARTS = [
    "part-jiebiao.json",
    "part-qingre-a.json",
    "part-qingre-b.json",
    "part-lishui.json",
    "part-wenli.json",
    "part-zhixue.json",
    "part-tanping.json",
    "part-buxu.json",
    "part-shuse.json",
]
FIELDS = [
    "name", "category", "priority", "nature", "effects",
    "indications", "usage", "caution", "points", "trap",
]
PRIORITIES = {"重点", "次重点", "了解"}


def normalize(record: dict, source: str) -> dict:
    clean = {}
    for key in FIELDS:
        value = str(record.get(key, "")).strip()
        if not value:
            raise ValueError(f"{source}: 《{record.get('name', '?')}》缺少字段 {key}")
        if key == "name":
            value = value.replace("紫苏叶", "紫苏")
        if key in {"usage", "indications", "effects", "points"}:
            value = re.sub(r"(?<=\d)-(?=\d)", "~", value).replace("～", "~")
        if key == "priority" and value not in PRIORITIES:
            raise ValueError(f"{source}: {clean.get('name', '?')} 的 priority 非法：{value}")
        clean[key] = value
    return clean


def main() -> int:
    records: list[dict] = []
    for name in PARTS:
        path = DATA / name
        if not path.exists():
            print(f"缺少数据分片：{path}", file=sys.stderr)
            return 1
        try:
            part = json.loads(path.read_text(encoding="utf-8"))
        except json.JSONDecodeError as exc:
            print(f"{name} 不是合法 JSON：{exc}", file=sys.stderr)
            return 1
        if not isinstance(part, list):
            print(f"{name} 顶层必须是数组", file=sys.stderr)
            return 1
        records.extend(normalize(item, name) for item in part)
        print(f"  {name:<24} {len(part):>3} 味")

    duplicates = [name for name, count in Counter(r["name"] for r in records).items() if count > 1]
    if duplicates:
        print(f"发现重复药名：{'、'.join(duplicates)}", file=sys.stderr)
        return 1

    priorities = Counter(r["priority"] for r in records)

    categories: list[str] = []
    for record in records:
        if record["category"] not in categories:
            categories.append(record["category"])

    output = DATA / "herbs.json"
    output.write_text(
        json.dumps(records, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(f"\n已写入 {output.relative_to(ROOT)}")
    print(f"共 {len(records)} 味，{len(categories)} 个分类")
    print("优先级：" + "，".join(f"{k} {priorities[k]}" for k in ["重点", "次重点", "了解"]))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
