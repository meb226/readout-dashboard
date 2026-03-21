/**
 * Convert markdown memo text to a .docx Word document.
 *
 * Uses the `docx` library to build headings, paragraphs, blockquotes,
 * bullet lists, bold/italic runs, and tables from simple markdown patterns.
 * Designed for Readout analyst memos — not a full markdown parser.
 */
import {
  Document,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  BorderStyle,
  Table,
  TableRow,
  TableCell,
  WidthType,
  Packer,
  ShadingType,
} from "docx";
import { saveAs } from "file-saver";

/* ── Inline formatting ─────────────────────────────────────────── */

/** Parse **bold** and *italic* into TextRun[] */
function parseInline(text: string): TextRun[] {
  const runs: TextRun[] = [];
  // Match **bold**, *italic*, or plain text segments
  const re = /(\*\*(.+?)\*\*|\*(.+?)\*|([^*]+))/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m[2]) {
      runs.push(new TextRun({ text: m[2], bold: true, font: "Lora", size: 22 }));
    } else if (m[3]) {
      runs.push(new TextRun({ text: m[3], italics: true, font: "Lora", size: 22 }));
    } else if (m[4]) {
      runs.push(new TextRun({ text: m[4], font: "Lora", size: 22 }));
    }
  }
  return runs;
}

/* ── Table parsing ─────────────────────────────────────────────── */

function parseTable(lines: string[]): Table {
  const parseRow = (line: string) =>
    line.split("|").map((c) => c.trim()).filter(Boolean);

  const headerCells = parseRow(lines[0]);
  // lines[1] is the separator row (---|---)
  const bodyRows = lines.slice(2).map(parseRow);

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: headerCells.map(
          (cell) =>
            new TableCell({
              children: [
                new Paragraph({
                  children: [new TextRun({ text: cell, bold: true, font: "Inter", size: 20 })],
                }),
              ],
              shading: { type: ShadingType.SOLID, color: "F0F0F0", fill: "F0F0F0" },
            })
        ),
      }),
      ...bodyRows.map(
        (row) =>
          new TableRow({
            children: row.map(
              (cell) =>
                new TableCell({
                  children: [
                    new Paragraph({
                      children: [new TextRun({ text: cell, font: "Lora", size: 20 })],
                    }),
                  ],
                })
            ),
          })
      ),
    ],
  });
}

/* ── Main converter ────────────────────────────────────────────── */

export async function downloadMemoAsDocx(markdown: string, filename: string) {
  const lines = markdown.split("\n");
  const children: (Paragraph | Table)[] = [];

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    // Blank line → skip
    if (line.trim() === "") {
      i++;
      continue;
    }

    // Table detection: line contains | and next line is separator (---|---)
    if (
      line.includes("|") &&
      i + 1 < lines.length &&
      /^\|?\s*-+\s*\|/.test(lines[i + 1])
    ) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].includes("|")) {
        tableLines.push(lines[i]);
        i++;
      }
      children.push(parseTable(tableLines));
      continue;
    }

    // Headings
    if (line.startsWith("#### ")) {
      children.push(
        new Paragraph({
          children: [new TextRun({ text: line.slice(5), font: "Inter", size: 22, bold: true, color: "444444" })],
          heading: HeadingLevel.HEADING_4,
          spacing: { before: 240, after: 120 },
        })
      );
      i++;
      continue;
    }
    if (line.startsWith("### ")) {
      children.push(
        new Paragraph({
          children: [new TextRun({ text: line.slice(4).toUpperCase(), font: "Inter", size: 22, bold: true, color: "0039A6" })],
          heading: HeadingLevel.HEADING_3,
          spacing: { before: 300, after: 120 },
        })
      );
      i++;
      continue;
    }
    if (line.startsWith("## ")) {
      children.push(
        new Paragraph({
          children: [new TextRun({ text: line.slice(3), font: "Inter", size: 28, bold: true })],
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 360, after: 80 },
        })
      );
      i++;
      continue;
    }
    if (line.startsWith("# ")) {
      children.push(
        new Paragraph({
          children: [new TextRun({ text: line.slice(2), font: "Inter", size: 34, bold: true })],
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 0, after: 60 },
        })
      );
      i++;
      continue;
    }

    // Horizontal rule
    if (/^---+$/.test(line.trim())) {
      children.push(
        new Paragraph({
          border: { bottom: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC", space: 1 } },
          spacing: { before: 200, after: 200 },
        })
      );
      i++;
      continue;
    }

    // Blockquote
    if (line.startsWith("> ")) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].startsWith("> ")) {
        quoteLines.push(lines[i].slice(2));
        i++;
      }
      children.push(
        new Paragraph({
          children: parseInline(quoteLines.join(" ")),
          indent: { left: 400 },
          border: { left: { style: BorderStyle.SINGLE, size: 6, color: "0039A6", space: 8 } },
          spacing: { before: 160, after: 160 },
        })
      );
      continue;
    }

    // Bullet list item
    if (/^[-*] /.test(line)) {
      children.push(
        new Paragraph({
          children: parseInline(line.slice(2)),
          bullet: { level: 0 },
          spacing: { before: 40, after: 80 },
        })
      );
      i++;
      continue;
    }

    // Regular paragraph
    children.push(
      new Paragraph({
        children: parseInline(line),
        spacing: { before: 60, after: 120 },
        alignment: AlignmentType.JUSTIFIED,
      })
    );
    i++;
  }

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: { top: 1200, right: 1200, bottom: 1200, left: 1200 },
          },
        },
        children,
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, filename);
}
