"use client";
import React, { createContext, useMemo } from "react";

export const BackButtonContext = createContext({ hideChildrenBackButtons: false });

export function BackButtonProvider({ children, hideChildrenBackButtons = false }) {
  const value = useMemo(() => ({ hideChildrenBackButtons }), [hideChildrenBackButtons]);
  return (
    <BackButtonContext.Provider value={value}>{children}</BackButtonContext.Provider>
  );
}
