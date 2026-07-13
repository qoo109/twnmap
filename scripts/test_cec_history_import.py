#!/usr/bin/env python3
import json
import subprocess
import tempfile
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def add_group(zf, base, candidates, votes, parties, areas):
    def write(name, rows):
        text = "\n".join(",".join(str(cell) for cell in row) for row in rows) + "\n"
        zf.writestr(f"{base}/{name}", text.encode("big5"))
    write("elbase.csv", areas)
    write("elpaty.csv", parties)
    write("elcand.csv", candidates)
    write("elctks.csv", votes)


with tempfile.TemporaryDirectory() as tmp:
    tmp = Path(tmp)
    archive = tmp / "votedata-fixture.zip"
    output = tmp / "output.json"
    with zipfile.ZipFile(archive, "w", zipfile.ZIP_DEFLATED) as zf:
        add_group(
            zf,
            "2022地方選舉/直轄市長/RawData",
            [
                ["01", "000", "00", "000", "0000", "1", "甲候選人", "16", "1", "0600101", "51", "臺灣", "大學", "Y", "*", ""],
                ["01", "000", "00", "000", "0000", "2", "乙候選人", "1", "2", "0650202", "46", "臺灣", "碩士", "N", "", ""],
            ],
            [
                ["01", "000", "00", "000", "0000", "0", "1", "600000", "55.0", "*"],
                ["01", "000", "00", "000", "0000", "0", "2", "490000", "45.0", ""],
            ],
            [["1", "中國國民黨"], ["16", "民主進步黨"]],
            [["01", "000", "00", "000", "0000", "臺北市"]],
        )
        add_group(
            zf,
            "2022地方選舉/村里長/RawData",
            [["01", "000", "00", "001", "0001", "1", "里長候選人", "999", "1", "0500101", "61", "臺灣", "高中", "Y", "*", ""]],
            [["01", "000", "00", "001", "0001", "0", "1", "800", "80.0", "*"]],
            [["999", "無黨籍及未經政黨推薦"]],
            [["01", "000", "00", "001", "0001", "臺北市 北投區 建民里"]],
        )
        add_group(
            zf,
            "2024總統立委/總統副總統/RawData",
            [
                ["00", "000", "00", "000", "0000", "1", "總統候選人", "16", "1", "0480101", "65", "臺灣", "碩士", "N", "*", ""],
                ["00", "000", "00", "000", "0000", "1", "副總統候選人", "16", "2", "0600101", "53", "臺灣", "博士", "N", "*", "Y"],
            ],
            [["00", "000", "00", "000", "0000", "0", "1", "5586019", "40.05", "*"]],
            [["16", "民主進步黨"]],
            [["00", "000", "00", "000", "0000", "全國"]],
        )

    command = ["python3", str(ROOT / "scripts/cec_history_import.py"), "--archive", str(archive), "--output", str(output), "--scope", "core", "--years", "2022,2024"]
    subprocess.run(command, check=True, cwd=ROOT)
    payload = json.loads(output.read_text(encoding="utf-8"))
    records = payload["records"]
    assert len(records) == 4, f"expected 4 core records, got {len(records)}"
    assert not any(record["roleId"] == "village-chief" for record in records)
    assert {record["roleId"] for record in records} == {"municipal-mayor", "president", "vice-president"}
    mayor = next(record for record in records if record["name"] == "甲候選人")
    assert mayor["votes"] == 600000 and mayor["elected"] is True and mayor["partyId"] == "dpp"
    assert mayor["countyId"] == "taipei"
    vice = next(record for record in records if record["roleId"] == "vice-president")
    assert vice["votes"] == 5586019 and vice["partyId"] == "dpp"
    print("CEC historical importer fixture test passed.")
