import re
from abc import ABC, abstractmethod
from pathlib import Path
from typing import List, Optional, Tuple, Dict, Any
from pydantic import BaseModel, Field
from app.core.exceptions import ScreenplayParseException
from app.core.logging import logger


def is_valid_timestamp_string(ts_str: str) -> bool:
    """Validates whether a string is a properly formed timestamp (e.g. 00:11.30, (01:15.50), 00:01:15.50)."""
    if not ts_str:
        return False
    clean_ts = ts_str.strip().strip("()").strip("[]")
    parts = clean_ts.split(":")
    if len(parts) not in (1, 2, 3):
        return False
    try:
        for p in parts:
            val = float(p)
            if val < 0:
                return False
        return True
    except (ValueError, TypeError):
        return False


def parse_timestamp_to_seconds(ts_str: str) -> float:
    """
    Converts timestamps in formats like:
      - (00:11.30) or 00:11.30 -> 11.30
      - (01:15.50) or 01:15.50 -> 75.50
      - 00:01:15.50 -> 75.50
      - 01:15 -> 75.0
    Returns 0.0 if malformed or invalid.
    """
    if not ts_str:
        return 0.0
    clean_ts = ts_str.strip().strip("()").strip("[]")
    parts = clean_ts.split(":")
    try:
        if len(parts) == 3:  # HH:MM:SS.ss
            h, m, s = float(parts[0]), float(parts[1]), float(parts[2])
            if h < 0 or m < 0 or s < 0:
                return 0.0
            return h * 3600 + m * 60 + s
        elif len(parts) == 2:  # MM:SS.ss
            m, s = float(parts[0]), float(parts[1])
            if m < 0 or s < 0:
                return 0.0
            return m * 60 + s
        elif len(parts) == 1:
            s = float(parts[0])
            return s if s >= 0 else 0.0
        else:
            return 0.0
    except (ValueError, TypeError):
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
        if not text or not text.strip():
            raise ScreenplayParseException("Screenplay content is empty or contains only whitespace.")

        lines = text.splitlines()
        cue_pattern = re.compile(r"^[\[\(]\s*([0-9:.]+)\s*[\]\)]\s*(.*)$")
        has_bracket_ts = any(cue_pattern.match(l.strip()) for l in lines)

        if has_bracket_ts:
            try:
                return self._parse_cue_sheet_text(text, episode_fallback=episode_fallback)
            except ScreenplayParseException:
                # If cue sheet failed, try block format as second chance
                try:
                    return self._parse_block_format_text(text, episode_fallback=episode_fallback)
                except Exception:
                    raise
        else:
            try:
                return self._parse_block_format_text(text, episode_fallback=episode_fallback)
            except ScreenplayParseException:
                try:
                    return self._parse_cue_sheet_text(text, episode_fallback=episode_fallback)
                except Exception:
                    raise

    def _parse_cue_sheet_text(self, text: str, episode_fallback: int = 1) -> ParsedScreenplay:
        """Parses timestamped cue sheet screenplays (e.g. [00:04.00] ACTION: ... or [00:12.00] DIALOGUE: ...)."""
        lines = text.splitlines()
        ep_num = episode_fallback
        logline = ""
        continuity_notes = ""

        # 1. Header parsing
        for raw_line in lines[:25]:
            line = raw_line.strip()
            ep_match = re.search(r"^(?:EPISODE(?:\s+NUMBER)?|EP)[\s:]*(?:Episode\s*)?0*(\d+)", line, re.IGNORECASE)
            if ep_match:
                ep_num = int(ep_match.group(1))
            m_log = re.search(r"^(?:EPISODE\s+)?(?:LOGLINE|SYNOPSIS)[:\s]+(.+)", line, re.IGNORECASE)
            if m_log:
                logline = m_log.group(1).strip()
            m_con = re.search(r"^CONTINUITY(?:\s+NOTES)?[:\s]+(.+)", line, re.IGNORECASE)
            if m_con:
                continuity_notes = m_con.group(1).strip()

        cue_pattern = re.compile(r"^[\[\(]\s*([0-9:.]+)\s*[\]\)]\s*(.*)$")
        items = []
        current_scene_num = 1
        current_heading = "SCENE 1"

        for idx, raw_line in enumerate(lines):
            line = raw_line.strip()
            if not line:
                continue

            # Standalone SCENE header: 'SCENE 01' or 'SCENE 1'
            m_sc = re.match(r"^SCENE\s+(\d+)", line, re.IGNORECASE)
            if m_sc:
                current_scene_num = int(m_sc.group(1))
                current_heading = f"SCENE {current_scene_num}"
                items.append({"type": "scene_header", "scene_num": current_scene_num, "heading": current_heading})
                continue

            # Slugline heading like 'INT. HOUSE - NIGHT' right after SCENE
            m_slug = re.match(r"^(?:INT|EXT|INT/EXT|EXT/INT)[.\s]", line, re.IGNORECASE)
            if m_slug:
                current_heading = line
                items.append({"type": "scene_heading_update", "heading": current_heading})
                continue

            m_ts = cue_pattern.match(line)
            if m_ts:
                ts_str = m_ts.group(1)
                ts_sec = parse_timestamp_to_seconds(ts_str)
                content = m_ts.group(2).strip()
                
                # Check if this timestamped line is a scene boundary e.g. '[00:00.00] SCENE: INT. ...'
                m_ts_sc = re.match(r"^SCENE(?:\s+\d+)?:\s*(.+)$", content, re.IGNORECASE)
                if m_ts_sc:
                    heading = m_ts_sc.group(1).strip()
                    items.append({"type": "scene_start", "ts_str": ts_str, "ts_sec": ts_sec, "heading": heading})
                    continue

                items.append({"type": "cue", "ts_str": ts_str, "ts_sec": ts_sec, "content": content})

        scenes: List[ParsedScene] = []
        current_scene: Optional[ParsedScene] = None

        for i, it in enumerate(items):
            if it["type"] == "scene_start":
                if current_scene and current_scene.lines:
                    scenes.append(current_scene)
                sc_idx = len(scenes) + 1
                current_scene = ParsedScene(
                    scene_number=sc_idx,
                    heading=it["heading"],
                    start_timestamp=it["ts_str"],
                    end_timestamp=it["ts_str"],
                    start_seconds=it["ts_sec"],
                    end_seconds=it["ts_sec"],
                    duration_seconds=0.0,
                    lines=[]
                )
            elif it["type"] == "scene_header":
                if current_scene and current_scene.lines:
                    scenes.append(current_scene)
                current_scene = ParsedScene(
                    scene_number=it["scene_num"],
                    heading=it["heading"],
                    start_timestamp="00:00.00",
                    end_timestamp="00:00.00",
                    start_seconds=0.0,
                    end_seconds=0.0,
                    duration_seconds=0.0,
                    lines=[]
                )
            elif it["type"] == "scene_heading_update":
                if current_scene:
                    current_scene.heading = it["heading"]
            elif it["type"] == "cue":
                if not current_scene:
                    current_scene = ParsedScene(
                        scene_number=1,
                        heading="SCENE 1",
                        start_timestamp=it["ts_str"],
                        end_timestamp=it["ts_str"],
                        start_seconds=it["ts_sec"],
                        end_seconds=it["ts_sec"],
                        duration_seconds=0.0,
                        lines=[]
                    )

                start_ts = it["ts_str"]
                start_sec = it["ts_sec"]
                
                # Find next cue timestamp to determine end time
                next_cue = None
                for later in items[i+1:]:
                    if later.get("ts_sec") is not None and later["ts_sec"] > start_sec:
                        next_cue = later
                        break
                        
                if next_cue:
                    end_sec = next_cue["ts_sec"]
                    end_ts = next_cue["ts_str"]
                else:
                    end_sec = start_sec + 4.0
                    end_ts = format_seconds_to_timestamp(end_sec)

                dur_sec = max(0.5, end_sec - start_sec)

                content = it["content"]
                line_type = "action"
                speaker = None
                parenthetical = None
                text = content

                m_act = re.match(r"^(?:\*\*ACTION:\*\*|ACTION:)\s*(.*)$", content, re.IGNORECASE)
                if m_act:
                    line_type = "action"
                    text = m_act.group(1).strip("\"' ")
                else:
                    m_cam = re.match(r"^(?:\*\*CAMERA:\*\*|CAMERA:)\s*(.*)$", content, re.IGNORECASE)
                    if m_cam:
                        line_type = "camera"
                        text = m_cam.group(1).strip("\"' ")
                    else:
                        m_dia = re.match(r"^DIALOGUE:\s*([A-Za-z0-9_\s]+?):\s*(.*)$", content, re.IGNORECASE)
                        if m_dia:
                            line_type = "dialogue"
                            speaker = m_dia.group(1).strip()
                            text = m_dia.group(2).strip("\"' ")
                        else:
                            m_spk = re.match(r"^([A-Z0-9_\s]+?)(?:\s*\((.+?)\))?:\s*(.*)$", content)
                            if m_spk and len(m_spk.group(1).strip()) <= 25 and not m_spk.group(1).strip().lower().startswith(("scene", "http", "action", "camera")):
                                line_type = "dialogue"
                                speaker = m_spk.group(1).strip()
                                parenthetical = m_spk.group(2).strip() if m_spk.group(2) else None
                                text = m_spk.group(3).strip("\"' ")

                current_scene.lines.append(ScreenplayLine(
                    line_type=line_type,
                    speaker=speaker,
                    parenthetical=parenthetical,
                    text=text,
                    start_timestamp=start_ts,
                    end_timestamp=end_ts,
                    start_seconds=start_sec,
                    end_seconds=end_sec,
                    duration_seconds=dur_sec
                ))

        if current_scene and current_scene.lines:
            scenes.append(current_scene)

        for sc in scenes:
            if sc.lines:
                sc.start_timestamp = sc.lines[0].start_timestamp
                sc.start_seconds = sc.lines[0].start_seconds
                sc.end_timestamp = sc.lines[-1].end_timestamp
                sc.end_seconds = sc.lines[-1].end_seconds
                sc.duration_seconds = max(0.0, sc.end_seconds - sc.start_seconds)

        if not scenes or not any(s.lines for s in scenes):
            raise ScreenplayParseException("Screenplay parsing failed: no valid scenes or dialogue cues found in content.")

        total_dur = max([s.end_seconds for s in scenes]) if scenes else 0.0
        return ParsedScreenplay(
            episode_number=ep_num,
            logline=logline,
            continuity_notes=continuity_notes,
            scenes=scenes,
            total_duration_seconds=total_dur
        )

    def _parse_block_format_text(self, text: str, episode_fallback: int = 1) -> ParsedScreenplay:
        """Parses markdown-style block screenplays (e.g. **ACTION:**\\nStart: ...)."""
        lines = text.splitlines()
        
        episode_number = episode_fallback
        logline = ""
        continuity_notes = ""
        
        # 1. Parse header metadata
        for raw_line in lines[:25]:
            line = raw_line.strip()
            ep_match = re.search(r"^(?:EPISODE(?:\s+NUMBER)?|EP)[\s:]*(?:Episode\s*)?0*(\d+)", line, re.IGNORECASE)
            if ep_match:
                episode_number = int(ep_match.group(1))
            
            logline_match = re.search(r"^(?:EPISODE\s+)?(?:LOGLINE|SYNOPSIS)[:\s]+(.+)", line, re.IGNORECASE)
            if logline_match:
                logline = logline_match.group(1).strip()
                
            continuity_match = re.search(r"^CONTINUITY(?:\s+NOTES)?[:\s]+(.+)", line, re.IGNORECASE)
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
                clean_text = line.strip('"').strip("'")
                current_text_lines.append(clean_text)

            i += 1

        flush_current_block()
        if current_scene:
            scenes.append(current_scene)

        # If no scenes were parsed or none contain any dialogue/action lines, parsing has failed
        if not scenes or not any(s.lines for s in scenes):
            raise ScreenplayParseException("Screenplay parsing failed: no valid scenes or dialogue cues found in content.")

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
