// copy text with a browser api first then fallback
export async function copyTextToClipboard(text, options = {}) {
  const fallbackOnClipboardWriteFailure = options.fallbackOnClipboardWriteFailure ?? true;

  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch (error) {
      if (!fallbackOnClipboardWriteFailure) throw error;
      // fallback to execCommand when clipboard api write fails
    }
  }

  if (typeof document === "undefined") throw new Error("Clipboard is unavailable.");
  const textArea = document.createElement("textarea");
  textArea.value = text;
  textArea.setAttribute("readonly", "");
  textArea.style.position = "fixed";
  textArea.style.opacity = "0";

  document.body.appendChild(textArea);
  textArea.select();
  const copied = document.execCommand("copy");
  document.body.removeChild(textArea);

  if (!copied) throw new Error("Clipboard copy failed.");
}
