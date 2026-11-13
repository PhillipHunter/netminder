import {
    useEffect,
    useRef
} from 'react';

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    children: React.ReactNode;
}

export const Modal = ({ isOpen, onClose, title, children }: ModalProps) => {
    const overlayRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose();
            }
        };

        if (isOpen) {
            document.addEventListener('keydown', handleEscape);
            document.body.style.overflow = 'hidden';
        }

        return () => {
            document.removeEventListener('keydown', handleEscape);
            document.body.style.overflow = 'unset';
        };
    }, [isOpen, onClose]);

    if (!isOpen)
        return null;

    const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
        if (e.target === overlayRef.current) {
            onClose();
        }
    };

    return (
        <div
            ref={overlayRef}
            className='fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 backdrop-blur-md'
            onClick={handleOverlayClick}
            role='dialog'
            aria-modal='true'
            aria-labelledby='modal-title'
        >
            <div className='relative w-full max-w-md rounded-2xl border border-slate-700/50 bg-gradient-to-b from-slate-800/90 to-slate-900/90 p-6 shadow-2xl shadow-black/50 backdrop-blur-xl animate-in fade-in zoom-in-95 duration-200'>
                <div className='absolute -top-px left-1/2 h-px w-1/2 -translate-x-1/2 bg-gradient-to-r from-transparent via-indigo-400/50 to-transparent' />
                <div className='mb-4 flex items-center justify-between'>
                    <h2 id='modal-title' className='text-xl font-semibold bg-gradient-to-r from-slate-100 to-slate-300 bg-clip-text text-transparent'>
                        {title}
                    </h2>
                    <button
                        onClick={onClose}
                        className='rounded-lg p-1 text-slate-400 transition-colors hover:bg-slate-700/50 hover:text-slate-100'
                        aria-label='Close modal'
                    >
                        <svg
                            className='h-5 w-5'
                            fill='none'
                            stroke='currentColor'
                            viewBox='0 0 24 24'
                            xmlns='http://www.w3.org/2000/svg'
                        >
                            <path
                                strokeLinecap='round'
                                strokeLinejoin='round'
                                strokeWidth={2}
                                d='M6 18L18 6M6 6l12 12'
                            />
                        </svg>
                    </button>
                </div>
                <div className='text-slate-300'>{children}</div>
            </div>
        </div>
    );
};