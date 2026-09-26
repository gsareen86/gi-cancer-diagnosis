"""Invented report for software demonstrations. No real laboratory or patient."""
from pathlib import Path
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor
from reportlab.lib.pagesizes import A4
from shutil import copyfile
import pypdfium2
from pypdf import PdfReader
out=Path('output/pdf'); out.mkdir(parents=True,exist_ok=True)
target=out/'synthetic-whole-body-report.pdf'
c=canvas.Canvas(str(target),pagesize=A4)
c.setTitle('GI Compass - fictional whole-body laboratory report')
c.setAuthor('GI Compass synthetic demonstration')
width,height=A4
sections=[('Blood count and iron profile',[
 ('Haemoglobin','10.4','g/dL','13.0 - 17.0'),('WBC count','7.2','10^9/L','4.0 - 11.0'),('Platelet count','345','10^9/L','150 - 400'),('MCV','74','fL','80 - 100'),('Ferritin','12','ng/mL','30 - 400'),('Serum iron','34','ug/dL','60 - 170')]),
 ('Liver, kidney and metabolic profile',[
 ('Total bilirubin','0.8','mg/dL','0.2 - 1.2'),('Direct bilirubin','0.2','mg/dL','0.0 - 0.3'),('AST (SGOT)','27','U/L','10 - 40'),('ALT (SGPT)','31','U/L','7 - 56'),('Alkaline phosphatase','92','U/L','44 - 147'),('Albumin','4.0','g/dL','3.5 - 5.0'),('Creatinine','0.9','mg/dL','0.7 - 1.3'),('Fasting glucose','104','mg/dL','70 - 99'),('Sodium','139','mmol/L','135 - 145'),('Potassium','4.2','mmol/L','3.5 - 5.1')]),
 ('Lipids, thyroid and report context',[
 ('Total cholesterol','187','mg/dL','Below 200'),('HDL cholesterol','44','mg/dL','40 or above'),('LDL cholesterol','112','mg/dL','Below 100'),('Triglycerides','153','mg/dL','Below 150'),('TSH','2.4','mIU/L','0.4 - 4.0')])]
for page,(title,rows) in enumerate(sections,1):
 c.setFillColor(HexColor('#087c80'));c.rect(0,height-12,width,12,fill=1,stroke=0)
 c.setFillColor(HexColor('#10263c'));c.setFont('Helvetica-Bold',23);c.drawString(42,height-56,'GI Compass | Demonstration lab')
 c.setFillColor(HexColor('#9b3e28'));c.setFont('Helvetica-Bold',12);c.drawString(42,height-83,'SYNTHETIC - NOT A MEDICAL RECORD')
 c.setFillColor(HexColor('#40566d'));c.setFont('Helvetica',10)
 for n,line in enumerate(['Patient: Aarav Mehra (fictional)     Age / sex: 52 years / Male','Synthetic reference: SYN-DEMO-WB-001     Sample date: 18 September 2026','Report date: 18 September 2026     Specimen: blood (invented)']):c.drawString(42,height-116-n*18,line)
 c.setFillColor(HexColor('#10263c'));c.setFont('Helvetica-Bold',17);c.drawString(42,height-201,title)
 y=height-239
 c.setFillColor(HexColor('#e6f1f2'));c.rect(42,y-10,width-84,30,fill=1,stroke=0)
 c.setFillColor(HexColor('#10263c'));c.setFont('Helvetica-Bold',10)
 for x,label in [(52,'Test'),(274,'Result'),(335,'Units'),(425,'Reference example')]:c.drawString(x,y,label)
 c.setFont('Helvetica',10)
 for name,value,unit,ref in rows:
  y-=34;c.setStrokeColor(HexColor('#dce5eb'));c.line(42,y-12,width-42,y-12)
  for x,label in [(52,name),(274,value),(335,unit),(425,ref)]:c.drawString(x,y,label)
 y-=48;c.setFont('Helvetica-Bold',10);c.drawString(42,y,'Demonstration context')
 c.setFont('Helvetica',10)
 notes=['All values and identities were invented for testing software workflows.','Reference examples vary by method and laboratory; these are not clinical guidance.','No sample was collected. No laboratory has issued or verified this document.','This report is not a diagnosis and must not be used to guide patient care.']
 if page==3:notes+=['The fictional encounter describes altered bowel habit and intermittent bleeding.','There is no colonoscopy, biopsy, CT interpretation or confirmed cancer diagnosis.']
 for line in notes:y-=17;c.drawString(42,y,line)
 c.setStrokeColor(HexColor('#dce5eb'));c.line(42,66,width-42,66)
 c.setFillColor(HexColor('#60758a'));c.setFont('Helvetica',9);c.drawString(42,47,'DRAFT fixture | For software demonstration only');c.drawRightString(width-42,47,f'Page {page} of 3')
 c.showPage()
c.save()
asset=Path('public/demo-assets');asset.mkdir(parents=True,exist_ok=True);copyfile(target,asset/target.name)
qa=Path('var/pdf-qa');qa.mkdir(parents=True,exist_ok=True)
doc=pypdfium2.PdfDocument(str(target))
for i,page in enumerate(doc):page.render(scale=1.3).to_pil().save(qa/f'whole-body-{i+1}.png')
reader=PdfReader(target)
assert len(reader.pages)==3 and all('SYNTHETIC' in p.extract_text() for p in reader.pages)
print('Created and rendered 3-page synthetic report.')
