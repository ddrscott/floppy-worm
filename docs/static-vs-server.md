# Static vs Server Mode


Static is the standard game deployed to a static hosting service like GitHub Pages, Netlify, or Vercel. It is a single-page application (SPA) that runs entirely in the browser.

Server mode is for map editors and designers to add map data to the game and project.

## Static Mode

The terms Static mode and Game mode can be used synonymously. Static mode is the default mode of the game that
players will experience when they first load the game. It is a single-page application (SPA) that runs entirely in
the browser without any server-side rendering.

When in static mode, players will have a choice of maps/levels, see their best times, and be able to jump to any level they choose without the need to unlock them. Each level get progressively harder and teaches the mechanics of the game.

The final level is the Rage Tower that encourages speed running and forces players to start at the beginning of the level if they die. This level is designed to be nearly impossible and is meant to be played repeatedly to improve times.

When a player reaches a goal in game mode a dialog should appear with the following options:
- **Replay Level**: Reply to Improve your time.
- **Next Level**: This will take the player to the next level in the game.
- **Share Reply**: Create a share links for others to watch your replay.
- **Main Menu**: This will take the player back to the main menu where they can choose a different level or exit the
    game.

From the replay screen, players can watch it and have an options to race against the replay, which will start the level with a ghost player as an opponent.

## Server Mode

Server mode allows developers to add new maps and try them locally before releasing them in static mode.

The opening screen of server mode will show all the maps and allow players to select one to play, edit.

When playing a level: `TAB` should open the map editor, `R` should reset the level, and `Esc` should return to the map selection screen.
When in edit mode, `TAB` should play the game, `R` does nothing because they're editing, and `Esc` should cancel their last editing action if needed.

When a player reaches a goal in server mode, a dialog should appear with the following options:
- **Replay Level**: Reply to Improve your time.
- **Return to Editor**: This will take the player back to the map editor where they can continue editing the map.
- **Return to Map Selection**: This will take the player back to the map selection screen where they can choose a different map to play or edit.

