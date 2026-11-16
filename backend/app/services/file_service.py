import os
import shutil
import hashlib
import zipfile
from pathlib import Path
from typing import List, Dict, Any, Tuple
from fastapi import UploadFile
from app.core.config import settings
from app.core.exceptions import FileValidationException
from app.core.logging import logger

ALLOWED_EXTENSIONS = {".txt", ".pdf", ".zip"}


class FileService:
    def __init__(self, upload_dir: str = settings.UPLOAD_DIR):
        self.upload_dir = Path(upload_dir)
        self.upload_dir.mkdir(parents=True, exist_ok=True)

    @staticmethod
    def calculate_sha256(file_path: Path) -> str:
        sha256_hash = hashlib.sha256()
        with open(file_path, "rb") as f:
            for byte_block in iter(lambda: f.read(65536), b""):
                sha256_hash.update(byte_block)
        return sha256_hash.hexdigest()

    def save_upload(self, upload_file: UploadFile) -> Tuple[Path, str]:
        """Validates and saves an uploaded file, returning (saved_path, sha256)."""
        filename = upload_file.filename or "unknown"
        ext = Path(filename).suffix.lower()
        
        if ext not in ALLOWED_EXTENSIONS:
            raise FileValidationException(
                f"Unsupported file format '{ext}'. Supported formats: {', '.join(ALLOWED_EXTENSIONS)}"
            )

        safe_filename = Path(filename).name.replace(" ", "_")
        dest_path = self.upload_dir / safe_filename
        
        contents = upload_file.file.read()
        size_mb = len(contents) / (1024 * 1024)
        if size_mb > settings.MAX_UPLOAD_SIZE_MB:
            raise FileValidationException(
                f"File size {size_mb:.2f}MB exceeds limit of {settings.MAX_UPLOAD_SIZE_MB}MB."
            )

        if len(contents) == 0:
            raise FileValidationException("Uploaded file is empty.")

        with open(dest_path, "wb") as f:
            f.write(contents)

        sha256 = self.calculate_sha256(dest_path)
        logger.info(f"Saved file {safe_filename} ({len(contents)} bytes, SHA-256: {sha256[:10]}...)")
        return dest_path, sha256

    def extract_zip(self, zip_path: Path, target_dir: Path) -> List[Path]:
        """Safely extracts a ZIP archive preventing path traversal (Zip Slip)."""
        extracted_files: List[Path] = []
        target_dir.mkdir(parents=True, exist_ok=True)
        resolved_target = target_dir.resolve()

        with zipfile.ZipFile(zip_path, "r") as zf:
            for member in zf.infolist():
                if member.is_dir():
                    continue
                
                # Check for Zip Slip vulnerability
                member_path = (target_dir / member.filename).resolve()
                if not str(member_path).startswith(str(resolved_target)):
                    raise FileValidationException(f"Malicious archive entry detected: {member.filename}")

                # Check extension
                ext = member_path.suffix.lower()
                if ext in {".txt", ".pdf"}:
                    member_path.parent.mkdir(parents=True, exist_ok=True)
                    with zf.open(member) as source, open(member_path, "wb") as target:
                        shutil.copyfileobj(source, target)
                    extracted_files.append(member_path)

        logger.info(f"Extracted {len(extracted_files)} screenplay files from {zip_path.name}")
        return sorted(extracted_files, key=lambda p: p.name)


file_service = FileService()
