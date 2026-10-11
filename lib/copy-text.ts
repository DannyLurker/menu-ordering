// Clipboard copy with a fallback (lib). The async clipboard API is
// missing on non secure origins, so typing into a scratch textarea keeps
// the desk copy actions working everywhere the panel runs.
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Fall through to the legacy path below.
  }
  try {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    const done = document.execCommand("copy");
    document.body.removeChild(area);
    return done;
  } catch {
    return false;
  }
}

/** Shareable guest link for a stay, built from the panel origin. */
export function guestSetupLink(origin: string, stayId: string): string {
  return `${origin.replace(/\/$/, "")}/guest/setup?stay=${encodeURIComponent(stayId)}`;
}
