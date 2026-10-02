'use client';
import { createContext, useContext, type ReactNode } from 'react';

const Ctx = createContext<string | null>(null);
/** Tells client components who is signed in, so on-device data is scoped to that user. */
export const OfflineProvider = ({ userId, children }: { userId: string; children: ReactNode }) => <Ctx.Provider value={userId}>{children}</Ctx.Provider>;
export const useOfflineUser = () => useContext(Ctx);
