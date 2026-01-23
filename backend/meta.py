import re
import sys
from pathlib import Path


def extract_xmp_dates(pdf_path):
    with open(pdf_path, "rb") as f:
        data = f.read()

    # Extract the XMP metadata block (between <x:xmpmeta> ... </x:xmpmeta>)
    match = re.search(b"<x:xmpmeta.*?</x:xmpmeta>", data, re.DOTALL)
    if not match:
        print("No XMP metadata found in this PDF.")
        return

    xmp_data = match.group(0).decode("utf-8", errors="ignore")

    # Find CreateDate and ModifyDate
    create_match = re.search(r"<xmp:CreateDate>(.*?)</xmp:CreateDate>", xmp_data)
    modify_match = re.search(r"<xmp:ModifyDate>(.*?)</xmp:ModifyDate>", xmp_data)

    create_date = create_match.group(1) if create_match else "Not Found"
    modify_date = modify_match.group(1) if modify_match else "Not Found"

    print("📌 Raw CreateDate from file:", create_date)
    print("📌 Raw ModifyDate from file:", modify_date)


if __name__ == "__main__":
    # Allow passing a PDF path as the first argument; otherwise default to the known file
    if len(sys.argv) > 1:
        pdf_path = sys.argv[1]
    else:
        # Resolve to a PDF sitting alongside this script
        pdf_path = str(Path(__file__).with_name("Vote Chori_English Presentation.pdf"))

    extract_xmp_dates(pdf_path)
