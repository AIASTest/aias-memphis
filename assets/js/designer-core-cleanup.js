(() => {
  'use strict';

  const removeById = id => document.getElementById(id)?.remove();

  // The structured game layer owns briefs, timed builds, progression, and completion.
  // Retire the superseded novelty controls created by the older editor core before
  // the current game UI is installed. Keep only editing actions that affect the design.
  [
    'name-building',
    'sprint-toggle',
    'shape-repeat',
    'designer-badges',
    'new-challenge',
    'surprise-building'
  ].forEach(removeById);

  const vibe = document.getElementById('stat-vibe');
  vibe?.closest('div')?.remove();

  const legacyActions = document.querySelector('.designer-challenge-actions');
  if (legacyActions && !legacyActions.children.length) legacyActions.remove();
})();
