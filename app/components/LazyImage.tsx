import { useEffect, useRef, useState } from 'react';

interface LazyImageProps {
    src: string;
    alt: string;
    className?: string;
    placeholder?: string;
}

export function LazyImage({ src, alt, className, placeholder }: LazyImageProps) {
    const [imageSrc, setImageSrc] = useState<string | undefined>(placeholder);
    const [imageRef, setImageRef] = useState<HTMLImageElement | null>(null);
    const [isInView, setIsInView] = useState(false);

    useEffect(() => {
        if (!imageRef) return;

        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        setIsInView(true);
                        observer.unobserve(entry.target);
                    }
                });
            },
            {
                // Start loading when image is 100px away from viewport
                rootMargin: '100px',
                threshold: 0.01
            }
        );

        observer.observe(imageRef);

        return () => {
            if (imageRef) {
                observer.unobserve(imageRef);
            }
        };
    }, [imageRef]);

    useEffect(() => {
        if (isInView && src) {
            setImageSrc(src);
        }
    }, [isInView, src]);

    return (
        <img
            ref={setImageRef}
            src={imageSrc}
            alt={alt}
            className={className}
            loading="lazy"
            style={{
                backgroundColor: imageSrc ? 'transparent' : '#1f2937',
                minHeight: imageSrc ? 'auto' : '200px'
            }}
        />
    );
}