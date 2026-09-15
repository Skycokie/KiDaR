export type Plan = "free" | "paid";
export type ProjectMode = "popout" | "gallery" | "upload";
export type ProjectStatus = "draft" | "processing" | "ready" | "error";

export interface ProjectSettings {
  title: string;
  theme: string;
  logoUrl?: string;
  ctaText?: string;
  ctaUrl?: string;
  scale: number;
  offset: { x: number; y: number; z: number };
  soundUrl?: string;
}

export type ProjectSettingsPatch = Partial<
  Omit<ProjectSettings, "offset">
> & {
  offset?: Partial<ProjectSettings["offset"]>;
};

export interface Project {
  id: string;
  owner: string;
  name: string;
  slug: string;
  mode: ProjectMode;
  sourceImagePath: string | null;
  mindPath: string | null;
  glbPath: string | null;
  status: ProjectStatus;
  settings: ProjectSettings;
}

export const PLAN_QUOTAS: Record<Plan, number> = {
  free: 3,
  paid: 30
};

export function canCreateProject(plan: Plan, projectCount: number): boolean {
  return projectCount < PLAN_QUOTAS[plan];
}

export function canUseWhitelabel(plan: Plan): boolean {
  return plan === "paid";
}

export function mergeSettings(
  current: ProjectSettings,
  patch: ProjectSettingsPatch
): ProjectSettings {
  return {
    ...current,
    ...patch,
    offset: { ...current.offset, ...patch.offset }
  };
}

export function slugify(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}
