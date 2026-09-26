"use client";
import { useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
export function PdfViewer({ url }: { url: string }) {
  const [document, setDocument] = useState<PDFDocumentProxy | null>(null);
  const [page, setPage] = useState(1);
  const [error, setError] = useState("");
  const [width, setWidth] = useState(500);
  const [zoom, setZoom] = useState(1);
  const canvas = useRef<HTMLCanvasElement>(null);
  const container = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let cancelled = false;
    let task: { destroy: () => Promise<void> } | undefined;
    void import("pdfjs-dist/build/pdf.mjs")
      .then(async (pdf) => {
        pdf.GlobalWorkerOptions.workerSrc = "/api/demo/pdf-worker";
        const loading = pdf.getDocument({ url, verbosity: 0 });
        task = loading;
        const doc = await loading.promise;
        if (!cancelled) {
          setDocument(doc);
          setPage(1);
          setError("");
        }
      })
      .catch(() => {
        if (!cancelled)
          setError(
            "The PDF preview could not be rendered. Open the original in a larger view.",
          );
      });
    return () => {
      cancelled = true;
      void task?.destroy();
    };
  }, [url]);
  useEffect(() => {
    const node = container.current;
    if (!node) return;
    const observer = new ResizeObserver((items) =>
      setWidth(Math.max(200, items[0].contentRect.width - 16)),
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (!document || !canvas.current) return;
    let cancelled = false;
    let render: { cancel: () => void } | undefined;
    void document
      .getPage(page)
      .then(async (pdfPage) => {
        if (cancelled || !canvas.current) return;
        const base = pdfPage.getViewport({ scale: 1 });
        const viewport = pdfPage.getViewport({
          scale: (width / base.width) * zoom,
        });
        const ratio = Math.min(window.devicePixelRatio || 1, 2);
        const c = canvas.current;
        c.width = Math.round(viewport.width * ratio);
        c.height = Math.round(viewport.height * ratio);
        c.style.width = `${viewport.width}px`;
        c.style.height = `${viewport.height}px`;
        const task = pdfPage.render({
          canvas: c,
          viewport,
          transform: ratio === 1 ? undefined : [ratio, 0, 0, ratio, 0, 0],
        });
        render = task;
        await task.promise;
      })
      .catch((e) => {
        if (e.name !== "RenderingCancelledException" && !cancelled)
          setError("Page preview unavailable. Open the original report.");
      });
    return () => {
      cancelled = true;
      render?.cancel();
    };
  }, [document, page, width, zoom]);
  return (
    <div className="pdf-viewer" ref={container}>
      <div className="pdf-toolbar">
        <button
          className="secondary"
          disabled={!document || page <= 1}
          onClick={() => setPage((p) => p - 1)}
          aria-label="Previous report page"
        >
          ←
        </button>
        <span>
          Page {page} / {document?.numPages ?? "…"}
        </span>
        <button
          className="secondary"
          disabled={!document || page >= document.numPages}
          onClick={() => setPage((p) => p + 1)}
          aria-label="Next report page"
        >
          →
        </button>
        <label>
          Zoom
          <select
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
          >
            <option value="1">Fit</option>
            <option value="1.5">150%</option>
            <option value="2">200%</option>
          </select>
        </label>
      </div>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      <div className="pdf-canvas-scroll">
        <canvas aria-label={`Original report page ${page}`} ref={canvas} />
      </div>
    </div>
  );
}
