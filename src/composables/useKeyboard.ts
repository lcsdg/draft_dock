import { onMounted, onUnmounted } from "vue";
import { useUiStore } from "@/stores/ui";

export function useKeyboard() {
  const uiStore = useUiStore();

  function handleKeydown(e: KeyboardEvent) {
    const mod = e.metaKey || e.ctrlKey;

    // Cmd+W: Close current modal (prevent default only if modal is open)
    if (mod && e.key === "w" && !e.shiftKey) {
      if (uiStore.showSearch) {
        e.preventDefault();
        uiStore.showSearch = false;
        return;
      }
      if (uiStore.showVariableFill) {
        e.preventDefault();
        uiStore.showVariableFill = false;
        return;
      }
      // Don't prevent default for Cmd+W when no modal is open
      return;
    }

    // Cmd+F: Search
    if (mod && e.key === "f" && !e.shiftKey) {
      // Don't intercept when focus is in editor (CodeMirror has its own search)
      const activeEl = document.activeElement;
      if (activeEl && (activeEl.tagName === "INPUT" || activeEl.tagName === "TEXTAREA")) {
        return;
      }
      e.preventDefault();
      uiStore.showSearch = true;
      return;
    }

    // Cmd+Shift+F: Variable fill
    if (mod && e.shiftKey && e.key === "F") {
      e.preventDefault();
      uiStore.showVariableFill = true;
      return;
    }

    // Cmd+Shift+N: New project
    if (mod && e.shiftKey && e.key === "N") {
      e.preventDefault();
      // Trigger new project - this is handled by the sidebar component
      document.dispatchEvent(new CustomEvent("draftdock:new-project"));
      return;
    }

    // Cmd+N: New document (only when a project is selected, not intercepted by editor)
    if (mod && e.key === "n" && !e.shiftKey) {
      const activeEl = document.activeElement;
      if (activeEl && activeEl.closest(".cm-editor, .cm-content")) {
        return; // Don't intercept when in editor
      }
      e.preventDefault();
      document.dispatchEvent(new CustomEvent("draftdock:new-document"));
      return;
    }

    // Escape: Close modals
    if (e.key === "Escape") {
      if (uiStore.showSearch) {
        uiStore.showSearch = false;
        return;
      }
      if (uiStore.showVariableFill) {
        uiStore.showVariableFill = false;
        return;
      }
    }
  }

  onMounted(() => {
    document.addEventListener("keydown", handleKeydown);
  });

  onUnmounted(() => {
    document.removeEventListener("keydown", handleKeydown);
  });
}
