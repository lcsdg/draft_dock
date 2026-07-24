import { defineStore } from "pinia";
import { ref } from "vue";
import type { Project } from "@/types";
import * as cmd from "@/lib/commands";

export const useProjectsStore = defineStore("projects", () => {
  const projects = ref<Project[]>([]);
  const selectedProjectId = ref<string | null>(null);
  const loading = ref(false);
  const error = ref<string | null>(null);

  async function loadProjects() {
    loading.value = true;
    error.value = null;
    try {
      projects.value = await cmd.listProjects();
    } catch (e) {
      error.value = `加载项目失败: ${e}`;
      console.error("Failed to load projects:", e);
    } finally {
      loading.value = false;
    }
  }

  async function addProject(name: string): Promise<Project | null> {
    try {
      const project = await cmd.createProject(name);
      projects.value.push(project);
      return project;
    } catch (e) {
      error.value = `创建项目失败: ${e}`;
      console.error("Failed to create project:", e);
    }
    return null;
  }

  async function renameProject(id: string, name: string) {
    try {
      await cmd.updateProject(id, name);
      const p = projects.value.find((p) => p.id === id);
      if (p) p.name = name;
    } catch (e) {
      error.value = `重命名失败: ${e}`;
      console.error("Failed to rename project:", e);
    }
  }

  async function removeProject(id: string) {
    try {
      await cmd.deleteProject(id);
      projects.value = projects.value.filter((p) => p.id !== id);
      if (selectedProjectId.value === id) {
        selectedProjectId.value = null;
      }
    } catch (e) {
      error.value = `删除项目失败: ${e}`;
      console.error("Failed to delete project:", e);
    }
  }

  function selectProject(id: string | null) {
    selectedProjectId.value = id;
  }

  const selectedProject = () =>
    projects.value.find((p) => p.id === selectedProjectId.value) ?? null;

  return {
    projects,
    selectedProjectId,
    loading,
    error,
    loadProjects,
    addProject,
    renameProject,
    removeProject,
    selectProject,
    selectedProject,
  };
});
