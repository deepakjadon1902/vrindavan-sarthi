import { useEffect, useState, type ImgHTMLAttributes } from 'react';

type OptimizedImageProps = Omit<ImgHTMLAttributes<HTMLImageElement>, 'src' | 'loading'> & {
  src?: string | null;
  webpSrc?: string | null;
  fallbackSrc?: string;
  loading?: 'eager' | 'lazy';
  pictureClassName?: string;
  fetchPriority?: 'high' | 'low' | 'auto';
  fetchpriority?: 'high' | 'low' | 'auto';
};

const OptimizedImage = ({
  src,
  webpSrc,
  fallbackSrc = '/placeholder.svg',
  alt,
  loading = 'lazy',
  decoding = 'async',
  sizes = '100vw',
  pictureClassName,
  onError,
  fetchPriority,
  fetchpriority,
  ...props
}: OptimizedImageProps) => {
  const [currentSrc, setCurrentSrc] = useState(src || fallbackSrc);
  const usableWebp = webpSrc && webpSrc !== currentSrc ? webpSrc : undefined;
  const priority = fetchpriority || fetchPriority;

  useEffect(() => {
    setCurrentSrc(src || fallbackSrc);
  }, [fallbackSrc, src]);

  return (
    <picture className={pictureClassName}>
      {usableWebp ? <source srcSet={usableWebp} type="image/webp" sizes={sizes} /> : null}
      <img
        {...props}
        src={currentSrc}
        alt={alt || ''}
        loading={loading}
        decoding={decoding}
        sizes={sizes}
        {...(priority ? ({ fetchpriority: priority } as any) : {})}
        onError={(event) => {
          if (currentSrc !== fallbackSrc) setCurrentSrc(fallbackSrc);
          onError?.(event);
        }}
      />
    </picture>
  );
};

export default OptimizedImage;
