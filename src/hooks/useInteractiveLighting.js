import { useEffect } from 'react';

const INTERACTIVE_SELECTOR = [
  'button:not([data-interactive="off"])',
  'input:not([type="file"]):not([type="hidden"]):not([data-interactive="off"])',
  'textarea:not([data-interactive="off"])',
  'select:not([data-interactive="off"])',
  '[data-interactive]:not([data-interactive="off"])',
].join(',');

const getInteractiveTarget = (target) => {
  if (!(target instanceof Element)) return null;
  const interactiveElement = target.closest(INTERACTIVE_SELECTOR);
  if (!interactiveElement || interactiveElement.matches(':disabled, [aria-disabled="true"]')) return null;
  return interactiveElement;
};

export const useInteractiveLighting = () => {
  useEffect(() => {
    let activeElement = null;
    let animationFrame = null;
    let pendingPosition = null;

    const setPosition = (element, clientX, clientY) => {
      const rect = element.getBoundingClientRect();
      const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
      const y = Math.max(0, Math.min(clientY - rect.top, rect.height));

      element.style.setProperty('--pointer-x', `${x}px`);
      element.style.setProperty('--pointer-y', `${y}px`);
    };

    const flushPosition = () => {
      animationFrame = null;
      if (!pendingPosition?.element?.isConnected) return;
      setPosition(pendingPosition.element, pendingPosition.clientX, pendingPosition.clientY);
    };

    const activate = (element, clientX, clientY) => {
      if (!element) return;

      if (activeElement !== element) {
        activeElement?.classList.remove('is-pointer-active');
        activeElement = element;
        activeElement.classList.add('is-pointer-active');
      }

      pendingPosition = { element, clientX, clientY };
      if (animationFrame === null) {
        animationFrame = requestAnimationFrame(flushPosition);
      }
    };

    const centerKeyboardLight = (element) => {
      const rect = element.getBoundingClientRect();
      element.style.setProperty('--pointer-x', `${rect.width / 2}px`);
      element.style.setProperty('--pointer-y', `${rect.height / 2}px`);
      element.classList.add('is-keyboard-focus');
    };

    const deactivate = (element = activeElement) => {
      if (!element) return;
      element.classList.remove('is-pointer-active');
      if (element === activeElement) activeElement = null;
    };

    const handlePointerMove = (event) => {
      activate(getInteractiveTarget(event.target), event.clientX, event.clientY);
    };

    const handlePointerOver = (event) => {
      activate(getInteractiveTarget(event.target), event.clientX, event.clientY);
    };

    const handlePointerDown = (event) => {
      activate(getInteractiveTarget(event.target), event.clientX, event.clientY);
    };

    const handlePointerOut = (event) => {
      if (!activeElement) return;
      const nextTarget = event.relatedTarget;
      if (!(nextTarget instanceof Node) || !activeElement.contains(nextTarget)) {
        deactivate();
      }
    };

    const handlePointerEnd = (event) => {
      if (event.pointerType !== 'mouse') deactivate();
    };

    const handleFocusIn = (event) => {
      const element = getInteractiveTarget(event.target);
      if (element) centerKeyboardLight(element);
    };

    const handleFocusOut = (event) => {
      const element = getInteractiveTarget(event.target);
      element?.classList.remove('is-keyboard-focus');
    };

    document.addEventListener('pointerover', handlePointerOver, { passive: true });
    document.addEventListener('pointerdown', handlePointerDown, { passive: true });
    document.addEventListener('pointermove', handlePointerMove, { passive: true });
    document.addEventListener('pointerout', handlePointerOut, { passive: true });
    document.addEventListener('pointerup', handlePointerEnd, { passive: true });
    document.addEventListener('pointercancel', handlePointerEnd, { passive: true });
    document.addEventListener('focusin', handleFocusIn);
    document.addEventListener('focusout', handleFocusOut);

    return () => {
      if (animationFrame !== null) cancelAnimationFrame(animationFrame);
      document.removeEventListener('pointerover', handlePointerOver);
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('pointermove', handlePointerMove);
      document.removeEventListener('pointerout', handlePointerOut);
      document.removeEventListener('pointerup', handlePointerEnd);
      document.removeEventListener('pointercancel', handlePointerEnd);
      document.removeEventListener('focusin', handleFocusIn);
      document.removeEventListener('focusout', handleFocusOut);
    };
  }, []);
};
