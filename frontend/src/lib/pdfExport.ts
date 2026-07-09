const A4_WIDTH_MM = 210;
const A4_HEIGHT_MM = 297;

type ShareNavigator = Navigator & {
  canShare?: (data: ShareData) => boolean;
  share?: (data: ShareData) => Promise<void>;
};

export type PdfSaveResult = "shared" | "downloaded" | "opened" | "cancelled";

export function safePdfFilename(value: string, fallback = "LIFT"): string {
  const name = value
    .trim()
    .replace(/[\\/:*?"<>|]/g, "_")
    .replace(/\s+/g, "_")
    .slice(0, 80);
  return name || fallback;
}

export function isAppleMobileBrowser(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  return /iPad|iPhone|iPod/i.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

export function openPdfFallbackWindow(): Window | null {
  if (!isAppleMobileBrowser()) return null;

  const win = window.open("", "_blank");
  if (!win) return null;

  try {
    win.document.title = "PDF 준비 중";
    win.document.body.innerHTML =
      '<div style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;padding:24px;line-height:1.5;color:#172033">' +
      '<strong>PDF 파일을 준비하고 있어요.</strong><br />잠시 후 이 탭에서 열립니다.' +
      "</div>";
  } catch {
    // Some WebViews block access to the newly opened document. Navigation still works later.
  }

  return win;
}

export async function createPdfBlobFromElement(element: HTMLElement): Promise<Blob> {
  if (document.fonts) {
    await document.fonts.ready;
  }

  await new Promise((resolve) => window.requestAnimationFrame(resolve));

  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import("html2canvas"),
    import("jspdf"),
  ]);
  const canvas = await html2canvas(element, {
    backgroundColor: "#ffffff",
    logging: false,
    scale: 2,
    useCORS: true,
    windowWidth: element.scrollWidth,
  });

  if (canvas.width === 0 || canvas.height === 0) {
    throw new Error("PDF export target is empty.");
  }

  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
    compress: true,
  });
  const pageHeightPx = Math.floor((canvas.width * A4_HEIGHT_MM) / A4_WIDTH_MM);
  let offsetY = 0;
  let pageIndex = 0;

  while (offsetY < canvas.height) {
    const sliceHeight = Math.min(pageHeightPx, canvas.height - offsetY);
    const pageCanvas = document.createElement("canvas");
    pageCanvas.width = canvas.width;
    pageCanvas.height = sliceHeight;

    const ctx = pageCanvas.getContext("2d");
    if (!ctx) {
      throw new Error("Could not create PDF page canvas.");
    }

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
    ctx.drawImage(
      canvas,
      0,
      offsetY,
      canvas.width,
      sliceHeight,
      0,
      0,
      canvas.width,
      sliceHeight,
    );

    if (pageIndex > 0) {
      pdf.addPage();
    }

    const pageHeightMm = (sliceHeight * A4_WIDTH_MM) / canvas.width;
    pdf.addImage(
      pageCanvas.toDataURL("image/jpeg", 0.92),
      "JPEG",
      0,
      0,
      A4_WIDTH_MM,
      pageHeightMm,
      undefined,
      "FAST",
    );

    offsetY += sliceHeight;
    pageIndex += 1;
  }

  return pdf.output("blob");
}

export async function savePdfBlob(
  blob: Blob,
  filename: string,
  fallbackWindow: Window | null = null,
): Promise<PdfSaveResult> {
  const normalizedFilename = filename.endsWith(".pdf") ? filename : `${filename}.pdf`;
  const file = new File([blob], normalizedFilename, { type: "application/pdf" });
  const shareNavigator = navigator as ShareNavigator;

  if (shareNavigator.share && canShareFile(shareNavigator, file)) {
    try {
      await shareNavigator.share({
        files: [file],
        title: normalizedFilename,
      });
      closeFallbackWindow(fallbackWindow);
      return "shared";
    } catch (error) {
      if (isShareCancelled(error)) {
        closeFallbackWindow(fallbackWindow);
        return "cancelled";
      }
    }
  }

  const url = URL.createObjectURL(blob);
  if (fallbackWindow && !fallbackWindow.closed) {
    fallbackWindow.location.href = url;
    window.setTimeout(() => URL.revokeObjectURL(url), 60000);
    return "opened";
  }

  if (isAppleMobileBrowser()) {
    const opened = window.open(url, "_blank");
    if (!opened) {
      window.location.href = url;
    }
    window.setTimeout(() => URL.revokeObjectURL(url), 60000);
    return "opened";
  }

  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = normalizedFilename;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  return "downloaded";
}

function canShareFile(navigatorApi: ShareNavigator, file: File): boolean {
  try {
    return Boolean(navigatorApi.canShare?.({ files: [file] }));
  } catch {
    return false;
  }
}

function closeFallbackWindow(win: Window | null) {
  if (!win || win.closed) return;
  try {
    win.close();
  } catch {
    // Ignore: the share sheet already handled the file.
  }
}

function isShareCancelled(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}
