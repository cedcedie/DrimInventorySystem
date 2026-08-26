"use client";

/** Returns an EntityModal `confirmClose` — prompts before discarding an
 * edited form. `isDirty` should be false whenever the form matches its
 * just-opened state (empty for a create form, the original record for an
 * edit form), so opening/closing without typing anything never prompts.
 *
 * Only 5 of 17 modals had this before it was pulled out — every
 * multi-field data-entry modal should use it, not just the ones that
 * happened to get it first. */
export function useUnsavedChangesGuard(
  isDirty: boolean,
  message = "Discard your changes? This can't be undone."
) {
  return () => {
    if (!isDirty) return true;
    return window.confirm(message);
  };
}
