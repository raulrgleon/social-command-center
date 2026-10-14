export type MasterContent = {
  title: string;
  body: string;
  linkUrl: string;
  hashtags: string[];
};

export type EditableVersion = MasterContent & {
  platformId: string;
  customized: boolean;
};

export function versionFromMaster(platformId: string, master: MasterContent): EditableVersion {
  return { platformId, customized: false, ...master, hashtags: [...master.hashtags] };
}

export function syncMaster(versions: EditableVersion[], master: MasterContent) {
  return versions.map((version) => {
    if (version.customized) return version;
    return versionFromMaster(version.platformId, master);
  });
}

export function editVersion(versions: EditableVersion[], platformId: string, patch: Partial<MasterContent>) {
  return versions.map((version) => {
    if (version.platformId !== platformId) return version;
    return {
      ...version,
      ...patch,
      hashtags: patch.hashtags ? [...patch.hashtags] : version.hashtags,
      customized: true,
    };
  });
}

export function clipToLimit(text: string, limit: number) {
  const trimmed = text.trim();
  if (trimmed.length <= limit) return { text: trimmed, clipped: false };
  const slice = trimmed.slice(0, Math.max(0, limit - 1)).trimEnd();
  return { text: `${slice}…`, clipped: true };
}
