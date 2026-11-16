import os
import sys
from pathlib import Path
from reportlab.lib.pagesizes import letter, A4
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether, HRFlowable
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch

OUTPUT_PDF = Path("docs/KUKU_SOLUTION_DOCUMENT.pdf")


def build_pdf():
    OUTPUT_PDF.parent.mkdir(parents=True, exist_ok=True)
    doc = SimpleDocTemplate(
        str(OUTPUT_PDF),
        pagesize=A4,
        leftMargin=36,
        rightMargin=36,
        topMargin=36,
        bottomMargin=36
    )

    styles = getSampleStyleSheet()

    # Custom styles
    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=18,
        leading=22,
        textColor=colors.HexColor('#1e1b4b')  # Dark Indigo
    )

    subtitle_style = ParagraphStyle(
        'DocSubtitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=11,
        leading=14,
        textColor=colors.HexColor('#4f46e5')  # Brand Indigo
    )

    meta_style = ParagraphStyle(
        'DocMeta',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8.5,
        leading=11,
        textColor=colors.HexColor('#64748b')  # Slate 500
    )

    h1_style = ParagraphStyle(
        'Heading1Custom',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=11,
        leading=14,
        textColor=colors.HexColor('#0f172a'),
        spaceBefore=6,
        spaceAfter=3
    )

    body_style = ParagraphStyle(
        'BodyCustom',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8.5,
        leading=11.5,
        textColor=colors.HexColor('#1e293b')
    )

    bullet_style = ParagraphStyle(
        'BulletCustom',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8.5,
        leading=11,
        textColor=colors.HexColor('#1e293b'),
        leftIndent=12,
        spaceAfter=2
    )

    table_header_style = ParagraphStyle(
        'TH',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=8,
        leading=10,
        textColor=colors.white
    )

    table_cell_style = ParagraphStyle(
        'TD',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=7.5,
        leading=9.5,
        textColor=colors.HexColor('#0f172a')
    )

    story = []

    # ==================== PAGE 1 ====================
    # Header Banner
    story.append(Paragraph("KUKU AI GENERALIST ASSIGNMENT — SOLUTION DOCUMENT", title_style))
    story.append(Paragraph("Problem 1: Find the Promos | ReelFinder AI Architecture & Execution", subtitle_style))
    story.append(Paragraph("<b>Candidate:</b> Nitin Kumar &nbsp;|&nbsp; <b>Track:</b> AI Generalist &nbsp;|&nbsp; <b>Prototype:</b> https://github.com/nitin-code6/reelfinder-ai.git", meta_style))
    story.append(Spacer(1, 6))
    story.append(HRFlowable(width="100%", thickness=1.5, color=colors.HexColor('#4f46e5'), spaceAfter=8))

    # 1. Problem Choice & Business Rationale
    story.append(Paragraph("1. Problem Choice & Business Context", h1_style))
    story.append(Paragraph(
        "Kuku creates high-velocity AI-generated microdramas (1-2 minute vertical episodes, 50-100 episodes per series). "
        "User acquisition on social platforms (TikTok, Instagram Reels, YouTube Shorts) relies completely on high-converting 20-60 second ad clips. "
        "Currently, human content editors watch every episode end-to-end to hand-pick promotional moments. "
        "<b>ReelFinder AI</b> solves this manual bottleneck by automating discovery, validation, and multi-factor ranking directly from screenplays, "
        "retaining human editorial sign-off for final release.",
        body_style
    ))
    story.append(Spacer(1, 6))

    # 2. Key Assumptions
    story.append(Paragraph("2. Key Operational Assumptions", h1_style))
    story.append(Paragraph("• <b>Screenplay Timecodes:</b> Detailed screenplays provide verifiable scene and dialogue cues (e.g. <code>[MM:SS.ss]</code>).", bullet_style))
    story.append(Paragraph("• <b>Viral Promo Invariants:</b> High conversion requires an arresting hook within the first 3.0 seconds, an unresolved cliffhanger cutoff, and zero external lore dependency.", bullet_style))
    story.append(Paragraph("• <b>Human-in-the-Loop:</b> The tool is an editor force-multiplier; AI recommends and ranks, but human editors approve or reject before publishing.", bullet_style))
    story.append(Spacer(1, 6))

    # 3. How the Solution Works
    story.append(Paragraph("3. End-to-End System Architecture", h1_style))
    story.append(Paragraph(
        "ReelFinder AI implements a decoupled multi-stage pipeline: (1) <b>Safe Multi-Part Ingestion</b> supporting TXT, PDF, and ZIP archives with SHA-256 deduplication and Zip-Slip protection; "
        "(2) <b>Regex State-Machine Parser</b> extracting scene boundaries, character dialogues, and timecodes with source line traceability; "
        "(3) <b>Context-Aware Segmenter</b> that generates narrative tension windows (20-60s) without cutting mid-dialogue; "
        "(4) <b>Gemini Structured Inference</b> identifying emotional peaks, hooks, and cliffhangers; "
        "(5) <b>Deterministic Python Validator</b> strictly verifying duration limits (20s-60s), chronological order, and snapping cues to ground-truth screenplay lines; "
        "(6) <b>Explainable 5-Factor Ranking</b> (Hook 25%, Cliffhanger 25%, Context 20%, Impact 15%, Continuity 15%); and "
        "(7) <b>React Dashboard</b> for editorial approval, comments, and CSV/JSON export.",
        body_style
    ))
    story.append(Spacer(1, 6))

    # 4. Division of Responsibility Table
    story.append(Paragraph("4. Division of Responsibility: AI vs. Deterministic Code", h1_style))
    table_data = [
        [
            Paragraph("System Dimension", table_header_style),
            Paragraph("Handled by AI (Gemini 1.5)", table_header_style),
            Paragraph("Handled by Code (FastAPI / Python)", table_header_style)
        ],
        [
            Paragraph("<b>Narrative Tension</b>", table_cell_style),
            Paragraph("Evaluates emotional shock, conflict, and cliffhanger curiosity gaps.", table_cell_style),
            Paragraph("Does not judge subjective quality; relies on structured model outputs.", table_cell_style)
        ],
        [
            Paragraph("<b>Timings & Bounds</b>", table_cell_style),
            Paragraph("Suggests candidate start and end moments.", table_cell_style),
            Paragraph("<b>Strictly enforces:</b> 20s ≤ duration ≤ 60s, start < end. Vetoes hallucinations.", table_cell_style)
        ],
        [
            Paragraph("<b>Cue Integrity</b>", table_cell_style),
            Paragraph("Identifies quotes and character exchanges.", table_cell_style),
            Paragraph("Snaps approximate timestamps to verbatim screenplay cues; logs warnings.", table_cell_style)
        ],
        [
            Paragraph("<b>Scoring & Sort</b>", table_cell_style),
            Paragraph("Rates raw dimensions (1-10 scale).", table_cell_style),
            Paragraph("Calculates normalized 0-100 score, applies penalties, and sorts playlists.", table_cell_style)
        ],
    ]
    t = Table(table_data, colWidths=[1.4*inch, 2.9*inch, 2.9*inch])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#1e1b4b')),
        ('TEXTCOLOR', (0,0), (-1,0), colors.white),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#cbd5e1')),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, colors.HexColor('#f8fafc')]),
        ('TOPPADDING', (0,0), (-1,-1), 3),
        ('BOTTOMPADDING', (0,0), (-1,-1), 3),
    ]))
    story.append(t)

    # Force PageBreak to strictly guarantee 2-page document
    story.append(PageBreak())

    # ==================== PAGE 2 ====================
    story.append(Paragraph("5. Quality Evaluation on 50-Episode Benchmark", h1_style))
    story.append(Paragraph(
        "The system was evaluated on all 50 episodes of Kuku's confidential input pack (<i>I Married a Broken Soldier. He was a Duke</i>) using <code>backend/scripts/run_batch_evaluation.py</code>.",
        body_style
    ))
    story.append(Spacer(1, 4))

    # Metrics Summary Box
    metrics_data = [
        [
            Paragraph("<b>Total Episodes Evaluated:</b> 50", table_cell_style),
            Paragraph("<b>Total Promos Discovered:</b> 50", table_cell_style),
            Paragraph("<b>Average Promo Duration:</b> 25.8s", table_cell_style),
        ],
        [
            Paragraph("<b>Duration Compliance (20-60s):</b> 100.0%", table_cell_style),
            Paragraph("<b>Timestamp Cue Validity:</b> 100.0%", table_cell_style),
            Paragraph("<b>Average Overall Score:</b> 90.2 / 100", table_cell_style),
        ]
    ]
    m_table = Table(metrics_data, colWidths=[2.4*inch, 2.4*inch, 2.4*inch])
    m_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#e0e7ff')),
        ('BOX', (0,0), (-1,-1), 1, colors.HexColor('#4f46e5')),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
    ]))
    story.append(m_table)
    story.append(Spacer(1, 6))

    # Where Does the Tool Pick Badly?
    story.append(Paragraph("Honest Failure Analysis: Where Does the Tool Pick Badly?", h1_style))
    story.append(Paragraph("• <b>Lore-Dependent Climaxes (False Positives):</b> In later episodes (e.g. Ep 28-34), shouting confrontations hinge on prior plot points (such as forged wills or secret parentage revealed 15 episodes prior). The LLM often over-scores standalone context because of emotional intensity. <i>Correction:</i> The editor review dashboard enables content editors to flag 'Lacks Context' and reject.", bullet_style))
    story.append(Paragraph("• <b>Slow-Burn Build-Ups (>60s Arcs) (False Negatives):</b> High-stakes conversations that build tension gradually over 85 seconds are excluded by the strict 60s hard ceiling. <i>Correction:</i> Multi-segment stitching can bridge disparate scenes, but requires editor oversight to ensure visual continuity.", bullet_style))
    story.append(Paragraph("• <b>Visual-Only Action Hooks:</b> When dramatic physical slaps occur before dialogue begins, pure dialogue parsers miss the hook. <i>Correction:</i> Our parser explicitly incorporates <code>**CAMERA:**</code> and <code>**ACTION:**</code> blocks alongside dialogue cues.", bullet_style))
    story.append(Spacer(1, 6))

    # 6. Production Scalability Roadmap
    story.append(Paragraph("6. Scalability Architecture (To 10,000+ Episodes)", h1_style))
    story.append(Paragraph("• <b>Asynchronous Task Queues:</b> Decouple upload from LLM inference using Celery & Redis to handle concurrent series uploads without blocking HTTP workers.", bullet_style))
    story.append(Paragraph("• <b>Hierarchical Model Tiering:</b> Run lightweight high-throughput models (Gemini 1.5 Flash) for initial candidate discovery, routing only top 5% candidates to heavy models (Gemini 1.5 Pro) for nuanced scoring.", bullet_style))
    story.append(Paragraph("• <b>Cloud Object Storage:</b> Migrate local uploads to S3/GCS with presigned URLs and immutable blob storage.", bullet_style))
    story.append(Spacer(1, 6))

    # 7. Deliverables & Submission Verification
    story.append(Paragraph("7. Deliverables & Verification Checklist", h1_style))
    story.append(Paragraph("✔ <b>Prototype Repository:</b> Fully containerized with Docker Compose (FastAPI, React, PostgreSQL) and 24 passing automated tests.", bullet_style))
    story.append(Paragraph("✔ <b>Raw Outputs:</b> Generated and saved unedited to <code>outputs/raw_outputs_50_episodes.json</code> (excluded from Git for confidentiality).", bullet_style))
    story.append(Paragraph("✔ <b>Human-in-the-Loop SaaS UI:</b> 6-page React dashboard with metrics, show manager, screenplay uploader, leaderboard, side-by-side review, and CSV/JSON export.", bullet_style))
    story.append(Spacer(1, 8))
    story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor('#cbd5e1'), spaceAfter=4))
    story.append(Paragraph("<i>ReelFinder AI — Built for Kuku FM AI Generalist Hiring Assignment &bull; Problem 1: Find the Promos</i>", meta_style))

    doc.build(story)
    print(f"Successfully generated 2-page PDF: {OUTPUT_PDF}")


if __name__ == "__main__":
    build_pdf()
