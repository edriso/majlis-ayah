import { createContext, useContext } from 'react';
import type { Photos } from '@/halaqa/state';

/** The reader's choice of how reciters' photographs appear, for every face
    the app draws: the lists, the circle, the reciter's button. */
export const PhotosContext = createContext<Photos>('show');

export const usePhotos = () => useContext(PhotosContext);
