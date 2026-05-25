const ALLOWED_MIME = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/svg+xml",
]);

const ALLOWED_EXT = [".png", ".jpg", ".jpeg", ".webp", ".svg"];

export const LOGO_UPLOAD_RULES = {
  maxBytes: 5 * 1024 * 1024,
  minWidth: 200,
  minHeight: 200,
  maxWidth: 4096,
  maxHeight: 4096,
  accept: ".png,.jpg,.jpeg,.webp,.svg",
  acceptMime: Array.from(ALLOWED_MIME).join(","),
} as const;

function hasAllowedExtension(name: string): boolean {
  const lower = name.toLowerCase();
  return ALLOWED_EXT.some((ext) => lower.endsWith(ext));
}

function readDimensions(
  dataUrl: string,
): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () =>
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => reject(new Error("Could not read image dimensions."));
    img.src = dataUrl;
  });
}

export async function validateAndReadLogoFile(
  file: File,
): Promise<{ ok: true; dataUrl: string } | { ok: false; error: string }> {
  if (!ALLOWED_MIME.has(file.type) && !hasAllowedExtension(file.name)) {
    return {
      ok: false,
      error: "Only PNG, JPG, WebP, or SVG files are allowed.",
    };
  }

  if (file.size > LOGO_UPLOAD_RULES.maxBytes) {
    return {
      ok: false,
      error: `File must be ${LOGO_UPLOAD_RULES.maxBytes / (1024 * 1024)}MB or smaller.`,
    };
  }

  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Failed to read file."));
    reader.readAsDataURL(file);
  });

  if (file.type === "image/svg+xml" || file.name.toLowerCase().endsWith(".svg")) {
    return { ok: true, dataUrl };
  }

  try {
    const { width, height } = await readDimensions(dataUrl);
    if (
      width < LOGO_UPLOAD_RULES.minWidth ||
      height < LOGO_UPLOAD_RULES.minHeight
    ) {
      return {
        ok: false,
        error: `Logo must be at least ${LOGO_UPLOAD_RULES.minWidth}×${LOGO_UPLOAD_RULES.minHeight}px (yours: ${width}×${height}).`,
      };
    }
    if (
      width > LOGO_UPLOAD_RULES.maxWidth ||
      height > LOGO_UPLOAD_RULES.maxHeight
    ) {
      return {
        ok: false,
        error: `Logo must be at most ${LOGO_UPLOAD_RULES.maxWidth}×${LOGO_UPLOAD_RULES.maxHeight}px.`,
      };
    }
  } catch {
    return { ok: false, error: "Could not validate image dimensions." };
  }

  return { ok: true, dataUrl };
}
