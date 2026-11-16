import re
from abc import ABC, abstractmethod
from pathlib import Path
from typing import List, Optional, Tuple, Dict, Any
from pydantic import BaseModel, Field
from app.core.exceptions import ScreenplayParseException
from app.core.logging import logger


def parse_timestamp_to_seconds(ts_str: str) -> float:
    """
    Converts timestamps in formats like:
      - (00:11.30) or 00:11.30 -> 11.30
      - (01:15.50) or 01:15.50 -> 75.50
      - 00:01:15.50 -> 75.50
      - 01:15 -> 75.0
    """
    clean_ts = ts_str.strip().strip("()").strip("[]")
    parts = clean_ts.split(":")
    try:
        if len(parts) == 3:  # HH:MM:SS.ss
            return float(parts[0]) * 3600 + float(parts[1]) * 60 + float(parts[2])
        elif len(parts) == 2:  # MM:SS.ss
            return float(parts[0]) * 60 + float(parts[1])
        elif len(parts) == 1:
            return float(parts[0])
        else:
            return 0.0
    except ValueError:
        return 0.0


def format_seconds_to_timestamp(seconds: float) -> str:
    """Formats seconds into MM:SS.ss string."""
    mins = int(seconds // 60)
    secs = seconds % 60
    return f"{mins:02d}:{secs:05.2f}"


class ScreenplayLine(BaseModel):
    line_type: str = Field(description="'dialogue', 'action', or 'camera'")
    speaker: Optional[str] = None
    parenthetical: Optional[str] = None
    text: str
    start_timestamp: str
    end_timestamp: str
    start_seconds: float
    end_seconds: float
    duration_seconds: float


class ParsedScene(BaseModel):
    scene_number: int
    heading: str
    start_timestamp: str
    end_timestamp: str
    start_seconds: float
    end_seconds: float
    duration_seconds: float
    lines: List[ScreenplayLine] = []


class ParsedScreenplay(BaseModel):
    episode_number: int
    logline: str = ""
    continuity_notes: str = ""
    scenes: List[ParsedScene] = []
    total_duration_seconds: float = 0.0

    def get_all_lines(self) -> List[ScreenplayLine]:
        lines = []
        for scene in self.scenes:
            lines.extend(scene.lines)
        return lines

    def get_dialogue_lines(self) -> List[ScreenplayLine]:
        return [line for line in self.get_all_lines() if line.line_type == "dialogue"]


class BaseScreenplayParser(ABC):
    @abstractmethod
    def parse_file(self, file_path: Path) -> ParsedScreenplay:
        pass

    @abstractmethod
    def parse_text(self, text: str, episode_fallback: int = 1) -> ParsedScreenplay:
        pass


class TxtScreenplayParser(BaseScreenplayParser):
    """
    Parser for Kuku microdrama structured text cue-sheets.
    Extracts:
      - Episode Number
      - Logline
      - Continuity Notes
      - Scenes (Heading, Start, End)
      - Blocks (**CAMERA:**, **ACTION:**, **CHARACTER (Mood):**)
      - Precise Start/End timestamps and text
    """

    def parse_file(self, file_path: Path) -> ParsedScreenplay:
        with open(file_path, "r", encoding="utf-8", errors="replace") as f:
            content = f.read()
        
        # Infer fallback episode number from filename if not in content
        ep_match = re.search(r"episode[-_\s]*0*(\d+)", file_path.name, re.IGNORECASE)
        fallback_ep = int(ep_match.group(1)) if ep_match else 1
        return self.parse_text(content, episode_fallback=fallback_ep)

    def parse_text(self, text: str, episode_fallback: int = 1) -> ParsedScreenplay:
        lines = text.splitlines()
        
        episode_number = episode_fallback
        logline = ""
        continuity_notes = ""
        
        # 1. Parse header metadata
        for line in lines[:25]:
            ep_match = re.search(r"^EPISODE NUMBER:\s*Episode\s*(\d+)", line, re.IGNORECASE)
            if ep_match:
                episode_number = int(ep_match.group(1))
            
            logline_match = re.search(r"^EPISODE LOGLINE:\s*(.+)", line, re.IGNORECASE)
            if logline_match:
                logline = logline_match.group(1).strip()
                
            continuity_match = re.search(r"^CONTINUITY NOTES:\s*(.+)", line, re.IGNORECASE)
            if continuity_match:
                continuity_notes = continuity_match.group(1).strip()

        # 2. Parse scenes and dialogue blocks
        scenes: List[ParsedScene] = []
        current_scene: Optional[ParsedScene] = None
        
        # State machine variables for item blocks
        current_block_type: Optional[str] = None
        current_speaker: Optional[str] = None
        current_parenthetical: Optional[str] = None
        current_start_ts: Optional[str] = None
        current_end_ts: Optional[str] = None
        current_text_lines: List[str] = []

        def flush_current_block():
            nonlocal current_block_type, current_speaker, current_parenthetical
            nonlocal current_start_ts, current_end_ts, current_text_lines
            
            if current_block_type and current_start_ts and current_end_ts and current_scene:
                block_text = " ".join([l.strip() for l in current_text_lines if l.strip()])
                start_sec = parse_timestamp_to_seconds(current_start_ts)
                end_sec = parse_timestamp_to_seconds(current_end_ts)
                dur_sec = max(0.0, end_sec - start_sec)
                
                line_item = ScreenplayLine(
                    line_type=current_block_type,
                    speaker=current_speaker,
                    parenthetical=current_parenthetical,
                    text=block_text,
                    start_timestamp=current_start_ts,
                    end_timestamp=current_end_ts,
                    start_seconds=start_sec,
                    end_seconds=end_sec,
                    duration_seconds=dur_sec
                )
                current_scene.lines.append(line_item)
                
            current_block_type = None
            current_speaker = None
            current_parenthetical = None
            current_start_ts = None
            current_end_ts = None
            current_text_lines = []

        i = 0
        while i < len(lines):
            raw_line = lines[i]
            line = raw_line.strip()

            # Detect Scene boundary: e.g. "SCENE 01" or "SCENE 1"
            scene_match = re.search(r"^SCENE\s+(\d+)", line, re.IGNORECASE)
            if scene_match:
                flush_current_block()
                if current_scene:
                    scenes.append(current_scene)
                
                sc_num = int(scene_match.group(1))
                current_scene = ParsedScene(
                    scene_number=sc_num,
                    heading=f"SCENE {sc_num}",
                    start_timestamp="00:00.00",
                    end_timestamp="00:00.00",
                    start_seconds=0.0,
                    end_seconds=0.0,
                    duration_seconds=0.0,
                    lines=[]
                )
                i += 1
                continue

            # Scene heading
            heading_match = re.search(r"^Scene heading:\s*(.+)", line, re.IGNORECASE)
            if heading_match and current_scene:
                current_scene.heading = heading_match.group(1).strip()
                i += 1
                continue

            # Scene start
            sc_start_match = re.search(r"^Scene start:\s*([0-9:.]+)", line, re.IGNORECASE)
            if sc_start_match and current_scene:
                current_scene.start_timestamp = sc_start_match.group(1).strip()
                current_scene.start_seconds = parse_timestamp_to_seconds(current_scene.start_timestamp)
                i += 1
                continue

            # Scene end
            sc_end_match = re.search(r"^Scene end:\s*([0-9:.]+)", line, re.IGNORECASE)
            if sc_end_match and current_scene:
                current_scene.end_timestamp = sc_end_match.group(1).strip()
                current_scene.end_seconds = parse_timestamp_to_seconds(current_scene.end_timestamp)
                current_scene.duration_seconds = max(0.0, current_scene.end_seconds - current_scene.start_seconds)
                i += 1
                continue

            # Detect Block Headers: **CAMERA:**, **ACTION:**, or **CHARACTER (Parenthetical):**
            block_header_match = re.search(r"^\*\*(.+?)\*\*:\s*$", line)
            if not block_header_match:
                # Sometimes character line does not have trailing colon inside or outside
                block_header_match = re.search(r"^\*\*(.+?):\*\*\s*$", line)

            if block_header_match:
                flush_current_block()
                header_content = block_header_match.group(1).strip()

                if header_content.upper() == "CAMERA":
                    current_block_type = "camera"
                elif header_content.upper() == "ACTION":
                    current_block_type = "action"
                else:
                    current_block_type = "dialogue"
                    # Check for parenthetical e.g. "MATRIARCH (Cold, Commanding)"
                    paren_match = re.search(r"^([^(]+)\s*\((.+)\)$", header_content)
                    if paren_match:
                        current_speaker = paren_match.group(1).strip()
                        current_parenthetical = paren_match.group(2).strip()
                    else:
                        current_speaker = header_content.strip()
                i += 1
                continue

            # Detect Timing Line: e.g. Start: (00:11.30) | End: (00:13.10)
            timing_match = re.search(r"Start:\s*\(?([0-9:.]+)\)?\s*\|\s*End:\s*\(?([0-9:.]+)\)?", line, re.IGNORECASE)
            if timing_match:
                current_start_ts = timing_match.group(1).strip()
                current_end_ts = timing_match.group(2).strip()
                i += 1
                continue

            # Text line within a block
            if current_block_type and line:
                # Clean up quotes if present
                clean_text = line.strip('"').strip("'")
                current_text_lines.append(clean_text)

            i += 1

        flush_current_block()
        if current_scene:
            scenes.append(current_scene)

        # Fallback if no explicit scenes detected: treat whole file as Scene 1
        if not scenes:
            all_sec = 0.0
            scenes.append(ParsedScene(
                scene_number=1,
                heading="SCENE 01",
                start_timestamp="00:00.00",
                end_timestamp="02:00.00",
                start_seconds=0.0,
                end_seconds=120.0,
                duration_seconds=120.0,
                lines=[]
            ))

        total_dur = max([s.end_seconds for s in scenes]) if scenes else 0.0

        return ParsedScreenplay(
            episode_number=episode_number,
            logline=logline,
            continuity_notes=continuity_notes,
            scenes=scenes,
            total_duration_seconds=total_dur
        )


class PdfScreenplayParser(BaseScreenplayParser):
    """
    Parser for PDF screenplay documents using PyMuPDF (fitz) or pypdf fallback.
    Extracts text per page and feeds into the text state machine.
    """

    def parse_file(self, file_path: Path) -> ParsedScreenplay:
        text_content = ""
        try:
            import fitz  # PyMuPDF
            doc = fitz.open(str(file_path))
            for page in doc:
                text_content += page.get_text() + "\n"
        except Exception:
            import pypdf
            reader = pypdf.PdfReader(str(file_path))
            for page in reader.pages:
                text_content += (page.extract_text() or "") + "\n"

        ep_match = re.search(r"episode[-_\s]*0*(\d+)", file_path.name, re.IGNORECASE)
        fallback_ep = int(ep_match.group(1)) if ep_match else 1

        txt_parser = TxtScreenplayParser()
        return txt_parser.parse_text(text_content, episode_fallback=fallback_ep)

    def parse_text(self, text: str, episode_fallback: int = 1) -> ParsedScreenplay:
        txt_parser = TxtScreenplayParser()
        return txt_parser.parse_text(text, episode_fallback=episode_fallback)
