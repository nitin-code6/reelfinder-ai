import io
import zipfile
import pytest
from pathlib import Path
from fastapi import UploadFile
from app.services.file_service import FileService
from app.core.exceptions import FileValidationException


def test_save_valid_text_upload(tmp_path):
    service = FileService(upload_dir=str(tmp_path))
    content = b"SCENE 1: INT. ROOM - DAY\nJuliana looks shocked."
    upload = UploadFile(
        filename="episode-001.txt",
        file=io.BytesIO(content)
    )
    
    saved_path, sha256 = service.save_upload(upload)
    assert saved_path.exists()
    assert saved_path.name == "episode-001.txt"
    assert len(sha256) == 64


def test_reject_invalid_extension(tmp_path):
    service = FileService(upload_dir=str(tmp_path))
    upload = UploadFile(
        filename="script.exe",
        file=io.BytesIO(b"malicious content")
    )
    with pytest.raises(FileValidationException):
        service.save_upload(upload)


def test_extract_zip_safely(tmp_path):
    service = FileService(upload_dir=str(tmp_path / "uploads"))
    zip_path = tmp_path / "episodes.zip"
    
    # Create valid ZIP containing 2 txt files
    with zipfile.ZipFile(zip_path, "w") as zf:
        zf.writestr("ep1.txt", "Episode 1 content")
        zf.writestr("ep2.txt", "Episode 2 content")
        zf.writestr("ignored.jpg", "image binary")
        
    extracted = service.extract_zip(zip_path, tmp_path / "extracted")
    assert len(extracted) == 2
    assert any(f.name == "ep1.txt" for f in extracted)
    assert any(f.name == "ep2.txt" for f in extracted)
