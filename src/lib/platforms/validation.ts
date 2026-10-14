import { getPlatform, type PlatformDefinition } from "@/lib/platforms/catalog";

export type ValidationIssue = {
  level: "error" | "warning";
  code: string;
  message: string;
};

export type VersionContent = {
  title: string;
  body: string;
  hashtags: string[];
  linkUrl: string;
  mediaKinds: Array<"IMAGE" | "VIDEO" | "DOCUMENT">;
};

export function validateVersion(platform: PlatformDefinition, content: VersionContent): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const hashtags = content.hashtags.map((tag) => tag.replace(/^#/, "").trim()).filter(Boolean);
  const bodyLength = content.body.trim().length;
  const titleLength = content.title.trim().length;

  if (platform.titleMax && titleLength > platform.titleMax) {
    issues.push({
      level: "error",
      code: "title_too_long",
      message: `El título supera ${platform.titleMax} caracteres (${titleLength}).`,
    });
  }

  if (bodyLength > platform.bodyMax) {
    issues.push({
      level: "error",
      code: "body_too_long",
      message: `El texto supera ${platform.bodyMax} caracteres (${bodyLength}).`,
    });
  }

  if (platform.hashtagMax && hashtags.length > platform.hashtagMax) {
    issues.push({
      level: "error",
      code: "too_many_hashtags",
      message: `${platform.name} admite hasta ${platform.hashtagMax} hashtags.`,
    });
  }

  if (!platform.allowsLink && content.linkUrl.trim()) {
    issues.push({
      level: "warning",
      code: "link_not_clickable",
      message: `${platform.name} no convierte el enlace en un vínculo de la publicación.`,
    });
  }

  const images = content.mediaKinds.filter((kind) => kind === "IMAGE").length;
  const videos = content.mediaKinds.filter((kind) => kind === "VIDEO").length;
  const documents = content.mediaKinds.filter((kind) => kind === "DOCUMENT").length;

  if (platform.media === "image" && images === 0) {
    issues.push({
      level: "error",
      code: "image_required",
      message: `${platform.name} necesita una imagen.`,
    });
  }
  if (platform.media === "video" && videos === 0) {
    issues.push({
      level: "error",
      code: "video_required",
      message: `${platform.name} necesita un video.`,
    });
  }
  if (platform.media === "image_or_video" && images + videos === 0) {
    issues.push({
      level: "error",
      code: "media_required",
      message: `${platform.name} necesita una imagen o un video.`,
    });
  }
  if (!platform.allowsVideo && videos > 0) {
    issues.push({
      level: "error",
      code: "video_not_allowed",
      message: `${platform.name} no admite video en este flujo.`,
    });
  }
  if (!platform.allowsImage && images > 0) {
    issues.push({
      level: "warning",
      code: "image_ignored",
      message: `${platform.name} no usará las imágenes en la publicación automática.`,
    });
  }
  if (!platform.allowsDocument && documents > 0) {
    issues.push({
      level: "warning",
      code: "document_manual",
      message: `El documento hay que adjuntarlo a mano en ${platform.name}.`,
    });
  }
  if (bodyLength === 0 && titleLength === 0 && images + videos === 0) {
    issues.push({
      level: "error",
      code: "empty",
      message: "La versión está vacía.",
    });
  }

  return issues;
}

export function validatePlatformContent(platformId: string, content: VersionContent) {
  const platform = getPlatform(platformId);
  if (!platform) {
    return [{ level: "error" as const, code: "unknown_platform", message: "La red no está en el catálogo." }];
  }
  return validateVersion(platform, content);
}

export function blockingIssues(issues: ValidationIssue[]) {
  return issues.filter((issue) => issue.level === "error");
}
