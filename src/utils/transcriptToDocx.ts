/**
 * Convert transcript JSON to a .docx Word document.
 *
 * Speaker-attributed format: each speaker turn gets a bold heading
 * with timestamp, followed by their utterance paragraphs.
 */
import {
  Document,
  Paragraph,
  TextRun,
  Packer,
  AlignmentType,
  BorderStyle,
} from "docx";
import { saveAs } from "file-saver";
import type { TranscriptData } from "../types/api";

function formatTimestamp(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export async function downloadTranscriptAsDocx(transcript: TranscriptData, filename: string) {
  const children: Paragraph[] = [];

  // Title
  children.push(
    new Paragraph({
      children: [
        new TextRun({ text: "Hearing Transcript", font: "Inter", size: 36, bold: true }),
      ],
      spacing: { after: 100 },
    }),
  );

  // Stats line
  const durationMin = Math.round(transcript.duration_seconds / 60);
  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: `${transcript.utterances.length} utterances · ${transcript.num_speakers} speakers · ${durationMin} min`,
          font: "Inter",
          size: 18,
          color: "666666",
        }),
      ],
      spacing: { after: 300 },
      border: {
        bottom: { style: BorderStyle.SINGLE, size: 1, color: "E0E0E0", space: 8 },
      },
    }),
  );

  // Group consecutive utterances by same speaker
  let lastSpeaker = "";
  for (const u of transcript.utterances) {
    const speakerLabel = u.speaker_name || `Speaker ${u.speaker}`;

    if (speakerLabel !== lastSpeaker) {
      // Speaker heading with timestamp
      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: speakerLabel, font: "Inter", size: 22, bold: true, color: "0039A6" }),
            new TextRun({ text: `  ${formatTimestamp(u.start)}`, font: "Inter", size: 18, color: "999999" }),
          ],
          spacing: { before: 240, after: 60 },
        }),
      );
      lastSpeaker = speakerLabel;
    }

    // Utterance text
    children.push(
      new Paragraph({
        children: [
          new TextRun({ text: u.text, font: "Lora", size: 22 }),
        ],
        spacing: { after: 40 },
        alignment: AlignmentType.LEFT,
      }),
    );
  }

  const doc = new Document({
    sections: [{
      properties: {
        page: {
          margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 },
        },
      },
      children,
    }],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, filename);
}
