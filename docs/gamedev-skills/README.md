# Game development guides used in v0.4

Selected from the user-supplied `awesome-gamedev-agent-skills-main.zip`. These are development guides, not runtime game assets or executable dependencies. Unmodified source guides and their references are retained here with the original Apache-2.0 LICENSE and NOTICE. No archive install scripts were executed.

- [game-ui-ux](game-ui-ux/SKILL.md): separate arena and command dock rows, safe-area insets, constrained landscape layouts, modal character creation, and touch targets of at least 44 CSS pixels in the landscape dock.
- [game-feel](game-feel/SKILL.md): anticipation, distinct body poses, class-specific strikes, hit reactions, layered effects, recovery, and a reduced-motion option. Visual animation stays separate from combat state.
- [rpg](rpg/SKILL.md): data-driven classes/races, derived combat stats, weighted lineage rolls with disclosed odds, ability mastery, secondary-class effects, and progression tests.

The implementation remains Phaser + TypeScript. Engine-neutral principles were adapted; Godot/Unity examples were not installed as game code. UI viewport tests, combat rules, migration, and real browser command tests document the implemented subset.
