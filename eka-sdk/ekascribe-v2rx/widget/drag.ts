export function enableDrag(
  widget: HTMLElement,
  handle: HTMLElement
): () => void {
  let offsetX = 0;
  let offsetY = 0;
  let isDragging = false;

  function onPointerDown(e: MouseEvent | TouchEvent): void {
    isDragging = true;
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    const rect = widget.getBoundingClientRect();
    offsetX = clientX - rect.left;
    offsetY = clientY - rect.top;

    // Switch from bottom/right positioning to top/left for drag
    widget.style.bottom = 'auto';
    widget.style.right = 'auto';
    widget.style.left = `${rect.left}px`;
    widget.style.top = `${rect.top}px`;

    document.addEventListener('mousemove', onPointerMove);
    document.addEventListener('mouseup', onPointerUp);
    document.addEventListener('touchmove', onPointerMove, { passive: false });
    document.addEventListener('touchend', onPointerUp);

    e.preventDefault();
  }

  function onPointerMove(e: MouseEvent | TouchEvent): void {
    if (!isDragging) return;
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    const maxX = window.innerWidth - widget.offsetWidth;
    const maxY = window.innerHeight - widget.offsetHeight;

    const x = Math.min(Math.max(0, clientX - offsetX), maxX);
    const y = Math.min(Math.max(0, clientY - offsetY), maxY);

    widget.style.left = `${x}px`;
    widget.style.top = `${y}px`;

    e.preventDefault();
  }

  function onPointerUp(): void {
    isDragging = false;
    document.removeEventListener('mousemove', onPointerMove);
    document.removeEventListener('mouseup', onPointerUp);
    document.removeEventListener('touchmove', onPointerMove);
    document.removeEventListener('touchend', onPointerUp);
  }

  handle.addEventListener('mousedown', onPointerDown);
  handle.addEventListener('touchstart', onPointerDown, { passive: false });

  return () => {
    handle.removeEventListener('mousedown', onPointerDown);
    handle.removeEventListener('touchstart', onPointerDown);
    onPointerUp();
  };
}
