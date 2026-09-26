"""Invented written observations only; no patient or medical images are used."""
from pathlib import Path
from shutil import copyfile
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4
from reportlab.lib.colors import HexColor
from pypdf import PdfReader

out = Path('output/pdf'); out.mkdir(parents=True, exist_ok=True)
target = out / 'synthetic-written-imaging-report.pdf'
c = canvas.Canvas(str(target), pagesize=A4)
c.setTitle('Fictional written ultrasound, CT and MRI reports')
c.setAuthor('GI Compass software test fixture')
w, h = A4
pages = [
    ('Ultrasound abdomen', '20 September 2026', [
        ('Observation', 'Gallbladder: no calculi seen on this examination.'),
        ('Observation', 'Bowel assessment is limited by overlying gas.'),
        ('Impression', 'Bowel findings cannot be assessed on this ultrasound.')]),
    ('CT abdomen and pelvis', '21 September 2026', [
        ('Observation', 'Segmental wall thickening of the sigmoid colon is described.'),
        ('Impression', 'Indeterminate sigmoid wall thickening.'),
        ('Recommendation', 'Endoscopic correlation advised in the written report.')]),
    ('MRI abdomen', '10 March 2025', [
        ('Observation', 'No focal liver lesion is identified on this examination.'),
        ('Limitations', 'This examination does not provide a dedicated bowel assessment.'),
        ('Impression', 'No focal liver lesion on this historical examination.')]),
]
for index, (title, date, rows) in enumerate(pages, 1):
    c.setFillColor(HexColor('#087c80')); c.rect(0, h-12, w, 12, fill=1, stroke=0)
    c.setFillColor(HexColor('#10263c')); c.setFont('Helvetica-Bold', 21)
    c.drawString(42, h-57, 'GI Compass | Written imaging fixture')
    c.setFillColor(HexColor('#9b3e28')); c.setFont('Helvetica-Bold', 12)
    c.drawString(42, h-88, 'SYNTHETIC - NOT A MEDICAL RECORD')
    c.setFillColor(HexColor('#40566d')); c.setFont('Helvetica', 11)
    c.drawString(42, h-124, 'Patient: Aarav Mehra (fictional) | Synthetic ID: SYN-DEMO-IMG')
    c.drawString(42, h-145, 'Report date: ' + date)
    c.setFillColor(HexColor('#10263c')); c.setFont('Helvetica-Bold', 18)
    c.drawString(42, h-198, title)
    y = h-243
    for label, value in rows:
        c.setFont('Helvetica-Bold', 11); c.drawString(42, y, label)
        c.setFont('Helvetica', 11); c.drawString(42, y-24, value)
        y -= 79
    c.setFont('Helvetica-Bold', 10); c.drawString(42, 210, 'Software demonstration only')
    c.setFont('Helvetica', 10)
    for n, text in enumerate([
        'All identities, dates and observations are invented for workflow testing.',
        'No scan was performed. No radiologist issued or verified this document.',
        'These are written report statements, not medical images or clinical advice.',
        'Do not use this fixture to guide care. Different report dates are intentional.',
    ]): c.drawString(42, 187-n*19, text)
    c.setStrokeColor(HexColor('#dce5eb')); c.line(42, 66, w-42, 66)
    c.setFont('Helvetica', 9); c.drawString(42, 47, 'DRAFT fictional fixture | No real patient information')
    c.drawRightString(w-42, 47, f'Page {index} of {len(pages)}'); c.showPage()
c.save()
Path('public/demo-assets').mkdir(parents=True, exist_ok=True)
copyfile(target, Path('public/demo-assets') / target.name)
reader = PdfReader(target)
assert len(reader.pages) == 3
assert all('SYNTHETIC' in p.extract_text() for p in reader.pages)
print('Created three-page fictional written imaging fixture.')
