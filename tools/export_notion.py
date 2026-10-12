#!/usr/bin/env python3
"""One-time export of Saranyaa's public Notion portfolio into assets/ + content.json.

Notion serves public page data from an unauthenticated endpoint and serves public
attachments without signing, so nothing here needs a token. This is a migration
script, not part of the site build -- once assets/ and content.json exist the
site has no dependency on Notion at all.
"""

import json
import os
import re
import subprocess
import sys
import urllib.parse
import urllib.request

SITE = "https://thrilling-kumquat-461.notion.site"
SPACE_ID = "acfa0549-db34-49aa-80f4-ed0337a4758c"

ROOT_PAGE = "1e6fecea-51d3-80aa-b968-fbe839dec799"
SUBPAGES = {
    "morphic": "3dcfecea-51d3-8015-a029-dfdc1e9c6649",
    "headout": "3dcfecea-51d3-8030-9f12-ca6db4d22267",
    "yaas-media": "3dcfecea-51d3-80ad-9dfa-c80a3a9f0cd6",
    "decoding-draupadi": "3dcfecea-51d3-806a-88d0-df47c9c1992f",
}

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ASSETS = os.path.join(HERE, "assets")

ATTACHMENT_TYPES = {"image", "pdf", "file", "video"}

# Names of attachments that could not be downloaded, reported at the end.
FAILED_DOWNLOADS = []


def post(path, payload):
    req = urllib.request.Request(
        SITE + path,
        data=json.dumps(payload).encode(),
        headers={"Content-Type": "application/json", "User-Agent": "Mozilla/5.0"},
    )
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.load(r)


def load_page(page_id):
    """Page chunks are paginated; keep following the cursor until it runs dry."""
    blocks = {}
    cursor = {"stack": []}
    for chunk in range(12):
        data = post(
            "/api/v3/loadPageChunk",
            {
                "pageId": page_id,
                "limit": 200,
                "cursor": cursor,
                "chunkNumber": chunk,
                "verticalColumns": False,
            },
        )
        blocks.update(data["recordMap"].get("block", {}))
        cursor = data.get("cursor") or {"stack": []}
        if not cursor.get("stack"):
            break
    return blocks


def unwrap(record):
    v = record.get("value") or {}
    if isinstance(v, dict) and "value" in v:
        v = v["value"]
    return v


def rich_text(prop):
    """Flatten Notion rich text to HTML, keeping bold/italic/code and links."""
    if not prop:
        return ""
    out = []
    for seg in prop:
        text = seg[0]
        if text == "‣":
            # A link-mention block. Its target lives outside the text property
            # and is not exposed on the public endpoint, so it comes through empty.
            continue
        text = (
            text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
        )
        href = None
        for fmt in seg[1] if len(seg) > 1 else []:
            code = fmt[0]
            if code == "b":
                text = f"<strong>{text}</strong>"
            elif code == "i":
                text = f"<em>{text}</em>"
            elif code == "c":
                text = f"<code>{text}</code>"
            elif code == "a":
                href = fmt[1]
        if href:
            text = f'<a href="{href}" target="_blank" rel="noopener">{text}</a>'
        out.append(text)
    return "".join(out)


def plain_text(html):
    """Strip tags and undo the entity escaping rich_text() applies."""
    text = re.sub(r"<[^>]+>", "", html or "")
    for entity, char in (("&amp;", "&"), ("&lt;", "<"), ("&gt;", ">")):
        text = text.replace(entity, char)
    return text.strip()


def slugify(text, fallback="item"):
    slug = re.sub(r"[^a-z0-9]+", "-", (text or "").lower()).strip("-")
    return slug[:32].strip("-") or fallback


def attachment_url(block_id, source, kind):
    """Images serve from /image/ with a resize param; everything else needs /signed/.
    The /file/ route silently returns Notion's HTML shell instead of the file."""
    encoded = urllib.parse.quote(source, safe="")
    if kind == "image":
        return (
            f"{SITE}/image/{encoded}?table=block&id={block_id}"
            f"&spaceId={SPACE_ID}&width=1600&cache=v2"
        )
    return (
        f"{SITE}/signed/{encoded}?table=block&id={block_id}"
        f"&spaceId={SPACE_ID}&cache=v2"
    )


MAGIC = {
    "image": (b"\x89PNG", b"\xff\xd8\xff", b"GIF8", b"RIFF"),
    "pdf": (b"%PDF",),
}


def download(url, dest, kind):
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=120) as r:
        data = r.read()
    expected = MAGIC.get(kind)
    if expected and not data.startswith(expected):
        # Notion answers some bad requests with a 200 and its HTML app shell.
        raise ValueError(f"expected {kind}, got {data[:16]!r}")
    with open(dest, "wb") as f:
        f.write(data)
    return len(data)


def sips(args):
    return subprocess.run(
        ["sips"] + args, check=False, capture_output=True, text=True
    )


def dimensions(path):
    out = sips(["-g", "pixelWidth", "-g", "pixelHeight", path]).stdout
    nums = [int(n) for n in re.findall(r"pixel(?:Width|Height):\s*(\d+)", out)]
    return max(nums) if nums else 0


def shrink(path):
    """Cap at 1600px and keep the smallest of the original, a resized copy, and a
    JPEG copy. Photos win as JPEG; flat-colour UI screenshots stay smaller in their
    original PNG, and re-encoding those actually inflates them. sips ships with
    macOS so this needs no dependencies."""
    stem, ext = os.path.splitext(path)
    candidates = [path]

    if dimensions(path) > 1600:
        resized = f"{stem}-resized{ext}"
        if sips(["--resampleHeightWidthMax", "1600", path, "--out", resized]).returncode == 0:
            candidates.append(resized)

    source = candidates[-1]
    if ext.lower() not in (".jpg", ".jpeg"):
        as_jpeg = f"{stem}-q80.jpg"
        if sips([
            "--setProperty", "format", "jpeg",
            "--setProperty", "formatOptions", "80",
            source, "--out", as_jpeg,
        ]).returncode == 0:
            candidates.append(as_jpeg)

    candidates = [c for c in candidates if os.path.exists(c)]
    best = min(candidates, key=os.path.getsize)

    # Settle on the canonical name for whichever encoding won.
    final = stem + (".jpg" if best.lower().endswith((".jpg", ".jpeg")) else ext)
    if os.path.abspath(best) != os.path.abspath(final):
        if os.path.exists(final):
            os.remove(final)
        os.rename(best, final)
    for leftover in candidates:
        if os.path.exists(leftover) and os.path.abspath(leftover) != os.path.abspath(final):
            os.remove(leftover)
    return final


def walk(blocks, block_id, page_slug, out, seen, section, counter):
    if block_id in seen:
        return section
    seen.add(block_id)
    record = blocks.get(block_id)
    if not record:
        return section

    value = unwrap(record)
    btype = value.get("type")
    props = value.get("properties") or {}
    title = rich_text(props.get("title"))
    plain = plain_text(title)

    if btype in ("header", "sub_header", "sub_sub_header"):
        section = slugify(plain, section)

    if btype in ATTACHMENT_TYPES:
        source = (props.get("source") or [[""]])[0][0]
        if source.startswith("attachment:"):
            ext = os.path.splitext(source)[1].lower() or ".png"
            original = source.split(":")[-1].lower()
            if "resume" in original:
                base = "saranyaa-resume"
            else:
                base = f"{page_slug}-{section}" if section else page_slug
            counter[base] = counter.get(base, 0) + 1
            suffix = "" if base == "saranyaa-resume" else f"-{counter[base]}"
            name = re.sub(r"-+", "-", f"{base}{suffix}{ext}")
            dest = os.path.join(ASSETS, name)
            url = attachment_url(block_id, source, btype)
            try:
                size = download(url, dest, btype)
                if btype == "image":
                    dest = shrink(dest)
                    name = os.path.basename(dest)
                final = os.path.getsize(dest) // 1024
                print(f"  {name}  {size // 1024} KB -> {final} KB")
            except Exception as exc:  # noqa: BLE001
                print(f"  FAILED {name}: {exc}", file=sys.stderr)
                FAILED_DOWNLOADS.append(name)
                return section
            out.append(
                {
                    "kind": btype,
                    "file": f"assets/{name}",
                    "caption": rich_text(props.get("caption")),
                    "original": source.split(":")[-1],
                    "section": section,
                }
            )
    elif btype == "bookmark":
        out.append(
            {
                "kind": "bookmark",
                "text": plain,
                "link": (props.get("link") or [[""]])[0][0],
                "section": section,
            }
        )
    elif plain or btype in ("divider", "callout"):
        out.append({"kind": btype, "html": title, "text": plain, "section": section})

    for child in value.get("content") or []:
        section = walk(blocks, child, page_slug, out, seen, section, counter)
    return section


def export(page_id, page_slug):
    print(f"fetching {page_slug} ...")
    blocks = load_page(page_id)
    out = []
    walk(blocks, page_id, page_slug, out, set(), "", {})
    print(f"  {len(out)} blocks")
    return out


def main():
    os.makedirs(ASSETS, exist_ok=True)
    content = {"home": export(ROOT_PAGE, "home")}
    for slug, page_id in SUBPAGES.items():
        content[slug] = export(page_id, slug)

    dest = os.path.join(HERE, "content.json")
    with open(dest, "w", encoding="utf-8") as f:
        json.dump(content, f, indent=2, ensure_ascii=False)

    files = sorted(os.listdir(ASSETS))
    total = sum(os.path.getsize(os.path.join(ASSETS, f)) for f in files)
    print(f"\n{len(files)} files in assets/ ({total // 1024} KB)")
    print(f"wrote {dest}")

    # A missing attachment leaves a gap in content.json, so say so loudly
    # rather than finishing as if the export were complete.
    if FAILED_DOWNLOADS:
        print(f"{len(FAILED_DOWNLOADS)} attachment(s) failed: {', '.join(FAILED_DOWNLOADS)}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
