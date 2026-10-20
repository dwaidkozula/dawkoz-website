/* Minimal OOXML export; no external service or dependency. */
(() => {
  'use strict';
  const encoder = new TextEncoder();
  const xml = value => String(value).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&apos;');
  const crcTable = Uint32Array.from({ length: 256 }, (_, index) => {
    let result = index;
    for (let bit = 0; bit < 8; bit++) result = result & 1 ? 0xedb88320 ^ (result >>> 1) : result >>> 1;
    return result >>> 0;
  });
  function crc32(data) {
    let crc = 0xffffffff;
    for (const byte of data) crc = crcTable[(crc ^ byte) & 255] ^ (crc >>> 8);
    return (crc ^ 0xffffffff) >>> 0;
  }
  function join(parts) {
    const result = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
    let offset = 0;
    for (const part of parts) { result.set(part, offset); offset += part.length; }
    return result;
  }
  function zip(files) {
    const local = [], central = [];
    let offset = 0;
    for (const [filename, text] of Object.entries(files)) {
      const name = encoder.encode(filename), data = encoder.encode(text), crc = crc32(data);
      const header = new Uint8Array(30), h = new DataView(header.buffer);
      h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x800, true); h.setUint16(12, 33, true);
      h.setUint32(14, crc, true); h.setUint32(18, data.length, true); h.setUint32(22, data.length, true); h.setUint16(26, name.length, true);
      local.push(header, name, data);
      const record = new Uint8Array(46), r = new DataView(record.buffer);
      r.setUint32(0, 0x02014b50, true); r.setUint16(4, 20, true); r.setUint16(6, 20, true); r.setUint16(8, 0x800, true); r.setUint16(14, 33, true);
      r.setUint32(16, crc, true); r.setUint32(20, data.length, true); r.setUint32(24, data.length, true); r.setUint16(28, name.length, true); r.setUint32(42, offset, true);
      central.push(record, name); offset += header.length + name.length + data.length;
    }
    const directory = join(central), end = new Uint8Array(22), e = new DataView(end.buffer);
    e.setUint32(0, 0x06054b50, true); e.setUint16(8, Object.keys(files).length, true); e.setUint16(10, Object.keys(files).length, true); e.setUint32(12, directory.length, true); e.setUint32(16, offset, true);
    return join([...local, directory, end]);
  }
  function paragraph(text, style = 'Normal') {
    const runs = String(text).split('\n').map((line, i) => `${i ? '<w:r><w:br/></w:r>' : ''}<w:r><w:t xml:space="preserve">${xml(line)}</w:t></w:r>`).join('');
    return `<w:p><w:pPr><w:pStyle w:val="${style}"/></w:pPr>${runs}</w:p>`;
  }
  function create(document) {
    const body = [paragraph('DAWKOZ / DOKUMENTY', 'Brand'), paragraph(document.title, 'Title'), paragraph('Projekt do uzgodnienia • wzór B2B • wersja ' + document.version, 'Subtitle')];
    if (document.note) body.push(paragraph(document.note, 'Note'));
    for (const section of document.sections) {
      body.push(paragraph(section.title, 'Heading1'));
      for (const text of section.paragraphs) body.push(paragraph(text));
    }
    const files = {
      '[Content_Types].xml': '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>',
      '_rels/.rels': '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>',
      'docProps/core.xml': `<?xml version="1.0" encoding="UTF-8"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>${xml(document.title)}</dc:title><dc:creator>DAWKOZ</dc:creator></cp:coreProperties>`,
      'word/document.xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:body>${body.join('')}<w:sectPr><w:footerReference w:type="default" r:id="rId2"/><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1021" w:right="1021" w:bottom="1021" w:left="1021" w:header="500" w:footer="500"/></w:sectPr></w:body></w:document>`,
      'word/_rels/document.xml.rels': '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/></Relationships>',
      'word/footer1.xml': '<?xml version="1.0" encoding="UTF-8"?><w:ftr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:p><w:pPr><w:pStyle w:val="Subtitle"/></w:pPr><w:r><w:t>DAWKOZ • PROJEKT DO UZGODNIENIA • </w:t></w:r><w:fldSimple w:instr="PAGE"/></w:p></w:ftr>',
      'word/styles.xml': '<?xml version="1.0" encoding="UTF-8"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:sz w:val="21"/><w:lang w:val="pl-PL"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="140" w:line="290" w:lineRule="auto"/><w:widowControl/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style><w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/><w:pPr><w:keepNext/><w:spacing w:before="200" w:after="200"/></w:pPr><w:rPr><w:b/><w:sz w:val="42"/><w:color w:val="15273D"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:pPr><w:keepNext/><w:spacing w:before="220" w:after="100"/></w:pPr><w:rPr><w:b/><w:sz w:val="24"/><w:color w:val="15273D"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Subtitle"><w:name w:val="Subtitle"/><w:basedOn w:val="Normal"/><w:rPr><w:sz w:val="17"/><w:color w:val="65758A"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Note"><w:name w:val="Note"/><w:basedOn w:val="Normal"/><w:pPr><w:shd w:fill="EDF2F8"/><w:spacing w:before="100" w:after="200"/></w:pPr><w:rPr><w:sz w:val="18"/><w:color w:val="536478"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Brand"><w:name w:val="Brand"/><w:basedOn w:val="Normal"/><w:rPr><w:b/><w:sz w:val="18"/><w:color w:val="315B87"/></w:rPr></w:style></w:styles>',
    };
    return zip(files);
  }
  const api = { create };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else globalThis.DawkozDocx = api;
})();
