"""Build the same Polish operator handbook as private HTML and a navigable PDF.

Development only: reportlab and Pillow. The deployed Node service reads the
committed HTML/PDF/images and never executes this script or receives client data.
"""
import argparse
import html
import json
import re
import shutil
import textwrap
from pathlib import Path
from urllib.parse import urlparse
from xml.sax.saxutils import escape

from PIL import Image as PillowImage
from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    BaseDocTemplate, Flowable, Frame, Image, KeepTogether, PageBreak,
    PageTemplate, Paragraph, Spacer, Table, TableStyle,
)
from reportlab.platypus.tableofcontents import TableOfContents

ROOT = Path(__file__).resolve().parents[1]
MANUAL = ROOT / 'manual'
OFFER = json.loads((ROOT / 'commercial/offer.json').read_text())
EDITION = '1.0'
DATE = '25.10.2026'
PDF_NAME = 'dawkoz-instrukcja-realizacji-zamowien.pdf'
TITLE = 'DAWKOZ — instrukcja realizacji zamówień'
TYPES = {'p', 'heading', 'note', 'steps', 'checklist', 'table', 'code', 'links', 'image'}


def money(cents):
    value = f'{cents / 100:,.2f}'.replace(',', ' ').replace('.', ',')
    if value.endswith(',00'):
        value = value[:-3]
    return value + ' zł'


def values():
    result = {}
    for key, plan in OFFER['plans'].items():
        for field, value in plan.items():
            result[key + '.' + field] = str(value)
        result[key + '.setup'] = money(plan['setupCents'])
        result[key + '.monthly'] = money(plan['monthlyCents'])
    for key, service in OFFER['otherServices'].items():
        for field, value in service.items():
            if not isinstance(value, dict):
                result[key + '.' + field] = str(value)
        result[key + '.setup'] = money(service['setupCents'])
        result[key + '.care'] = money(service['careMonthlyCents'])
    for key, example in OFFER['otherServices']['automation']['examples'].items():
        result[key + '.setup'] = money(example['setupCents'])
    for field, key in [('ivrExtraMinuteCents', 'ivrExtra'), ('aiExtraMinuteCents', 'aiExtra'), ('extraSmsPartCents', 'smsExtra'), ('extraWorkHourCents', 'extraWork')]:
        result['billing.' + key] = money(OFFER['billing'][field])
    return result


VARIABLES = values()


def resolve(value):
    if isinstance(value, dict):
        return {key: resolve(item) for key, item in value.items()}
    if isinstance(value, list):
        return [resolve(item) for item in value]
    if isinstance(value, str):
        def substitute(match):
            key = match.group(1)
            if key not in VARIABLES:
                raise ValueError('Unknown manual offer token: ' + key)
            return VARIABLES[key]
        return re.sub(r'\{\{([A-Za-z0-9_.]+)\}\}', substitute, value)
    return value


def load_chapters():
    chapters = []
    ids = set()
    for file in sorted((MANUAL / 'chapters').glob('*.json')):
        chapter = resolve(json.loads(file.read_text()))
        if not re.fullmatch(r'[a-z0-9-]+', chapter['id']) or chapter['id'] in ids:
            raise ValueError('Invalid or duplicate chapter ID: ' + chapter['id'])
        ids.add(chapter['id'])
        for block in chapter['blocks']:
            if block['type'] not in TYPES:
                raise ValueError('Unknown manual block: ' + block['type'])
            if block['type'] == 'image':
                if not re.fullmatch(r'[a-z0-9-]+\.png', block['file']):
                    raise ValueError('Invalid manual image filename')
                if not (MANUAL / 'assets' / block['file']).is_file():
                    raise ValueError('Missing manual image: ' + block['file'])
            if block['type'] == 'links':
                for link in block['items']:
                    if urlparse(link['url']).scheme != 'https':
                        raise ValueError('Manual reference must use HTTPS')
        chapters.append(chapter)
    required = {'start', 'proces-zamowienia', 'mapa-oferty', 'documents', 'ivr', 'bot', 'combo', 'website', 'automation', 'inquiries', 'reminders', 'invoices', 'client-panel', 'opieka-i-rozliczenia', 'sciagi-i-diagnoza'}
    if not required.issubset(ids):
        raise ValueError('Missing handbook chapters: ' + ', '.join(sorted(required - ids)))
    return chapters


def esc(text):
    return html.escape(str(text), quote=True)


def html_block(block):
    kind = block['type']
    if kind == 'p':
        return '<p>' + esc(block['text']) + '</p>'
    if kind == 'heading':
        return '<h3>' + esc(block['text']) + '</h3>'
    if kind == 'note':
        return '<aside class="guide-note" data-tone="' + esc(block.get('tone', 'info')) + '"><strong>' + esc(block['label']) + '</strong><p>' + esc(block['text']) + '</p></aside>'
    if kind == 'steps':
        heading = '<h3>' + esc(block['title']) + '</h3>' if block.get('title') else ''
        return heading + '<ol class="guide-steps">' + ''.join('<li><h4>' + esc(item['title']) + '</h4><p>' + esc(item['text']) + '</p><p class="guide-check"><strong>Sprawdź wynik:</strong> ' + esc(item['check']) + '</p></li>' for item in block['items']) + '</ol>'
    if kind == 'checklist':
        heading = '<h3>' + esc(block['title']) + '</h3>' if block.get('title') else ''
        return heading + '<ul class="guide-checklist">' + ''.join('<li>' + esc(item) + '</li>' for item in block['items']) + '</ul>'
    if kind == 'table':
        return '<div class="guide-table-wrap"><table><thead><tr>' + ''.join('<th scope="col">' + esc(item) + '</th>' for item in block['headers']) + '</tr></thead><tbody>' + ''.join('<tr>' + ''.join('<td>' + esc(item) + '</td>' for item in row) + '</tr>' for row in block['rows']) + '</tbody></table></div>'
    if kind == 'code':
        return '<pre class="guide-code">' + esc(block['text']) + '</pre>'
    if kind == 'links':
        return '<ul class="guide-links">' + ''.join('<li><a href="' + esc(item['url']) + '" target="_blank" rel="noopener noreferrer">' + esc(item['label']) + '</a></li>' for item in block['items']) + '</ul>'
    if kind == 'image':
        return '<figure class="guide-figure"><img src="/app/guide/images/' + esc(block['file']) + '" alt="' + esc(block['alt']) + '" loading="lazy"><figcaption>' + esc(block['caption']) + '</figcaption></figure>'
    raise ValueError(kind)


def write_html(chapters):
    file = ROOT / 'panel/guide.html'
    template = file.read_text()
    nav = '\n'.join('<a data-guide-link href="#' + esc(c['id']) + '">' + esc(str(i) + '. ' + c['title']) + '</a>' for i, c in enumerate(chapters, 1))
    content = '\n'.join('<section class="guide-chapter" data-guide-chapter data-title="' + esc(c['title']) + '" id="' + esc(c['id']) + '"><h2>' + esc(str(i) + '. ' + c['title']) + '</h2><p class="guide-summary">' + esc(c['summary']) + '</p>' + '\n'.join(html_block(b) for b in c['blocks']) + '</section>' for i, c in enumerate(chapters, 1))
    for tag, body in [('NAV', nav), ('CONTENT', content)]:
        expression = r'<!-- GUIDE ' + tag + r' START -->[\s\S]*?<!-- GUIDE ' + tag + r' END -->'
        if not re.search(expression, template):
            raise ValueError('Missing handbook HTML marker: ' + tag)
        template = re.sub(expression, lambda _: '<!-- GUIDE ' + tag + ' START -->\n' + body + '\n<!-- GUIDE ' + tag + ' END -->', template)
    file.write_text(template)


FONT_ROOT = Path('/usr/share/fonts/truetype/dejavu')
for name, file in [('Guide', 'DejaVuSans.ttf'), ('GuideBold', 'DejaVuSans-Bold.ttf'), ('GuideMono', 'DejaVuSansMono.ttf')]:
    pdfmetrics.registerFont(TTFont(name, str(FONT_ROOT / file)))
pdfmetrics.registerFontFamily('Guide', normal='Guide', bold='GuideBold', italic='Guide', boldItalic='GuideBold')
INK = colors.HexColor('#192c43')
BLUE = colors.HexColor('#275b9e')
MUTED = colors.HexColor('#58708b')
LINE = colors.HexColor('#dbe4ee')
W = A4[0] - 92
STYLES = {
    'body': ParagraphStyle('guide-body', fontName='Guide', fontSize=9.2, leading=14.4, textColor=INK, spaceAfter=8, allowWidows=0, allowOrphans=0),
    'summary': ParagraphStyle('guide-summary', fontName='Guide', fontSize=10, leading=16, textColor=MUTED, spaceAfter=16),
    'chapter': ParagraphStyle('guide-chapter', fontName='GuideBold', fontSize=22, leading=28, textColor=INK, spaceAfter=13, keepWithNext=True),
    'heading': ParagraphStyle('guide-heading', fontName='GuideBold', fontSize=12, leading=17, textColor=BLUE, spaceBefore=14, spaceAfter=9, keepWithNext=True),
    'step': ParagraphStyle('guide-step', fontName='GuideBold', fontSize=10, leading=15, textColor=INK, spaceBefore=9, spaceAfter=5, keepWithNext=True),
    'check': ParagraphStyle('guide-check', fontName='Guide', fontSize=8.3, leading=12.8, textColor=colors.HexColor('#38644e'), spaceAfter=8),
    'cell': ParagraphStyle('guide-cell', fontName='Guide', fontSize=8.1, leading=12.2, textColor=INK),
    'thead': ParagraphStyle('guide-thead', fontName='GuideBold', fontSize=8.2, leading=12.5, textColor=BLUE),
    'note': ParagraphStyle('guide-note', fontName='Guide', fontSize=8.5, leading=13.3, textColor=MUTED),
    'code': ParagraphStyle('guide-code', fontName='GuideMono', fontSize=8.2, leading=12.4, textColor=INK, backColor=colors.HexColor('#f1f5f9'), borderColor=LINE, borderWidth=.6, borderPadding=11, spaceBefore=12, spaceAfter=15),
    'caption': ParagraphStyle('guide-caption', fontName='Guide', fontSize=8, leading=12, textColor=MUTED, spaceBefore=7, spaceAfter=13),
}


def p(text, style='body', raw=False):
    return Paragraph(text if raw else escape(str(text)).replace('\n', '<br/>'), STYLES[style])


class Cover(Flowable):
    width = W
    height = 690

    def __init__(self, chapters):
        super().__init__()
        self.width = W
        self.height = 690
        self.chapters = chapters

    def draw(self):
        c = self.canv
        c.setFillColor(INK)
        c.roundRect(0, 580, 174, 28, 6, fill=1, stroke=0)
        c.setFillColor(colors.white)
        c.setFont('GuideBold', 9)
        c.drawString(13, 590, 'PODRĘCZNIK OPERATORA')
        logo = ROOT / 'public/logo2.png'
        c.drawImage(str(logo), 0, 630, width=194, height=65, mask='auto', preserveAspectRatio=True)
        c.setFillColor(INK)
        c.setFont('GuideBold', 31)
        for i, line in enumerate(['Od zapytania', 'do działającej usługi.']):
            c.drawString(0, 528 - i * 43, line)
        subtitle = p('Instrukcja realizacji zamówień DAWKOZ.\nKrok po kroku dla każdej oferty, z obsługą panelu,\ntestami, dokumentami i miesięczną opieką.', 'summary')
        _, sh = subtitle.wrap(W - 8, 100)
        subtitle.drawOn(c, 0, 402 - sh)
        box_width = (W - 32) / 5
        for i, label in enumerate(['Zapytanie', 'Wycena', 'Realizacja', 'Testy', 'Odbiór']):
            x = i * (box_width + 8)
            c.setFillColor(colors.HexColor('#eef3f9'))
            c.setStrokeColor(LINE)
            c.roundRect(x, 247, box_width, 64, 6, fill=1, stroke=1)
            c.setFillColor(BLUE)
            c.setFont('GuideBold', 8)
            c.drawString(x + 10, 289, str(i + 1).zfill(2))
            c.setFillColor(INK)
            c.setFont('Guide', 8)
            c.drawString(x + 10, 264, label)
        details = p(f'{len(self.chapters)} rozdziałów • rzeczywiste zrzuty panelu • gotowe listy testów\nWersja {EDITION} | {DATE} | Oferta DAWKOZ {OFFER["version"]}', 'summary')
        _, dh = details.wrap(W, 90)
        details.drawOn(c, 0, 194 - dh)
        note = p('Materiał wewnętrzny. Rozdziały pokazują, co należy wykonać i sprawdzić. Nie potwierdzają uruchomienia integracji, kont dostawców ani kompletności danych prawnych konkretnego zlecenia.', 'note')
        _, nh = note.wrap(W - 20, 100)
        note.drawOn(c, 0, 75 - nh)


class HandbookDoc(BaseDocTemplate):
    def __init__(self, file):
        super().__init__(str(file), pagesize=A4, leftMargin=46, rightMargin=46, topMargin=47, bottomMargin=49, title=TITLE, author='DAWKOZ', subject='Instrukcja organizacji, realizacji i obsługi zamówień', pageCompression=1)
        frame = Frame(46, 49, W, A4[1] - 96, leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0, id='main')
        self.addPageTemplates(PageTemplate(id='handbook', frames=[frame], onPage=self.page_frame))

    def page_frame(self, c, doc):
        c.saveState()
        if doc.page > 1:
            c.setStrokeColor(LINE)
            c.setLineWidth(.5)
            c.line(46, A4[1] - 30, A4[0] - 46, A4[1] - 30)
            c.setFont('Guide', 7)
            c.setFillColor(MUTED)
            c.drawString(46, A4[1] - 23, 'DAWKOZ / INSTRUKCJA REALIZACJI ZAMÓWIEŃ')
        c.setFont('Guide', 7)
        c.setFillColor(MUTED)
        c.drawString(46, 27, f'Wersja {EDITION} • {DATE} • materiał wewnętrzny')
        c.drawRightString(A4[0] - 46, 27, str(doc.page))
        c.restoreState()

    def afterFlowable(self, flowable):
        if isinstance(flowable, Paragraph) and hasattr(flowable, '_chapter_key'):
            key = flowable._chapter_key
            self.canv.bookmarkPage(key)
            self.canv.addOutlineEntry(flowable.getPlainText(), key, level=0, closed=False)
            self.notify('TOCEntry', (0, flowable.getPlainText(), self.page, key))


def pdf_block(block):
    kind = block['type']
    if kind == 'p':
        return [p(block['text'])]
    if kind == 'heading':
        return [p(block['text'], 'heading')]
    if kind == 'note':
        body = p('<b>' + escape(block['label']) + '</b><br/>' + escape(block['text']), 'note', raw=True)
        table = Table([[body]], colWidths=[W], hAlign='LEFT')
        table.setStyle(TableStyle([('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#fff7e9') if block.get('tone') == 'warning' else colors.HexColor('#eef4fb')), ('BOX', (0, 0), (-1, -1), .6, LINE), ('TOPPADDING', (0, 0), (-1, -1), 11), ('BOTTOMPADDING', (0, 0), (-1, -1), 11), ('LEFTPADDING', (0, 0), (-1, -1), 12), ('RIGHTPADDING', (0, 0), (-1, -1), 12)]))
        return [Spacer(1, 6), table, Spacer(1, 12)]
    if kind == 'steps':
        result = [p(block['title'], 'heading')] if block.get('title') else []
        for i, item in enumerate(block['items'], 1):
            result.extend([p(str(i) + '. ' + item['title'], 'step'), p(item['text']), p('<b>Sprawdź wynik:</b> ' + escape(item['check']), 'check', raw=True)])
        return result
    if kind == 'checklist':
        result = [p(block['title'], 'heading')] if block.get('title') else []
        result.extend(p('☐  ' + item) for item in block['items'])
        return result
    if kind == 'table':
        columns = len(block['headers'])
        if not columns or any(len(row) != columns for row in block['rows']):
            raise ValueError('Inconsistent table columns')
        fractions = {2: [.3, .7], 3: [.24, .33, .43], 4: [.17, .25, .3, .28]}.get(columns, [1 / columns] * columns)
        data = [[p(value, 'thead') for value in block['headers']]] + [[p(value, 'cell') for value in row] for row in block['rows']]
        table = Table(data, colWidths=[W * fraction for fraction in fractions], hAlign='LEFT', repeatRows=1)
        table.setStyle(TableStyle([('VALIGN', (0, 0), (-1, -1), 'TOP'), ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#eaf1f9')), ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f7f9fc')]), ('LINEBELOW', (0, 0), (-1, -1), .4, LINE), ('LEFTPADDING', (0, 0), (-1, -1), 8), ('RIGHTPADDING', (0, 0), (-1, -1), 8), ('TOPPADDING', (0, 0), (-1, -1), 8), ('BOTTOMPADDING', (0, 0), (-1, -1), 8)]))
        return [Spacer(1, 6), table, Spacer(1, 12)]
    if kind == 'code':
        lines = []
        for line in block['text'].splitlines():
            lines.extend(textwrap.wrap(line, width=85, break_long_words=True, break_on_hyphens=False) or [''])
        return [p('\n'.join(lines), 'code')]
    if kind == 'links':
        return [p('<a href="' + escape(item['url'], {'"': '&quot;'}) + '" color="#275b9e">' + escape(item['label']) + '</a><br/><font size="7.5">' + escape(item['url']) + '</font>', raw=True) for item in block['items']]
    if kind == 'image':
        file = MANUAL / 'assets' / block['file']
        with PillowImage.open(file) as image:
            width, height = image.size
        scale = min(W / width, 370 / height)
        picture = Image(str(file), width=width * scale, height=height * scale, hAlign='LEFT')
        return [KeepTogether([Spacer(1, 7), picture, p(block['caption'], 'caption')])]
    raise ValueError(kind)


def write_pdf(chapters, file):
    story = [Cover(chapters), PageBreak(), p('Spis treści', 'chapter')]
    story.append(p('Kliknij tytuł rozdziału lub skorzystaj z zakładek PDF. Najpierw przeczytaj wspólny proces, następnie wybierz usługę zamawianą przez klienta.', 'summary'))
    toc = TableOfContents()
    toc.levelStyles = [ParagraphStyle('guide-toc', fontName='Guide', fontSize=9.4, leading=16, leftIndent=0, firstLineIndent=0, spaceBefore=6, textColor=INK)]
    story.append(toc)
    for index, chapter in enumerate(chapters, 1):
        story.append(PageBreak())
        heading = p(str(index) + '. ' + chapter['title'], 'chapter')
        heading._chapter_key = chapter['id']
        story.extend([heading, p(chapter['summary'], 'summary')])
        for block in chapter['blocks']:
            story.extend(pdf_block(block))
    HandbookDoc(file).multiBuild(story)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--exports', type=Path, default=ROOT.parent / 'exports')
    args = parser.parse_args()
    chapters = load_chapters()
    write_html(chapters)
    generated = MANUAL / 'generated'
    generated.mkdir(parents=True, exist_ok=True)
    file = generated / PDF_NAME
    write_pdf(chapters, file)
    args.exports.mkdir(parents=True, exist_ok=True)
    shutil.copy2(file, args.exports / PDF_NAME)
    manifest = {'title': TITLE, 'version': EDITION, 'date': '2026-10-25', 'offerVersion': OFFER['version'], 'chapters': [{'id': c['id'], 'title': c['title']} for c in chapters], 'images': sorted({b['file'] for c in chapters for b in c['blocks'] if b['type'] == 'image'})}
    (generated / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
    print(f'{len(chapters)} chapters; {len(manifest["images"])} real screenshots; PDF {file.stat().st_size} bytes')
    print(args.exports / PDF_NAME)


if __name__ == '__main__':
    main()
