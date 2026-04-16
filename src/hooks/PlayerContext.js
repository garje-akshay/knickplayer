import { createContext, useContext } from 'react';

export const PlayerContext = createContext(null);
export const usePlayerContext = () => useContext(PlayerContext);
