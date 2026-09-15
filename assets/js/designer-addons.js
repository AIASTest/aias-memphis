(() => {
  const repeatButton = document.getElementById('shape-repeat');
  const groundButton = document.getElementById('shape-ground');
  const duplicateButton = document.getElementById('shape-duplicate');
  const status = document.getElementById('studio-status');

  if (repeatButton && duplicateButton) {
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

  // Ground positioning needs access to the designer's internal transformed geometry.
  // Keep the unfinished control out of the public UI rather than exposing a button
  // that could behave unpredictably for rotated parts.
  if (groundButton) groundButton.hidden = true;
})();
