"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

type DashboardProject = {
  id: string;
  name: string;
  slug: string;
  status: string;
  source_image_path: string | null;
  updated_at: string;
};

type Quota = { plan: "free" | "paid"; used: number; limit: number; canCreate: boolean };

export function DashboardClient({
  initialProjects,
  initialQuota
}: {
  initialProjects: DashboardProject[];
  initialQuota: Quota;
}) {
  const [projects, setProjects] = useState(initialProjects);
  const [quota, setQuota] = useState(initialQuota);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState("");

  async function createProject(event: React.FormEvent) {
    event.preventDefault();
    setCreating(true);
    setMessage("");
    const response = await fetch("/api/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name })
    });
    const body = await response.json();
    if (!response.ok) {
      setMessage(body.upgrade ? "You reached the free limit. Upgrade to create more." : body.error);
      setCreating(false);
      return;
    }
    setProjects((current) => [body.project, ...current]);
    setQuota((current) => ({ ...current, used: current.used + 1, canCreate: current.used + 1 < current.limit }));
    setName("");
    setCreating(false);
  }

  async function renameProject(projectId: string, nextName: string) {
    await fetch(`/api/projects/${projectId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: nextName })
    });
  }

  async function deleteProject(projectId: string) {
    const response = await fetch(`/api/projects/${projectId}`, { method: "DELETE" });
    if (!response.ok) return;
    setProjects((current) => current.filter((project) => project.id !== projectId));
    setQuota((current) => ({ ...current, used: current.used - 1, canCreate: true }));
  }

  async function uploadSource(projectId: string, file: File) {
    const formData = new FormData();
    formData.set("file", file);
    const response = await fetch(`/api/projects/${projectId}/source`, {
      method: "POST",
      body: formData
    });
    const body = await response.json();
    setMessage(response.ok ? "Drawing uploaded." : body.error);
  }

  return (
    <main>
      <header>
        <h1>kidAR Studio</h1>
        <p>
          {quota.used} / {quota.limit} projects used · {quota.plan} plan
        </p>
      </header>

      <section aria-labelledby="new-project">
        <h2 id="new-project">New project</h2>
        <form onSubmit={createProject}>
          <input
            aria-label="Project name"
            placeholder="Project name"
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
          <button disabled={creating || !quota.canCreate}>
            {quota.canCreate ? "Create project" : "Upgrade to create more"}
          </button>
        </form>
      </section>

      {message && <p role="status">{message}</p>}

      <section aria-label="Projects">
        {projects.map((project) => (
          <ProjectCard
            key={project.id}
            project={project}
            onRename={renameProject}
            onDelete={deleteProject}
            onUpload={uploadSource}
          />
        ))}
        {!projects.length && <p>No projects yet. Create your first drawing experience.</p>}
      </section>
    </main>
  );
}

function ProjectCard({
  project,
  onRename,
  onDelete,
  onUpload
}: {
  project: DashboardProject;
  onRename: (id: string, name: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onUpload: (id: string, file: File) => Promise<void>;
}) {
  const [name, setName] = useState(project.name);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (name === project.name) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => void onRename(project.id, name), 500);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [name, onRename, project.id, project.name]);

  return (
    <article>
      <input aria-label={`Rename ${project.name}`} value={name} onChange={(event) => setName(event.target.value)} />
      <p>/{project.slug}</p>
      <p>Status: {project.status}</p>
      <Link href={`/studio/${project.id}`}>Open studio</Link>
      <label>
        Source drawing
        <input
          type="file"
          accept="image/png,image/jpeg"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void onUpload(project.id, file);
          }}
        />
      </label>
      <button onClick={() => void onDelete(project.id)}>Delete</button>
    </article>
  );
}
