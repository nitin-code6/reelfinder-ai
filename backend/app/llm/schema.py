from typing import List, Optional, Any, Dict
from pydantic import BaseModel, Field, model_validator


class AIPromoSegmentCandidate(BaseModel):
    episode_number: Optional[int] = Field(default=None, description="Episode number for this segment")
    start_timestamp: str = Field(default="00:00.00", description="Start timestamp in MM:SS.ss format")
    end_timestamp: str = Field(default="00:30.00", description="End timestamp in MM:SS.ss format")

    @model_validator(mode="before")
    @classmethod
    def normalize_segment(cls, data: Any) -> Any:
        if isinstance(data, dict):
            for k in ["start", "start_time", "start_ts", "from"]:
                if k in data and "start_timestamp" not in data:
                    data["start_timestamp"] = str(data[k])
            for k in ["end", "end_time", "end_ts", "to"]:
                if k in data and "end_timestamp" not in data:
                    data["end_timestamp"] = str(data[k])
        return data


class AIPromoCandidate(BaseModel):
    candidate_id: Optional[str] = Field(default=None, description="Unique candidate identifier, e.g. PROMO_01")
    episode_number: Optional[int] = Field(default=None, description="The primary episode number")
    start_timestamp: str = Field(default="00:00.00", description="Verbatim start timestamp from the screenplay, e.g. 00:11.30")
    end_timestamp: str = Field(default="00:30.00", description="Verbatim end timestamp from the screenplay, e.g. 00:49.80")
    segments: Optional[List[AIPromoSegmentCandidate]] = Field(default=None, description="Optional multi-segment windows")
    hook: str = Field(default="", description="Action/dialogue occurring in the first 3 seconds that hooks the viewer")
    cliffhanger: str = Field(default="", description="The unresolved tension or unanswered question at the end cutoff")
    standalone_context: Optional[str] = Field(default="", description="Why this makes complete sense without prior lore or context")
    why_it_works: Optional[str] = Field(default="", description="Marketing rationale for why this ad will convert viewers")
    reason: Optional[str] = Field(default=None, description="Alternative field name for why_it_works")
    
    # Subjective Narrative Quality Scores (1 to 10 scale)
    hook_strength: float = Field(default=7.5, ge=1.0, le=10.0, description="Rate 1-10: How compelling is the 3-second hook?")
    cliffhanger_strength: float = Field(default=8.0, ge=1.0, le=10.0, description="Rate 1-10: How unresolved and suspenseful is the cut?")
    standalone_context_score: float = Field(default=7.0, ge=1.0, le=10.0, description="Rate 1-10: Is it easily understood independently?")
    emotional_impact: float = Field(default=7.5, ge=1.0, le=10.0, description="Rate 1-10: Intensity of conflict, shock, or emotion")
    narrative_continuity: float = Field(default=8.0, ge=1.0, le=10.0, description="Rate 1-10: Smoothness of dialogue progression")

    @model_validator(mode="before")
    @classmethod
    def normalize_fields(cls, data: Any) -> Any:
        if not isinstance(data, dict):
            return data
        
        # Normalize episode_number if returned as string, e.g. "Episode 32"
        if "episode_number" in data and isinstance(data["episode_number"], str):
            digits = "".join([c for c in data["episode_number"] if c.isdigit()])
            data["episode_number"] = int(digits) if digits else None

        # Normalize start_timestamp aliases
        for k in ["start", "start_time", "start_ts", "from_time", "begin_timestamp", "begin_time"]:
            if k in data and not data.get("start_timestamp"):
                data["start_timestamp"] = str(data[k])
                
        # Normalize end_timestamp aliases
        for k in ["end", "end_time", "end_ts", "to_time", "cutoff_timestamp", "cutoff_time"]:
            if k in data and not data.get("end_timestamp"):
                data["end_timestamp"] = str(data[k])

        # If rationale is provided instead of why_it_works
        if "rationale" in data and not data.get("why_it_works"):
            data["why_it_works"] = data["rationale"]

        # If hook is missing, attempt extraction from rationale or quotes
        if not data.get("hook") and data.get("rationale"):
            import re
            rat = str(data["rationale"])
            quotes = re.findall(r"['\"]([^'\"]{3,})['\"]", rat)
            if quotes:
                data["hook"] = f"Opening confrontation: '{quotes[0]}'"
            else:
                first_sent = rat.split(".")[0].strip()
                data["hook"] = first_sent if len(first_sent) > 5 else "High-tension opening confrontation"

        # If cliffhanger is missing, attempt extraction from rationale
        if not data.get("cliffhanger") and data.get("rationale"):
            import re
            rat = str(data["rationale"])
            quotes = re.findall(r"['\"]([^'\"]{3,})['\"]", rat)
            if len(quotes) > 1:
                data["cliffhanger"] = f"Unresolved cut: '{quotes[-1]}'"
            else:
                cliff_sents = [s.strip() for s in rat.split(".") if any(w in s.lower() for w in ["cliffhanger", "ending", "cut", "denial", "reveals"])]
                if cliff_sents:
                    data["cliffhanger"] = cliff_sents[0]
                else:
                    data["cliffhanger"] = "Dramatic cut before emotional fallout or revelation"

        # If standalone_context was returned as a score float/int
        if "standalone_context" in data and isinstance(data["standalone_context"], (int, float)):
            data["standalone_context_score"] = float(data["standalone_context"])
            data["standalone_context"] = "Clear, self-contained conflict understandable to first-time viewers."

        # If candidate_id is missing, use title or fallback
        if not data.get("candidate_id"):
            data["candidate_id"] = data.get("title") or data.get("name") or "PROMO_CANDIDATE"

        return data

    @model_validator(mode="after")
    def validate_text_fields(self):
        if not self.why_it_works and self.reason:
            self.why_it_works = self.reason
        if not self.why_it_works:
            self.why_it_works = f"High-conversion microdrama hook ending on dramatic unresolved cliffhanger: {self.cliffhanger[:100]}"
        if not self.hook:
            self.hook = f"Opening moment: {self.candidate_id}" if self.candidate_id else "High-tension opening confrontation"
        if not self.cliffhanger:
            self.cliffhanger = "Dramatic cut right before the revelation or consequence"
        if not self.standalone_context:
            self.standalone_context = "Clear, self-contained conflict understandable to first-time viewers."
        return self


class AIPromoDiscoveryResponse(BaseModel):
    candidates: List[AIPromoCandidate] = Field(default_factory=list, description="List of 1 to 3 top promo candidates")
