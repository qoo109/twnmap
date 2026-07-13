#!/usr/bin/env python3
"""Download and parse the official CEC historical election archive.

The archive is the Central Election Commission's votedata.zip.  It contains
Big5-encoded CSV files and, in older releases, Big5-encoded ZIP filenames.
Only candidate-level aggregate rows are imported; polling-station rows are
never copied into the website data file.
"""
from __future__ import annotations

import argparse
import csv
import hashlib
import io
import json
import os
import re
import shutil
import sys
import tempfile
import time
import urllib.parse
import urllib.request
import zipfile
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

OFFICIAL_URL = "https://data.cec.gov.tw/選舉資料庫/votedata.zip"
SOURCE_PAGE = "https://data.gov.tw/dataset/13119"

COUNTIES = {
    "臺北市": "taipei", "台北市": "taipei", "新北市": "new-taipei", "基隆市": "keelung",
    "桃園市": "taoyuan", "新竹市": "hsinchu-city", "新竹縣": "hsinchu-county",
    "苗栗縣": "miaoli", "臺中市": "taichung", "台中市": "taichung", "彰化縣": "changhua",
    "南投縣": "nantou", "雲林縣": "yunlin", "嘉義市": "chiayi-city", "嘉義縣": "chiayi-county",
    "臺南市": "tainan", "台南市": "tainan", "高雄市": "kaohsiung", "屏東縣": "pingtung",
    "宜蘭縣": "yilan", "花蓮縣": "hualien", "臺東縣": "taitung", "台東縣": "taitung",
    "澎湖縣": "penghu", "金門縣": "kinmen", "連江縣": "lienchiang",
}

PARTY_ALIASES = {
    "民主進步黨": "dpp", "民進黨": "dpp",
    "中國國民黨": "kmt", "國民黨": "kmt",
    "台灣民眾黨": "tpp", "臺灣民眾黨": "tpp", "民眾黨": "tpp",
    "時代力量": "npp", "台灣基進": "tsp", "臺灣基進": "tsp",
    "親民黨": "pfp", "無黨團結聯盟": "npsu", "台灣團結聯盟": "tsu", "臺灣團結聯盟": "tsu",
    "新黨": "new-party", "台灣綠黨": "green", "臺灣綠黨": "green", "綠黨": "green",
    "社會民主黨": "sdp", "無黨籍及未經政黨推薦": "ind", "無黨籍": "ind", "未經政黨推薦": "ind",
}

# More specific patterns must appear first.
ROLE_RULES = [
    ("indigenous-district-representative", "原住民區民代表", ["山地原住民區民代表", "原住民區民代表", "原住民區代表"]),
    ("indigenous-district-mayor", "原住民區長", ["山地原住民區長", "原住民區長"]),
    ("township-representative", "鄉鎮市民代表", ["鄉鎮市民代表", "鄉鎮市區民代表", "鄉鎮市代表"]),
    ("township-mayor", "鄉鎮市長", ["鄉鎮市長"]),
    ("municipal-councilor", "直轄市議員", ["直轄市議員"]),
    ("county-councilor", "縣市議員", ["縣市議員", "縣(市)議員", "縣市議會議員"]),
    ("municipal-mayor", "直轄市長", ["直轄市長"]),
    ("county-mayor", "縣市長", ["縣市長", "縣(市)長"]),
    ("village-chief", "村里長", ["村里長", "村(里)長", "里長", "村長"]),
    ("legislator", "立法委員", ["立法委員", "區域立委", "不分區立委", "立委"]),
    ("president", "總統副總統", ["總統副總統", "總統、副總統", "總統"]),
]

SCOPE_ROLES = {
    "core": {"president", "vice-president", "legislator", "municipal-mayor", "county-mayor", "municipal-councilor", "county-councilor"},
    "local": {"president", "vice-president", "legislator", "municipal-mayor", "county-mayor", "municipal-councilor", "county-councilor", "township-mayor", "indigenous-district-mayor", "township-representative", "indigenous-district-representative"},
    "all": {rule[0] for rule in ROLE_RULES} | {"vice-president"},
}


def utc_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def normalize_text(value: str) -> str:
    return re.sub(r"[\s　·・．.\-—_/\\()（）]+", "", str(value or "")).strip()


def decode_zip_name(name: str) -> str:
    # Python decodes the legacy ZIP filename bytes as CP437.  CEC archives used
    # Big5 for many directory names, so reverse that interpretation first.
    try:
        return name.encode("cp437").decode("big5")
    except (UnicodeEncodeError, UnicodeDecodeError):
        return name


def decode_bytes(payload: bytes) -> str:
    for encoding in ("utf-8-sig", "big5", "cp950"):
        try:
            return payload.decode(encoding)
        except UnicodeDecodeError:
            continue
    return payload.decode("big5", errors="replace")


def csv_rows(payload: bytes) -> list[list[str]]:
    text = decode_bytes(payload).replace("\x00", "")
    return [[cell.strip() for cell in row] for row in csv.reader(io.StringIO(text)) if any(cell.strip() for cell in row)]


def parse_year(path_text: str) -> int | None:
    for match in re.findall(r"(?<!\d)(19\d{2}|20\d{2})(?!\d)", path_text):
        year = int(match)
        if 1940 <= year <= 2100:
            return year
    roc_matches = re.findall(r"(?<!\d)(\d{2,3})\s*年", path_text)
    for raw in roc_matches:
        value = int(raw)
        if 30 <= value <= 200:
            return value + 1911
    return None


def classify_role(path_text: str) -> tuple[str | None, str | None]:
    # The archive often has a broad parent such as “2024總統立委” and a
    # specific child such as “總統副總統”.  Classify from the deepest path
    # component first so the broad parent does not win accidentally.
    components = [part for part in re.split(r"[/\\]+", path_text) if part and normalize_text(part).lower() not in {"rawdata", "data"}]
    for component in reversed(components):
        compact = normalize_text(component)
        for role_id, label, keywords in ROLE_RULES:
            if any(normalize_text(keyword) in compact for keyword in keywords):
                return role_id, label
    compact = normalize_text(path_text)
    for role_id, label, keywords in ROLE_RULES:
        if any(normalize_text(keyword) in compact for keyword in keywords):
            return role_id, label
    return None, None


def county_from_text(text: str) -> tuple[str | None, str | None]:
    normalized = str(text or "").replace("台", "臺")
    for name, county_id in COUNTIES.items():
        canonical = name.replace("台", "臺")
        if canonical in normalized:
            canonical_name = next((n for n, cid in COUNTIES.items() if cid == county_id and "臺" in n), name)
            return county_id, canonical_name
    return None, None


def party_id(name: str) -> str:
    cleaned = str(name or "").strip()
    if cleaned in PARTY_ALIASES:
        return PARTY_ALIASES[cleaned]
    compact = normalize_text(cleaned)
    for alias, value in PARTY_ALIASES.items():
        if normalize_text(alias) == compact:
            return value
    if not cleaned or cleaned in {"999", "無", "-"}:
        return "ind"
    return "other"


def roc_birthdate(raw: str) -> tuple[str | None, int | None]:
    digits = re.sub(r"\D", "", str(raw or ""))
    if len(digits) < 3:
        return None, None
    try:
        roc_year = int(digits[:3])
        year = roc_year + 1911
        if not 1850 <= year <= datetime.now().year:
            return None, None
        if len(digits) >= 7:
            month, day = int(digits[3:5]), int(digits[5:7])
            if 1 <= month <= 12 and 1 <= day <= 31:
                return f"{year:04d}-{month:02d}-{day:02d}", year
        return str(year), year
    except ValueError:
        return None, None


def stable_hash(*parts: object, length: int = 20) -> str:
    joined = "|".join(str(part or "") for part in parts)
    return hashlib.sha256(joined.encode("utf-8")).hexdigest()[:length]


def download_archive(target: Path, url: str = OFFICIAL_URL) -> None:
    target.parent.mkdir(parents=True, exist_ok=True)
    encoded_url = urllib.parse.quote(url, safe=":/._-?=&%")
    request = urllib.request.Request(encoded_url, headers={"User-Agent": "TaiwanElectionMap/5.5 (+public-data-sync)"})
    tmp = target.with_suffix(".download")
    with urllib.request.urlopen(request, timeout=300) as response, tmp.open("wb") as handle:
        shutil.copyfileobj(response, handle, length=1024 * 1024)
    tmp.replace(target)


def file_groups(archive: zipfile.ZipFile) -> dict[str, dict[str, zipfile.ZipInfo]]:
    groups: dict[str, dict[str, zipfile.ZipInfo]] = defaultdict(dict)
    for info in archive.infolist():
        if info.is_dir():
            continue
        decoded = decode_zip_name(info.filename).replace("\\", "/")
        base = Path(decoded).name.lower()
        if base == "elbese.csv":
            base = "elbase.csv"
        if base in {"elbase.csv", "elcand.csv", "elpaty.csv", "elprof.csv", "elctks.csv"}:
            groups[str(Path(decoded).parent)][base] = info
    return groups


def read_group_file(archive: zipfile.ZipFile, group: dict[str, zipfile.ZipInfo], name: str) -> list[list[str]]:
    info = group.get(name)
    return csv_rows(archive.read(info)) if info else []


def build_records_for_group(archive: zipfile.ZipFile, group_path: str, files: dict[str, zipfile.ZipInfo], scope: str, years: set[int] | None) -> tuple[list[dict], dict]:
    year = parse_year(group_path)
    role_id, election_label = classify_role(group_path)
    group_meta = {"path": group_path, "year": year, "roleId": role_id, "status": "skipped", "records": 0}
    if not year or not role_id:
        group_meta["reason"] = "cannot-classify-year-or-election"
        return [], group_meta
    if years and year not in years:
        group_meta["reason"] = "year-filter"
        return [], group_meta
    if role_id not in SCOPE_ROLES[scope]:
        group_meta["reason"] = "scope-filter"
        return [], group_meta

    candidate_rows = read_group_file(archive, files, "elcand.csv")
    vote_rows = read_group_file(archive, files, "elctks.csv")
    party_rows = read_group_file(archive, files, "elpaty.csv")
    base_rows = read_group_file(archive, files, "elbase.csv")
    if not candidate_rows or not vote_rows:
        group_meta["reason"] = "missing-candidate-or-vote-file"
        return [], group_meta

    parties = {row[0].strip(): row[1].strip() for row in party_rows if len(row) >= 2}
    areas = {tuple(row[:5]): row[5].strip() for row in base_rows if len(row) >= 6}
    votes: dict[tuple[str, ...], tuple[int | None, float | None, str]] = {}
    for row in vote_rows:
        if len(row) < 10:
            continue
        # Candidate-level total has polling-station code 0. Exact first-five
        # codes match the candidate's constituency row in elcand.csv.
        if str(row[5]).strip() not in {"0", "0000", ""}:
            continue
        key = tuple(row[:5] + [str(row[6]).strip()])
        try:
            count = int(float(str(row[7]).replace(",", "")))
        except ValueError:
            count = None
        try:
            rate = float(str(row[8]).replace("%", ""))
        except ValueError:
            rate = None
        votes[key] = (count, rate, row[9].strip())

    records: list[dict] = []
    for row in candidate_rows:
        if len(row) < 16:
            continue
        codes = [str(value).strip() for value in row[:5]]
        number = str(row[5]).strip()
        name = str(row[6]).strip()
        if not name or not number:
            continue
        raw_party_code = str(row[7]).strip()
        raw_party_name = parties.get(raw_party_code, "")
        gender = {"1": "男", "2": "女"}.get(str(row[8]).strip(), str(row[8]).strip() or None)
        birth_date, birth_year = roc_birthdate(str(row[9]).strip())
        incumbent = str(row[13]).strip().upper() == "Y"
        candidate_mark = str(row[14]).strip()
        is_deputy = str(row[15]).strip().upper() == "Y"
        effective_role = "vice-president" if role_id == "president" and is_deputy else role_id
        effective_label = "副總統" if effective_role == "vice-president" else election_label
        vote_count, vote_rate, vote_mark = votes.get(tuple(codes + [number]), (None, None, ""))
        elected = candidate_mark in {"*", "!"} or vote_mark in {"*", "!"}
        area_name = areas.get(tuple(codes), "")
        county_id, county_name = county_from_text(f"{area_name} {group_path}")
        district = area_name or Path(group_path).name
        raw_birth = str(row[9]).strip()
        identity_base = [normalize_text(name), gender or "", birth_date or raw_birth or ""]
        confidence = "exact" if birth_date and gender else "probable" if birth_year or gender else "review"
        if confidence == "review":
            identity_base.extend([county_id or "national", effective_role])
        person_key = "person-" + stable_hash(*identity_base)
        record_id = "cec-" + stable_hash(year, effective_role, *codes, number, name)
        records.append({
            "id": record_id,
            "demo": False,
            "official": True,
            "personKey": person_key,
            "identityConfidence": confidence,
            "name": name,
            "gender": gender,
            "birthDate": birth_date,
            "birthYear": birth_year,
            "year": year,
            "electionType": effective_label,
            "electionName": re.sub(r"[/\\]+", " › ", group_path),
            "roleId": effective_role,
            "countyId": county_id,
            "countyName": county_name,
            "district": district,
            "areaCodes": {"prv": codes[0], "city": codes[1], "area": codes[2], "dept": codes[3], "li": codes[4]},
            "number": int(number) if number.isdigit() else number,
            "partyId": party_id(raw_party_name),
            "partyNameRaw": raw_party_name or raw_party_code,
            "votes": vote_count,
            "voteRate": vote_rate,
            "rank": None,
            "elected": bool(elected),
            "incumbent": bool(incumbent),
            "sourceType": "cec-official-history",
            "sourcePath": group_path,
            "sources": [{"label": "中央選舉委員會選舉資料庫", "url": SOURCE_PAGE, "date": utc_now()[:10]}],
        })

    # Rank within each constituency and role. Null vote totals stay unranked.
    buckets: dict[tuple, list[dict]] = defaultdict(list)
    for record in records:
        buckets[(record["year"], record["roleId"], record.get("countyId"), record.get("district"))].append(record)
    for bucket in buckets.values():
        ordered = sorted([r for r in bucket if isinstance(r.get("votes"), int)], key=lambda r: (-r["votes"], str(r["name"])))
        for index, record in enumerate(ordered, start=1):
            record["rank"] = index

    group_meta.update({"status": "ok", "records": len(records)})
    return records, group_meta


def parse_archive(archive_path: Path, scope: str, years: set[int] | None) -> dict:
    records: list[dict] = []
    groups_meta: list[dict] = []
    with zipfile.ZipFile(archive_path) as archive:
        groups = file_groups(archive)
        for group_path, files in sorted(groups.items()):
            if "elcand.csv" not in files or "elctks.csv" not in files:
                continue
            group_records, meta = build_records_for_group(archive, group_path, files, scope, years)
            groups_meta.append(meta)
            records.extend(group_records)

    # Deduplicate identical records that can appear in archive aliases.
    unique = {record["id"]: record for record in records}
    records = list(unique.values())
    records.sort(key=lambda r: (-int(r["year"]), str(r["roleId"]), str(r.get("countyId") or ""), str(r["district"]), int(r["number"]) if isinstance(r["number"], int) else 9999))
    return {
        "metadata": {
            "source": "Central Election Commission votedata.zip",
            "sourceUrl": OFFICIAL_URL,
            "sourcePage": SOURCE_PAGE,
            "fetchedAt": utc_now(),
            "scope": scope,
            "yearsFilter": sorted(years) if years else [],
            "archiveBytes": archive_path.stat().st_size,
            "datasetGroups": len(groups_meta),
            "importedGroups": sum(1 for group in groups_meta if group["status"] == "ok"),
            "recordCount": len(records),
            "parserVersion": "5.5.0",
            "groups": groups_meta,
        },
        "records": records,
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--archive", help="Use a local votedata.zip instead of downloading")
    parser.add_argument("--output", default="data/history/cec-import.json")
    parser.add_argument("--cache", default=".cache/cec/votedata.zip")
    parser.add_argument("--scope", choices=sorted(SCOPE_ROLES), default=os.environ.get("CEC_HISTORY_SCOPE", "core"))
    parser.add_argument("--years", default=os.environ.get("CEC_HISTORY_YEARS", "2014,2018,2020,2022,2024"), help="Comma-separated Gregorian years; use 'all' for every year")
    parser.add_argument("--refresh", action="store_true", help="Redownload even when a cache exists")
    args = parser.parse_args()

    years = None if args.years.strip().lower() == "all" else {int(value) for value in re.findall(r"\d{4}", args.years)}
    archive_path = Path(args.archive) if args.archive else Path(args.cache)
    if not args.archive and (args.refresh or not archive_path.exists()):
        print(f"Downloading official CEC archive to {archive_path} …", flush=True)
        download_archive(archive_path)
    if not archive_path.exists():
        raise FileNotFoundError(f"Archive not found: {archive_path}")

    started = time.monotonic()
    payload = parse_archive(archive_path, args.scope, years)
    payload["metadata"]["durationSeconds"] = round(time.monotonic() - started, 2)
    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Imported {len(payload['records'])} records from {payload['metadata']['importedGroups']} datasets in {payload['metadata']['durationSeconds']}s.")
    if not payload["records"]:
        print("No records matched the selected scope/year filters.", file=sys.stderr)
        return 2
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
