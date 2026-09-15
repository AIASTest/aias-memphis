(() => {
  const repeatButton = document.getElementById('shape-repeat');
  const groundButton = document.getElementById('shape-ground');
  const duplicateButton = document.getElementById('shape-duplicate');
  const status = document.getElementById('studio-status');

  if (repeatButton && duplicateButton) {
    const syncRepeatState = () => {
      repeatButton.disabled = duplicateButton.disabled;
      repeatButton.setAttribute('aria-disabled', String(duplicateButton.disabled));
    };

    syncRepeatState();
    new MutationObserver(syncRepeatState).observe(duplicateButton, { attributes: true, attributeFilter: ['disabled'] });

    repeatButton.addEventListener('click', () => {
      if (repeatButton.disabled || duplicateButton.disabled) return;
      let count = 0;
      const repeat = () => {
        if (count >= 3 || duplicateButton.disabled) {
          if (status && count) status.textContent = `Repeated the selected part ${count} time${count === 1 ? '' : 's'}.`;
          return;
        }
        duplicateButton.click();
        count += 1;
        requestAnimationFrame(repeat);
      };
      repeat();
    });
  }

  // Baseline positioning needs access to transformed designer geometry.
  // Keep the unfinished control out of the public UI rather than exposing a
  // button that could behave unpredictably for rotated parts.
  if (groundButton) groundButton.hidden = true;
})();
