import type { Reciter } from '@/data/reciters';
import { usePhotos } from './photos';

/** A reciter's photo in a round frame, or his initial where no freely
    licensed photo exists or the reader has photos hidden. Decorative: his
    name is always written beside it. */
export function ReciterAvatar({
  reciter,
  size = 44,
}: {
  reciter: Reciter;
  size?: number;
}) {
  return (
    <span
      className="reciter-avatar"
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <ReciterFace reciter={reciter} />
    </span>
  );
}

/**
 * What fills a reciter's frame, as the reader chose: his photo, his photo
 * blurred past recognition, or his initial. A hidden photo is not fetched
 * at all, rather than fetched and covered.
 */
export function ReciterFace({
  reciter,
  initialClass = 'reciter-initial',
}: {
  reciter: Reciter;
  initialClass?: string;
}) {
  const photos = usePhotos();
  if (!reciter.photo || photos === 'hide')
    return (
      <span className={initialClass} aria-hidden="true">
        {reciter.short.replace(/^ال/, '').at(0)}
      </span>
    );
  return (
    <img
      className="reciter-photo"
      data-blur={photos === 'blur' || undefined}
      src={`${import.meta.env.BASE_URL}reciters/${reciter.photo}`}
      alt=""
      loading="lazy"
      decoding="async"
    />
  );
}
