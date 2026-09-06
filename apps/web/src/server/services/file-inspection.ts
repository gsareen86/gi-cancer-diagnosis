/**
 * Upload inspection.
 *
 * Type is decided by content, never by the filename: a `.pdf` extension is a claim by whoever
 * uploaded the file, and accepting it would let an executable into patient storage.
 */

export const ACCEPTED_TYPES = {
  'application/pdf': ['pdf'],
  'image/jpeg': ['jpg', 'jpeg'],
  'image/png': ['png'],
  'application/dicom': ['dcm', 'dicom'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['docx'],
} as const;

export type AcceptedContentType = keyof typeof ACCEPTED_TYPES;

export type InspectionResult =
  | { ok: true; contentType: AcceptedContentType }
  | { ok: false; reason: 'unsupported_type' | 'empty' | 'mismatched_extension' };

const startsWith = (buffer: Buffer, bytes: readonly number[]): boolean =>
  bytes.every((byte, index) => buffer[index] === byte);

/** Magic-number sniffing. Deliberately small: only the four types we actually accept. */
export function detectContentType(buffer: Buffer): AcceptedContentType | null {
  if (buffer.length < 8) return null;
  // DICOM Part 10 files carry the DICM marker after the 128-byte preamble.
  if (buffer.length >= 132 && buffer.subarray(128, 132).toString('ascii') === 'DICM') return 'application/dicom';

  // %PDF-
  if (startsWith(buffer, [0x25, 0x50, 0x44, 0x46, 0x2d])) return 'application/pdf';
  // JPEG SOI
  if (startsWith(buffer, [0xff, 0xd8, 0xff])) return 'image/jpeg';
  // PNG signature
  if (startsWith(buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'image/png';

  // DOCX is a ZIP container. Distinguish it from a bare archive by the OOXML marker that
  // appears near the head of a Word document.
  if (startsWith(buffer, [0x50, 0x4b, 0x03, 0x04])) {
    const head = buffer.subarray(0, Math.min(buffer.length, 4096)).toString('latin1');
    if (head.includes('word/') || head.includes('[Content_Types].xml')) {
      return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    }
  }
  return null;
}

export function inspectUpload(buffer: Buffer, filename: string): InspectionResult {
  if (buffer.byteLength === 0) return { ok: false, reason: 'empty' };

  const detected = detectContentType(buffer);
  if (detected === null) return { ok: false, reason: 'unsupported_type' };

  const extension = filename.split('.').pop()?.toLowerCase() ?? '';
  const permitted = ACCEPTED_TYPES[detected] as readonly string[];
  if (extension !== '' && !permitted.includes(extension)) {
    // The content is acceptable but the name misrepresents it. Refusing keeps the stored
    // filename honest for whoever opens it later.
    return { ok: false, reason: 'mismatched_extension' };
  }
  return { ok: true, contentType: detected };
}

/* -------------------------------------------------------------------------------------------- */
/* Malware scanning                                                                              */
/* -------------------------------------------------------------------------------------------- */

export type ScanVerdict = 'clean' | 'infected' | 'scanner_unavailable';

export interface MalwareScanner {
  scan(buffer: Buffer): Promise<ScanVerdict>;
}

/**
 * Development scanner. Recognises the EICAR test string so the infected path is exercisable
 * without real malware, and otherwise reports clean.
 *
 * TODO(confirm): wire a real scanner (ClamAV or a managed service) before any real patient
 * uploads a file. Until then this is a placeholder, and `scanner_unavailable` is the honest
 * verdict for anything it cannot actually judge.
 */
export const developmentScanner: MalwareScanner = {
  async scan(buffer) {
    const head = buffer.subarray(0, Math.min(buffer.length, 1024)).toString('latin1');
    return head.includes('EICAR-STANDARD-ANTIVIRUS-TEST-FILE') ? 'infected' : 'clean';
  },
};

let scanner: MalwareScanner = developmentScanner;

export function setMalwareScanner(next: MalwareScanner): void {
  scanner = next;
}

export async function scanUpload(buffer: Buffer): Promise<ScanVerdict> {
  try {
    return await scanner.scan(buffer);
  } catch {
    // Never treat an unreachable scanner as a pass. The upload is held, not accepted.
    return 'scanner_unavailable';
  }
}
