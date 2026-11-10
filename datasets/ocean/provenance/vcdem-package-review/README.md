# Publisher metadata retained for the Pope’s Eye review

The DataVic VCDEM2021 250 cm package contains the VCDEM2022 deliverable. `source.json`
pins its URL, ETag, size and exact ZIP members. All four binary files are in Git LFS.
The package licence is CC BY 4.0. Attribution: State of Victoria (DEECA), Veris
Australia and the individual survey owners listed in the metadata.

- `readme.bin` and `metadata.bin` contain the original DEFLATE payloads of
  `readme.txt` and `Metadata_VCDEM_2022.xlsx`. Inflate with raw DEFLATE (`wbits=-15`).
- `geodatabase-prefix.bin` retains archive bytes 0–7347192. For each geodatabase
  member in `source.json`, slice from `data_offset` for `compressed_bytes`; inflate
  compression 8 and retain compression 0 as-is. The receipt records exact compressed
  and uncompressed SHA-256, byte lengths and CRC32. This reconstructs all 46 files
  in `Metadata.gdb` without changing their bytes.
- `datavic-metadata.bin` retains the official ISO XML record verbatim. Its receipt
  records the retrieval URL, byte count and SHA-256.

The geodatabase has one layer, `ProjectExtents_Metadata_Veris_20221121`, in
EPSG:7844 with 157 survey footprints. The selected Pope’s Eye geometry and source
attributes are retained in `../vcdem-popes-eye-review.json`; no vector reader is
needed to reconstruct its mask. The review records the native source tile,
horizontal CRS, 5 m footprint inset, cell-centre mask rule and original nodata.
Source inputs outside the subset remain available in the raw archive member and
full coastal COG. Reapplying the same mask is idempotent.

Run `.venv/bin/python -m unittest tests.test_vcdem_review -v` to verify metadata
round trips, every retained cell, the grid and mask, and every exported numeric
cell. The original ASCII member was additionally inflated and compared against
all 6,665 retained cells during the recorded source review.
