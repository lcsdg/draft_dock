import { defineStore } from "pinia";
import { ref } from "vue";
import type { SaveStatus } from "@/types";

export const useUiStore = defineStore("ui", () => {
  const sidebarWidth = ref(240);
  const saveStatus = ref<SaveStatus>("saved");
  const theme = ref<"dark" | "light">("dark");
  const showSearch = ref(false);
  const showVariableFill = ref(false);
  const showConfirmDialog = ref(false);
  const confirmDialogConfig = ref<{
    title: string;
    message: string;
    danger?: boolean;
    resolve?: (confirmed: boolean) => void;
  } | null>(null);

  function setSaveStatus(status: SaveStatus) {
    saveStatus.value = status;
  }

  function toggleTheme() {
    theme.value = theme.value === "dark" ? "light" : "dark";
    applyTheme();
  }

  function applyTheme() {
    document.documentElement.setAttribute("data-theme", theme.value);
  }

  function setTheme(t: "dark" | "light") {
    theme.value = t;
    applyTheme();
  }

  function openConfirmDialog(
    title: string,
    message: string,
    danger = false,
  ): Promise<boolean> {
    return new Promise((resolve) => {
      confirmDialogConfig.value = { title, message, danger, resolve };
      showConfirmDialog.value = true;
    });
  }

  function closeConfirmDialog(confirmed: boolean) {
    confirmDialogConfig.value?.resolve?.(confirmed);
    showConfirmDialog.value = false;
    confirmDialogConfig.value = null;
  }

  return {
    sidebarWidth,
    saveStatus,
    theme,
    showSearch,
    showVariableFill,
    showConfirmDialog,
    confirmDialogConfig,
    setSaveStatus,
    toggleTheme,
    applyTheme,
    setTheme,
    openConfirmDialog,
    closeConfirmDialog,
  };
});
