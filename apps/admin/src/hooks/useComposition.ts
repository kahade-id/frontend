import { useState, useCallback } from 'react';

/**
 * useComposition — handles IME composition events (CJK/Indonesian input).
 * Used by Input and Textarea to suppress onChange during composition.
 */
export function useComposition() {
 const [isComposing, setIsComposing] = useState(false);

 const onCompositionStart = useCallback(() => {
 setIsComposing(true);
 }, []);

 const onCompositionEnd = useCallback(() => {
 setIsComposing(false);
 }, []);

 return { isComposing, onCompositionStart, onCompositionEnd };
}
