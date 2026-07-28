import { useEffect } from 'react';

const INTERACTIVE_SELECTOR = [
  'button:not([data-interactive="off"])',
  'input:not([type="file"]):not([type="hidden"]):not([data-interactive="off"])',
  'textarea:not([data-interactive="off"])',
  'select:not([data-interactive="off"])',
  'a[href]:not([data-interactive="off"])',
  '[role="button"]:not([data-interactive="off"])',
  '.cursor-pointer:not([data-interactive="off"])',
  '[data-interactive]:not([data-interactive="off"])',
].join(',');

const GLOW_COLORS = {
  primary: '96, 165, 250',
  purple: '192, 132, 252',
  success: '74, 222, 128',
  danger: '248, 113, 113',
  neutral: '125, 211, 252',
  subtle: '255, 255, 255',
};

const GLOW_SIZES = {
  control: { radius: 140, centerAlpha: 0.34, middleAlpha: 0.1 },
  card: { radius: 210, centerAlpha: 0.18, middleAlpha: 0.05 },
  panel: { radius: 370, centerAlpha: 0.12, middleAlpha: 0.035 },
};

const getInteractiveTarget = (target) => {
  if (!(target instanceof Element)) return null;
  const interactiveElement = target.closest(INTERACTIVE_SELECTOR);
  if (!interactiveElement || interactiveElement.matches(':disabled, [aria-disabled="true"]')) return null;
  if (
    !interactiveElement.hasAttribute('data-interactive')
    && !interactiveElement.matches('button, input, textarea, select')
  ) {
    interactiveElement.dataset.interactive = 'runtime';
  }
  return interactiveElement;
};

export const useInteractiveLighting = () => {
  useEffect(() => {
    let activeElement = null;
    let keyboardFocusElement = null;
    let keyboardNavigation = false;
    let animationFrame = null;
    let pendingPosition = null;

    const setPosition = (element, clientX, clientY) => {
      const rect = element.getBoundingClientRect();
      const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
      const y = Math.max(0, Math.min(clientY - rect.top, rect.height));
      const xPercent = rect.width > 0 ? (x / rect.width) * 100 : 50;
      const yPercent = rect.height > 0 ? (y / rect.height) * 100 : 50;
      const glowColor = GLOW_COLORS[element.dataset.glow] || GLOW_COLORS.primary;
      const inferredSize = rect.width >= 180 && rect.height >= 90 ? 'card' : 'control';
      const glowSize = GLOW_SIZES[element.dataset.interactiveSize || inferredSize] || GLOW_SIZES.control;
      const gradient = [
        `radial-gradient(circle ${glowSize.radius}px at ${x}px ${y}px`,
        `rgba(${glowColor}, ${glowSize.centerAlpha}) 0%`,
        `rgba(${glowColor}, ${glowSize.middleAlpha}) 38%`,
        'rgba(255, 255, 255, 0.015) 58%',
        'transparent 76%)',
      ].join(', ');

      element.style.setProperty('--interactive-light-gradient', gradient);
      element.style.setProperty('--glass-x', `${xPercent}%`);
      element.style.setProperty('--glass-y', `${yPercent}%`);
      element.style.setProperty('--glass-shift-x', `${(xPercent - 50) * 0.035}px`);
      element.style.setProperty('--glass-shift-y', `${(yPercent - 50) * 0.035}px`);
    };

    const clearPosition = (element) => {
      element.style.removeProperty('--interactive-light-gradient');
      element.style.removeProperty('--glass-x');
      element.style.removeProperty('--glass-y');
      element.style.removeProperty('--glass-shift-x');
      element.style.removeProperty('--glass-shift-y');
    };

    const flushPosition = () => {
      animationFrame = null;
      if (!pendingPosition?.element?.isConnected) return;
      setPosition(pendingPosition.element, pendingPosition.clientX, pendingPosition.clientY);
    };

    const activate = (element, clientX, clientY) => {
      if (!element) {
        if (activeElement) {
          activeElement.classList.remove('is-pointer-active');
          clearPosition(activeElement);
          activeElement = null;
        }
        pendingPosition = null;
        return;
      }

      if (activeElement !== element) {
        if (activeElement) {
          activeElement.classList.remove('is-pointer-active');
          if (!activeElement.classList.contains('is-keyboard-focus')) {
            clearPosition(activeElement);
          }
        }
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
      setPosition(element, rect.left + rect.width / 2, rect.top + rect.height / 2);
      element.classList.add('is-keyboard-focus');
      keyboardFocusElement = element;
    };

    const deactivate = (element = activeElement) => {
      if (!element) return;
      element.classList.remove('is-pointer-active');
      if (!element.classList.contains('is-keyboard-focus')) {
        clearPosition(element);
      }
      if (element === activeElement) {
        activeElement = null;
        pendingPosition = null;
      }
    };

    const clearKeyboardFocus = () => {
      if (!keyboardFocusElement) return;
      keyboardFocusElement.classList.remove('is-keyboard-focus');
      if (keyboardFocusElement !== activeElement) {
        clearPosition(keyboardFocusElement);
      }
      keyboardFocusElement = null;
    };

    const switchToPointerInput = () => {
      keyboardNavigation = false;
      clearKeyboardFocus();
    };

    const handlePointerMove = (event) => {
      switchToPointerInput();
      const element = getInteractiveTarget(event.target);
      if (element) activate(element, event.clientX, event.clientY);
      else deactivate();
    };

    const handlePointerOver = (event) => {
      switchToPointerInput();
      const element = getInteractiveTarget(event.target);
      if (element) activate(element, event.clientX, event.clientY);
      else deactivate();
    };

    const handlePointerDown = (event) => {
      switchToPointerInput();
      const element = getInteractiveTarget(event.target);
      if (element) activate(element, event.clientX, event.clientY);
      else deactivate();
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
      if (element && keyboardNavigation) centerKeyboardLight(element);
    };

    const handleFocusOut = (event) => {
      const element = getInteractiveTarget(event.target);
      element?.classList.remove('is-keyboard-focus');
      if (element === keyboardFocusElement) keyboardFocusElement = null;
      if (element && element !== activeElement) {
        clearPosition(element);
      }
    };

    const handleKeyDown = (event) => {
      if (event.key === 'Tab') keyboardNavigation = true;
    };

    const handleWindowBlur = () => {
      deactivate();
      clearKeyboardFocus();
    };

    const handleVisibilityChange = () => {
      if (document.hidden) handleWindowBlur();
    };

    document.addEventListener('pointerover', handlePointerOver, { passive: true });
    document.addEventListener('pointerdown', handlePointerDown, { passive: true });
    document.addEventListener('pointermove', handlePointerMove, { passive: true });
    document.addEventListener('pointerout', handlePointerOut, { passive: true });
    document.addEventListener('pointerup', handlePointerEnd, { passive: true });
    document.addEventListener('pointercancel', handlePointerEnd, { passive: true });
    document.addEventListener('focusin', handleFocusIn);
    document.addEventListener('focusout', handleFocusOut);
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleWindowBlur);

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
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleWindowBlur);
    };
  }, []);
};
