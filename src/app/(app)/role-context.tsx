"use client";

import { createContext, useContext } from "react";

// Whether the current member may make changes (owner/editor = yes, viewer = no).
// Provided once by the shell; read anywhere under it.
const CanEditContext = createContext(true);

export function RoleProvider({ canEdit, children }: { canEdit: boolean; children: React.ReactNode }) {
  return <CanEditContext.Provider value={canEdit}>{children}</CanEditContext.Provider>;
}

export function useCanEdit(): boolean {
  return useContext(CanEditContext);
}

// Wrap any editable region. For viewers it renders a disabled <fieldset> — which
// natively disables every descendant input/select/textarea/button — laid out as
// `display:contents` so it doesn't affect layout. Navigation via <a>/<Link> and
// non-form click targets still work, so keep in-page nav OUTSIDE this wrapper.
export function ReadOnly({ children, className }: { children: React.ReactNode; className?: string }) {
  const canEdit = useCanEdit();
  if (canEdit) return <>{children}</>;
  return (
    <fieldset disabled className={className} style={{ display: "contents" }}>
      {children}
    </fieldset>
  );
}
