import {
    useLayoutEffect,
    useRef,
    useState,
    type CSSProperties,
    type ReactNode
} from 'react';

interface StickyOnScrollProps {
    children: ReactNode;
    className?: string;
    contentClassName?: string;
    stuckClassName?: string;
    style?: CSSProperties;
    contentStyle?: CSSProperties;
    top?: number;
    zIndex?: number;
}

function joinClassNames(...values: (string | undefined)[]): string {
    return values.filter(Boolean).join(' ');
}

export function StickyOnScroll({
    children,
    className,
    contentClassName,
    stuckClassName,
    style,
    contentStyle,
    top = 0,
    zIndex = 30
}: StickyOnScrollProps) {
    const [isStuck, setIsStuck] = useState(false);
    const [metrics, setMetrics] = useState<{ width: number; left: number; height: number }>({
        width: 0,
        left: 0,
        height: 0
    });

    const containerRef = useRef<HTMLDivElement>(null);
    const contentRef = useRef<HTMLDivElement>(null);
    const frameRef = useRef<number>();

    useLayoutEffect(() => {
        const container = containerRef.current;
        const content = contentRef.current;

        if (!container || !content || typeof window === 'undefined') {
            return;
        }

        const updateMetrics = () => {
            const rect = container.getBoundingClientRect();
            const next = {
                width: rect.width,
                left: rect.left,
                height: content.offsetHeight
            };

            setMetrics((prev) => {
                if (
                    prev.width === next.width
                    && prev.left === next.left
                    && prev.height === next.height
                ) {
                    return prev;
                }

                return next;
            });
        };

        const updateStickiness = () => {
            const rect = container.getBoundingClientRect();
            const shouldStick = rect.top <= top;
            setIsStuck(prev => (prev === shouldStick ? prev : shouldStick));
        };

        const requestUpdate = () => {
            if (frameRef.current) {
                return;
            }

            frameRef.current = window.requestAnimationFrame(() => {
                frameRef.current = undefined;
                updateMetrics();
                updateStickiness();
            });
        };

        updateMetrics();
        updateStickiness();

        window.addEventListener('scroll', requestUpdate, { passive: true });
        window.addEventListener('resize', requestUpdate);

        const resizeObserver = typeof ResizeObserver !== 'undefined'
            ? new ResizeObserver(requestUpdate)
            : undefined;

        if (resizeObserver) {
            resizeObserver.observe(container);
            resizeObserver.observe(content);
        }

        return () => {
            window.removeEventListener('scroll', requestUpdate);
            window.removeEventListener('resize', requestUpdate);
            if (resizeObserver) {
                resizeObserver.disconnect();
            }
            if (frameRef.current) {
                window.cancelAnimationFrame(frameRef.current);
                frameRef.current = undefined;
            }
        };
    }, [top]);

    const stickyTop = `${top}px`;
    const outerClassName = joinClassNames('relative', className);
    const innerClassName = joinClassNames(
        'transition-shadow duration-200',
        contentClassName,
        isStuck ? stuckClassName : undefined
    );

    const stickyStyle: CSSProperties = isStuck
        ? {
            position: 'fixed',
            top: stickyTop,
            left: metrics.left,
            width: metrics.width,
            zIndex,
            ...contentStyle
        }
        : {
            position: 'relative',
            zIndex,
            ...contentStyle
        };

    return (
        <div
            ref={containerRef}
            className={outerClassName}
            style={{
                ...style,
                minHeight: isStuck ? metrics.height : undefined
            }}
        >
            <div
                ref={contentRef}
                className={innerClassName}
                style={stickyStyle}
                data-stuck={isStuck}
            >
                {children}
            </div>
        </div>
    );
}