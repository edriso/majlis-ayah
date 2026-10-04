import type { Reciter } from '@/data/reciters';

/** A reciter's photo, or his initial where no freely licensed photo exists.
    Decorative: his name is always written beside it. */
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
      {reciter.photo ? (
        <img
          src={`${import.meta.env.BASE_URL}reciters/${reciter.photo}`}
          alt=""
          width={size}
          height={size}
          loading="lazy"
          decoding="async"
        />
      ) : (
        <span className="reciter-initial">
          {reciter.short.replace(/^ال/, '').at(0)}
        </span>
      )}
    </span>
  );
}
