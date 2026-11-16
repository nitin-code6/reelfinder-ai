import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.db.database import Base
from app.models.show import Show
from app.models.episode import Episode, ProcessingStatus
from app.models.promo import Promo
from app.services.screenplay_parser import TxtScreenplayParser
from app.services.timestamp_validator import TimestampValidator
from app.services.ranking_service import RankingService
from app.services.candidate_detector import CandidateDetector
from app.llm.mock_provider import MockLLMProvider
from app.llm.gemini_provider import GeminiProvider
from app.llm.groq_provider import GroqProvider
from app.llm.hybrid_provider import HybridLLMProvider
from app.core.exceptions import ScreenplayParseException, LLMInferenceException
from app.repositories.promo_repository import PromoRepository


@pytest.fixture
def db_session():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine)
    session = Session()
    yield session
    session.close()


@pytest.fixture
def parser():
    return TxtScreenplayParser()


@pytest.fixture
def validator():
    return TimestampValidator(min_duration=20.0, max_duration=60.0)


@pytest.fixture
def ranking():
    return RankingService()


# ---------------------------------------------------------------------------
# 1-10: STRONG HIGH-TENSION / DRAMATIC EPISODES (Expected: VALID, Score >= 75.0)
# ---------------------------------------------------------------------------

def test_01_strong_altar_betrayal(parser, validator, ranking):
    script = """EPISODE NUMBER: Episode 1
EPISODE LOGLINE: Juliana is abandoned at the altar by Gerald.
SCENE 01
Scene heading: INT. CATHEDRAL - DAY
Scene start: 00:00.00
Scene end: 01:15.00
**GERALD (Cold):**
Start: (00:04.00) | End: (00:08.50)
"I will never marry a disgraced woman like you."
**JULIANA (Shocked):**
Start: (00:09.00) | End: (00:15.00)
"You swore an oath on my dying mother's honor!"
**GERALD (Mocking):**
Start: (00:15.50) | End: (00:30.00)
"Your mother was a fraud, and so are you!"
"""
    sp = parser.parse_text(script)
    res = validator.validate_candidate("00:04.00", "00:30.00", sp)
    assert res.is_valid is True
    assert res.duration_seconds == 26.0
    score = ranking.calculate_overall_score(9.0, 9.5, 8.5, 9.0, 8.5, res.status)
    assert score >= 85.0


def test_02_strong_secret_identity_reveal(parser, validator, ranking):
    script = """EPISODE NUMBER: Episode 2
SCENE 01
Scene heading: INT. COUNCIL CHAMBER - NIGHT
Scene start: 00:00.00
Scene end: 01:30.00
**DUKE ALEXANDER (Commanding):**
Start: (00:05.00) | End: (00:12.00)
"You thought I died on the battlefield. Look at my face!"
**LORD STERLING (Terrified):**
Start: (00:13.00) | End: (00:22.00)
"Your Grace... It cannot be. We burned your regiment!"
**DUKE ALEXANDER (Wrathful):**
Start: (00:23.00) | End: (00:37.00)
"And from those ashes, I have returned to execute you all!"
"""
    sp = parser.parse_text(script)
    res = validator.validate_candidate("00:05.00", "00:37.00", sp)
    assert res.is_valid is True
    assert 20.0 <= res.duration_seconds <= 60.0
    score = ranking.calculate_overall_score(9.0, 9.5, 8.0, 9.0, 9.0, res.status)
    assert score >= 85.0


def test_03_strong_poisoned_wine_climax(parser, validator, ranking):
    script = """EPISODE NUMBER: Episode 3
SCENE 01
Scene heading: INT. BANQUET HALL - NIGHT
Scene start: 00:00.00
Scene end: 01:20.00
**CLARISSA (Sweet, Deceitful):**
Start: (00:10.00) | End: (00:16.00)
"Drink this toast, dear sister, to your new exile."
**JULIANA (Suspicious):**
Start: (00:17.00) | End: (00:25.00)
"Why does this chalice smell of bitter almonds?"
**ACTION:**
Start: (00:26.00) | End: (00:38.00)
Juliana splashes the wine onto the marble floor. The hound licks it and collapses instantly!
"""
    sp = parser.parse_text(script)
    res = validator.validate_candidate("00:10.00", "00:38.00", sp)
    assert res.is_valid is True
    assert res.duration_seconds == 28.0


def test_04_strong_arrest_warrant_execution(parser, validator, ranking):
    script = """EPISODE NUMBER: Episode 4
SCENE 01
Scene heading: INT. PARLOUR - DAY
Scene start: 00:00.00
Scene end: 01:10.00
**CONSTABLE (Loud):**
Start: (00:03.00) | End: (00:11.00)
"By Royal decree, Lady Juliana Ashcroft is charged with treason!"
**ALEXANDER (Stepping between them):**
Start: (00:12.00) | End: (00:24.00)
"Touch one hair on my wife's head, and your guard will lose their hands."
**CONSTABLE (Nervous):**
Start: (00:25.00) | End: (00:35.00)
"Your Grace, the warrant bears the King's own seal!"
"""
    sp = parser.parse_text(script)
    res = validator.validate_candidate("00:03.00", "00:35.00", sp)
    assert res.is_valid is True
    assert res.duration_seconds == 32.0


def test_05_strong_forged_will_unveiling(parser, validator, ranking):
    script = """EPISODE NUMBER: Episode 5
SCENE 01
Scene heading: INT. LAWYER'S OFFICE - DAY
Scene start: 00:00.00
Scene end: 01:15.00
**LAWYER (Shaking):**
Start: (00:06.00) | End: (00:14.00)
"The original testament was replaced before your father drew his last breath."
**JULIANA (Furious):**
Start: (00:15.00) | End: (00:25.00)
"Show me the handwriting. Whose signature forged my disinheritance?"
**LAWYER (Whispering):**
Start: (00:26.00) | End: (00:41.00)
"It was Gerald... and your own sister, Clarissa."
"""
    sp = parser.parse_text(script)
    res = validator.validate_candidate("00:06.00", "00:41.00", sp)
    assert res.is_valid is True
    assert res.duration_seconds == 35.0


def test_06_strong_slap_and_disownment(parser, validator, ranking):
    script = """EPISODE NUMBER: Episode 6
SCENE 01
Scene heading: INT. MANOR DRAWING ROOM - DAY
Scene start: 00:00.00
Scene end: 01:05.00
**MATRIARCH (Screaming):**
Start: (00:02.00) | End: (00:09.00)
"You dare accuse your sister in my house?!"
**ACTION:**
Start: (00:09.50) | End: (00:13.00)
A resounding crack echoes as the Matriarch strikes Juliana across the cheek.
**JULIANA (Unflinching):**
Start: (00:14.00) | End: (00:27.00)
"Strike me a thousand times. You cannot strike away the truth!"
"""
    sp = parser.parse_text(script)
    res = validator.validate_candidate("00:02.00", "00:27.00", sp)
    assert res.is_valid is True
    assert res.duration_seconds == 25.0


def test_07_strong_duchess_unmasking(parser, validator, ranking):
    script = """EPISODE NUMBER: Episode 7
SCENE 01
Scene heading: INT. BALLROOM - NIGHT
Scene start: 00:00.00
Scene end: 01:25.00
**HERALD (Booming):**
Start: (00:05.00) | End: (00:13.00)
"Announcing His Grace the Duke of Ashburton, and Her Grace the Duchess!"
**GERALD (Stunned):**
Start: (00:14.00) | End: (00:22.00)
"Juliana?! You married a broken pauper, not the Duke!"
**JULIANA (Regal):**
Start: (00:23.00) | End: (00:35.00)
"Kneel before your Duke, Gerald. Or face the dungeon."
"""
    sp = parser.parse_text(script)
    res = validator.validate_candidate("00:05.00", "00:35.00", sp)
    assert res.is_valid is True
    assert res.duration_seconds == 30.0


def test_08_strong_blackmail_ultimatum(parser, validator, ranking):
    script = """EPISODE NUMBER: Episode 8
SCENE 01
Scene heading: INT. SECLUDED GARDEN - DUSK
Scene start: 00:00.00
Scene end: 01:15.00
**FATHER THOMAS (Low):**
Start: (00:04.00) | End: (00:14.00)
"I possess the letters Catherine sent you. Hand over the deed, or I deliver them to the Crown."
**CATHERINE (Desperate):**
Start: (00:15.00) | End: (00:25.00)
"You swore holy silence in the confessional!"
**FATHER THOMAS (Smirking):**
Start: (00:26.00) | End: (00:46.00)
"God forgives sins, my lady. The Crown hangs traitors."
"""
    sp = parser.parse_text(script)
    res = validator.validate_candidate("00:04.00", "00:46.00", sp)
    assert res.is_valid is True
    assert res.duration_seconds == 42.0


def test_09_strong_ambush_in_the_rain(parser, validator, ranking):
    script = """EPISODE NUMBER: Episode 9
SCENE 01
Scene heading: EXT. FOREST ROAD - RAIN - NIGHT
Scene start: 00:00.00
Scene end: 01:20.00
**MERCENARY LEADER (Gravelly):**
Start: (00:02.00) | End: (00:08.00)
"Halt the carriage! Lord Sterling paid for both your throats."
**ALEXANDER (Drawing his blade):**
Start: (00:09.00) | End: (00:18.00)
"Juliana, stay inside and lock the latch."
**ACTION:**
Start: (00:19.00) | End: (00:28.00)
Steel clashes in the darkness as six masked men surround Alexander.
"""
    sp = parser.parse_text(script)
    res = validator.validate_candidate("00:02.00", "00:28.00", sp)
    assert res.is_valid is True
    assert res.duration_seconds == 26.0


def test_10_strong_secret_marriage_challenge(parser, validator, ranking):
    script = """EPISODE NUMBER: Episode 10
SCENE 01
Scene heading: INT. CHAPEL - DAY
Scene start: 00:00.00
Scene end: 01:30.00
**HIGH PRIEST (Booming):**
Start: (00:06.00) | End: (00:16.00)
"This sacred union is invalid! Alexander of Ashburton is already betrothed by Royal decree!"
**JULIANA (Palep):**
Start: (00:17.00) | End: (00:25.00)
"Alexander... tell me he lies."
**ALEXANDER (Grim, Silent):**
Start: (00:26.00) | End: (00:39.00)
"He does not lie, Juliana."
"""
    sp = parser.parse_text(script)
    res = validator.validate_candidate("00:06.00", "00:39.00", sp)
    assert res.is_valid is True
    assert res.duration_seconds == 33.0


# ---------------------------------------------------------------------------
# 11-16: WEAK STORY / LOW STAKES EPISODES (Expected: Low Scores < 6.0)
# ---------------------------------------------------------------------------

def test_11_weak_story_morning_tea(parser, validator, ranking):
    script = """EPISODE NUMBER: Episode 11
SCENE 01
Scene heading: INT. KITCHEN - MORNING
Scene start: 00:00.00
Scene end: 01:00.00
**JULIANA (Calm):**
Start: (00:05.00) | End: (00:15.00)
"Good morning, Agnes. Would you like a cup of tea?"
**AGNES (Smiling):**
Start: (00:16.00) | End: (00:25.00)
"Yes, please. Earl Grey with a bit of honey would be lovely."
**JULIANA (Gentle):**
Start: (00:26.00) | End: (00:35.00)
"Here you are. Let us enjoy the quiet morning."
"""
    sp = parser.parse_text(script)
    mock = MockLLMProvider()
    resp = mock.generate_structured(f"EPISODE NUMBER: Episode 11\n{script}", "", None)
    cand = resp.candidates[0]
    assert cand.hook_strength <= 5.0
    assert cand.emotional_impact <= 4.0
    score = ranking.calculate_overall_score(
        cand.hook_strength, cand.cliffhanger_strength, cand.standalone_context_score,
        cand.emotional_impact, cand.narrative_continuity
    )
    assert score < 60.0


def test_12_weak_story_weather_chit_chat(parser, validator, ranking):
    script = """EPISODE NUMBER: Episode 12
SCENE 01
Scene heading: EXT. GARDEN - DAY
Scene start: 00:00.00
Scene end: 01:00.00
**GERALD (Bored):**
Start: (00:04.00) | End: (00:14.00)
"The weather today is rather pleasant, wouldn't you say?"
**CLARISSA (Mild):**
Start: (00:15.00) | End: (00:26.00)
"Indeed, it might rain tomorrow afternoon, but today the sun is fine."
**GERALD (Mild):**
Start: (00:27.00) | End: (00:36.00)
"Let us take a slow stroll toward the roses."
"""
    sp = parser.parse_text(script)
    mock = MockLLMProvider()
    resp = mock.generate_structured(f"EPISODE NUMBER: Episode 12\n{script}", "", None)
    cand = resp.candidates[0]
    assert cand.cliffhanger_strength <= 4.5
    assert cand.emotional_impact <= 4.0


def test_13_weak_story_cleaning_library(parser, validator, ranking):
    script = """EPISODE NUMBER: Episode 13
SCENE 01
Scene heading: INT. LIBRARY - DAY
Scene start: 00:00.00
Scene end: 01:00.00
**AGNES:**
Start: (00:02.00) | End: (00:12.00)
"I think this shelf needs a quick dusting."
**MAID:**
Start: (00:13.00) | End: (00:24.00)
"I will fetch the feather duster and the linen cloth right away."
**AGNES:**
Start: (00:25.00) | End: (00:34.00)
"Thank you, Mary. We should finish before noon."
"""
    sp = parser.parse_text(script)
    mock = MockLLMProvider()
    resp = mock.generate_structured(f"EPISODE NUMBER: Episode 13\n{script}", "", None)
    cand = resp.candidates[0]
    score = ranking.calculate_overall_score(
        cand.hook_strength, cand.cliffhanger_strength, cand.standalone_context_score,
        cand.emotional_impact, cand.narrative_continuity
    )
    assert score < 60.0


def test_14_weak_story_polite_greetings(parser, validator, ranking):
    script = """EPISODE NUMBER: Episode 14
SCENE 01
Scene heading: INT. FOYER - DAY
Scene start: 00:00.00
Scene end: 01:00.00
**NEIGHBOR (Smiling):**
Start: (00:04.00) | End: (00:14.00)
"Good afternoon, Lady Juliana. Just dropping off the village newsletter."
**JULIANA (Polite):**
Start: (00:15.00) | End: (00:25.00)
"How kind of you, Mrs. Higgins. Have a wonderful weekend."
**NEIGHBOR:**
Start: (00:26.00) | End: (00:33.00)
"And you as well, my dear."
"""
    sp = parser.parse_text(script)
    mock = MockLLMProvider()
    resp = mock.generate_structured(f"EPISODE NUMBER: Episode 14\n{script}", "", None)
    cand = resp.candidates[0]
    assert cand.hook_strength <= 5.0
    assert cand.cliffhanger_strength <= 4.0


def test_15_weak_story_grocery_list(parser, validator, ranking):
    script = """EPISODE NUMBER: Episode 15
SCENE 01
Scene heading: INT. PANTRY - DAY
Scene start: 00:00.00
Scene end: 01:00.00
**COOK:**
Start: (00:05.00) | End: (00:15.00)
"We need three sacks of potatoes and a barrel of flour for the pantry."
**APPRENTICE:**
Start: (00:16.00) | End: (00:28.00)
"I will write it down in the supplier ledger, Chef."
**COOK:**
Start: (00:29.00) | End: (00:36.00)
"Don't forget the salt."
"""
    sp = parser.parse_text(script)
    mock = MockLLMProvider()
    resp = mock.generate_structured(f"EPISODE NUMBER: Episode 15\n{script}", "", None)
    cand = resp.candidates[0]
    assert cand.emotional_impact <= 4.0


def test_16_weak_story_carriage_ride_silence(parser, validator, ranking):
    script = """EPISODE NUMBER: Episode 16
SCENE 01
Scene heading: INT. CARRIAGE - AFTERNOON
Scene start: 00:00.00
Scene end: 01:00.00
**JULIANA:**
Start: (00:03.00) | End: (00:12.00)
"The countryside is very quiet today."
**ALEXANDER:**
Start: (00:13.00) | End: (00:24.00)
"Yes, it is peaceful in the autumn."
**JULIANA:**
Start: (00:25.00) | End: (00:32.00)
"We should arrive before dark."
"""
    sp = parser.parse_text(script)
    mock = MockLLMProvider()
    resp = mock.generate_structured(f"EPISODE NUMBER: Episode 16\n{script}", "", None)
    cand = resp.candidates[0]
    assert cand.cliffhanger_strength <= 4.0


# ---------------------------------------------------------------------------
# 17-22: RESOLVED CONFLICT EPISODES (Expected: Low Cliffhanger Score < 5.0)
# ---------------------------------------------------------------------------

def test_17_resolved_conflict_polite_apology(parser, validator, ranking):
    script = """EPISODE NUMBER: Episode 17
SCENE 01
Scene heading: INT. DRAWING ROOM - DAY
Scene start: 00:00.00
Scene end: 01:10.00
**GERALD (Humble):**
Start: (00:04.00) | End: (00:13.00)
"Juliana, I am deeply sorry for my sharp words yesterday. Please accept my apology."
**JULIANA (Gracious):**
Start: (00:14.00) | End: (00:24.00)
"I forgive you, Gerald. Let us put all grievances behind us and be at peace."
**GERALD (Relieved):**
Start: (00:25.00) | End: (00:35.00)
"Thank you. Everything is settled then. Have a wonderful evening."
"""
    sp = parser.parse_text(script)
    mock = MockLLMProvider()
    resp = mock.generate_structured(f"EPISODE NUMBER: Episode 17\n{script}", "", None)
    cand = resp.candidates[0]
    # In resolved conflicts, cliffhanger suspense is near zero
    assert cand.cliffhanger_strength <= 4.5
    assert "without impending jeopardy" in cand.cliffhanger or cand.cliffhanger_strength < 5.0


def test_18_resolved_conflict_business_agreement(parser, validator, ranking):
    script = """EPISODE NUMBER: Episode 18
SCENE 01
Scene heading: INT. STUDY - DAY
Scene start: 00:00.00
Scene end: 01:10.00
**MERCHANT (Nodding):**
Start: (00:05.00) | End: (00:15.00)
"We have agreed on fifty silver coins per shipment, signed and sealed."
**ALEXANDER (Extending hand):**
Start: (00:16.00) | End: (00:26.00)
"A fair compromise for both parties. I look forward to mutual prosperity."
**MERCHANT (Shaking hands):**
Start: (00:27.00) | End: (00:36.00)
"A pleasure doing business with you, Your Grace. Farewell."
"""
    sp = parser.parse_text(script)
    mock = MockLLMProvider()
    resp = mock.generate_structured(f"EPISODE NUMBER: Episode 18\n{script}", "", None)
    cand = resp.candidates[0]
    assert cand.cliffhanger_strength <= 4.5


def test_19_resolved_conflict_reconciled_lovers(parser, validator, ranking):
    script = """EPISODE NUMBER: Episode 19
SCENE 01
Scene heading: INT. BALCONY - NIGHT
Scene start: 00:00.00
Scene end: 01:10.00
**ALEXANDER (Softly):**
Start: (00:04.00) | End: (00:14.00)
"I should have told you about my past sooner. Will you ever forgive me?"
**JULIANA (Tearful smile):**
Start: (00:15.00) | End: (00:25.00)
"I understand your burden, Alexander. I love you, and nothing can part us now."
**ACTION:**
Start: (00:26.00) | End: (00:35.00)
They embrace peacefully under the starlight as soft music plays.
"""
    sp = parser.parse_text(script)
    mock = MockLLMProvider()
    resp = mock.generate_structured(f"EPISODE NUMBER: Episode 19\n{script}", "", None)
    cand = resp.candidates[0]
    assert cand.cliffhanger_strength <= 4.5


def test_20_resolved_conflict_lost_key_found(parser, validator, ranking):
    script = """EPISODE NUMBER: Episode 20
SCENE 01
Scene heading: INT. ATTIC - DAY
Scene start: 00:00.00
Scene end: 01:05.00
**AGNES (Frantic):**
Start: (00:02.00) | End: (00:10.00)
"The key to the dowry chest is gone! Someone must have stolen it!"
**JULIANA (Checking pocket):**
Start: (00:11.00) | End: (00:19.00)
"Wait, here it is in my apron pocket. It wasn't stolen at all."
**AGNES (Relieved):**
Start: (00:20.00) | End: (00:30.00)
"Oh, praise the heavens! All is well."
"""
    sp = parser.parse_text(script)
    mock = MockLLMProvider()
    resp = mock.generate_structured(f"EPISODE NUMBER: Episode 20\n{script}", "", None)
    cand = resp.candidates[0]
    assert cand.cliffhanger_strength <= 4.5


def test_21_resolved_conflict_peace_treaty_ratified(parser, validator, ranking):
    script = """EPISODE NUMBER: Episode 21
SCENE 01
Scene heading: INT. THRONE ROOM - DAY
Scene start: 00:00.00
Scene end: 01:10.00
**CHANCELLOR:**
Start: (00:04.00) | End: (00:14.00)
"Both kingdoms have ratified the border treaty. The war is officially over."
**KING:**
Start: (00:15.00) | End: (00:25.00)
"Let the bells ring throughout the land in celebration of permanent peace."
**ACTION:**
Start: (00:26.00) | End: (00:35.00)
Courtiers bow respectfully as the ambassadors toast with warm smiles.
"""
    sp = parser.parse_text(script)
    mock = MockLLMProvider()
    resp = mock.generate_structured(f"EPISODE NUMBER: Episode 21\n{script}", "", None)
    cand = resp.candidates[0]
    assert cand.cliffhanger_strength <= 4.5


def test_22_resolved_conflict_family_forgiveness(parser, validator, ranking):
    script = """EPISODE NUMBER: Episode 22
SCENE 01
Scene heading: INT. GARDEN ARBOR - DAY
Scene start: 00:00.00
Scene end: 01:05.00
**SISTER (Tearfully):**
Start: (00:04.00) | End: (00:13.00)
"I was envious of you, Juliana. Can you ever forgive me?"
**JULIANA (Warmly):**
Start: (00:14.00) | End: (00:23.00)
"We are sisters. I forgive you completely."
**ACTION:**
Start: (00:24.00) | End: (00:33.00)
They clasp hands in mutual reconciliation.
"""
    sp = parser.parse_text(script)
    mock = MockLLMProvider()
    resp = mock.generate_structured(f"EPISODE NUMBER: Episode 22\n{script}", "", None)
    cand = resp.candidates[0]
    assert cand.cliffhanger_strength <= 4.5


# ---------------------------------------------------------------------------
# 23-27: MALFORMED TIMESTAMPS (Expected: INVALID / REJECTED)
# ---------------------------------------------------------------------------

def test_23_malformed_timestamp_inverted_times(parser, validator):
    script = """EPISODE NUMBER: Episode 23
SCENE 01
Scene heading: INT. ROOM - DAY
Scene start: 00:00.00
Scene end: 01:00.00
**A:**
Start: (00:05.00) | End: (00:10.00)
"Line 1"
**B:**
Start: (00:11.00) | End: (00:45.00)
"Line 2"
"""
    sp = parser.parse_text(script)
    # Start after End
    res = validator.validate_candidate("00:45.00", "00:10.00", sp)
    assert res.is_valid is False
    assert res.status == "invalid"
    assert any("must occur before end" in l for l in res.limitations)


def test_24_malformed_timestamp_garbage_text(parser, validator):
    script = """EPISODE NUMBER: Episode 24
SCENE 01
Scene heading: INT. ROOM - DAY
Scene start: 00:00.00
Scene end: 01:00.00
**A:**
Start: (00:05.00) | End: (00:35.00)
"Line"
"""
    sp = parser.parse_text(script)
    res = validator.validate_candidate("not_a_time", "corrupted_end", sp)
    assert res.is_valid is False
    assert res.status == "invalid"
    assert any("Malformed timestamp" in l for l in res.limitations)


def test_25_malformed_timestamp_negative_time(parser, validator):
    script = """EPISODE NUMBER: Episode 25
SCENE 01
Scene heading: INT. ROOM - DAY
Scene start: 00:00.00
Scene end: 01:00.00
**A:**
Start: (00:05.00) | End: (00:35.00)
"Line"
"""
    sp = parser.parse_text(script)
    res = validator.validate_candidate("-00:10.00", "00:20.00", sp)
    assert res.is_valid is False
    assert res.status == "invalid"


def test_26_malformed_timestamp_colons_overflow(parser, validator):
    script = """EPISODE NUMBER: Episode 26
SCENE 01
Scene heading: INT. ROOM - DAY
Scene start: 00:00.00
Scene end: 01:00.00
**A:**
Start: (00:05.00) | End: (00:35.00)
"Line"
"""
    sp = parser.parse_text(script)
    res = validator.validate_candidate("00:01:02:03.00", "00:30.00", sp)
    assert res.is_valid is False
    assert res.status == "invalid"


def test_27_malformed_timestamp_start_equals_end(parser, validator):
    script = """EPISODE NUMBER: Episode 27
SCENE 01
Scene heading: INT. ROOM - DAY
Scene start: 00:00.00
Scene end: 01:00.00
**A:**
Start: (00:15.00) | End: (00:35.00)
"Line"
"""
    sp = parser.parse_text(script)
    res = validator.validate_candidate("00:15.00", "00:15.00", sp)
    assert res.is_valid is False
    assert res.status == "invalid"


# ---------------------------------------------------------------------------
# 28-32: MISSING & INVENTED TIMESTAMPS (Expected: REJECTED / NO INVENTED TIMES)
# ---------------------------------------------------------------------------

def test_28_missing_timestamp_invented_start(parser, validator):
    script = """EPISODE NUMBER: Episode 28
SCENE 01
Scene heading: INT. ROOM - DAY
Scene start: 00:00.00
Scene end: 01:00.00
**A:**
Start: (00:05.00) | End: (00:30.00)
"Real dialogue"
"""
    sp = parser.parse_text(script)
    # LLM invented timestamp 04:00.00 which does not exist in script
    res = validator.validate_candidate("04:00.00", "04:30.00", sp)
    assert res.is_valid is False
    assert res.status == "invalid"
    assert any("does not exist in source screenplay cues" in l for l in res.limitations)


def test_29_missing_timestamp_empty_cue_headers(parser):
    script = """EPISODE NUMBER: Episode 29
SCENE 01
Scene heading: INT. ROOM - DAY
Scene start: 
Scene end: 
**A:**
Start: | End: 
"Dialogue with missing timestamps"
"""
    with pytest.raises(ScreenplayParseException):
        parser.parse_text(script)


def test_30_missing_timestamp_invented_end(parser, validator):
    script = """EPISODE NUMBER: Episode 30
SCENE 01
Scene heading: INT. ROOM - DAY
Scene start: 00:00.00
Scene end: 01:00.00
**A:**
Start: (00:05.00) | End: (00:30.00)
"Real line"
"""
    sp = parser.parse_text(script)
    # Start exists (00:05.00), but end is completely fabricated (05:45.00)
    res = validator.validate_candidate("00:05.00", "05:45.00", sp)
    assert res.is_valid is False
    assert res.status == "invalid"


def test_31_missing_timestamp_no_scenes_detected(parser):
    script = """EPISODE NUMBER: Episode 31
EPISODE LOGLINE: Testing floating lines without scene headers
Some text with no SCENE block or timecodes.
"""
    with pytest.raises(ScreenplayParseException):
        parser.parse_text(script)


def test_32_missing_timestamp_cues_not_in_range(parser, validator):
    script = """EPISODE NUMBER: Episode 32
SCENE 01
Scene heading: INT. CELLAR - NIGHT
Scene start: 00:00.00
Scene end: 00:40.00
**A:**
Start: (00:02.00) | End: (00:10.00)
"Only one line here."
"""
    sp = parser.parse_text(script)
    res = validator.validate_candidate("00:02.00", "00:59.00", sp)
    assert res.is_valid is False
    assert res.status == "invalid"


# ---------------------------------------------------------------------------
# 33-36: OUT-OF-BOUNDS PROMO DURATION (Expected: INVALID / EXACT DURATION REPORTED)
# ---------------------------------------------------------------------------

def test_33_out_of_bounds_too_short_5s(parser, validator):
    script = """EPISODE NUMBER: Episode 33
SCENE 01
Scene heading: INT. HALL - DAY
Scene start: 00:00.00
Scene end: 01:00.00
**A:**
Start: (00:02.00) | End: (00:07.20)
"Just five seconds!"
"""
    sp = parser.parse_text(script)
    res = validator.validate_candidate("00:02.00", "00:07.20", sp)
    assert res.is_valid is False
    assert res.status == "invalid"
    assert res.duration_seconds == 5.20  # Never artificially inflated!
    assert any("below minimum requirement" in l for l in res.limitations)


def test_34_out_of_bounds_too_short_12s(parser, validator):
    script = """EPISODE NUMBER: Episode 34
SCENE 01
Scene heading: INT. HALL - DAY
Scene start: 00:00.00
Scene end: 01:00.00
**A:**
Start: (00:05.00) | End: (00:17.00)
"Twelve seconds."
"""
    sp = parser.parse_text(script)
    res = validator.validate_candidate("00:05.00", "00:17.00", sp)
    assert res.is_valid is False
    assert res.status == "invalid"
    assert res.duration_seconds == 12.0
    assert any("below minimum requirement" in l for l in res.limitations)


def test_35_out_of_bounds_too_long_75s(parser, validator):
    script = """EPISODE NUMBER: Episode 35
SCENE 01
Scene heading: INT. BALLROOM - NIGHT
Scene start: 00:00.00
Scene end: 02:00.00
**A:**
Start: (00:05.00) | End: (01:20.00)
"A long monologue that spans 75 seconds."
"""
    sp = parser.parse_text(script)
    res = validator.validate_candidate("00:05.00", "01:20.00", sp)
    assert res.is_valid is False
    assert res.status == "invalid"
    assert res.duration_seconds == 75.0  # Kept authentic, not clamped
    assert any("exceeds maximum promo limit" in l for l in res.limitations)


def test_36_out_of_bounds_too_long_120s(parser, validator):
    script = """EPISODE NUMBER: Episode 36
SCENE 01
Scene heading: INT. BALLROOM - NIGHT
Scene start: 00:00.00
Scene end: 03:00.00
**A:**
Start: (00:00.00) | End: (02:00.00)
"Two full minutes."
"""
    sp = parser.parse_text(script)
    res = validator.validate_candidate("00:00.00", "02:00.00", sp)
    assert res.is_valid is False
    assert res.status == "invalid"
    assert res.duration_seconds == 120.0
    assert any("exceeds maximum promo limit" in l for l in res.limitations)


# ---------------------------------------------------------------------------
# 37-38: EMPTY & CORRUPTED SCREENPLAYS (Expected: Clear Parse Error, No Promo)
# ---------------------------------------------------------------------------

def test_37_empty_screenplay_blank_file(parser):
    with pytest.raises(ScreenplayParseException) as exc:
        parser.parse_text("")
    assert "empty or contains only whitespace" in str(exc.value)


def test_38_empty_screenplay_header_only(parser):
    script = """EPISODE NUMBER: Episode 38
EPISODE LOGLINE: Only metadata here.
CONTINUITY NOTES: Nothing else follows.
"""
    with pytest.raises(ScreenplayParseException) as exc:
        parser.parse_text(script)
    assert "no valid scenes or dialogue cues" in str(exc.value)


# ---------------------------------------------------------------------------
# 39: DUPLICATE PROCESSING (Expected: Idempotent, 0 Duplicates)
# ---------------------------------------------------------------------------

def test_39_duplicate_processing_idempotence(db_session, tmp_path):
    show = Show(title="Duplicate Test Show", language="English")
    db_session.add(show)
    db_session.commit()

    script_content = """EPISODE NUMBER: Episode 39
SCENE 01
Scene heading: INT. TENT - NIGHT
Scene start: 00:00.00
Scene end: 01:10.00
**WARRIOR (Grim):**
Start: (00:04.00) | End: (00:14.00)
"The fortress has fallen. We must withdraw immediately!"
**GENERAL (Unyielding):**
Start: (00:15.00) | End: (00:32.00)
"We stand our ground until the last banner burns."
"""
    script_file = tmp_path / "ep39.txt"
    script_file.write_text(script_content, encoding="utf-8")

    ep = Episode(
        show_id=show.id,
        episode_number=39,
        original_filename="ep39.txt",
        file_path=str(script_file),
        processing_status=ProcessingStatus.PENDING.value
    )
    db_session.add(ep)
    db_session.commit()

    detector = CandidateDetector(llm_provider=MockLLMProvider())
    
    # Run 1
    promos_run1 = detector.process_episode(ep.id, db_session)
    count_run1 = len(promos_run1)
    assert count_run1 >= 1

    # Run 2 (Reprocessing same episode)
    promos_run2 = detector.process_episode(ep.id, db_session)
    count_run2 = len(promos_run2)

    promo_repo = PromoRepository(db_session)
    stored_promos = promo_repo.list_promos(show_id=show.id, episode_number=39)

    assert count_run1 == count_run2
    assert len(stored_promos) == count_run1  # Exactly 0 duplicates created!


# ---------------------------------------------------------------------------
# 40: PROVIDER FAILURE REPORTING (Expected: Clean Exception, No Fake Fallback)
# ---------------------------------------------------------------------------

from unittest.mock import patch

def test_40_provider_failure_reporting():
    # Verify Gemini provider raises LLMInferenceException on failure (no silent mock fallback)
    gemini = GeminiProvider(api_key="test_key", model_name="gemini-3.8-flash")
    
    with patch("google.generativeai.GenerativeModel.generate_content", side_effect=Exception("429 ResourceExhausted: Quota exceeded")):
        with pytest.raises(LLMInferenceException) as exc:
            gemini.generate_structured(
                prompt="Test prompt",
                system_instruction="Test system",
                response_schema=None
            )
        # Confirms provider failure is explicitly raised rather than silently generating mock promos
        assert "429" in str(exc.value) or "quota" in str(exc.value).lower()
